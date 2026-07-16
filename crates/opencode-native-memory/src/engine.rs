use std::collections::HashSet;
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::Path;
use std::sync::OnceLock;
use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::{Context, Result, anyhow, bail, ensure};
use fastembed::{EmbeddingModel, TextEmbedding, TextInitOptions};
use fs2::FileExt;
use serde::{Deserialize, Serialize};
use zvec_rust::{
    Collection, CollectionSchema, DataType, Doc, FieldSchema, Fts, IndexParams, MetricType,
    MultiQuery, SearchQuery, SubQuery,
};

use crate::MemoryConfig;
use crate::config::hash_hex;
use crate::model::{
    ForgetRequest, ForgetResponse, GetRequest, IndexStatus, MemoryKind, MemoryRecord,
    OptimizeResponse, SearchRequest, SearchResponse, StatusResponse, StoreRequest, StoreResponse,
};

const SCHEMA_VERSION: u32 = 1;
const EMBEDDING_DIMENSION: usize = 384;
const EMBEDDING_MODEL_NAME: &str = "intfloat/multilingual-e5-small";
const MAX_CONTENT_CHARS: usize = 6_000;
const MAX_EXCERPT_CHARS: usize = 1_600;
const MAX_QUERY_CHARS: usize = 2_000;
const MAX_TITLE_CHARS: usize = 160;
const MAX_SOURCE_CHARS: usize = 240;
const MAX_TAGS: usize = 12;
const MAX_TAG_CHARS: usize = 64;
const MAX_SEARCH_LIMIT: usize = 10;
const MAX_ID_COUNT: usize = 10;
const MAX_CANDIDATES: usize = 200;
const TOKEN_PREFIXES: [&str; 9] = [
    "ghp_",
    "github_pat_",
    "sk-proj-",
    "sk_live_",
    "sk_test_",
    "xoxb-",
    "xoxp-",
    "akia",
    "eyjhb",
];
const RESULT_FIELDS: [&str; 8] = [
    "title",
    "content",
    "kind",
    "importance",
    "tags",
    "source",
    "created_at",
    "updated_at",
];

static ZVEC_INITIALIZED: OnceLock<Result<(), String>> = OnceLock::new();

#[derive(Debug, Deserialize, Serialize)]
struct Manifest {
    schema_version: u32,
    project_root: String,
    project_id: String,
    embedding_model: String,
    embedding_dimension: usize,
    zvec_version: String,
    created_at_ms: i64,
}

pub struct MemoryEngine {
    config: MemoryConfig,
    collection: Collection,
    embedder: TextEmbedding,
    _writer_lock: File,
}

impl MemoryEngine {
    /// Open the project collection and local embedding model.
    ///
    /// # Errors
    ///
    /// Returns an error when storage cannot be locked/opened, the manifest is
    /// incompatible, or the embedding model cannot be loaded.
    pub fn open(config: MemoryConfig) -> Result<Self> {
        initialize_zvec()?;
        secure_create_dir(&config.project_data_dir())?;
        secure_create_dir(config.model_cache())?;

        let writer_lock = acquire_writer_lock(&config.project_data_dir())?;
        let collection = open_collection(&config)?;
        let embedder = TextEmbedding::try_new(
            TextInitOptions::new(EmbeddingModel::MultilingualE5Small)
                .with_cache_dir(config.model_cache().to_path_buf())
                .with_max_length(512)
                .with_show_download_progress(false),
        )
        .context("cannot initialize the multilingual local embedding model")?;

        Ok(Self {
            config,
            collection,
            embedder,
            _writer_lock: writer_lock,
        })
    }

