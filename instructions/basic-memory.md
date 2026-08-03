# Basic Memory and Codebase Memory

This is the operating policy for using Basic Memory together with
`codebase-memory-mcp` during software work, especially when several agents or
subagents are active.

## Responsibility Boundaries

Keep the two knowledge systems complementary. Do not duplicate their jobs.

### Basic Memory is the durable coordination layer

Use Basic Memory for:

- Parent tasks, subtasks, ownership, status, blockers, and resume context.
- Product or repository decisions, constraints, assumptions, and tradeoffs.
- User preferences, operational conventions, and reusable workflows.
- Concise handoffs and end-of-thread captures.

Basic Memory is not a file lock, a live source index, or a transcript archive.
An MCP server being connected does not mean that context is captured
automatically. Write notes deliberately at task and decision boundaries.

### Codebase Memory is the code intelligence layer

Use `codebase-memory-mcp` for:

- Finding current functions, classes, routes, variables, and exact symbols.
- Reading implementation snippets after obtaining a qualified name.
- Tracing callers, callees, data flow, and cross-service impact.
- Architecture, dependency, complexity, and change-impact analysis.

Follow `instructions/codebase-memory.md` for its search priority. Use the
knowledge graph for source discovery instead of searching Basic Memory for code
facts. Verify the graph against the live worktree when freshness matters.

### Git and the worktree are authoritative for file state

- Git status and the actual files determine what is currently changed.
- Basic Memory records intent and coordination, not whether a file was really
  changed.
- Codebase Memory records relationships and code structure, not uncommitted
  working-tree state.
- Never treat an old note, graph result, or copied snippet as the current source
  without checking the relevant file or commit.

## When to Use Basic Memory

Create or update durable memory when any of the following is true:

- The work has three or more steps, can outlast the current context, or uses
  subagents.
- A decision, constraint, assumption, blocker, or failed approach matters to
  future work.
- A task must be resumed in another session.
- The user explicitly asks to remember, capture, track, or document something.
- A completed workflow is reusable by another agent.

Skip memory writes for trivial one-shot edits with no lasting decision. Do not
store raw transcripts, full diffs, generated code, tool-call logs, or secrets.

Load the relevant workflow skill instead of reproducing it in a prompt:

- `memory-tasks` for multi-step work, subagent coordination, and compaction
  recovery.
- `memory-capture` for a coherent end-of-thread or milestone summary.
- `memory-notes` for entity and relation design.
- `memory-schema` when creating or changing structured note types.

## Start and Resume Protocol

Before dispatching subagents or making a substantial change:

1. Identify the repository using its canonical remote (`owner/name` when
   available), repository root, current branch, and current `HEAD`.
2. Search the active Basic Memory tasks for that repository and branch. Prefer
   `metadata_filters` for fields such as `repo`, `branch`, `task_key`, and
   `status`; do not rely on a broad full-text search for YAML metadata.
3. Read the matching parent task and active subtasks. If a stable memory URL or
   task key is known, use it instead of creating a duplicate note.
4. Refresh code facts with Codebase Memory. For an unfamiliar area, start with
   `get_architecture` or `search_graph`; then use `get_code_snippet` only with an
   exact qualified name. Use `trace_path` before changing behavior with callers
   or downstream effects.
5. Check `git status --short` and the relevant diff before claiming a write
   scope. Preserve changes made by the user or other agents.

If the graph appears stale, check its index status and use the repository
change-detection/indexing workflow before relying on new relationship results.
Fall back to `grep` or `glob` only for strings, configs, scripts, non-code
files, or cases where the graph is insufficient, as defined by the codebase
memory instructions.

## Task and Subtask Notes

For multi-step work, create one parent `Task` note and one separate subtask
note per write-capable agent. Use the same Basic Memory project and include
repository identity in metadata so tasks from different repositories do not
mix.

Use a stable `task_key` such as `<repo>:<branch>:<task-slug>`. Search for that
key before writing. Rewrite or edit the existing note instead of creating a
duplicate.

At minimum, task metadata should include:

```yaml
status: active # active, blocked, review, done, abandoned
repo: owner/name
branch: main
task_key: owner/name:main:task-slug
assigned_to: main-agent-or-subagent-id
mode: read-only # read-only, write, or integrator
base_commit: <sha>
current_step: 1
write_scope:
  - src/owned-file.ts
parent_task: <parent-task-permalink-if-this-is-a-subtask>
```

The note body must contain a concise `Context` section with:

