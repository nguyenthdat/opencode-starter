use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Default, Deserialize, Eq, Hash, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum MemoryKind {
    Decision,
    Preference,
    Fact,
    Pattern,
    Gotcha,
    #[default]
    Summary,
}

impl MemoryKind {
    pub(crate) const fn as_str(self) -> &'static str {
        match self {
            Self::Decision => "decision",
            Self::Preference => "preference",
            Self::Fact => "fact",
            Self::Pattern => "pattern",
            Self::Gotcha => "gotcha",
            Self::Summary => "summary",
        }
    }

    pub(crate) fn parse(value: &str) -> anyhow::Result<Self> {
        match value {
            "decision" => Ok(Self::Decision),
            "preference" => Ok(Self::Preference),
            "fact" => Ok(Self::Fact),
            "pattern" => Ok(Self::Pattern),
            "gotcha" => Ok(Self::Gotcha),
            "summary" => Ok(Self::Summary),
            _ => anyhow::bail!("unknown memory kind: {value}"),
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct StoreRequest {
    pub content: String,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub kind: MemoryKind,
    #[serde(default = "default_importance")]
    pub importance: f32,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub source: Option<String>,
}

const fn default_importance() -> f32 {
    0.7
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct SearchRequest {
    pub query: String,
    #[serde(default = "default_limit")]
    pub limit: usize,
    #[serde(default)]
    pub kinds: Vec<MemoryKind>,
    #[serde(default = "default_min_score")]
    pub min_score: f32,
}

const fn default_limit() -> usize {
    5
}

const fn default_min_score() -> f32 {
    0.2
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct GetRequest {
    pub ids: Vec<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct ForgetRequest {
    pub ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct MemoryRecord {
    pub id: String,
    pub title: String,
    pub content: String,
    pub kind: MemoryKind,
    pub importance: f32,
    pub tags: Vec<String>,
    pub source: String,
    pub created_at_ms: i64,
    pub updated_at_ms: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub score: Option<f32>,
}

#[derive(Debug, Clone, Serialize)]
pub struct StoreResponse {
    pub id: String,
    pub inserted: bool,
    pub content_hash: String,
    pub updated_at_ms: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct SearchResponse {
    pub query: String,
    pub count: usize,
    pub memories: Vec<MemoryRecord>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ForgetResponse {
    pub requested: usize,
    pub deleted: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct IndexStatus {
    pub name: String,
    pub completeness: f32,
}

#[derive(Debug, Clone, Serialize)]
pub struct StatusResponse {
    pub ready: bool,
    pub backend: &'static str,
    pub zvec_version: String,
    pub embedding_model: &'static str,
    pub embedding_dimension: usize,
    pub project_root: String,
    pub project_id: String,
    pub collection_path: String,
    pub document_count: u64,
    pub indexes: Vec<IndexStatus>,
}

#[derive(Debug, Clone, Serialize)]
pub struct OptimizeResponse {
    pub optimized: bool,
    pub document_count: u64,
}