    /// Validate, embed, deduplicate, and durably upsert one memory.
    ///
    /// # Errors
    ///
    /// Returns an error for invalid/sensitive input or a storage/inference failure.
    pub fn store(&mut self, request: StoreRequest) -> Result<StoreResponse> {
        let normalized = validate_store_request(request)?;
        let content_hash = hash_hex(normalized.content.as_bytes());
        let id_material = format!("{}\0{}", normalized.kind.as_str(), normalized.content);
        let id_hash = hash_hex(id_material.as_bytes());
        let id = format!("mem_{}", &id_hash[..32]);
        let now = now_ms()?;

        let existing =
            self.collection
                .fetch_with_options(&[id.as_str()], Some(&["created_at"]), false)?;
        let inserted = existing.is_empty();
        let created_at = existing
            .first()
            .and_then(|doc| doc.get_i64("created_at").ok().flatten())
            .unwrap_or(now);

        let search_text = build_search_text(
            &normalized.title,
            normalized.kind,
            &normalized.tags,
            &normalized.content,
        );
        let embedding = self.embed(&format!("passage: {search_text}"))?;
        let tags_json = serde_json::to_string(&normalized.tags)?;

        let mut doc = Doc::new()?;
        doc.set_pk(&id);
        doc.add_string("title", &normalized.title)?;
        doc.add_string("content", &normalized.content)?;
        doc.add_string("search_text", &search_text)?;
        doc.add_string("kind", normalized.kind.as_str())?;
        doc.add_f32("importance", normalized.importance)?;
        doc.add_string("tags", &tags_json)?;
        doc.add_string("source", &normalized.source)?;
        doc.add_string("content_hash", &content_hash)?;
        doc.add_i64("created_at", created_at)?;
        doc.add_i64("updated_at", now)?;
        doc.add_vector_f32("embedding", &embedding)?;

        let write = self.collection.upsert(&[&doc])?;
        ensure_write_succeeded("store memory", &write)?;
        self.collection.flush()?;

        Ok(StoreResponse {
            id,
            inserted,
            content_hash,
            updated_at_ms: now,
        })
    }

    /// Search with dense and full-text retrieval, then rerank bounded candidates.
    ///
    /// # Errors
    ///
    /// Returns an error for invalid input or a storage/inference failure.
    pub fn search(&mut self, request: &SearchRequest) -> Result<SearchResponse> {
        validate_search_request(request)?;
        let query_text = request.query.trim().to_string();
        let stats = self.collection.stats()?;
        if stats.doc_count == 0 {
            return Ok(SearchResponse {
                query: query_text,
                count: 0,
                memories: Vec::new(),
            });
        }

        let query_embedding = self.embed(&format!("query: {query_text}"))?;
        let candidate_count = usize::try_from(stats.doc_count)
            .unwrap_or(MAX_CANDIDATES)
            .min(MAX_CANDIDATES)
            .min(request.limit.saturating_mul(8).max(32));
        let filter = kind_filter(&request.kinds);

        let (documents, hybrid) = match self.hybrid_query(
            &query_text,
            &query_embedding,
            candidate_count,
            filter.as_deref(),
        ) {
            Ok(documents) if !documents.is_empty() => (documents, true),
            Ok(_) | Err(_) => (
                self.dense_query(&query_embedding, candidate_count, filter.as_deref())?,
                false,
            ),
        };

        let document_count = documents.len();
        let now = now_ms()?;
        let mut memories = Vec::with_capacity(document_count);
        for (rank, document) in documents.iter().enumerate() {
            let mut memory = memory_from_doc(document, false)?;
            let retrieval_score = if hybrid {
                let rank = f32::from(u16::try_from(rank)?);
                let count = f32::from(u16::try_from(document_count)?);
                1.0 - rank / (count + 1.0)
            } else {
                f32::midpoint(document.get_score(), 1.0).clamp(0.0, 1.0)
            };
            let lexical = lexical_score(&query_text, &memory.title, &memory.content, &memory.tags);
            let age_days = now.saturating_sub(memory.updated_at_ms) / 86_400_000;
            let age_days = f32::from(u16::try_from(age_days.min(i64::from(u16::MAX)))?);
            let recency = (-age_days.max(0.0) / 180.0).exp();
            let score = (0.65 * retrieval_score
                + 0.15 * lexical
                + 0.10 * memory.importance
                + 0.10 * recency)
                .clamp(0.0, 1.0);
            if score < request.min_score {
                continue;
            }
            memory.score = Some(score);
            memory.content = truncate_chars(&memory.content, MAX_EXCERPT_CHARS);
            memories.push(memory);
        }

        memories.sort_by(|left, right| {
            right
                .score
                .unwrap_or_default()
                .total_cmp(&left.score.unwrap_or_default())
                .then_with(|| right.updated_at_ms.cmp(&left.updated_at_ms))
        });
        memories.truncate(request.limit);

        Ok(SearchResponse {
            query: query_text,
            count: memories.len(),
            memories,
        })
    }

