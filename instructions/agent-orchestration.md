# Agent Orchestration

- The primary agent owns decomposition, integration, verification, and the final response.
- Work directly when a few tool calls are cheaper than delegation.
- Route bounded local discovery to `explore`, bounded external lookup to `search`, one-source research to the matching `research-*` specialist, and multi-source/high-stakes research to `research`.
- Normal maximum depth is two `task` edges; workers never delegate.
- Fan out to at most three independent, non-overlapping tasks unless the user requests full research.
- Retry one failed task once with narrower instructions and the same `task_id`; then return a partial result or blocker.
- Never delegate merely to relay or summarize another agent's result. The caller reads artifacts, resolves conflicts, and performs routine synthesis.
- Use validator or synthesizer agents only when a separate quality gate materially improves the result.

## Change History

| Date | Change | Target | Reason |
|---|---|---|---|
| 2026-07-13 | Compressed routing and call limits | all agents | Reduce prompt and delegation cost |
