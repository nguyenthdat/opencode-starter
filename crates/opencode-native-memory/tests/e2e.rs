use std::fs;

use opencode_native_memory::{
    FeedbackEvent, FeedbackRequest, ForgetRequest, GetRequest, ListRequest, MemoryConfig,
    MemoryEngine, MemoryKind, MemoryOrigin, MemoryScope, SearchRequest, StoreRequest,
};

#[test]
#[ignore = "downloads the multilingual embedding model on first run"]
#[allow(clippy::too_many_lines)]
fn stores_recalls_and_forgets_project_memory() {
    let temp = tempfile::tempdir().expect("create temp dir");
    let project = temp.path().join("project");
    fs::create_dir_all(&project).expect("create project dir");
    let config = MemoryConfig::new(project, temp.path().join("data"), model_cache());
    let mut engine = MemoryEngine::open(config).expect("open native memory");

    let rust = engine
        .store(StoreRequest {
            content: "Quyết định dùng Rust và zvec cho bộ nhớ native của OpenCode.".to_string(),
            title: Some("Kiến trúc memory".to_string()),
            kind: MemoryKind::Decision,
            importance: 0.9,
            tags: vec!["rust".to_string(), "zvec".to_string()],
            source: Some("e2e-test".to_string()),
            scope: MemoryScope::Project,
            scope_key: None,
            origin: MemoryOrigin::Manual,
            expires_in_days: None,
            code_paths: Vec::new(),
            revive: false,
        })
        .expect("store Rust decision");
    engine
        .store(StoreRequest {
            content: "Giao diện người dùng ưu tiên màu xanh lá.".to_string(),
            title: Some("Màu giao diện".to_string()),
            kind: MemoryKind::Preference,
            importance: 0.4,
            tags: vec!["ui".to_string()],
            source: Some("e2e-test".to_string()),
            scope: MemoryScope::Project,
            scope_key: None,
            origin: MemoryOrigin::Manual,
            expires_in_days: None,
            code_paths: Vec::new(),
            revive: false,
        })
        .expect("store unrelated preference");
    engine
        .store(StoreRequest {
            content:
                "Rust sidecar kết hợp zvec dense search và full-text search cho OpenCode memory."
                    .to_string(),
            title: Some("Hybrid memory retrieval".to_string()),
            kind: MemoryKind::Pattern,
            importance: 0.7,
            tags: vec!["rust".to_string(), "zvec".to_string()],
            source: Some("e2e-test".to_string()),
            scope: MemoryScope::Project,
            scope_key: None,
            origin: MemoryOrigin::Manual,
            expires_in_days: None,
            code_paths: Vec::new(),
            revive: false,
        })
        .expect("store related retrieval pattern");

    let results = engine
        .search(&SearchRequest {
            query: "Memory server được viết bằng ngôn ngữ và database nào?".to_string(),
            limit: Some(2),
            max_results: 20,
            budget_chars: 6_000,
            kinds: Vec::new(),
            scopes: Vec::new(),
            session_scope_key: None,
            agent_scope_key: None,
            min_score: 0.0,
            include_stale: false,
            track_feedback: true,
        })
        .expect("search memories");
    assert_eq!(
        results.memories.first().map(|memory| memory.id.as_str()),
        Some(rust.id.as_str())
    );

    let fetched = engine
        .get(&GetRequest {
            ids: vec![rust.id.clone()],
            session_scope_key: None,
            agent_scope_key: None,
        })
        .expect("fetch memory");
    assert_eq!(fetched.len(), 1);
    assert_eq!(fetched[0].kind, MemoryKind::Decision);

    let feedback_search = engine
        .search(&SearchRequest {
            query: "OpenCode memory Rust zvec search".to_string(),
            limit: Some(5),
            max_results: 20,
            budget_chars: 6_000,
            kinds: Vec::new(),
            scopes: Vec::new(),
            session_scope_key: None,
            agent_scope_key: None,
            min_score: 0.0,
            include_stale: false,
            track_feedback: true,
        })
        .expect("search feedback candidates");
    assert!(feedback_search.memories.len() >= 2);
    let retrieval_id = feedback_search
        .retrieval_id
        .expect("tracked search has retrieval id");
    let first_id = feedback_search.memories[0].id.clone();
    let second_id = feedback_search.memories[1].id.clone();
    let first_feedback = engine
        .feedback(&FeedbackRequest {
            retrieval_id: retrieval_id.clone(),
            event: FeedbackEvent::Injected,
            memory_ids: vec![first_id.clone()],
        })
        .expect("record first feedback subset");
    let second_feedback = engine
        .feedback(&FeedbackRequest {
            retrieval_id: retrieval_id.clone(),
            event: FeedbackEvent::Injected,
            memory_ids: vec![second_id.clone()],
        })
        .expect("record second feedback subset");
    assert_eq!(first_feedback.affected, 1);
    assert_eq!(second_feedback.affected, 1);
    let duplicate_feedback = engine
        .feedback(&FeedbackRequest {
            retrieval_id,
            event: FeedbackEvent::Injected,
            memory_ids: vec![first_id],
        })
        .expect("deduplicate repeated feedback subset");
    assert!(!duplicate_feedback.recorded);

    let session_memory = engine
        .store(StoreRequest {
            content: "Session family A private coordination context.".to_string(),
            title: Some("Private session context".to_string()),
            kind: MemoryKind::Fact,
            importance: 0.5,
            tags: vec!["session".to_string()],
            source: Some("e2e-test".to_string()),
            scope: MemoryScope::Session,
            scope_key: Some("family-a".to_string()),
            origin: MemoryOrigin::Manual,
            expires_in_days: None,
            code_paths: Vec::new(),
            revive: false,
        })
        .expect("store session memory");
    let hidden = engine
        .get(&GetRequest {
            ids: vec![session_memory.id.clone()],
            session_scope_key: Some("family-b".to_string()),
            agent_scope_key: None,
        })
        .expect("fetch from unrelated session");
    assert!(hidden.is_empty());
    let visible = engine
        .list(&ListRequest {
            kinds: Vec::new(),
            scopes: vec![MemoryScope::Session],
            include_expired: false,
            include_stale: false,
            offset: 0,
            limit: 50,
            session_scope_key: Some("family-a".to_string()),
            agent_scope_key: None,
        })
        .expect("list matching session family");
    assert!(
        visible
            .memories
            .iter()
            .any(|memory| memory.id == session_memory.id)
    );

    let forgotten = engine
        .forget(&ForgetRequest {
            ids: vec![rust.id],
            session_scope_key: None,
            agent_scope_key: None,
        })
        .expect("forget memory");
    assert_eq!(forgotten.deleted, 1);
}

fn model_cache() -> std::path::PathBuf {
    std::env::var_os("OPENCODE_MEMORY_MODEL_CACHE").map_or_else(
        || {
            std::env::var_os("HOME").map_or_else(
                || std::path::PathBuf::from(".fastembed_cache"),
                |home| std::path::PathBuf::from(home).join(".cache/opencode/native-memory/models"),
            )
        },
        std::path::PathBuf::from,
    )
}