    /// Fetch complete memories in the same order as the requested IDs.
    ///
    /// # Errors
    ///
    /// Returns an error for invalid IDs, corrupt records, or a storage failure.
    pub fn get(&self, request: &GetRequest) -> Result<Vec<MemoryRecord>> {
        validate_ids(&request.ids)?;
        let id_refs: Vec<&str> = request.ids.iter().map(String::as_str).collect();
        let documents =
            self.collection
                .fetch_with_options(&id_refs, Some(&RESULT_FIELDS), false)?;
        let mut by_id = documents
            .iter()
            .map(|doc| memory_from_doc(doc, false).map(|memory| (memory.id.clone(), memory)))
            .collect::<Result<std::collections::HashMap<_, _>>>()?;

        Ok(request
            .ids
            .iter()
            .filter_map(|id| by_id.remove(id))
            .collect())
    }

    /// Permanently delete memories and flush the collection.
    ///
    /// # Errors
    ///
    /// Returns an error for invalid IDs or a storage failure.
    pub fn forget(&self, request: &ForgetRequest) -> Result<ForgetResponse> {
        validate_ids(&request.ids)?;
        let id_refs: Vec<&str> = request.ids.iter().map(String::as_str).collect();
        let write = self.collection.delete(&id_refs)?;
        ensure_write_succeeded("forget memory", &write)?;
        self.collection.flush()?;
        Ok(ForgetResponse {
            requested: request.ids.len(),
            deleted: write.success_count,
        })
    }

    /// Report collection, model, index, and project status.
    ///
    /// # Errors
    ///
    /// Returns an error when collection statistics cannot be read.
    pub fn status(&self) -> Result<StatusResponse> {
        let stats = self.collection.stats()?;
        Ok(StatusResponse {
            ready: true,
            backend: "zvec",
            zvec_version: zvec_rust::version().clone(),
            embedding_model: EMBEDDING_MODEL_NAME,
            embedding_dimension: EMBEDDING_DIMENSION,
            project_root: self.config.project_root().display().to_string(),
            project_id: self.config.project_id().to_string(),
            collection_path: self.config.collection_dir().display().to_string(),
            document_count: stats.doc_count,
            indexes: stats
                .indexes
                .into_iter()
                .map(|index| IndexStatus {
                    name: index.name,
                    completeness: index.completeness,
                })
                .collect(),
        })
    }

    /// Compact segments, rebuild indexes, and flush the collection.
    ///
    /// # Errors
    ///
    /// Returns an error when optimization, flushing, or statistics fail.
    pub fn optimize(&self) -> Result<OptimizeResponse> {
        self.collection.optimize()?;
        self.collection.flush()?;
        Ok(OptimizeResponse {
            optimized: true,
            document_count: self.collection.stats()?.doc_count,
        })
    }

    fn embed(&mut self, text: &str) -> Result<Vec<f32>> {
        let mut embeddings = self
            .embedder
            .embed([text], None)
            .context("local embedding inference failed")?;
        let embedding = embeddings
            .pop()
            .ok_or_else(|| anyhow!("embedding model returned no vector"))?;
        ensure!(
            embedding.len() == EMBEDDING_DIMENSION,
            "embedding dimension mismatch: expected {EMBEDDING_DIMENSION}, received {}",
            embedding.len()
        );
        Ok(embedding)
    }

    fn hybrid_query(
        &self,
        query_text: &str,
        embedding: &[f32],
        candidate_count: usize,
        filter: Option<&str>,
    ) -> Result<Vec<Doc>> {
        let candidates = i32::try_from(candidate_count)?;
        let mut dense = SubQuery::new()?;
        dense.set_field_name("embedding")?;
        dense.set_query_vector(embedding)?;
        dense.set_num_candidates(candidates)?;

        let mut fts = Fts::new()?;
        fts.set_match_string(query_text)?;
        let mut lexical = SubQuery::new()?;
        lexical.set_field_name("search_text")?;
        lexical.set_fts(&fts)?;
        lexical.set_num_candidates(candidates)?;

        let mut query = MultiQuery::new()?;
        query.add_sub_query(&dense)?;
        query.add_sub_query(&lexical)?;
        query.set_topk(candidates)?;
        query.set_rerank_rrf(60)?;
        query.set_output_fields(&RESULT_FIELDS)?;
        if let Some(filter) = filter {
            query.set_filter(filter)?;
        }
        Ok(self.collection.multi_query(&query)?)
    }

