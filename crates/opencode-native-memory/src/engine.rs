use std::collections::{HashMap, HashSet};
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Component, Path};
use std::process::Command;
use std::sync::OnceLock;
use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::{anyhow, bail, ensure, Context, Result};
use fastembed::{EmbeddingModel, TextEmbedding, TextInitOptions};
use fs2::FileExt;
use serde::{Deserialize, Serialize};
use zvec_rust::{
    Collection, CollectionSchema, DataType, Doc, FieldSchema, Fts, IndexParams, MetricType,
    SearchQuery,
};

use crate::config::hash_hex;
use crate::model::{
    CodeAnchor, DeleteReason, DeleteRequest, DeleteResponse, DoctorRequest, DoctorResponse,
    FeedbackEvent, FeedbackRequest, FeedbackResponse, ForgetRequest, ForgetResponse, GetRequest,
    IndexStatus, ListRequest, ListResponse, MemoryKind, MemoryOrigin, MemoryRecord, MemoryScope,
    OptimizeResponse, PurgeRequest, PurgeResponse, ScoreBreakdown, SearchRequest, SearchResponse,
    StatusResponse, StoreRequest, StoreResponse, SyncSharedRequest, SyncSharedResponse,
    UpdateRequest, UpdateResponse,
};
use crate::state::{
    default_expiry, default_half_life_days, expiry_from_days, memory_fingerprint, MemoryMetadata,
    MemoryState, RetrievalRecord, Tombstone, STATE_SCHEMA_VERSION,
};
use crate::MemoryConfig;

const SCHEMA_VERSION: u32 = 1;
const SCORE_VERSION: &str = "hybrid_v2";
const EMBEDDING_DIMENSION: usize = 384;
const EMBEDDING_MODEL_NAME: &str = "intfloat/multilingual-e5-small";
const MAX_CONTENT_CHARS: usize = 6_000;
const MAX_EXCERPT_CHARS: usize = 1_600;
const MAX_QUERY_CHARS: usize = 2_000;
const MAX_TITLE_CHARS: usize = 160;
const MAX_SOURCE_CHARS: usize = 240;
const MAX_TAGS: usize = 12;
const MAX_TAG_CHARS: usize = 64;
const MAX_SEARCH_RESULTS: usize = 20;
const MAX_LIST_RESULTS: usize = 100;
const MAX_ID_COUNT: usize = 100;
const MAX_CANDIDATES: usize = 200;
const MIN_BUDGET_CHARS: usize = 512;
const MAX_BUDGET_CHARS: usize = 24_000;
const MAX_CODE_PATHS: usize = 12;
const MAX_CODE_FILE_BYTES: u64 = 2 * 1_024 * 1_024;
const MAX_SHARED_RECORDS: usize = 200;
const SESSION_DEFAULT_TTL_DAYS: u32 = 7;
const ABSTENTION_THRESHOLD: f32 = 0.42;
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
    state: MemoryState,
    _writer_lock: File,
}

