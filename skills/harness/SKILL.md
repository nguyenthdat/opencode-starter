---
name: harness
description: "Use this skill only when creating or editing harness teams, harness agents, harness skills, lead-owned or skill-owned orchestration workflows, component manifests, or related opencode harness configuration."
compatibility: opencode
metadata:
  domain: opencode-harness
  audience: harness-authors
---

# Harness — opencode Agent & Skill Architect

Build a domain-specific harness: a reusable operating system of opencode agents, skills, caller-led workflows, project instructions, component manifests, and verification loops.

A harness is not a static pile of prompts. It is a maintained system that answers:

- **Who** does the work? → agent definitions.
- **How** do they do it? → skills and references.
- **When and in what order** do they collaborate? → one primary lead or reusable orchestrator workflow.
- **How does the harness stay useful over time?** → tests, audits, drift checks, and change history.

## Core principles

1. **Use opencode-native locations.** Create reusable agents under `.opencode/agent/` or `.opencode/agents/`. Create skills under `.opencode/skill(s)/` or a configured project skill path such as `skills/`.
2. **Separate specialist role from reusable procedure.** Specialist agents define identity, scope, constraints, and I/O. Skills contain reusable domain methodology. A primary lead may own a team-specific workflow directly; do not create an orchestration skill unless that workflow is reused independently.
3. **The primary agent owns orchestration.** opencode subagents return results to the caller; do not assume direct subagent-to-subagent messaging. Share context through task prompts and `_workspace/` artifacts.
4. **Use parallel tasks when they add value.** Launch independent `task` subagents in the same turn when research, implementation, QA, or content work can happen concurrently. Sequence tasks when outputs have real dependencies.
5. **One workflow owner.** Keep a team-specific workflow in its primary lead agent by default. Use a dedicated orchestrator skill only when multiple leads or entry points genuinely reuse it. Never duplicate the same flow in both.
6. **Per-team instructions + lean base index.** Each harness team gets its own instruction file at `.opencode/instructions/<team>.md`, registered with an explicit path in `.opencode/opencode.jsonc` `instructions` (keeping `AGENTS.md` first). `AGENTS.md` stays a lean base: project identity, source-of-truth statement, global rules, and a compact harness index table.
7. **Treat the harness as evolving infrastructure.** After each meaningful run, fold feedback into the relevant agent, skill, workflow owner, test case, manifest, or project pointer.
8. **Namespace reusable teams.** Put team roles under `agents/<team-id>/` so runtime IDs become `<team-id>/<role>`. Keep role filenames generic inside the namespace (`lead.md`, `architect.md`, `reviewer.md`) and prefix language-specific skills (`rust-design-patterns`) so future language and domain teams do not collide.
9. **Keep component state declarative.** When the repository supports component toggles, maintain one schema-validated manifest per team with exact agent, skill, MCP, and instruction IDs. Manifests contain identity, enabled state, required hints, and model defaults only; workflow prose remains in the selected workflow owner.

## Workflow

### Phase 0: Current-state audit

When this skill triggers, inspect the existing harness before designing anything.

1. Read likely harness locations:
   - `.opencode/agent/` and `.opencode/agents/`
   - `.opencode/skill/`, `.opencode/skills/`, and any configured `skills.paths` such as `skills/`
   - `.opencode/opencode.jsonc`
   - `AGENTS.md`, `.opencode/instructions/`, and `.opencode/rules/`
   - `_workspace/` audit or run artifacts if present
2. Choose the execution path:

| Situation | Signal | Action |
|---|---|---|
| New harness | No relevant agents/skills, empty harness folders, or user asks for a new system | Run Phases 1-6 end to end |
| Existing extension | Harness exists and user asks for one new capability, agent, skill, or workflow | Run only affected phases using the matrix below |
| Operations/maintenance | User asks for audit, drift check, sync, cleanup, or status | Use Phase 7-5 maintenance workflow |

**Extension phase-selection matrix:**