    fn dense_query(
        &self,
        embedding: &[f32],
        candidate_count: usize,
        filter: Option<&str>,
    ) -> Result<Vec<Doc>> {
        let mut query = SearchQuery::new("embedding", embedding, i32::try_from(candidate_count)?)?;
        query.set_output_fields(&RESULT_FIELDS)?;
        if let Some(filter) = filter {
            query.set_filter(filter)?;
        }
        Ok(self.collection.query(&query)?)
    }
}

struct NormalizedStoreRequest {
    content: String,
    title: String,
    kind: MemoryKind,
    importance: f32,
    tags: Vec<String>,
    source: String,
}

fn validate_store_request(request: StoreRequest) -> Result<NormalizedStoreRequest> {
    let content = request.content.trim().to_string();
    ensure!(!content.is_empty(), "memory content cannot be empty");
    ensure!(
        content.chars().count() <= MAX_CONTENT_CHARS,
        "memory content exceeds {MAX_CONTENT_CHARS} characters; store a distilled fact instead"
    );
    ensure!(
        !content.contains('\0'),
        "memory content cannot contain NUL bytes"
    );
    if let Some(reason) = sensitive_content_reason(&content) {
        bail!("memory rejected because it may contain {reason}; redact the value before storing");
    }

    let title = request
        .title
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map_or_else(|| infer_title(&content), ToOwned::to_owned);
    ensure!(
        title.chars().count() <= MAX_TITLE_CHARS,
        "memory title exceeds {MAX_TITLE_CHARS} characters"
    );
    ensure!(
        !title.contains('\0'),
        "memory title cannot contain NUL bytes"
    );
    ensure!(
        request.importance.is_finite() && (0.0..=1.0).contains(&request.importance),
        "importance must be between 0 and 1"
    );

    let source = request.source.unwrap_or_else(|| "agent".to_string());
    let source = source.trim().to_string();
    ensure!(
        source.chars().count() <= MAX_SOURCE_CHARS,
        "memory source exceeds {MAX_SOURCE_CHARS} characters"
    );
    ensure!(
        !source.contains('\0'),
        "memory source cannot contain NUL bytes"
    );

    let tags = normalize_tags(request.tags)?;
    Ok(NormalizedStoreRequest {
        content,
        title,
        kind: request.kind,
        importance: request.importance,
        tags,
        source,
    })
}

fn validate_search_request(request: &SearchRequest) -> Result<()> {
    let query = request.query.trim();
    ensure!(!query.is_empty(), "search query cannot be empty");
    ensure!(
        query.chars().count() <= MAX_QUERY_CHARS,
        "search query exceeds {MAX_QUERY_CHARS} characters"
    );
    ensure!(
        !query.contains('\0'),
        "search query cannot contain NUL bytes"
    );
    ensure!(
        (1..=MAX_SEARCH_LIMIT).contains(&request.limit),
        "search limit must be between 1 and {MAX_SEARCH_LIMIT}"
    );
    ensure!(
        request.min_score.is_finite() && (0.0..=1.0).contains(&request.min_score),
        "min_score must be between 0 and 1"
    );
    Ok(())
}

fn validate_ids(ids: &[String]) -> Result<()> {
    ensure!(!ids.is_empty(), "provide at least one memory id");
    ensure!(
        ids.len() <= MAX_ID_COUNT,
        "at most {MAX_ID_COUNT} memory ids are allowed"
    );
    for id in ids {
        ensure!(
            id.len() == 36
                && id.starts_with("mem_")
                && id[4..].bytes().all(|byte| byte.is_ascii_hexdigit()),
            "invalid memory id: {id}"
        );
    }
    Ok(())
}

fn normalize_tags(tags: Vec<String>) -> Result<Vec<String>> {
    ensure!(
        tags.len() <= MAX_TAGS,
        "at most {MAX_TAGS} tags are allowed"
    );
    let mut seen = HashSet::new();
    let mut normalized = Vec::new();
    for tag in tags {
        let tag = tag.trim();
        if tag.is_empty() {
            continue;
        }
        ensure!(
            tag.chars().count() <= MAX_TAG_CHARS,
            "tag exceeds {MAX_TAG_CHARS} characters: {tag}"
        );
        ensure!(!tag.contains('\0'), "tag cannot contain NUL bytes");
        let key = tag.to_lowercase();
        if seen.insert(key) {
            normalized.push(tag.to_string());
        }
    }
    Ok(normalized)
}