impl MemoryEngine {
    /// Open the project collection, lifecycle state, and local embedding model.
    ///
    /// # Errors
    ///
    /// Returns an error when storage cannot be locked/opened, state is
    /// incompatible, or the embedding model cannot be loaded.
    pub fn open(config: MemoryConfig) -> Result<Self> {
        initialize_zvec()?;
        secure_create_dir(&config.project_data_dir())?;
        secure_create_dir(config.model_cache())?;

        let writer_lock = acquire_writer_lock(&config.project_data_dir())?;
        let collection = open_collection(&config)?;
        let state = MemoryState::load(&config.state_path())?;
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
            state,
            _writer_lock: writer_lock,
        })
    }

    /// Validate, embed, deduplicate, and durably upsert one memory.
    ///
    /// # Errors
    ///
    /// Returns an error for invalid/sensitive input, a tombstone, or a
    /// storage/inference failure.
    pub fn store(&mut self, request: StoreRequest) -> Result<StoreResponse> {
        let normalized = validate_store_request(request)?;
        let fingerprint = memory_fingerprint(
            normalized.kind,
            normalized.scope,
            normalized.scope_key.as_deref(),
            &normalized.content,
        );
        if self.state.is_tombstoned(&fingerprint) && !normalized.revive {
            bail!(
                "memory was previously deleted and is tombstoned; set revive=true after user approval"
            );
        }

        let id_material = format!(
            "{}\0{}\0{}\0{}",
            normalized.kind.as_str(),
            normalized.scope.as_str(),
            normalized.scope_key.as_deref().unwrap_or_default(),
            normalized.content
        );
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
        let code_anchors = capture_code_anchors(&self.config, &normalized.code_paths)?;
        let expires_at_ms = normalized.expires_in_days.map_or_else(
            || {
                if normalized.scope == MemoryScope::Session {
                    expiry_from_days(now, Some(SESSION_DEFAULT_TTL_DAYS))
                } else {
                    default_expiry(normalized.kind, created_at)
                }
            },
            |days| expiry_from_days(now, Some(days)),
        );
        let metadata = MemoryMetadata {
            scope: normalized.scope,
            scope_key: normalized.scope_key.clone(),
            origin: normalized.origin,
            expires_at_ms,
            half_life_days: default_half_life_days(normalized.kind),
            code_anchors,
            feedback: self
                .state
                .records
                .get(&id)
                .map(|item| item.feedback.clone())
                .unwrap_or_default(),
            shared_source: if normalized.origin == MemoryOrigin::SharedMarkdown {
                normalized
                    .source
                    .strip_prefix("shared:")
                    .map(ToOwned::to_owned)
            } else {
                None
            },
        };
        let content_hash = self.write_document(&id, &normalized, created_at, now)?;
        self.state.records.insert(id.clone(), metadata);
        if normalized.revive {
            self.state.tombstones.remove(&fingerprint);
        }
        self.save_state()?;

        Ok(StoreResponse {
            id,
            inserted,
            content_hash,
            updated_at_ms: now,
            scope: normalized.scope,
        })
    }

    /// Search dense and lexical channels, calibrate scores, apply lifecycle
    /// filters, diversify with MMR, and pack results into a character budget.
    ///
    /// # Errors
    ///
    /// Returns an error for invalid input or a storage/inference failure.
    pub fn search(&mut self, request: &SearchRequest) -> Result<SearchResponse> {
        validate_search_request(request)?;
        let query_text = request.query.trim().to_string();
        let budget_chars = request
            .budget_chars
            .clamp(MIN_BUDGET_CHARS, MAX_BUDGET_CHARS);
        let max_results = request
            .limit
            .unwrap_or(request.max_results)
            .clamp(1, MAX_SEARCH_RESULTS);
        let stats = self.collection.stats()?;
        if stats.doc_count == 0 {
            return Ok(empty_search_response(
                query_text,
                budget_chars,
                "empty_store",
            ));
        }

        let query_embedding = self.embed(&format!("query: {query_text}"))?;
        let candidate_count = usize::try_from(stats.doc_count)
            .unwrap_or(MAX_CANDIDATES)
            .min(MAX_CANDIDATES)
            .min(max_results.saturating_mul(12).max(48));
        let filter = kind_filter(&request.kinds);
        let dense_documents =
            self.dense_query(&query_embedding, candidate_count, filter.as_deref())?;
        let lexical_documents = self
            .lexical_query(&query_text, candidate_count, filter.as_deref())
            .unwrap_or_default();
        let mut candidates = merge_candidates(&dense_documents, &lexical_documents)?;
        let considered = candidates.len();
        let now = now_ms()?;
        let mut ranked = Vec::with_capacity(candidates.len());
        let mut state_dirty = false;

        for (_, candidate) in candidates.drain() {
            let metadata = self.state.metadata(
                &candidate.memory.id,
                candidate.memory.kind,
                candidate.memory.created_at_ms,
            );
            if !self.state.records.contains_key(&candidate.memory.id) {
                self.state
                    .records
                    .insert(candidate.memory.id.clone(), metadata.clone());
                state_dirty = true;
            }
            if !scope_visible(&metadata, request) {
                continue;
            }
            let expired = metadata.expires_at_ms.is_some_and(|expires| expires <= now);
            if expired {
                continue;
            }
            let stale = anchors_stale(&self.config, &metadata.code_anchors);
            if stale && !request.include_stale {
                continue;
            }

            let lexical = lexical_score(
                &query_text,
                &candidate.memory.title,
                &candidate.memory.content,
                &candidate.memory.tags,
            );
            let dense = candidate.dense_similarity.unwrap_or_default();
            let reciprocal_rank =
                normalized_reciprocal_rank(candidate.dense_rank, candidate.lexical_rank);
            let channel_agreement =
                f32::from(candidate.dense_rank.is_some() && candidate.lexical_rank.is_some());
            let raw =
                0.45 * dense + 0.25 * reciprocal_rank + 0.20 * lexical + 0.10 * channel_agreement;
            let calibrated = logistic(10.0 * (raw - 0.55));
            let retention = retention_factor(now, candidate.memory.updated_at_ms, &metadata);
            let feedback = feedback_factor(&metadata.feedback);
            let importance = 0.9 + 0.1 * candidate.memory.importance;
            let score = (calibrated * retention * feedback * importance).clamp(0.0, 1.0);
            if score < request.min_score.max(ABSTENTION_THRESHOLD) {
                continue;
            }

            let mut memory = decorate_memory(candidate.memory, metadata, stale);
            memory.content = truncate_chars(&memory.content, MAX_EXCERPT_CHARS);
            memory.score = Some(score);
            memory.score_breakdown = Some(ScoreBreakdown {
                dense,
                reciprocal_rank,
                lexical,
                channel_agreement,
                calibrated,
                retention,
                feedback,
            });
            ranked.push(RankedMemory { memory, score });
        }

        let ranked = deduplicate_layers(ranked);
        let (memories, used_chars) = select_mmr(ranked, max_results, budget_chars);
        let abstained = memories.is_empty();
        let abstention_reason = abstained.then(|| {
            if considered == 0 {
                "no_candidates".to_string()
            } else {
                "low_relevance_or_ineligible".to_string()
            }
        });
        let retrieval_id = if request.track_feedback && !memories.is_empty() {
            let id = retrieval_id(&query_text, now, self.state.generation, &memories);
            self.state.retrievals.insert(
                id.clone(),
                RetrievalRecord {
                    query_hash: hash_hex(query_text.as_bytes()),
                    memory_ids: memories.iter().map(|memory| memory.id.clone()).collect(),
                    created_at_ms: now,
                    events: Vec::new(),
                },
            );
            state_dirty = true;
            Some(id)
        } else {
            None
        };
        if state_dirty {
            self.save_state()?;
        }

        Ok(SearchResponse {
            query: query_text,
            retrieval_id,
            count: memories.len(),
            candidates_considered: considered,
            budget_chars,
            used_chars,
            abstained,
            abstention_reason,
            score_version: SCORE_VERSION,
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
        let documents = self.fetch_documents(&request.ids)?;
        let mut by_id = HashMap::new();
        for document in &documents {
            let stored = stored_memory_from_doc(document)?;
            let metadata = self
                .state
                .metadata(&stored.id, stored.kind, stored.created_at_ms);
            let stale = anchors_stale(&self.config, &metadata.code_anchors);
            by_id.insert(stored.id.clone(), decorate_memory(stored, metadata, stale));
        }
        Ok(request
            .ids
            .iter()
            .filter_map(|id| by_id.remove(id))
            .collect())
    }

    /// List lifecycle-indexed memories for human management.
    ///
    /// # Errors
    ///
    /// Returns an error for invalid pagination or corrupt records.
    pub fn list(&self, request: &ListRequest) -> Result<ListResponse> {
        ensure!(
            (1..=MAX_LIST_RESULTS).contains(&request.limit),
            "list limit must be between 1 and {MAX_LIST_RESULTS}"
        );
        let now = now_ms()?;
        let mut ids = self.state.records.keys().cloned().collect::<Vec<_>>();
        ids.sort();
        let documents = self.fetch_documents(&ids)?;
        let mut memories = Vec::new();
        for document in &documents {
            let stored = stored_memory_from_doc(document)?;
            let metadata = self
                .state
                .metadata(&stored.id, stored.kind, stored.created_at_ms);
            if !request.kinds.is_empty() && !request.kinds.contains(&stored.kind) {
                continue;
            }
            if !request.scopes.is_empty() && !request.scopes.contains(&metadata.scope) {
                continue;
            }
            if !request.include_expired
                && metadata.expires_at_ms.is_some_and(|expires| expires <= now)
            {
                continue;
            }
            let stale = anchors_stale(&self.config, &metadata.code_anchors);
            if stale && !request.include_stale {
                continue;
            }
            memories.push(decorate_memory(stored, metadata, stale));
        }
        memories.sort_by(|left, right| right.updated_at_ms.cmp(&left.updated_at_ms));
        let total = memories.len();
        let page = memories
            .into_iter()
            .skip(request.offset)
            .take(request.limit)
            .collect::<Vec<_>>();
        Ok(ListResponse {
            total,
            offset: request.offset,
            count: page.len(),
            memories: page,
        })
    }

    /// Update a memory by stable ID with optimistic concurrency.
    ///
    /// # Errors
    ///
    /// Returns an error for invalid changes, stale timestamps, or missing IDs.
    pub fn update(&mut self, request: UpdateRequest) -> Result<UpdateResponse> {
        validate_ids(std::slice::from_ref(&request.id))?;
        let documents = self.fetch_documents(std::slice::from_ref(&request.id))?;
        let document = documents
            .first()
            .ok_or_else(|| anyhow!("memory not found: {}", request.id))?;
        let existing = stored_memory_from_doc(document)?;
        if let Some(expected) = request.expected_updated_at_ms {
            ensure!(
                expected == existing.updated_at_ms,
                "memory changed since it was read; fetch it again before updating"
            );
        }
        let old_metadata = self
            .state
            .metadata(&existing.id, existing.kind, existing.created_at_ms);
        let scope = request.scope.unwrap_or(old_metadata.scope);
        let scope_key = if request.scope.is_some() || request.scope_key.is_some() {
            normalize_scope_key(scope, request.scope_key)?
        } else {
            old_metadata.scope_key.clone()
        };
        let code_paths = request.code_paths.clone().unwrap_or_default();
        let merged = validate_store_request(StoreRequest {
            content: request.content.unwrap_or_else(|| existing.content.clone()),
            title: Some(request.title.unwrap_or_else(|| existing.title.clone())),
            kind: request.kind.unwrap_or(existing.kind),
            importance: request.importance.unwrap_or(existing.importance),
            tags: request.tags.unwrap_or_else(|| existing.tags.clone()),
            source: Some(existing.source.clone()),
            scope,
            scope_key: scope_key.clone(),
            origin: old_metadata.origin,
            expires_in_days: request.expires_in_days,
            code_paths,
            revive: false,
        })?;
        let new_fingerprint = memory_fingerprint(
            merged.kind,
            merged.scope,
            merged.scope_key.as_deref(),
            &merged.content,
        );
        ensure!(
            !self.state.is_tombstoned(&new_fingerprint),
            "updated content matches a tombstoned memory"
        );
        let now = now_ms()?;
        let code_anchors = if request.code_paths.is_some() {
            capture_code_anchors(&self.config, &merged.code_paths)?
        } else {
            old_metadata.code_anchors.clone()
        };
        let expires_at_ms = if request.clear_expiry {
            None
        } else if let Some(days) = request.expires_in_days {
            expiry_from_days(now, Some(days))
        } else {
            old_metadata.expires_at_ms
        };
        self.write_document(&request.id, &merged, existing.created_at_ms, now)?;
        self.state.records.insert(
            request.id.clone(),
            MemoryMetadata {
                scope: merged.scope,
                scope_key,
                origin: old_metadata.origin,
                expires_at_ms,
                half_life_days: default_half_life_days(merged.kind),
                code_anchors,
                feedback: old_metadata.feedback,
                shared_source: old_metadata.shared_source,
            },
        );
        self.save_state()?;
        Ok(UpdateResponse {
            id: request.id,
            updated_at_ms: now,
        })
    }

    /// Delete memories, optionally leaving tombstones that block relearning.
    ///
    /// # Errors
    ///
    /// Returns an error for invalid IDs or a storage failure.
    pub fn delete(&mut self, request: &DeleteRequest) -> Result<DeleteResponse> {
        validate_ids(&request.ids)?;
        self.delete_internal(&request.ids, request.tombstone, request.reason)
    }

    /// Backward-compatible delete alias that always leaves tombstones.
    ///
    /// # Errors
    ///
    /// Returns an error for invalid IDs or a storage failure.
    pub fn forget(&mut self, request: &ForgetRequest) -> Result<ForgetResponse> {
        self.delete(&DeleteRequest {
            ids: request.ids.clone(),
            tombstone: true,
            reason: DeleteReason::UserDeleted,
        })
    }

    /// Purge all indexed records after verifying the current project ID.
    ///
    /// # Errors
    ///
    /// Returns an error for a project mismatch or storage failure.
    pub fn purge(&mut self, request: &PurgeRequest) -> Result<PurgeResponse> {
        ensure!(
            request.project_id == self.config.project_id(),
            "project id confirmation does not match the active memory store"
        );
        let deleted = self.collection.stats()?.doc_count;
        if deleted > 0 {
            self.collection.delete_by_filter("created_at >= 0")?;
            self.collection.flush()?;
        }
        self.state.records.clear();
        self.state.retrievals.clear();
        if !request.keep_tombstones {
            self.state.tombstones.clear();
        }
        self.save_state()?;
        Ok(PurgeResponse {
            deleted,
            tombstones_retained: self.state.tombstones.len(),
        })
    }

    /// Record explicit or proxy retrieval feedback idempotently.
    ///
    /// # Errors
    ///
    /// Returns an error for an unknown retrieval or invalid memory IDs.
    pub fn feedback(&mut self, request: &FeedbackRequest) -> Result<FeedbackResponse> {
        validate_retrieval_id(&request.retrieval_id)?;
        if !request.memory_ids.is_empty() {
            validate_ids(&request.memory_ids)?;
        }
        let retrieval = self
            .state
            .retrievals
            .get_mut(&request.retrieval_id)
            .ok_or_else(|| anyhow!("unknown retrieval id: {}", request.retrieval_id))?;
        if retrieval.events.contains(&request.event)
            || (request.event == FeedbackEvent::Ignored
                && retrieval.events.contains(&FeedbackEvent::Used))
        {
            return Ok(FeedbackResponse {
                retrieval_id: request.retrieval_id.clone(),
                recorded: false,
                affected: 0,
            });
        }
        let requested = if request.memory_ids.is_empty() {
            retrieval.memory_ids.clone()
        } else {
            request
                .memory_ids
                .iter()
                .filter(|id| retrieval.memory_ids.contains(id))
                .cloned()
                .collect()
        };
        let mut affected = 0;
        for id in &requested {
            let Some(metadata) = self.state.records.get_mut(id) else {
                continue;
            };
            match request.event {
                FeedbackEvent::Injected => {
                    metadata.feedback.injected = metadata.feedback.injected.saturating_add(1);
                }
                FeedbackEvent::Used => {
                    metadata.feedback.used = metadata.feedback.used.saturating_add(1);
                }
                FeedbackEvent::Ignored => {
                    metadata.feedback.ignored = metadata.feedback.ignored.saturating_add(1);
                }
                FeedbackEvent::Error => {
                    metadata.feedback.error = metadata.feedback.error.saturating_add(1);
                }
            }
            affected += 1;
        }
        retrieval.events.push(request.event);
        self.save_state()?;
        Ok(FeedbackResponse {
            retrieval_id: request.retrieval_id.clone(),
            recorded: true,
            affected,
        })
    }

    /// Synchronize approved repository Markdown into the local search index.
    ///
    /// # Errors
    ///
    /// Returns an error when the request is oversized or storage fails.
    pub fn sync_shared(&mut self, request: SyncSharedRequest) -> Result<SyncSharedResponse> {
        ensure!(
            request.records.len() <= MAX_SHARED_RECORDS,
            "at most {MAX_SHARED_RECORDS} shared memories are allowed"
        );
        let mut incoming_sources = HashSet::new();
        for record in &request.records {
            validate_shared_source(&record.source)?;
            ensure!(
                incoming_sources.insert(record.source.clone()),
                "duplicate shared memory source: {}",
                record.source
            );
        }
        let existing = self
            .state
            .records
            .iter()
            .filter_map(|(id, metadata)| {
                (metadata.origin == MemoryOrigin::SharedMarkdown)
                    .then(|| {
                        metadata
                            .shared_source
                            .as_ref()
                            .map(|source| (source.clone(), id.clone()))
                    })
                    .flatten()
            })
            .collect::<HashMap<_, _>>();
        let mut removed = 0;
        for (source, id) in &existing {
            if !incoming_sources.contains(source) {
                removed += self
                    .delete_internal(std::slice::from_ref(id), false, DeleteReason::Obsolete)?
                    .deleted as usize;
            }
        }

        let mut imported = 0;
        let mut rejected = 0;
        for record in request.records {
            if let Some(old_id) = existing.get(&record.source) {
                removed += self
                    .delete_internal(std::slice::from_ref(old_id), false, DeleteReason::Obsolete)?
                    .deleted as usize;
            }
            let stored = self.store(StoreRequest {
                content: record.content,
                title: Some(record.title),
                kind: record.kind,
                importance: record.importance,
                tags: record.tags,
                source: Some(format!("shared:{}", record.source)),
                scope: MemoryScope::Repository,
                scope_key: None,
                origin: MemoryOrigin::SharedMarkdown,
                expires_in_days: None,
                code_paths: record.code_paths,
                revive: false,
            });
            if stored.is_ok() {
                imported += 1;
            } else {
                rejected += 1;
            }
        }
        Ok(SyncSharedResponse {
            imported,
            removed,
            rejected,
        })
    }

    /// Report collection, model, lifecycle state, and project status.
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
            state_schema_version: STATE_SCHEMA_VERSION,
            metadata_count: self.state.records.len(),
            tombstone_count: self.state.tombstones.len(),
            retrieval_count: self.state.retrievals.len(),
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

    /// Prune expired lifecycle state, compact segments, rebuild indexes, and flush.
    ///
    /// # Errors
    ///
    /// Returns an error when deletion, optimization, or statistics fail.
    pub fn optimize(&mut self) -> Result<OptimizeResponse> {
        let now = now_ms()?;
        let expired_ids = self
            .state
            .records
            .iter()
            .filter_map(|(id, metadata)| {
                metadata
                    .expires_at_ms
                    .is_some_and(|expires| expires <= now)
                    .then(|| id.clone())
            })
            .collect::<Vec<_>>();
        let pruned_expired = if expired_ids.is_empty() {
            0
        } else {
            self.delete_internal(&expired_ids, false, DeleteReason::Obsolete)?
                .deleted as usize
        };
        let pruned_retrievals = self.state.prune_retrievals(now);
        self.collection.optimize()?;
        self.collection.flush()?;
        self.save_state()?;
        Ok(OptimizeResponse {
            optimized: true,
            document_count: self.collection.stats()?.doc_count,
            pruned_expired,
            pruned_retrievals,
        })
    }

    /// Diagnose lifecycle state and code anchors without repairing data.
    ///
    /// # Errors
    ///
    /// Returns an error when collection statistics cannot be read.
    pub fn doctor(&self, request: &DoctorRequest) -> Result<DoctorResponse> {
        let stats = self.collection.stats()?;
        let now = now_ms()?;
        let expired_count = self
            .state
            .records
            .values()
            .filter(|metadata| metadata.expires_at_ms.is_some_and(|expires| expires <= now))
            .count();
        let stale_count = if request.deep {
            self.state
                .records
                .values()
                .filter(|metadata| anchors_stale(&self.config, &metadata.code_anchors))
                .count()
        } else {
            0
        };
        let mut warnings = Vec::new();
        if u64::try_from(self.state.records.len()).unwrap_or(u64::MAX) < stats.doc_count {
            warnings.push(
                "some legacy zvec records have no lifecycle metadata until they are recalled"
                    .to_string(),
            );
        }
        if !self.config.model_cache().exists() {
            warnings.push("embedding model cache is missing".to_string());
        }
        if expired_count > 0 {
            warnings.push(format!("{expired_count} expired memories await optimize"));
        }
        if stale_count > 0 {
            warnings.push(format!("{stale_count} memories have stale code anchors"));
        }
        for index in &stats.indexes {
            if index.completeness < 1.0 {
                warnings.push(format!(
                    "index {} is only {:.1}% complete",
                    index.name,
                    index.completeness * 100.0
                ));
            }
        }
        Ok(DoctorResponse {
            ok: warnings.is_empty(),
            project_root: self.config.project_root().display().to_string(),
            project_id: self.config.project_id().to_string(),
            collection_path: self.config.collection_dir().display().to_string(),
            state_path: self.config.state_path().display().to_string(),
            model_cache: self.config.model_cache().display().to_string(),
            document_count: stats.doc_count,
            metadata_count: self.state.records.len(),
            stale_count,
            expired_count,
            tombstone_count: self.state.tombstones.len(),
            retrieval_count: self.state.retrievals.len(),
            git_sha: git_head(self.config.project_root()),
            warnings,
        })
    }

    fn write_document(
        &mut self,
        id: &str,
        normalized: &NormalizedStoreRequest,
        created_at: i64,
        updated_at: i64,
    ) -> Result<String> {
        let content_hash = hash_hex(normalized.content.as_bytes());
        let search_text = build_search_text(
            &normalized.title,
            normalized.kind,
            &normalized.tags,
            &normalized.content,
        );
        let embedding = self.embed(&format!("passage: {search_text}"))?;
        let tags_json = serde_json::to_string(&normalized.tags)?;

        let mut doc = Doc::new()?;
        doc.set_pk(id);
        doc.add_string("title", &normalized.title)?;
        doc.add_string("content", &normalized.content)?;
        doc.add_string("search_text", &search_text)?;
        doc.add_string("kind", normalized.kind.as_str())?;
        doc.add_f32("importance", normalized.importance)?;
        doc.add_string("tags", &tags_json)?;
        doc.add_string("source", &normalized.source)?;
        doc.add_string("content_hash", &content_hash)?;
        doc.add_i64("created_at", created_at)?;
        doc.add_i64("updated_at", updated_at)?;
        doc.add_vector_f32("embedding", &embedding)?;

        let write = self.collection.upsert(&[&doc])?;
        ensure_write_succeeded("store memory", &write)?;
        self.collection.flush()?;
        Ok(content_hash)
    }

    fn delete_internal(
        &mut self,
        ids: &[String],
        create_tombstones: bool,
        reason: DeleteReason,
    ) -> Result<DeleteResponse> {
        validate_ids(ids)?;
        let documents = self.fetch_documents(ids)?;
        let now = now_ms()?;
        let mut tombstones_created = 0;
        for document in &documents {
            let stored = stored_memory_from_doc(document)?;
            let metadata = self
                .state
                .metadata(&stored.id, stored.kind, stored.created_at_ms);
            if create_tombstones {
                let fingerprint = memory_fingerprint(
                    stored.kind,
                    metadata.scope,
                    metadata.scope_key.as_deref(),
                    &stored.content,
                );
                self.state.add_tombstone(Tombstone {
                    fingerprint,
                    kind: stored.kind,
                    scope: metadata.scope,
                    scope_key: metadata.scope_key,
                    deleted_at_ms: now,
                    reason,
                });
                tombstones_created += 1;
            }
            self.state.records.remove(&stored.id);
        }
        let id_refs = ids.iter().map(String::as_str).collect::<Vec<_>>();
        let write = self.collection.delete(&id_refs)?;
        ensure_write_succeeded("delete memory", &write)?;
        self.collection.flush()?;
        self.save_state()?;
        Ok(DeleteResponse {
            requested: ids.len(),
            deleted: write.success_count,
            tombstones_created,
        })
    }

    fn fetch_documents(&self, ids: &[String]) -> Result<Vec<Doc>> {
        let mut documents = Vec::new();
        for chunk in ids.chunks(MAX_ID_COUNT) {
            let id_refs = chunk.iter().map(String::as_str).collect::<Vec<_>>();
            documents.extend(self.collection.fetch_with_options(
                &id_refs,
                Some(&RESULT_FIELDS),
                false,
            )?);
        }
        Ok(documents)
    }

    fn save_state(&mut self) -> Result<()> {
        self.state.save(&self.config.state_path())
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

    fn lexical_query(
        &self,
        query_text: &str,
        candidate_count: usize,
        filter: Option<&str>,
    ) -> Result<Vec<Doc>> {
        let mut fts = Fts::new()?;
        fts.set_match_string(query_text)?;
        let mut query = SearchQuery::fts("search_text", &fts, i32::try_from(candidate_count)?)?;
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
    scope: MemoryScope,
    scope_key: Option<String>,
    origin: MemoryOrigin,
    expires_in_days: Option<u32>,
    code_paths: Vec<String>,
    revive: bool,
}

#[derive(Clone)]
struct StoredMemory {
    id: String,
    title: String,
    content: String,
    kind: MemoryKind,
    importance: f32,
    tags: Vec<String>,
    source: String,
    created_at_ms: i64,
    updated_at_ms: i64,
}

struct RetrievalCandidate {
    memory: StoredMemory,
    dense_rank: Option<usize>,
    lexical_rank: Option<usize>,
    dense_similarity: Option<f32>,
}

struct RankedMemory {
    memory: MemoryRecord,
    score: f32,
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
    scan_sensitive("content", &content)?;

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
    scan_sensitive("title", &title)?;
    ensure!(
        request.importance.is_finite() && (0.0..=1.0).contains(&request.importance),
        "importance must be between 0 and 1"
    );
    if request.origin == MemoryOrigin::AutoCompaction {
        ensure!(
            request.kind != MemoryKind::Summary,
            "automatic curation cannot store raw summaries"
        );
        ensure!(
            request.importance <= 0.6,
            "automatic memories cannot exceed importance 0.6"
        );
        ensure!(
            !contains_instruction_injection(&content),
            "automatic memory looks like prompt injection and was quarantined"
        );
    }
    if request.origin == MemoryOrigin::SharedMarkdown {
        ensure!(
            request.scope == MemoryScope::Repository,
            "shared Markdown must use repository scope"
        );
        ensure!(
            !contains_instruction_injection(&content),
            "shared memory looks like prompt injection and was quarantined"
        );
    }

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
    scan_sensitive("source", &source)?;

    let tags = normalize_tags(request.tags)?;
    for tag in &tags {
        scan_sensitive("tag", tag)?;
    }
    ensure!(
        request
            .expires_in_days
            .is_none_or(|days| (1..=3_650).contains(&days)),
        "expires_in_days must be between 1 and 3650"
    );
    ensure!(
        request.code_paths.len() <= MAX_CODE_PATHS,
        "at most {MAX_CODE_PATHS} code paths are allowed"
    );
    let scope_key = normalize_scope_key(request.scope, request.scope_key)?;
    Ok(NormalizedStoreRequest {
        content,
        title,
        kind: request.kind,
        importance: request.importance,
        tags,
        source,
        scope: request.scope,
        scope_key,
        origin: request.origin,
        expires_in_days: request.expires_in_days,
        code_paths: request.code_paths,
        revive: request.revive,
    })
}

fn normalize_scope_key(scope: MemoryScope, scope_key: Option<String>) -> Result<Option<String>> {
    match scope {
        MemoryScope::Session | MemoryScope::Agent => {
            let key = scope_key
                .as_deref()
                .map(str::trim)
                .filter(|key| !key.is_empty())
                .ok_or_else(|| anyhow!("{} scope requires a scope_key", scope.as_str()))?;
            ensure!(key.len() <= 240, "scope_key exceeds 240 bytes");
            ensure!(!key.contains('\0'), "scope_key cannot contain NUL bytes");
            Ok(Some(key.to_string()))
        }
        MemoryScope::Project | MemoryScope::Repository => {
            ensure!(
                scope_key.as_deref().is_none_or(|key| key.trim().is_empty()),
                "{} scope cannot have a scope_key",
                scope.as_str()
            );
            Ok(None)
        }
    }
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
        request
            .limit
            .is_none_or(|limit| (1..=MAX_SEARCH_RESULTS).contains(&limit)),
        "search limit must be between 1 and {MAX_SEARCH_RESULTS}"
    );
    ensure!(
        (1..=MAX_SEARCH_RESULTS).contains(&request.max_results),
        "max_results must be between 1 and {MAX_SEARCH_RESULTS}"
    );
    ensure!(
        (MIN_BUDGET_CHARS..=MAX_BUDGET_CHARS).contains(&request.budget_chars),
        "budget_chars must be between {MIN_BUDGET_CHARS} and {MAX_BUDGET_CHARS}"
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

fn validate_retrieval_id(id: &str) -> Result<()> {
    ensure!(
        id.len() == 28
            && id.starts_with("ret_")
            && id[4..].bytes().all(|byte| byte.is_ascii_hexdigit()),
        "invalid retrieval id: {id}"
    );
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
    set_private_file_permissions(&file)?;
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

fn stored_memory_from_doc(document: &Doc) -> Result<StoredMemory> {
    let id = document
        .get_pk()
        .ok_or_else(|| anyhow!("zvec result is missing its primary key"))?
        .to_string();
    let tags_json = required_string(document, "tags")?;
    Ok(StoredMemory {
        id,
        title: required_string(document, "title")?,
        content: required_string(document, "content")?,
        kind: MemoryKind::parse(&required_string(document, "kind")?)?,
        importance: document.get_f32("importance")?.unwrap_or_default(),
        tags: serde_json::from_str(&tags_json).context("invalid tags stored in memory")?,
        source: required_string(document, "source")?,
        created_at_ms: document.get_i64("created_at")?.unwrap_or_default(),
        updated_at_ms: document.get_i64("updated_at")?.unwrap_or_default(),
    })
}

fn decorate_memory(stored: StoredMemory, metadata: MemoryMetadata, stale: bool) -> MemoryRecord {
    MemoryRecord {
        id: stored.id,
        title: stored.title,
        content: stored.content,
        kind: stored.kind,
        importance: stored.importance,
        tags: stored.tags,
        source: stored.source,
        created_at_ms: stored.created_at_ms,
        updated_at_ms: stored.updated_at_ms,
        scope: metadata.scope,
        origin: metadata.origin,
        expires_at_ms: metadata.expires_at_ms,
        stale,
        code_anchors: metadata.code_anchors,
        feedback: metadata.feedback,
        score: None,
        score_breakdown: None,
    }
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

fn merge_candidates(dense: &[Doc], lexical: &[Doc]) -> Result<HashMap<String, RetrievalCandidate>> {
    let mut candidates = HashMap::new();
    for (rank, document) in dense.iter().enumerate() {
        let memory = stored_memory_from_doc(document)?;
        let id = memory.id.clone();
        candidates.insert(
            id,
            RetrievalCandidate {
                memory,
                dense_rank: Some(rank),
                lexical_rank: None,
                dense_similarity: Some(f32::midpoint(document.get_score(), 1.0).clamp(0.0, 1.0)),
            },
        );
    }
    for (rank, document) in lexical.iter().enumerate() {
        let memory = stored_memory_from_doc(document)?;
        candidates
            .entry(memory.id.clone())
            .and_modify(|candidate| candidate.lexical_rank = Some(rank))
            .or_insert(RetrievalCandidate {
                memory,
                dense_rank: None,
                lexical_rank: Some(rank),
                dense_similarity: None,
            });
    }
    Ok(candidates)
}

fn normalized_reciprocal_rank(dense_rank: Option<usize>, lexical_rank: Option<usize>) -> f32 {
    fn channel(rank: Option<usize>, weight: f32) -> f32 {
        rank.map_or(0.0, |rank| {
            let rank = f32::from(u16::try_from(rank).unwrap_or(u16::MAX));
            weight * 61.0 / (61.0 + rank)
        })
    }
    (channel(dense_rank, 0.65) + channel(lexical_rank, 0.35)).clamp(0.0, 1.0)
}

fn logistic(value: f32) -> f32 {
    1.0 / (1.0 + (-value).exp())
}

fn retention_factor(now: i64, updated_at_ms: i64, metadata: &MemoryMetadata) -> f32 {
    let age_days = now.saturating_sub(updated_at_ms).max(0) as f64 / 86_400_000.0;
    let half_life = f64::from(metadata.half_life_days.max(1.0));
    2.0_f64.powf(-age_days / half_life) as f32
}

fn feedback_factor(feedback: &crate::model::FeedbackStats) -> f32 {
    if feedback.injected < 3 {
        return 1.0;
    }
    let denominator = feedback.injected.max(1) as f32;
    let signal =
        (feedback.used as f32 - feedback.ignored as f32 - feedback.error as f32) / denominator;
    (1.0 + 0.1 * signal).clamp(0.9, 1.1)
}

fn scope_visible(metadata: &MemoryMetadata, request: &SearchRequest) -> bool {
    if !request.scopes.is_empty() && !request.scopes.contains(&metadata.scope) {
        return false;
    }
    match metadata.scope {
        MemoryScope::Session => metadata.scope_key == request.session_scope_key,
        MemoryScope::Agent => metadata.scope_key == request.agent_scope_key,
        MemoryScope::Project | MemoryScope::Repository => true,
    }
}

fn deduplicate_layers(ranked: Vec<RankedMemory>) -> Vec<RankedMemory> {
    let mut deduplicated: HashMap<String, RankedMemory> = HashMap::new();
    for candidate in ranked {
        let key = hash_hex(
            format!(
                "{}\0{}",
                candidate.memory.kind.as_str(),
                candidate
                    .memory
                    .content
                    .split_whitespace()
                    .collect::<Vec<_>>()
                    .join(" ")
            )
            .as_bytes(),
        );
        deduplicated
            .entry(key)
            .and_modify(|existing| {
                let candidate_priority = (
                    candidate.memory.scope.precedence(),
                    candidate.score,
                    candidate.memory.updated_at_ms,
                );
                let existing_priority = (
                    existing.memory.scope.precedence(),
                    existing.score,
                    existing.memory.updated_at_ms,
                );
                if candidate_priority > existing_priority {
                    *existing = RankedMemory {
                        memory: candidate.memory.clone(),
                        score: candidate.score,
                    };
                }
            })
            .or_insert(candidate);
    }
    deduplicated.into_values().collect()
}

fn select_mmr(
    mut candidates: Vec<RankedMemory>,
    max_results: usize,
    budget_chars: usize,
) -> (Vec<MemoryRecord>, usize) {
    let mut selected: Vec<MemoryRecord> = Vec::new();
    let mut used_chars: usize = 0;
    while !candidates.is_empty() && selected.len() < max_results {
        let best = candidates
            .iter()
            .enumerate()
            .map(|(index, candidate)| {
                let similarity = selected
                    .iter()
                    .map(|memory| memory_similarity(&candidate.memory, memory))
                    .fold(0.0_f32, f32::max);
                let mmr = 0.75 * candidate.score - 0.25 * similarity;
                (index, mmr, candidate.score)
            })
            .max_by(|left, right| {
                left.1
                    .total_cmp(&right.1)
                    .then_with(|| left.2.total_cmp(&right.2))
            });
        let Some((index, _, _)) = best else {
            break;
        };
        let candidate = candidates.swap_remove(index);
        let estimated = estimate_memory_chars(&candidate.memory);
        if used_chars.saturating_add(estimated) > budget_chars {
            continue;
        }
        used_chars += estimated;
        selected.push(candidate.memory);
    }
    (selected, used_chars)
}

fn memory_similarity(left: &MemoryRecord, right: &MemoryRecord) -> f32 {
    let left_tokens = tokens(&format!(
        "{} {} {}",
        left.title,
        left.tags.join(" "),
        left.content
    ));
    let right_tokens = tokens(&format!(
        "{} {} {}",
        right.title,
        right.tags.join(" "),
        right.content
    ));
    if left_tokens.is_empty() || right_tokens.is_empty() {
        return 0.0;
    }
    let intersection = left_tokens.intersection(&right_tokens).count() as f32;
    let union = left_tokens.union(&right_tokens).count() as f32;
    intersection / union.max(1.0)
}

fn estimate_memory_chars(memory: &MemoryRecord) -> usize {
    memory.title.chars().count()
        + memory.content.chars().count()
        + memory
            .tags
            .iter()
            .map(|tag| tag.chars().count())
            .sum::<usize>()
        + 320
}

fn retrieval_id(query: &str, now: i64, generation: u64, memories: &[MemoryRecord]) -> String {
    let ids = memories
        .iter()
        .map(|memory| memory.id.as_str())
        .collect::<Vec<_>>()
        .join(",");
    let hash = hash_hex(format!("{query}\0{now}\0{generation}\0{ids}").as_bytes());
    format!("ret_{}", &hash[..24])
}

fn empty_search_response(query: String, budget_chars: usize, reason: &str) -> SearchResponse {
    SearchResponse {
        query,
        retrieval_id: None,
        count: 0,
        candidates_considered: 0,
        budget_chars,
        used_chars: 0,
        abstained: true,
        abstention_reason: Some(reason.to_string()),
        score_version: SCORE_VERSION,
        memories: Vec::new(),
    }
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
    let matches = query_tokens.intersection(&document_tokens).count() as f32;
    matches / query_tokens.len().max(1) as f32
}

fn tokens(value: &str) -> HashSet<String> {
    value
        .split(|character: char| !character.is_alphanumeric())
        .filter(|token| token.chars().count() >= 2)
        .map(str::to_lowercase)
        .collect()
}

fn capture_code_anchors(config: &MemoryConfig, paths: &[String]) -> Result<Vec<CodeAnchor>> {
    ensure!(
        paths.len() <= MAX_CODE_PATHS,
        "at most {MAX_CODE_PATHS} code paths are allowed"
    );
    let git_sha = git_head(config.project_root());
    let root = config
        .project_root()
        .canonicalize()
        .unwrap_or_else(|_| config.project_root().to_path_buf());
    let mut seen = HashSet::new();
    let mut anchors = Vec::new();
    for path in paths {
        let relative = Path::new(path);
        ensure!(
            !relative.is_absolute(),
            "code path must be relative: {path}"
        );
        ensure!(
            !relative
                .components()
                .any(|component| matches!(component, Component::ParentDir)),
            "code path cannot contain '..': {path}"
        );
        let canonical = root
            .join(relative)
            .canonicalize()
            .with_context(|| format!("cannot resolve code path {path}"))?;
        ensure!(
            canonical.starts_with(&root),
            "code path escapes the project root: {path}"
        );
        let metadata = canonical
            .metadata()
            .with_context(|| format!("cannot inspect code path {path}"))?;
        ensure!(metadata.is_file(), "code path is not a file: {path}");
        ensure!(
            metadata.len() <= MAX_CODE_FILE_BYTES,
            "code path exceeds {MAX_CODE_FILE_BYTES} bytes: {path}"
        );
        let normalized = canonical
            .strip_prefix(&root)?
            .to_string_lossy()
            .replace('\\', "/");
        if !seen.insert(normalized.clone()) {
            continue;
        }
        let bytes =
            fs::read(&canonical).with_context(|| format!("cannot read code path {path}"))?;
        anchors.push(CodeAnchor {
            path: normalized,
            sha256: hash_hex(&bytes),
            git_sha: git_sha.clone(),
        });
    }
    Ok(anchors)
}

fn anchors_stale(config: &MemoryConfig, anchors: &[CodeAnchor]) -> bool {
    anchors.iter().any(|anchor| {
        let path = config.project_root().join(&anchor.path);
        let Ok(metadata) = path.metadata() else {
            return true;
        };
        if !metadata.is_file() || metadata.len() > MAX_CODE_FILE_BYTES {
            return true;
        }
        fs::read(path)
            .map(|bytes| hash_hex(&bytes) != anchor.sha256)
            .unwrap_or(true)
    })
}

fn git_head(root: &Path) -> Option<String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(root)
        .args(["rev-parse", "HEAD"])
        .output()
        .ok()?;
    output
        .status
        .success()
        .then(|| String::from_utf8_lossy(&output.stdout).trim().to_string())
        .filter(|value| !value.is_empty())
}

fn validate_shared_source(source: &str) -> Result<()> {
    ensure!(!source.is_empty(), "shared source cannot be empty");
    ensure!(source.len() <= 240, "shared source exceeds 240 bytes");
    let path = Path::new(source);
    ensure!(!path.is_absolute(), "shared source must be relative");
    ensure!(
        !path
            .components()
            .any(|component| matches!(component, Component::ParentDir)),
        "shared source cannot contain '..'"
    );
    ensure!(
        source.starts_with(".opencode/memory/") && source.ends_with(".md"),
        "shared source must be a Markdown file under .opencode/memory"
    );
    Ok(())
}

fn scan_sensitive(field: &str, value: &str) -> Result<()> {
    if let Some(reason) = sensitive_content_reason(value) {
        bail!("memory {field} rejected because it may contain {reason}; redact the value first");
    }
    Ok(())
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

fn contains_instruction_injection(content: &str) -> bool {
    let lower = content.to_lowercase();
    [
        "ignore previous instructions",
        "ignore all instructions",
        "reveal the system prompt",
        "<native-memory-policy",
        "<project-memory",
        "you must execute",
        "act as system",
    ]
    .iter()
    .any(|marker| lower.contains(marker))
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
        deduplicate_layers, kind_filter, lexical_score, logistic, normalized_reciprocal_rank,
        sensitive_content_reason, validate_store_request, MemoryKind, MemoryScope, StoreRequest,
    };
    use crate::model::{FeedbackStats, MemoryOrigin, MemoryRecord};

    fn request(content: &str) -> StoreRequest {
        StoreRequest {
            content: content.to_string(),
            title: None,
            kind: MemoryKind::Decision,
            importance: 0.8,
            tags: vec!["Rust".to_string(), "rust".to_string()],
            source: None,
            scope: MemoryScope::Project,
            scope_key: None,
            origin: MemoryOrigin::Manual,
            expires_in_days: None,
            code_paths: Vec::new(),
            revive: false,
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
    fn rejects_likely_secrets_in_all_fields() {
        assert!(sensitive_content_reason("API_KEY=abcdefghijklmnop123456").is_some());
        assert!(sensitive_content_reason("token=<redacted>").is_none());
        assert!(sensitive_content_reason("Use the API_KEY environment variable").is_none());
        let mut tagged = request("Safe content");
        tagged.tags = vec!["token:abcdefghijklmnop123456".to_string()];
        assert!(validate_store_request(tagged).is_err());
    }

    #[test]
    fn lexical_overlap_handles_code_identifiers_and_vietnamese() {
        let score = lexical_score(
            "Rust memory",
            "Bộ nhớ native",
            "Dùng Rust cho opencode_memory sidecar",
            &["zvec".to_string()],
        );
        assert!(score > 0.9);
    }

    #[test]
    fn calibrated_score_components_are_bounded_and_monotonic() {
        let dense_only = normalized_reciprocal_rank(Some(0), None);
        let both = normalized_reciprocal_rank(Some(0), Some(0));
        assert!(dense_only > 0.0 && dense_only < both);
        assert!(both <= 1.0);
        assert!(logistic(-5.0) < logistic(0.0));
        assert!(logistic(0.0) < logistic(5.0));
    }

    #[test]
    fn higher_scope_wins_exact_cross_layer_duplicate() {
        fn memory(id: &str, scope: MemoryScope) -> MemoryRecord {
            MemoryRecord {
                id: id.to_string(),
                title: "Rust".to_string(),
                content: "Use Rust".to_string(),
                kind: MemoryKind::Decision,
                importance: 0.8,
                tags: Vec::new(),
                source: "test".to_string(),
                created_at_ms: 1,
                updated_at_ms: 1,
                scope,
                origin: MemoryOrigin::Manual,
                expires_at_ms: None,
                stale: false,
                code_anchors: Vec::new(),
                feedback: FeedbackStats::default(),
                score: Some(0.8),
                score_breakdown: None,
            }
        }
        let result = deduplicate_layers(vec![
            super::RankedMemory {
                memory: memory(
                    "mem_00000000000000000000000000000000",
                    MemoryScope::Repository,
                ),
                score: 0.9,
            },
            super::RankedMemory {
                memory: memory("mem_11111111111111111111111111111111", MemoryScope::Session),
                score: 0.7,
            },
        ]);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].memory.scope, MemoryScope::Session);
    }

    #[test]
    fn kind_filter_only_uses_known_enum_values() {
        assert_eq!(
            kind_filter(&[MemoryKind::Decision, MemoryKind::Gotcha]),
            Some("kind = 'decision' OR kind = 'gotcha'".to_string())
        );
    }
}