| Change type | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 | Phase 6 |
|---|---|---|---|---|---|---|
| Add agent | Reuse audit result | Placement decision only | Required, including duplicate check | Only if the agent needs a dedicated skill | Update workflow owner | Required |
| Add/update skill | Skip unless domain changed | Skip | Skip | Required, including duplicate check | Only if routing changes | Required |
| Architecture change | Targeted analysis | Required | Affected agents only | Affected skills only | Required | Required |

3. Compare actual files with the selected workflow owner, component manifest, and project pointers. Record drift: missing files, orphaned files, stale triggers, mismatched names, and stale change history.
4. Report the audit summary and proposed plan before making broad changes.

### Phase 1: Domain analysis

1. Restate the user's goal as a domain/workflow problem.
2. Identify core work types: generation, research, editing, validation, deployment, migration, reporting, support, etc.
3. Use Phase 0 findings to detect conflicts, duplicates, or reusable components.
4. Inspect the project codebase and docs when relevant: tech stack, data model, key modules, existing conventions, tests, and build commands.
5. Infer the user's technical fluency from the conversation. Match the communication style; briefly explain terms such as "assertion" or "schema" when the user may not know them.

### Phase 2: Harness architecture design

#### 2-1. Select an execution mode

opencode orchestration is caller-led: the primary agent creates tasks, monitors results, integrates outputs, and resolves conflicts.

| Mode | Use when | Characteristics |
|---|---|---|
| **Parallel task subagents** (default for independent specialists) | 2+ specialists can work independently on the same input or separate work packages | Launch multiple `task` calls in one turn; each returns a summarized result; share large artifacts through `_workspace/` |
| **Sequential pipeline** | Each step depends strongly on the previous output | Run one task after another; pass artifact paths and decisions forward |
| **Single-agent workflow** | The work is small, tightly coupled, or cheaper than coordination | Primary agent performs the work directly using a todo list |
| **Hybrid** | Different phases have different needs | Example: parallel discovery → primary integration → independent QA |

Decision order:

1. If there are independent specialist perspectives, use parallel task subagents.
2. If a result must be reviewed or transformed before the next step, use a sequential pipeline.
3. If coordination overhead exceeds value, keep it as a single-agent workflow.
4. For multi-phase projects, combine modes and state the mode at the top of each phase.

See `references/agent-design-patterns.md` for detailed patterns and tradeoffs.

#### 2-2. Choose an architecture pattern

Decompose the work into reusable roles and flows:

- **Pipeline:** ordered stages such as analyze → design → implement → verify.
- **Fan-out/fan-in:** independent specialists produce findings, then the primary agent integrates.
- **Expert pool:** route each request to only the relevant specialist.
- **Producer-reviewer:** one agent creates, another validates, and the primary agent arbitrates revisions.
- **Supervisor:** primary agent partitions work and assigns batches dynamically.
- **Hierarchical delegation:** use sparingly; keep depth shallow to avoid latency and context loss.

#### 2-3. Decide when to split agents

Split by four axes: expertise, parallelism, context pressure, and reuse. Prefer fewer, sharper roles over many overlapping agents. Check existing agents before creating new ones; reuse or generalize when the old role already covers the need.

### Phase 3: Create or update agent definitions

#### 3-0. Duplicate review

Before creating an agent, read existing agent definitions and classify overlap:

| Situation | Action |
|---|---|
| Existing agent fully covers the role | Reuse it; do not create a duplicate |
| Existing agent partly covers the role and can be generalized safely | Update it, then verify dependent orchestrators still work |
| Existing role is intentionally domain-specific | Create a separate agent |
| Role is truly different | Create a new agent |

#### 3-1. opencode agent file requirements

Define reusable agents as files, not as one-off long prompts hidden inside an orchestrator. File definitions make the harness inspectable and reusable in later sessions.

Accepted project locations:

```text
.opencode/agent/{name}.md
.opencode/agents/{name}.md
.opencode/agents/{team-id}/{role}.md
```

OpenCode discovers nested agent files recursively. For example, `.opencode/agents/senior-rust-developer/lead.md` is invoked as `senior-rust-developer/lead`. Prefer this namespaced form for every multi-agent team; reserve root agent names for genuinely cross-team roles.