- The goal and acceptance criteria.
- Relevant repository paths and exact code symbols.
- Decisions already made and why.
- What was tried, including failed approaches that should not be repeated.
- The current step, next step, blockers, and verification status.

Keep the parent task as the coordination index. Each subagent owns only its
own subtask note. Do not have multiple agents append or rewrite the same
coordination note because Basic Memory note edits are not a concurrency lock.

## Multi-Agent Write Safety

Before dispatch, the parent agent must assign explicit non-overlapping
`write_scope` path globs. A subagent may read outside its scope but may write,
rename, delete, or format only inside it.

- Use `mode: read-only` for research, discovery, review, and impact analysis.
- Use `mode: write` for an isolated feature or file set.
- Use `mode: integrator` for shared files such as indexes, manifests,
  registries, aggregate docs, and lockfiles.
- If two tasks need the same file, serialize them. Do not solve the conflict by
  asking both agents to edit it.
- Do not let an agent run a repository-wide formatter, migration, cleanup, or
  delete operation unless that whole scope is explicitly owned.
- In a shared worktree, immediately before editing, reread the target and
  inspect its current diff. If it changed unexpectedly, stop and report a
  conflict to the parent instead of applying a stale patch.
- For multiple concurrent write agents, prefer one Git worktree and branch per
  agent. Merge or cherry-pick into the integration worktree sequentially.

Every subagent prompt must state its mode, owned paths, forbidden paths, parent
task memory URL, and the required handoff format:

```text
Handoff:
- status: done | blocked | review
- modified_paths:
- exact_symbols_or_configs_touched:
- decisions:
- tests_and_results:
- blockers:
- next_step:
- subtask_memory_url:
```

The parent agent is responsible for reconciling handoffs, reviewing the final
diff, and updating the parent task. A subagent result is not complete until its
modified paths and verification status are explicit.

## Checkpoints and Compaction Recovery

Update the relevant subtask note, or have the parent update it from the
handoff, at these boundaries:

- Plan accepted and scopes assigned.
- A material decision is made.
- A write scope is completed.
- A test fails or a blocker appears.
- A risky migration or bulk edit is about to begin.
- Before context compaction or session end.

Use structured observations such as `decision`, `insight`, `problem`,
`solution`, `tradeoff`, and `status`. Capture the current state, not a running
chat log. Use `edit_note` or an in-place rewrite for the same task; append only
when the new content is genuinely additive.

When resuming after compaction:

1. Read the active parent task and its active or blocked subtasks.
2. Confirm repository, branch, `HEAD`, and worktree status.
3. Check whether the recorded `base_commit` and write claims are still valid.
4. Use Codebase Memory to re-discover exact symbols and impact paths rather than
   trusting old source descriptions.
5. Continue from `current_step`; do not restart completed work or recreate
   notes that already exist.

## Codebase Memory Handoff

When a memory note refers to code, record stable references rather than copying
large source blocks:

```text
repo: owner/name
branch_or_commit: main / <sha>
source_file: src/orders/handler.ts
qualified_name: pkg.orders.OrderHandler
relationship_checked: inbound callers, depth 2
```

Use Basic Memory to preserve why a change was made. Use Codebase Memory to
reconstruct where the change lives and what it affects. Before finalizing a
non-trivial code change, use `detect_changes` or the equivalent impact workflow
and record relevant test or risk results in the task note. Refresh the graph
after substantial changes when its index is stale.

## Completion and Capture

Do not mark a task `done` until the parent has:

- Reconciled all subtask handoffs.
- Reviewed `git diff` and the final changed-file list.
- Run the relevant tests, checks, or validation.
- Recorded decisions, residual risks, blockers, and follow-ups.
- Marked subtasks `done`, `blocked`, or `abandoned` accurately.

For a reusable outcome, use `memory-capture`: search for the existing
thread/topic first and rewrite the same note rather than creating a duplicate.
Link related decisions, tasks, and repository concepts with typed wiki-link
relations.

## Privacy and Failure Handling

- Never write API keys, passwords, tokens, private credentials, or sensitive
  raw user data into Basic Memory.
- Scope searches to the current project and repository by default. Search all
  projects only when explicitly required.
- If Basic Memory is unavailable, keep the same structured checkpoint in the
  parent agent's handoff and persist it when the service returns.
- If Codebase Memory is unavailable, use the documented fallback tools only for
  discovery that the graph cannot provide, and clearly mark source references
  as needing revalidation.