fn initialize_zvec() -> Result<()> {
    ZVEC_INITIALIZED
        .get_or_init(|| zvec_rust::initialize(None).map_err(|error| error.to_string()))
        .clone()
        .map_err(|error| anyhow!("cannot initialize zvec: {error}"))
}

fn open_collection(config: &MemoryConfig) -> Result<Collection> {
    let collection_path = config.collection_dir();
    let manifest_path = config.project_data_dir().join("manifest.json");
    let collection_path_text = path_text(&collection_path)?;

    if manifest_path.exists() {
        ensure!(
            collection_path.exists(),
            "memory manifest exists but the zvec collection is missing: {}",
            collection_path.display()
        );
        let manifest: Manifest = serde_json::from_str(
            &fs::read_to_string(&manifest_path)
                .with_context(|| format!("cannot read {}", manifest_path.display()))?,
        )
        .with_context(|| format!("invalid memory manifest: {}", manifest_path.display()))?;
        validate_manifest(config, &manifest)?;
        return Collection::open(&collection_path_text, None).map_err(Into::into);
    }

    ensure!(
        !collection_path.exists(),
        "zvec collection exists without a manifest: {}; move it aside or restore its manifest",
        collection_path.display()
    );
    let schema = collection_schema()?;
    let collection = Collection::create_and_open(&collection_path_text, &schema, None)?;
    let manifest = Manifest {
        schema_version: SCHEMA_VERSION,
        project_root: config.project_root().display().to_string(),
        project_id: config.project_id().to_string(),
        embedding_model: EMBEDDING_MODEL_NAME.to_string(),
        embedding_dimension: EMBEDDING_DIMENSION,
        zvec_version: zvec_rust::version().clone(),
        created_at_ms: now_ms()?,
    };
    write_manifest(&manifest_path, &manifest)?;
    Ok(collection)
}

fn collection_schema() -> Result<CollectionSchema> {
    Ok(CollectionSchema::builder("opencode_project_memory")
        .add_field(FieldSchema::new("title", DataType::String, false, 0)?)
        .add_field(FieldSchema::new("content", DataType::String, false, 0)?)
        .add_indexed_field(
            "search_text",
            DataType::String,
            IndexParams::fts(None, None, None)?,
        )
        .add_indexed_field("kind", DataType::String, IndexParams::invert(false, false)?)
        .add_field(FieldSchema::new("importance", DataType::Float, false, 0)?)
        .add_field(FieldSchema::new("tags", DataType::String, false, 0)?)
        .add_field(FieldSchema::new("source", DataType::String, false, 0)?)
        .add_indexed_field(
            "content_hash",
            DataType::String,
            IndexParams::invert(false, false)?,
        )
        .add_indexed_field(
            "created_at",
            DataType::Int64,
            IndexParams::invert(true, false)?,
        )
        .add_field(FieldSchema::new("updated_at", DataType::Int64, false, 0)?)
        .add_vector_field(
            "embedding",
            DataType::VectorFp32,
            u32::try_from(EMBEDDING_DIMENSION)?,
            IndexParams::hnsw(MetricType::Cosine, 16, 200)?,
        )
        .max_doc_count_per_segment(10_000)
        .build()?)
}

fn validate_manifest(config: &MemoryConfig, manifest: &Manifest) -> Result<()> {
    ensure!(
        manifest.schema_version == SCHEMA_VERSION,
        "unsupported memory schema version {}; expected {SCHEMA_VERSION}",
        manifest.schema_version
    );
    ensure!(
        manifest.project_id == config.project_id(),
        "memory collection belongs to a different project"
    );
    ensure!(
        manifest.embedding_model == EMBEDDING_MODEL_NAME
            && manifest.embedding_dimension == EMBEDDING_DIMENSION,
        "memory embedding model mismatch; migrate or remove the project collection"
    );
    Ok(())
}