Recommended frontmatter:

```markdown
---
description: "Short role description with concrete trigger keywords."
mode: subagent
permission:
  edit: ask
  bash: ask
---

# Agent Name — one-line role summary

## Core role
...

## Working principles
...

## Input/output protocol
- Input: ...
- Output: ...
- Format: ...

## Collaboration protocol
- Receives context from: primary orchestrator, specific artifact paths, or prior task summaries.
- Returns: concise summary, changed files, verification output, risks, and artifact paths.
- Does not assume direct messaging with other subagents.

## Error handling
...
```

Notes:

- Use `mode: subagent` for specialist agents.
- Do not hardcode a provider-specific model unless the project already has a standard or the user asks for one.
- Use explicit permission constraints for risky roles such as reviewers, auditors, migration agents, or deployment helpers.
- Built-in opencode agents can be used for execution, but reusable harness roles should still be documented as agent files when the role will be used again.

### Phase 4: Create or update skills

Create each skill at a valid skill path:

```text
.opencode/skills/{skill-name}/SKILL.md
# or, if configured in .opencode/opencode.jsonc:
skills/{skill-name}/SKILL.md
```

Use the `skill-creator` skill at `/Users/datnguyen/Projects/harness-skill/skills/skill-creator` when creating or substantially improving skills. Apply `skills/harness/references/skill-writing-guide.md` as the shared writing standard, and let `skill-creator` handle skill frontmatter, progressive disclosure, tests/evals, packaging, and description tuning.

#### 4-0. Duplicate review

Before creating a skill, inspect existing skill descriptions and responsibilities:

| Situation | Action |
|---|---|
| Existing skill fully covers the workflow | Reuse it |
| Existing skill partly covers the workflow and can be generalized | Extend it carefully and update its description |
| Domain-specific skill is intentionally separate | Create a new skill |
| Completely different responsibility | Create a new skill |

#### 4-1. Skill structure

```text
skill-name/
├── SKILL.md                  # required
└── references/               # optional, loaded only when needed
    ├── domain-a.md
    └── domain-b.md
```

`SKILL.md` frontmatter:

```markdown
---
name: skill-name
description: "What the skill does + when to use it, with concrete trigger phrases."
---
```

Writing rules:

- Keep `SKILL.md` focused; move detailed recipes to `references/`.
- Explain why important rules exist so the model can generalize to edge cases.
- Avoid overfitting to one example.
- Bundle scripts only when repeated test runs show the same deterministic helper being recreated.
- Prefer imperative, concise instructions.

See `references/skill-writing-guide.md` for detailed writing patterns.

### Phase 5: Integration and orchestration

The primary lead owns orchestration. Put routing, data flow, retries, integration, and verification in the lead agent when they belong to one team. Create a dedicated orchestrator skill only when the workflow must be loaded independently or reused by multiple leads. Select one owner and remove duplicate flow prose from all other files.

#### 5-0. Workflow owner pattern

Build the selected workflow owner around these primitives:

- `todowrite` for visible progress and dependency tracking.
- `task` for specialist subagent calls.
- Run-scoped `_workspace/harness/<team-id>/<run-id>/` files for large or durable intermediate artifacts.
- Primary-agent integration for conflict resolution, final synthesis, and verification.

Use `references/orchestrator-template.md` only when a dedicated orchestration skill is justified; otherwise adapt the same contracts directly in `agents/<team-id>/lead.md`.

#### 5-1. Data handoff protocol

| Strategy | Mechanism | Good for |
|---|---|---|
| Prompt-based | Include compact context and exact acceptance criteria in the `task` prompt | Small inputs and simple dependencies |
| File-based | Write/read agreed paths under `_workspace/` | Large data, structured artifacts, audit trail |
| Summary-based | Use the subagent return message | Short results, status, risks |
| Todo-based | Track dependencies and progress in `todowrite` | Multi-step orchestration by the primary agent |

File-based handoff rules:

