# Agent Orchestration

## Goal

Keep delegation shallow, non-overlapping, and cheaper than doing the work directly.

## Routing

- The primary agent owns decomposition, integration, verification, and the final response.
- Use `explore` for bounded local code discovery and `search` for bounded external lookup.
- Use one direct `research-*` specialist when one source category dominates.
- Use `research` only for multi-source, high-stakes, disputed, or explicitly deep research.
- Use skill-creator grader, comparator, and analyzer agents only inside their eval workflow.

## Call Limits

- Prefer no delegation when the caller can complete the task with a few direct tool calls.
- Normal maximum depth is two `task` edges. A worker never delegates to another worker.
- Fan out to at most three independent agents unless the user explicitly requests a larger full-research run.
- Never assign the same question to overlapping agents. Partition by source, file scope, or acceptance criterion.
- Retry one failed task once with narrower instructions and the existing `task_id`; then return a partial result or blocker.
- Never call an agent only to restate, relay, or summarize another agent's completed result.
- Run validator and synthesizer only when their separate quality gate adds value; the caller handles routine checks and synthesis.

## Completion Gate

- Read returned artifacts before relying on summaries.
- Resolve conflicts in the caller rather than starting another delegation chain.
- Report failed or skipped work explicitly and stop when further calls would only repeat prior attempts.

## Change History

| Date | Change | Target | Reason |
|---|---|---|---|
| 2026-07-13 | Added shallow call graph, retry budget, and leaf-worker rules | all agents | Prevent recursive and redundant agent calls |
