use std::collections::{HashMap, HashSet};
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::Path;

use anyhow::{Context, Result, ensure};
use serde::{Deserialize, Serialize};

use crate::config::hash_hex;
use crate::model::{
    CodeAnchor, DeleteReason, FeedbackEvent, FeedbackStats, MemoryKind, MemoryOrigin, MemoryScope,
};

pub(crate) const STATE_SCHEMA_VERSION: u32 = 1;
const RETRIEVAL_RETENTION_MS: i64 = 30 * 86_400_000;
const MAX_RETRIEVALS: usize = 1_000;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct MemoryMetadata {
    pub scope: MemoryScope,
    #[serde(default)]
    pub scope_key: Option<String>,
    pub origin: MemoryOrigin,
    #[serde(default)]
    pub expires_at_ms: Option<i64>,
    pub half_life_days: f32,
    #[serde(default)]
    pub code_anchors: Vec<CodeAnchor>,
    #[serde(default)]
    pub feedback: FeedbackStats,
    #[serde(default)]
    pub shared_source: Option<String>,
}

impl MemoryMetadata {
    pub(crate) fn legacy(kind: MemoryKind, created_at_ms: i64) -> Self {
        Self {
            scope: MemoryScope::Project,
            scope_key: None,
            origin: MemoryOrigin::Legacy,
            expires_at_ms: default_expiry(kind, created_at_ms),
            half_life_days: default_half_life_days(kind),
            code_anchors: Vec::new(),
            feedback: FeedbackStats::default(),
            shared_source: None,
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct Tombstone {
    pub fingerprint: String,
    pub kind: MemoryKind,
    pub scope: MemoryScope,
    #[serde(default)]
    pub scope_key: Option<String>,
    pub deleted_at_ms: i64,
    pub reason: DeleteReason,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct RetrievalRecord {
    pub query_hash: String,
    pub memory_ids: Vec<String>,
    pub created_at_ms: i64,
    #[serde(default)]
    pub events: Vec<FeedbackEvent>,
    #[serde(default)]
    pub event_memory_ids: HashMap<String, Vec<String>>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct MemoryState {
    pub schema_version: u32,
    pub generation: u64,
    #[serde(default)]
    pub records: HashMap<String, MemoryMetadata>,
    #[serde(default)]
    pub tombstones: HashMap<String, Tombstone>,
    #[serde(default)]
    pub retrievals: HashMap<String, RetrievalRecord>,
    #[serde(default)]
    pub pending_deletes: HashSet<String>,
}

impl Default for MemoryState {
    fn default() -> Self {
        Self {
            schema_version: STATE_SCHEMA_VERSION,
            generation: 0,
            records: HashMap::new(),
            tombstones: HashMap::new(),
            retrievals: HashMap::new(),
            pending_deletes: HashSet::new(),
        }
    }
}

impl MemoryState {
    pub(crate) fn load(path: &Path) -> Result<Self> {
        if !path.exists() {
            return Ok(Self::default());
        }
        let state: Self = serde_json::from_str(
            &fs::read_to_string(path)
                .with_context(|| format!("cannot read memory state {}", path.display()))?,
        )
        .with_context(|| format!("invalid memory state {}", path.display()))?;
        ensure!(
            state.schema_version == STATE_SCHEMA_VERSION,
            "unsupported memory state schema {}; expected {STATE_SCHEMA_VERSION}",
            state.schema_version
        );
        Ok(state)
    }

    pub(crate) fn save(&mut self, path: &Path) -> Result<()> {
        self.generation = self.generation.saturating_add(1);
        let temporary = path.with_extension(format!("json.tmp-{}", std::process::id()));
        if temporary.exists() {
            fs::remove_file(&temporary)
                .with_context(|| format!("cannot remove stale {}", temporary.display()))?;
        }
        let mut file = OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&temporary)
            .with_context(|| format!("cannot create {}", temporary.display()))?;
        set_private_file_permissions(&file)?;
        serde_json::to_writer_pretty(&mut file, self)?;
        file.write_all(b"\n")?;
        file.sync_all()?;
        fs::rename(&temporary, path)
            .with_context(|| format!("cannot install memory state at {}", path.display()))?;
        sync_parent(path)?;
        Ok(())
    }

    pub(crate) fn metadata(
        &self,
        id: &str,
        kind: MemoryKind,
        created_at_ms: i64,
    ) -> MemoryMetadata {
        self.records
            .get(id)
            .cloned()
            .unwrap_or_else(|| MemoryMetadata::legacy(kind, created_at_ms))
    }

    pub(crate) fn is_tombstoned(&self, fingerprint: &str) -> bool {
        self.tombstones.contains_key(fingerprint)
    }

    pub(crate) fn add_tombstone(&mut self, tombstone: Tombstone) {
        self.tombstones
            .insert(tombstone.fingerprint.clone(), tombstone);
    }

    pub(crate) fn prune_retrievals(&mut self, now_ms: i64) -> usize {
        let before = self.retrievals.len();
        self.retrievals.retain(|_, record| {
            now_ms.saturating_sub(record.created_at_ms) <= RETRIEVAL_RETENTION_MS
        });
        if self.retrievals.len() > MAX_RETRIEVALS {
            let mut oldest = self
                .retrievals
                .iter()
                .map(|(id, record)| (id.clone(), record.created_at_ms))
                .collect::<Vec<_>>();
            oldest.sort_by_key(|(_, created)| *created);
            let remove_count = oldest.len().saturating_sub(MAX_RETRIEVALS);
            for (id, _) in oldest.into_iter().take(remove_count) {
                self.retrievals.remove(&id);
            }
        }
        before.saturating_sub(self.retrievals.len())
    }
}

pub(crate) fn default_half_life_days(kind: MemoryKind) -> f32 {
    match kind {
        MemoryKind::Decision => 730.0,
        MemoryKind::Preference | MemoryKind::Gotcha => 365.0,
        MemoryKind::Fact => 180.0,
        MemoryKind::Pattern => 270.0,
        MemoryKind::Summary => 14.0,
    }
}

pub(crate) fn default_expiry(kind: MemoryKind, created_at_ms: i64) -> Option<i64> {
    let days = match kind {
        MemoryKind::Decision | MemoryKind::Preference => return None,
        MemoryKind::Fact => 365,
        MemoryKind::Pattern => 540,
        MemoryKind::Gotcha => 730,
        MemoryKind::Summary => 30,
    };
    Some(created_at_ms.saturating_add(days * 86_400_000))
}

pub(crate) fn expiry_from_days(now_ms: i64, days: Option<u32>) -> Option<i64> {
    days.map(|days| now_ms.saturating_add(i64::from(days) * 86_400_000))
}

pub(crate) fn memory_fingerprint(
    kind: MemoryKind,
    scope: MemoryScope,
    scope_key: Option<&str>,
    content: &str,
) -> String {
    let normalized = content.split_whitespace().collect::<Vec<_>>().join(" ");
    hash_hex(
        format!(
            "{}\0{}\0{}\0{}",
            kind.as_str(),
            scope.as_str(),
            scope_key.unwrap_or_default(),
            normalized
        )
        .as_bytes(),
    )
}

fn sync_parent(path: &Path) -> Result<()> {
    if let Some(parent) = path.parent() {
        File::open(parent)?.sync_all()?;
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

#[cfg(test)]
mod tests {
    use super::{MemoryState, default_expiry, memory_fingerprint};
    use crate::model::{MemoryKind, MemoryScope};

    #[test]
    fn state_round_trips_atomically() {
        let temp = tempfile::tempdir().expect("create temp dir");
        let path = temp.path().join("state.json");
        let mut state = MemoryState::default();
        state.save(&path).expect("save state");
        let loaded = MemoryState::load(&path).expect("load state");
        assert_eq!(loaded.generation, 1);
    }

    #[test]
    fn fingerprint_includes_scope_and_normalizes_whitespace() {
        let first = memory_fingerprint(
            MemoryKind::Fact,
            MemoryScope::Project,
            None,
            "Use  Rust\nfor memory",
        );
        let second = memory_fingerprint(
            MemoryKind::Fact,
            MemoryScope::Project,
            None,
            "Use Rust for memory",
        );
        let repository = memory_fingerprint(
            MemoryKind::Fact,
            MemoryScope::Repository,
            None,
            "Use Rust for memory",
        );
        assert_eq!(first, second);
        assert_ne!(first, repository);
    }

    #[test]
    fn durable_decisions_do_not_expire_by_default() {
        assert_eq!(default_expiry(MemoryKind::Decision, 10), None);
        assert!(default_expiry(MemoryKind::Summary, 10).is_some());
    }
}