- Create `_workspace/` under the active project.
- Use a team and run namespace, then names like `{phase}_{agent}_{artifact}.{ext}`, for example `_workspace/harness/payments-review/20260716T090000Z/02_security_findings.md`.
- Preserve intermediate files for audit and reruns.
- Put final user-facing outputs where the user requested, not buried only in `_workspace/`.

#### 5-2. Error handling

Include realistic failure behavior in the workflow owner:

- Retry a failed specialist once with narrower instructions.
- If retry fails, proceed only if safe and clearly mark the missing section.
- Preserve conflicting evidence with sources instead of deleting it.
- Ask the user before continuing when a majority of critical tasks fail or when continuing could damage files/data.

#### 5-3. Per-team instructions and pointer registration

Standard procedure when a harness team is created or updated:

1. **Create or update the team instruction file** at `.opencode/instructions/<team>.md` — one team per file, covering (as applicable): Goal, Agents, Model routing, Completion gate, Skills, Trigger, and Change history.
2. **Register it in `.opencode/opencode.jsonc`** `"instructions"` with an explicit path, keeping `"AGENTS.md"` first:

   ```jsonc
   "instructions": [
     "AGENTS.md",
     ".opencode/instructions/<team>.md",
   ],
   ```

3. **Keep `AGENTS.md` a lean base**: project identity, source-of-truth statement, global base rules, and a compact index table (harness name → instruction file → one-line goal). Never place full harness sections or change-history tables in `AGENTS.md`.
4. **Create or update the component manifest** when supported, for example `.opencode/harness/teams/<team>.jsonc`. Use exact runtime IDs and explicit instruction paths so a plugin can toggle one component without parsing prompts or expanding a shared wildcard.

Team instruction file template (`.opencode/instructions/<team>.md`):

```markdown
# Harness Team: {team-name}

## Goal
{one-line purpose}

## Agents
{who orchestrates, who executes, strict role boundaries}

## Trigger
For non-trivial {domain} work, select `{team-id}/lead`. Simple questions can be answered directly.

## Change history
| Date | Change | Target | Reason |
|---|---|---|---|
| {YYYY-MM-DD} | Initial harness | all | - |
```

Do not duplicate skill bodies, workflow phases, or directory trees in instruction files. The selected lead or orchestrator skill is the sole workflow source of truth.

#### 5-4. Follow-up support

The workflow owner must handle future work, not only the first run.

1. Add follow-up triggers to the workflow owner's description: rerun, update, revise, improve, use previous output, partial rerun, sync, audit.
2. At the start of the workflow, inspect `_workspace/` and decide:
   - no `_workspace/` → initial run
   - `_workspace/` exists + partial change request → targeted rerun
   - `_workspace/` exists + new input → archive old workspace and run fresh
3. Agent definitions should say how to use prior artifacts and user feedback.

### Phase 6: Verification and testing

#### 6-1. Structure verification

- All agent files are in opencode-valid locations.
- All skill folders contain `SKILL.md` with `name` and `description` frontmatter.
- `name` values match folder names and use lowercase hyphen-separated identifiers.
- No stale references to old paths, old skill names, or unsupported tools remain.
- `.opencode/opencode.jsonc` remains valid if changed.

#### 6-2. Execution-mode verification

- Parallel subagents: task prompts are independent, acceptance criteria are explicit, and integration paths are clear.
- Sequential pipeline: each phase consumes the prior output and names the artifact path.
- Hybrid: mode transitions are explicit; artifacts bridge phases.

#### 6-3. Skill execution tests

For each important generated skill:

1. Write 2-3 realistic prompts that a real user would ask.
2. If practical, compare with-skill and baseline runs using subagents.
3. Evaluate qualitatively with user review and quantitatively with assertions when output is objectively checkable.
4. Improve the skill by generalizing feedback, not by hardcoding one test case.
5. Bundle deterministic helper scripts only after repeated tests show the same helper being recreated.

See `references/skill-testing-guide.md`.

#### 6-4. Trigger verification

Create should-trigger and should-not-trigger query sets:

- 8-10 should-trigger prompts with varied wording, tone, and implicit/explicit intent.
- 8-10 near-miss should-not-trigger prompts that share keywords but need a different workflow.
- Check for conflicts with existing skill descriptions.