fn write_manifest(path: &Path, manifest: &Manifest) -> Result<()> {
    let temporary = path.with_extension(format!("json.tmp-{}", std::process::id()));
    let mut file = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&temporary)
        .with_context(|| format!("cannot create {}", temporary.display()))?;
    serde_json::to_writer_pretty(&mut file, manifest)?;
    file.write_all(b"\n")?;
    file.sync_all()?;
    fs::rename(&temporary, path)
        .with_context(|| format!("cannot install memory manifest at {}", path.display()))?;
    Ok(())
}

fn acquire_writer_lock(project_dir: &Path) -> Result<File> {
    let lock_path = project_dir.join("writer.lock");
    let file = OpenOptions::new()
        .create(true)
        .truncate(false)
        .read(true)
        .write(true)
        .open(&lock_path)
        .with_context(|| format!("cannot open memory writer lock: {}", lock_path.display()))?;
    set_private_file_permissions(&file)?;
    file.try_lock_exclusive().map_err(|error| {
        anyhow!(
            "another OpenCode process already owns this project's native memory writer lock ({}): {error}",
            lock_path.display()
        )
    })?;
    Ok(file)
}

fn secure_create_dir(path: &Path) -> Result<()> {
    fs::create_dir_all(path).with_context(|| format!("cannot create {}", path.display()))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o700))?;
    }
    Ok(())
}

fn set_private_file_permissions(file: &File) -> Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        file.set_permissions(fs::Permissions::from_mode(0o600))?;
    }
    Ok(())
}

fn path_text(path: &Path) -> Result<String> {
    path.to_str()
        .map(ToOwned::to_owned)
        .ok_or_else(|| anyhow!("memory path is not valid UTF-8: {}", path.display()))
}

fn memory_from_doc(document: &Doc, truncate: bool) -> Result<MemoryRecord> {
    let id = document
        .get_pk()
        .ok_or_else(|| anyhow!("zvec result is missing its primary key"))?
        .to_string();
    let mut content = required_string(document, "content")?;
    if truncate {
        content = truncate_chars(&content, MAX_EXCERPT_CHARS);
    }
    let tags_json = required_string(document, "tags")?;
    Ok(MemoryRecord {
        id,
        title: required_string(document, "title")?,
        content,
        kind: MemoryKind::parse(&required_string(document, "kind")?)?,
        importance: document.get_f32("importance")?.unwrap_or_default(),
        tags: serde_json::from_str(&tags_json).context("invalid tags stored in memory")?,
        source: required_string(document, "source")?,
        created_at_ms: document.get_i64("created_at")?.unwrap_or_default(),
        updated_at_ms: document.get_i64("updated_at")?.unwrap_or_default(),
        score: None,
    })
}

fn required_string(document: &Doc, field: &str) -> Result<String> {
    document
        .get_string(field)?
        .ok_or_else(|| anyhow!("zvec result is missing field {field}"))
}

fn ensure_write_succeeded(operation: &str, result: &zvec_rust::WriteResult) -> Result<()> {
    if result.error_count == 0 {
        return Ok(());
    }
    let details = result
        .results
        .iter()
        .filter(|item| !item.is_success())
        .map(|item| item.message.as_str())
        .filter(|message| !message.is_empty())
        .take(3)
        .collect::<Vec<_>>()
        .join("; ");
    bail!(
        "cannot {operation}: {} document(s) failed{}{}",
        result.error_count,
        if details.is_empty() { "" } else { ": " },
        details
    )
}

fn build_search_text(title: &str, kind: MemoryKind, tags: &[String], content: &str) -> String {
    format!(
        "{title}\nkind: {}\ntags: {}\n{content}",
        kind.as_str(),
        tags.join(", ")
    )
}

fn kind_filter(kinds: &[MemoryKind]) -> Option<String> {
    if kinds.is_empty() {
        return None;
    }
    Some(
        kinds
            .iter()
            .map(|kind| format!("kind = '{}'", kind.as_str()))
            .collect::<Vec<_>>()
            .join(" OR "),
    )
}

fn infer_title(content: &str) -> String {
    let first_line = content
        .lines()
        .find(|line| !line.trim().is_empty())
        .unwrap_or("Memory");
    truncate_chars(first_line.trim(), 96)
}

