# opencode Orchestrator Skill Templates

An orchestrator skill coordinates the harness: it chooses agents, creates tasks, manages artifacts, integrates outputs, verifies results, and reports honestly.

Use these templates as starting points. Replace placeholders with project-specific names, files, commands, and acceptance criteria.

## Template A: Parallel task subagents

Use when two or more specialists can work independently before integration.

```markdown
---
name: {domain}-orchestrator
description: "Coordinates the {domain} harness in opencode. Use for {initial-run-keywords}; also use for rerun, update, revise, improve, partial rerun, audit, sync, or using previous {domain} outputs."
---

# {Domain} Orchestrator

Coordinates {domain} specialists to produce {final-output}.

## Execution mode

Parallel task subagents → primary integration → verification.

## Agent map

| Specialist | opencode agent type | Role | Skill/reference | Output |
|---|---|---|---|---|
| {specialist-1} | {general/build/explore/custom} | {role} | {skill} | `_workspace/02_{specialist-1}_{artifact}.md` |
| {specialist-2} | {general/build/explore/custom} | {role} | {skill} | `_workspace/02_{specialist-2}_{artifact}.md` |

## Workflow

### Phase 0: Context check

1. Check whether `_workspace/` exists.
2. Choose mode:
   - No `_workspace/` → initial run.
   - Existing `_workspace/` + partial revision request → targeted rerun of affected specialist only.
   - Existing `_workspace/` + new input → archive old workspace as `_workspace_{YYYYMMDD_HHMMSS}/`, then create a fresh `_workspace/`.
3. If doing a targeted rerun, include prior artifact paths and user feedback in the specialist task prompt.

### Phase 1: Prepare

1. Analyze user input and constraints.
2. Create `_workspace/00_input/`.
3. Save source inputs, decisions, and assumptions.
4. Create/update todo list with phases and verification gates.

### Phase 2: Dispatch specialists

Launch independent `task` calls in the same turn. Each prompt must include:

- Goal.
- Technical/business context.
- Exact files or artifact paths to read.
- Scope and out-of-scope items.
- Constraints and edge cases.
- Required output path.
- Verification method.
- Return format: summary, changed files, test output, risks, artifact paths.

Example task prompt:

```text
You are the {specialist} for the {domain} harness.

Goal: {measurable task outcome}
Context: {domain/project context}
Read: {files/artifacts}
Do not modify: {protected files}
Write output to: _workspace/02_{specialist}_{artifact}.md
Acceptance criteria:
- ...
Verification:
- ...
Return to orchestrator:
- Summary
- Evidence/artifact paths
- Risks and unresolved questions
```

### Phase 3: Integrate

1. Wait for all required specialist results.
2. Read artifact files, not only subagent summaries.
3. Compare claims across specialists; preserve contradictions with sources.
4. Create integrated artifact: `_workspace/03_integrated.md`.
5. If a critical gap exists, either run one targeted follow-up task or ask the user before proceeding.

### Phase 4: Verify

Run the checks appropriate to the domain:

- Lint/build/tests for code.
- Schema validation for structured data.
- Citation/source checks for research.
- Manual spot-check for user-facing outputs.

Record results in `_workspace/04_verification.md`.

### Phase 5: Final output

1. Write the final output to the user-requested path.
2. Preserve `_workspace/` for audit and reruns.
3. Report summary, changed files, verification results, known risks, and next steps.

## Error handling

| Situation | Response |
|---|---|
| One specialist fails | Retry once with narrower scope and failure context |
| Retry fails | Continue only if safe; mark that section incomplete with evidence |
| Majority of critical tasks fail | Ask user before continuing |
| Conflicting findings | Keep both, identify sources, and explain confidence |
| Timeout | Use completed artifacts; mark missing artifacts explicitly |
```

## Template B: Sequential pipeline

Use when each phase depends on the previous phase.

```markdown
---
name: {domain}-pipeline
description: "Runs the {domain} sequential harness. Use for {keywords}; also use for rerun, update, revise, partial rerun, audit, or sync requests."
---

# {Domain} Pipeline

## Execution mode

Sequential pipeline with explicit artifacts between phases.

## Workflow

### Phase 0: Context check

Same as Template A.

### Phase 1: Analysis

- Agent/type: `{agent-type}`
- Input: user request + source files
- Output: `_workspace/01_analysis.md`
- Gate: analysis must list assumptions, risks, and required decisions.

### Phase 2: Design

- Agent/type: `{agent-type}`
- Input: `_workspace/01_analysis.md`
- Output: `_workspace/02_design.md`
- Gate: design must define modules, interfaces, data flow, and verification plan.

### Phase 3: Execution

- Agent/type: `{agent-type}`
- Input: `_workspace/02_design.md`
- Output: changed files + `_workspace/03_execution.md`
- Gate: changed files match design; unrelated files are not touched.

### Phase 4: Verification

- Agent/type: `{agent-type or primary}`
- Input: changed files + `_workspace/03_execution.md`
- Output: `_workspace/04_verification.md`
- Gate: required checks pass or failures are fixed/reported.

### Phase 5: Report

Return summary, changed files, verification results, and risks.
```

## Template C: Hybrid workflow

Use when some phases benefit from parallel work and others require sequential integration.

```markdown
---
name: {domain}-hybrid-orchestrator
description: "Coordinates the {domain} hybrid harness. Use for {keywords}; rerun, update, revise, improve, audit, sync, and partial rerun requests."
---

# {Domain} Hybrid Orchestrator

## Execution mode map

| Phase | Mode | Reason |
|---|---|---|
| Phase 1: Discovery | Parallel task subagents | Independent perspectives reduce blind spots |
| Phase 2: Architecture | Primary or build agent | Needs one coherent design |
| Phase 3: Implementation | Parallel batches or sequential, depending on dependencies | Avoid conflicts while keeping throughput |
| Phase 4: QA | Independent review task | Fresh context catches integration defects |

## Transition rules

- Parallel → sequential: write all specialist artifacts, then primary reads and integrates them.
- Sequential → parallel: pass the design artifact path and exact batch boundaries to every subagent.
- Parallel implementation → QA: run QA only after changed files and implementation notes are complete.
```

## Orchestrator writing rules

1. **Name the execution mode early.** Readers should know whether the workflow is single-agent, parallel, sequential, or hybrid.
2. **Specify task prompts completely.** A subagent should not need hidden context.
3. **Use file paths for durable handoff.** Summaries are not enough for large outputs.
4. **State dependencies explicitly.** Name which artifact each phase consumes.
5. **Include realistic failure handling.** Assume timeouts, partial data, conflicting evidence, and permission limits can happen.
6. **Include test scenarios.** Add one normal flow and at least one failure flow.

## Follow-up trigger keywords

An orchestrator description should include follow-up phrases, otherwise the harness may only trigger for initial setup. Include terms such as:

- rerun, run again, update, revise, improve, sync, audit
- partial rerun, only redo {phase/component}
- based on previous output, improve the last result
- domain-specific everyday words the user is likely to use