#### 6-5. Dry run

Before declaring the harness complete, walk through one normal path and one failure path:

- Does each phase have a clear input and output?
- Are artifact paths valid?
- Can the primary agent integrate every specialist result?
- Is there a fallback for missing, timed-out, or contradictory results?

### Phase 7: Harness evolution

A harness should improve as it is used.

#### 7-1. Ask for feedback after meaningful runs

Ask briefly:

- "Anything in the result that should be improved?"
- "Should the agent roles or workflow change next time?"

Do not force feedback; provide the opportunity.

#### 7-2. Map feedback to the right file

| Feedback type | Update target | Example |
|---|---|---|
| Output quality | Specialist skill | "Analysis is too shallow" → add depth criteria |
| Agent role | Agent definition | "Need security review" → add or update security agent |
| Workflow order | Orchestrator skill | "Verify earlier" → move QA phase |
| Team composition | Orchestrator + agents | "These two roles overlap" → merge or clarify roles |
| Trigger miss | Skill description | User phrase did not trigger → expand description |

#### 7-3. Change history

Record significant changes in the affected team's instruction file (`.opencode/changelog/<team>.md`), never record in the lean `AGENTS.md` file:

```markdown
**Change history:**
| Date | Change | Target | Reason |
|---|---|---|---|
| 2026-04-05 | Initial harness | all | - |
| 2026-04-07 | Added QA agent | .opencode/agents/qa.md | Need integration checks |
```

#### 7-4. Evolution triggers

Suggest harness updates when:

- The same feedback appears twice.
- A specialist repeatedly fails in the same way.
- The user repeatedly bypasses the workflow owner to do manual work that should be automated.

#### 7-5. Operations and maintenance workflow

Use this when the user asks for harness audit, status, cleanup, synchronization, or repair.

1. **Audit state:** compare agent files, skill folders, the selected workflow owner, component manifests, per-team instruction files, the `AGENTS.md` index, and config paths (including the `.opencode/opencode.jsonc` `instructions` array).
2. **Report drift:** list missing, stale, duplicate, and orphaned components.
3. **Apply changes incrementally:** add/update/delete one component at a time.
4. **Update change history:** record date, target, change, and reason.
5. **Verify:** run structure checks and trigger checks; for large architecture changes, run skill tests and a dry run.

## Deliverable checklist

After building or changing a harness, confirm:

- [ ] Agents exist in `.opencode/agent(s)/` when reusable agents are required.
- [ ] Skills exist in `.opencode/skill(s)/` or a configured `skills/` path.
- [ ] Exactly one workflow owner (normally `agents/<team-id>/lead.md`, optionally an orchestrator skill) describes data flow, task delegation, error handling, and test scenarios.
- [ ] Execution mode is explicit: single-agent, parallel tasks, sequential pipeline, or hybrid.
- [ ] No unsupported tool names or stale platform-specific paths remain.
- [ ] Duplicate agent and skill review was completed.
- [ ] Skill descriptions include follow-up trigger keywords.
- [ ] Important skills were tested with realistic prompts or explicitly marked as not tested.
- [ ] Trigger near-miss checks were considered.
- [ ] Per-team instruction file (`.opencode/instructions/<team>.md`) created/updated, registered in `opencode.jsonc` `instructions` (AGENTS.md first), `AGENTS.md` index row current, and change history recorded in the team file.
- [ ] Component manifest matches the namespaced files and config IDs when manifest-driven toggles are enabled.

## References

- `references/agent-design-patterns.md` — opencode execution modes, architecture patterns, agent definitions, reuse rules.
- `references/orchestrator-template.md` — orchestrator skill templates for parallel, sequential, and hybrid workflows.
- `references/skill-writing-guide.md` — skill frontmatter, descriptions, progressive disclosure, examples, schema patterns.
- `references/skill-testing-guide.md` — test prompts, with-skill/baseline evaluation, assertions, iterative improvement.
- `references/qa-agent-guide.md` — QA agent design for integration-coherence checks.
- `references/examples.md` — adapted harness examples for research, writing, review, and migration workflows.