fn truncate_chars(value: &str, max_chars: usize) -> String {
    if value.chars().count() <= max_chars {
        return value.to_string();
    }
    let mut output = value
        .chars()
        .take(max_chars.saturating_sub(16))
        .collect::<String>();
    output.push_str("\n...[truncated]");
    output
}

fn lexical_score(query: &str, title: &str, content: &str, tags: &[String]) -> f32 {
    let query_lower = query.to_lowercase();
    let haystack = format!("{}\n{}\n{}", title, tags.join(" "), content).to_lowercase();
    if haystack.contains(&query_lower) {
        return 1.0;
    }

    let query_tokens = tokens(&query_lower);
    if query_tokens.is_empty() {
        return 0.0;
    }
    let document_tokens = tokens(&haystack);
    let matches = query_tokens.intersection(&document_tokens).count();
    let matches = f32::from(u16::try_from(matches).unwrap_or(u16::MAX));
    let query_count = f32::from(u16::try_from(query_tokens.len()).unwrap_or(u16::MAX));
    matches / query_count
}

fn tokens(value: &str) -> HashSet<String> {
    value
        .split(|character: char| !character.is_alphanumeric())
        .filter(|token| token.chars().count() >= 2)
        .map(ToOwned::to_owned)
        .collect()
}

fn sensitive_content_reason(content: &str) -> Option<&'static str> {
    let lower = content.to_lowercase();
    if lower.contains("-----begin ") && lower.contains("private key-----") {
        return Some("a private key");
    }

    if TOKEN_PREFIXES.iter().any(|prefix| lower.contains(prefix)) {
        return Some("an access token or credential");
    }

    for line in content.lines() {
        let Some((name, value)) = line.split_once(['=', ':']) else {
            continue;
        };
        let name = name.trim().to_lowercase();
        let sensitive_name = [
            "api_key",
            "apikey",
            "secret",
            "password",
            "token",
            "private_key",
        ]
        .iter()
        .any(|marker| name.ends_with(marker));
        if sensitive_name && looks_like_secret_value(value.trim()) {
            return Some("a credential assignment");
        }
    }
    None
}

fn looks_like_secret_value(value: &str) -> bool {
    if value.is_empty()
        || value.contains(char::is_whitespace)
        || value.contains("REDACTED")
        || value.contains("redacted")
        || value.starts_with('<')
        || value.starts_with("${")
    {
        return false;
    }
    let unquoted = value.trim_matches(['\'', '"']);
    unquoted.len() >= 16
        && unquoted
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || b"-_/+.=".contains(&byte))
}

fn now_ms() -> Result<i64> {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .context("system clock is before the Unix epoch")?;
    i64::try_from(duration.as_millis()).context("system timestamp exceeds i64")
}

#[cfg(test)]
mod tests {
    use super::{
        MemoryKind, StoreRequest, kind_filter, lexical_score, sensitive_content_reason,
        validate_store_request,
    };

    fn request(content: &str) -> StoreRequest {
        StoreRequest {
            content: content.to_string(),
            title: None,
            kind: MemoryKind::Decision,
            importance: 0.8,
            tags: vec!["Rust".to_string(), "rust".to_string()],
            source: None,
        }
    }

    #[test]
    fn normalizes_and_deduplicates_tags() {
        let normalized = validate_store_request(request("Use Rust for the memory sidecar."))
            .expect("valid request");
        assert_eq!(normalized.tags, vec!["Rust"]);
        assert_eq!(normalized.title, "Use Rust for the memory sidecar.");
    }

    #[test]
    fn rejects_likely_secrets() {
        assert!(sensitive_content_reason("API_KEY=abcdefghijklmnop123456").is_some());
        assert!(sensitive_content_reason("token=<redacted>").is_none());
        assert!(sensitive_content_reason("Use the API_KEY environment variable").is_none());
    }

    #[test]
    fn lexical_overlap_handles_code_identifiers_and_vietnamese() {
        let score = lexical_score(
            "Rust memory",
            "Bộ nhớ native",
            "Dùng Rust cho opencode memory sidecar",
            &["zvec".to_string()],
        );
        assert!(score > 0.9);
    }

    #[test]
    fn kind_filter_only_uses_known_enum_values() {
        assert_eq!(
            kind_filter(&[MemoryKind::Decision, MemoryKind::Gotcha]),
            Some("kind = 'decision' OR kind = 'gotcha'".to_string())
        );
    }
}
