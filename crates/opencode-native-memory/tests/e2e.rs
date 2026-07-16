use std::fs;

use opencode_native_memory::{
    ForgetRequest, GetRequest, MemoryConfig, MemoryEngine, MemoryKind, MemoryOrigin, MemoryScope,
    SearchRequest, StoreRequest,
};

#[test]
#[ignore = "downloads the multilingual embedding model on first run"]
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
        })
        .expect("fetch memory");
    assert_eq!(fetched.len(), 1);
    assert_eq!(fetched[0].kind, MemoryKind::Decision);

    let forgotten = engine
        .forget(&ForgetRequest { ids: vec![rust.id] })
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
