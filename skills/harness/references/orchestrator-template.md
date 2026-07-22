# Orchestrator Skill Template

The orchestrator is the top-level skill that coordinates the whole fleet. There's one template — OpenCode has a single native multi-agent mechanism (orchestrator + `task`-tool subagents), so there's no "team mode" vs. "sub-agent mode" split to choose between. What varies by architecture pattern (Phase 2-2 of `SKILL.md`) is the dispatch topology: sequential, parallel, conditional, iterative, dynamic, or nested — not the underlying mechanism.

---

## Template

```markdown
---
description: "Orchestrates the {domain} agent fleet. {initial-run keywords}. Also use for follow-up work: modifying {domain} results, partial re-runs, updates, refinements, re-running, or improving prior results."
---

# {Domain} Orchestrator

An integrated skill that orchestrates the {domain} agent fleet to produce {final deliverable}.

## Fleet composition

| Agent | Type | Role | Skill | Output |
|------|-------------|------|------|------|
| {agent-1} | {custom or built-in} | {role} | {skill} | {output-file} |
| {agent-2} | {custom or built-in} | {role} | {skill} | {output-file} |
| ... | | | | |

## Workflow

### Phase 0: Context check (follow-up support)

Check for prior artifacts to decide the execution mode:

1. Check whether `_workspace/` exists.
2. Decide the mode:
   - **`_workspace/` doesn't exist** → initial run. Proceed to Phase 1.
   - **`_workspace/` exists + user asked for a partial fix** → partial re-run. Re-dispatch only the relevant agent(s), overwriting only the affected artifacts.
   - **`_workspace/` exists + user provided new input** → fresh run. Move the existing `_workspace/` to `_workspace_{YYYYMMDD_HHMMSS}/`, then proceed to Phase 1.
3. On a partial re-run: include the prior artifact's path in the re-dispatched agent's prompt, instructing it to read the existing result and fold in the feedback.

### Phase 1: Preparation
1. Analyze the user's input — {what to extract}.
2. Create `_workspace/` under the working directory.
   - **Initial run**: create a fresh `_workspace/`.
   - **Fresh run**: after archiving the existing `_workspace/` as above, recreate an empty one.
3. Save input data to `_workspace/00_input/`.

### Phase 2: Dispatch

Issue the `task` calls for this phase. For independent work, issue every call in the **same turn** so they run in parallel; for dependent work, dispatch sequentially and feed each prior result forward.

| Agent | Input | Output | Model | Parallel? |
|---------|------|------|-------|-------------------|
| {agent-1} | {source} | `_workspace/{phase}_{agent}_{artifact}.md` | {model-id} | yes/no |
| {agent-2} | {source} | `_workspace/{phase}_{agent}_{artifact}.md` | {model-id} | yes/no |

> {agent-count} agents per phase, {tasks-per-agent} tasks each is a reasonable size — see "Fan-out sizing guidelines" in `SKILL.md` Phase 5-3.

### Phase 3: {main work — e.g. research/generation/analysis}

**Dispatch shape:** {sequential | parallel | conditional | iterative | dynamic}

Since subagents can't message each other directly, any cross-agent information sharing this phase needs happens through the orchestrator:

- After {agent-1} completes, read its output and include the relevant part in {agent-2}'s prompt (if {agent-2} needs it).
- If findings conflict between agents, the orchestrator either resolves it directly or re-dispatches one agent with the other's findings included, asking it to reconcile.

**Artifact locations:**

| Agent | Output path |
|------|----------|
| {agent-1} | `_workspace/{phase}_{agent-1}_{artifact}.md` |
| {agent-2} | `_workspace/{phase}_{agent-2}_{artifact}.md` |

### Phase 4: {follow-up work — e.g. verification/integration}
1. Collect each agent's artifact via `read`.
2. {Integration/verification logic.}
3. Produce the final deliverable: `{output-path}/{filename}`.

### Phase 5: Wrap-up
1. Preserve `_workspace/` (don't delete intermediate artifacts — they're for post-hoc verification and audit).
2. Report a summary of the results to the user.

## Data flow

```
[Orchestrator] → task(agent-1) → artifact-1.md
             → task(agent-2, includes relevant part of artifact-1) → artifact-2.md
                                     │
                              read both artifacts
                                     ↓
                          [Orchestrator: synthesize]
                                     ↓
                              final deliverable
```

## Error handling

| Situation | Strategy |
|------|------|
| One agent's dispatch fails | Retry once. If it fails again, proceed without that result and call out the gap in the report |
| Most agents fail | Notify the user and confirm whether to proceed |
| Timeout | Use whatever partial results were collected so far; don't wait indefinitely |
| Conflicting data between agents | Keep both, note the source of each — don't silently delete either |
| An agent's output doesn't match the expected shape | Retry with a more explicit format spec in the prompt; if it still fails, flag for manual review rather than guessing |

## Test scenarios

### Happy path
1. User provides {input}.
2. Phase 1 produces {analysis result}.
3. Phase 2 dispatches {N} agents ({parallel/sequential}).
4. Phase 3 completes the main work, with the orchestrator relaying context between dispatches as needed.
5. Phase 4 integrates artifacts into the final result.
6. Phase 5 reports the summary.
7. Expected result: `{output-path}/{filename}` is created.

### Error path
1. {agent-2}'s dispatch fails partway through Phase 3.
2. Orchestrator retries the dispatch once.
3. If the retry also fails, the orchestrator either re-dispatches {agent-1} to cover the gap, or proceeds without {agent-2}'s output.
4. Phase 4 proceeds with the remaining results.
5. Final report explicitly states "{agent-2}'s area was not fully covered."
```

---

## Writing principles

1. **State the dispatch topology up front** — name which architecture pattern(s) from Phase 2-2 this orchestrator uses, and whether any phase mixes topologies (e.g., parallel collection then sequential integration).
2. **Fully specify every `task` call** — agent name, input, output path, model, and whether it runs in parallel with others in the same turn.
3. **Make relay points explicit** — call out, in the workflow itself, every place where the orchestrator has to read one agent's output and forward it into another agent's prompt. This is the step that a peer-messaging system would handle automatically and OpenCode does not.
4. **Use absolute file paths** — no relative paths; always anchor to `_workspace/`.
5. **State inter-phase dependencies** — which phase depends on which phase's output.
6. **Handle errors realistically** — don't assume everything succeeds.
7. **Test scenarios are mandatory** — at least one happy path and one error path.

## Follow-up keywords in the description

An orchestrator's description needs more than initial-run keywords. Make sure it also includes phrasing like:

- "run again" / "re-run" / "update" / "fix" / "refine"
- "just redo the {sub-part} of {domain}"
- "based on the previous result", "improve the result"
- domain-relevant everyday phrasing (e.g., a launch-strategy harness should also match "launch", "promotion", "trending")

Without follow-up keywords, the harness is effectively dead code after its first run.

## Reference implementation

The basic shape of a fan-out/fan-in orchestrator:
preparation → Phase 0 (context check) → N parallel `task` dispatches → `read` + integrate → wrap-up.
See the research-fleet example in `references/orchestration-examples.md`.
