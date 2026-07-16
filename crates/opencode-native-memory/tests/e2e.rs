use std::fs;

use opencode_native_memory::{
    ForgetRequest, MemoryConfig, MemoryEngine, MemoryKind, SearchRequest, StoreRequest,
};

#[test]
#[ignore = "downloads the multilingual embedding model on first run"]
fn stores_recalls_and_forgets_project_memory() {
    let temp = tempfile::tempdir().expect("create temp dir");
    let project = temp.path().join("project");
    fs::create_dir_all(&project).expect("create project dir");
    let config = MemoryConfig::new(
        project,
        temp.path().join("data"),
        temp.path().join("models"),
    );
    let mut engine = MemoryEngine::open(config).expect("open native memory");

    let rust = engine
        .store(StoreRequest {
            content: "Quyết định dùng Rust và zvec cho bộ nhớ native của OpenCode.".to_string(),
            title: Some("Kiến trúc memory".to_string()),
            kind: MemoryKind::Decision,
            importance: 0.9,
            tags: vec!["rust".to_string(), "zvec".to_string()],
            source: Some("e2e-test".to_string()),
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
        })
        .expect("store unrelated preference");

    let results = engine
        .search(&SearchRequest {
            query: "Memory server được viết bằng ngôn ngữ và database nào?".to_string(),
            limit: 2,
            kinds: Vec::new(),
            min_score: 0.0,
        })
        .expect("search memories");
    assert_eq!(
        results.memories.first().map(|memory| memory.id.as_str()),
        Some(rust.id.as_str())
    );

    let forgotten = engine
        .forget(&ForgetRequest { ids: vec![rust.id] })
        .expect("forget memory");
    assert_eq!(forgotten.deleted, 1);
}
