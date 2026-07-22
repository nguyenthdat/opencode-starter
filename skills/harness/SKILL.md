---
name: harness
description: "Builds a harness: designs a subagent fleet for a domain/project, defines each subagent's role, and generates the skills those subagents use. Trigger this skill when the user (1) asks to 'build a harness', 'set up a harness', 'build a harness for this project'; (2) asks for 'harness design' or 'harness engineering'; (3) wants an agent/skill-based automation system for a new domain or project; (4) wants to restructure or extend an existing harness; (5) asks to 'audit the harness', 'check harness status', or 'sync agents/skills' for an existing harness — any operations/maintenance request on a harness already in place."
---

# Harness — Subagent Fleet & Skill Architect

A meta-skill that builds a harness fit for a domain/project: it defines the role of each subagent, and generates the skills those subagents use.

**Core principles:**
1. Generate agent definitions (`.opencode/agents/`) and skills (`.opencode/skills/`).
2. **Use an orchestrator-dispatched subagent fleet as the default execution model.** OpenCode has no peer-to-peer messaging between subagents (no equivalent of a shared task board with direct agent-to-agent chat) — the primary agent (the orchestrator) is always the one dispatching work via the `task` tool and relaying results between subagents.
3. **Register a harness pointer in `AGENTS.md`.** Keep only the minimum needed — goal, trigger rule, and the path to the team's changelog — so the orchestrator skill gets triggered again in a new session.
4. **A harness is a living system, not a fixed artifact.** After every run, incorporate feedback and keep updating agents, skills, and the dedicated `changelog/{team-name}/CHANGELOG.md`.

## Workflow

### Phase 0: Status audit

The moment this skill triggers, check the current state of the harness first.

1. Read `project/.opencode/agents/`, `project/.opencode/skills/`, and `project/AGENTS.md` (fall back to `CLAUDE.md` if that's what the project already uses). Follow the harness pointer to `project/changelog/{team-name}/CHANGELOG.md` when it exists.
2. Branch the execution mode based on what you find:
   - **New build**: the agent/skill directories are missing or empty → run all phases starting from Phase 1.
   - **Extend existing**: a harness already exists and the user wants new agents/skills added → run only the phases required, per the selection matrix below.
   - **Operate/maintain**: the user wants an audit, fix, or sync of an existing harness → jump to the Phase 7-5 operations workflow.

   **Phase-selection matrix for extending an existing harness:**
   | Change type | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 | Phase 6 |
   |----------|---------|---------|---------|---------|---------|---------|
   | Add an agent | Skip (reuse Phase 0 results) | Placement decision only | Required (incl. 3-0) | Only if a dedicated skill is needed (incl. 4-0) | Update orchestrator | Required |
   | Add/modify a skill | Skip | Skip | Skip | Required (incl. 4-0) | Only if wiring changes | Required |
   | Architecture change | Skip | Required | Only affected agents (incl. 3-0) | Only affected skills (incl. 4-0) | Required | Required |
3. Cross-check the existing agent/skill list against the orchestrator's fleet composition, then verify that the `AGENTS.md` pointer and team changelog path agree. Detect missing files and drift.
4. Summarize the audit for the user and confirm the execution plan before proceeding.

### Phase 1: Domain analysis
1. Identify the domain/project from the user's request.
2. Identify the core task types (generation, verification, editing, analysis, etc.).
3. Using the Phase 0 audit, analyze overlap/conflict with existing agents/skills.
4. Explore the project codebase — tech stack, data model, key modules.
5. **Gauge the user's technical fluency** — read contextual cues from the conversation (terminology used, question sophistication) and calibrate your communication tone accordingly. Don't use terms like "assertion" or "JSON schema" without explanation for a user with little coding experience.

### Phase 2: Fleet architecture design

#### 2-1. Execution model

**OpenCode has exactly one native multi-agent execution model: an orchestrator (primary agent) dispatching subagents through the `task` tool.** Unlike Claude Code's Agent Teams, subagents in OpenCode cannot message each other directly and there is no shared, self-claimable task board — every hand-off is mediated by the orchestrator, either by (a) returning results straight to the caller, or (b) writing to a file the orchestrator later reads and forwards as input to the next subagent call.

This has one practical consequence for every pattern below: anything that in a peer-messaging system would be "agent A tells agent B directly" becomes, in OpenCode, "the orchestrator reads A's output and includes the relevant part in B's prompt." Design each phase with this relay step made explicit — don't write workflows that assume subagents can talk to each other.

| Capability | OpenCode mechanism |
|------|----------|
| Dispatch a subagent | `task` tool, targeting a `mode: subagent` agent defined in `.opencode/agents/` (or a built-in: `general`, `explore`, `scout`) |
| Run several subagents in parallel | Multiple `task` calls issued in the same turn |
| Pass data between subagents | File-based (`_workspace/`) or return-value-based (task tool result goes to the orchestrator only) |
| Let a subagent delegate further | Subagent invokes `task` itself, if its own permissions allow it (`permission.task`) — keep nesting to at most 2 levels; deeper delegation adds latency and loses context fast |
| Manual user override | The user can always invoke a subagent directly with `@agent-name` in the OpenCode TUI |

> Detailed comparison and a pattern-selection decision tree: see "Execution model" in `references/agent-design-patterns.md`.

#### 2-2. Choosing an architecture pattern

1. Decompose the task into areas of expertise.
2. Decide the subagent fleet's shape (see `references/agent-design-patterns.md` for full pattern descriptions):
   - **Pipeline**: sequentially dependent steps
   - **Fan-out/Fan-in**: parallel independent work merged at the end
   - **Expert pool**: pick-and-call a specialist based on context
   - **Producer-reviewer**: generate, then quality-check
   - **Supervisor**: a central agent tracks state and dispatches work dynamically
   - **Hierarchical delegation**: a top-level agent recursively delegates to sub-agents

All six patterns run on the same underlying mechanism (orchestrator + `task` tool); what differs is the dispatch topology and how much the orchestrator has to relay between rounds.

#### 2-3. Criteria for splitting agents

Judge along four axes: specialization, parallelizability, context load, reusability. Full criteria table: "Agent separation criteria" in `references/agent-design-patterns.md`. Overlap/reuse review against existing agents happens in Phase 3-0.

### Phase 3: Generate agent definitions

#### 3-0. Check for overlap with existing agents

Before creating a new agent, check it against the existing agents in `project/.opencode/agents/`. Building harnesses repeatedly tends to accumulate agents with overlapping responsibilities under different names.

> Classification criteria and reuse design: "Agent reuse design" in `references/agent-design-patterns.md`.

**Every agent must be defined as a `project/.opencode/agents/{name}.md` file.** Putting a role directly into a `task` tool prompt without a backing agent file is not allowed. Why:
- An agent only survives to the next session if it exists as a file.
- Dispatch protocol (inputs/outputs, error handling) needs to be written down for hand-offs to work reliably.
- The harness's core value is separating the agent (who) from the skill (how).

Even when reusing a built-in subagent (`general`, `explore`, `scout`), still create an agent definition file for the custom role wrapped around it, or — if you truly need the unmodified built-in — reference it directly and document why no custom file was needed.

**Model assignment:** Give every custom agent an explicit `model` field in its frontmatter. For quality-critical roles (design, synthesis, verification, orchestration itself) assign the strongest reasoning model available from your configured provider; lighter, more mechanical roles (formatting, simple extraction) can use a faster/cheaper model. Don't leave `model` unset for a role where quality matters — subagents otherwise inherit the primary agent's model, which may not be the right trade-off for that specific role.

**No fleet reconfiguration needed:** because OpenCode subagents don't hold a session-spanning "team" state, there's nothing to tear down between phases — the orchestrator simply calls a different set of subagents in the next phase. Don't port over Claude Code's "tear down the team, create a new one" ceremony; it doesn't apply here.

Define each agent in `project/.opencode/agents/{name}.md`. Required sections in the body (the body itself is the agent's system prompt): core role, working principles, input/output protocol, error handling, collaboration. Add a **`## Hand-off protocol`** section describing what the orchestrator will feed this agent (and from which prior agent's output) and what file/return-value shape it must produce for the orchestrator to relay onward.

> Definition template and full worked examples: "Agent definition structure" in `references/agent-design-patterns.md` + `references/orchestration-examples.md`.

**Mandatory when a QA agent is included:**
- Use the `general` subagent (or a custom agent with equivalent permissions) for QA — never a read-only agent like `explore`, since QA needs to run verification scripts, not just read files.
- QA's core job is not "does it exist" but **"cross-boundary comparison"** — read the API response and the front-end hook that consumes it side by side, and compare their shapes.
- Run QA **incrementally, right after each module is finished** — not once at the very end.
- Detailed guide: `references/qa-agent-guide.md`.

### Phase 4: Generate skills

Generate the skill each agent uses at `project/.opencode/skills/{name}/SKILL.md`. Detailed writing guide: `references/skill-writing-guide.md`.

#### 4-0. Check for overlap with existing skills

Before creating a new skill, check it against the existing skills in `project/.opencode/skills/`. Skills with overlapping functionality under different names accumulate the same way agents do.

> Classification criteria and generalization patterns: "Skill reuse design" in `references/skill-writing-guide.md`.

#### 4-1. Skill structure

```
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter (name, description required)
│   └── Markdown body
└── Bundled resources (optional)
    ├── scripts/    - executable code for repetitive/deterministic work
    ├── references/ - conditionally-loaded reference docs
    └── assets/     - files used in output (templates, images, etc.)
```

Note OpenCode's frontmatter validation rules for skills: `name` must be 1–64 characters, lowercase alphanumeric with single hyphens (`^[a-z0-9]+(-[a-z0-9]+)*$`), and must match the containing directory name exactly. `description` must be 1–1024 characters. Skills placed at `.opencode/skills/<name>/SKILL.md`, `.claude/skills/<name>/SKILL.md`, or `.agents/skills/<name>/SKILL.md` are all discovered natively by OpenCode — default to `.opencode/skills/` for anything generated by this harness.

#### 4-2. Writing the description — bias it toward triggering

The description is a skill's only trigger mechanism. Agents tend to judge triggering conservatively, so write descriptions that are **pushy** on purpose.

**Bad:** `"A skill for handling PDF documents"`
**Good:** `"Reads PDFs, extracts text/tables, merges, splits, rotates, watermarks, encrypts, and OCRs — handles every PDF operation. Use this skill whenever a .pdf file is mentioned or a PDF deliverable is requested."`

Key: describe both what the skill does and the concrete situations that should trigger it, and draw a clear boundary against similar-but-wrong triggers.

#### 4-3. Body-writing principles

| Principle | Explanation |
|------|------|
| **Explain why** | Instead of forceful "ALWAYS/NEVER" directives, explain the reasoning. An agent that understands the reason judges edge cases correctly too. |
| **Stay lean** | The context window is a shared resource. Target under 500 lines for the SKILL.md body; delete or move to `references/` anything that isn't pulling its weight. |
| **Generalize** | Explain the underlying principle rather than writing narrow rules that only fit one example. Don't overfit. |
| **Bundle repeated code** | If test runs reveal agents independently writing the same helper script, pre-bundle it under `scripts/`. |
| **Write in the imperative** | Use direct, instructional phrasing — a skill is a set of instructions, not a description. |

#### 4-4. Progressive disclosure

Skills manage context through a three-tier loading system:

| Tier | Loaded | Size target |
|------|----------|----------|
| **Metadata** (name + description) | Always in context | ~100 words |
| **SKILL.md body** | When the skill triggers | <500 lines |
| **references/** | Only when needed | Unbounded (scripts run without being loaded into context at all) |

**Size-management rules:**
- As SKILL.md approaches 500 lines, split detail into `references/` and leave a pointer in the body saying when to read that file.
- Any reference file over 300 lines gets a **table of contents** at the top.
- If there are domain/framework-specific variants, split them by domain under `references/` so only the relevant file gets loaded.

```
cloud-deploy/
├── SKILL.md (workflow + selection guide)
└── references/
    ├── aws.md    ← loaded only when AWS is selected
    ├── gcp.md
    └── azure.md
```

#### 4-5. Skill-to-agent wiring

- One agent ↔ one or many skills (1:1 or 1:N).
- A skill can be shared across multiple agents.
- A skill holds "how to do it"; an agent holds "who does it."

> Detailed patterns, examples, and data-schema standards: `references/skill-writing-guide.md`.

### Phase 5: Integration and orchestration

The orchestrator is a specialized skill that wires individual agents and skills together into one workflow. Where the skills from Phase 4 define "what each agent does and how," the orchestrator defines "who runs when, in what order." Concrete template: `references/orchestrator-template.md`.

**Modifying the orchestrator when extending an existing harness:** don't create a new orchestrator from scratch — edit the existing one. When adding an agent, fold it into the fleet composition, task assignment, and data flow, and add trigger keywords for the new agent to the description.

#### 5-0. Orchestrator pattern

There is one orchestrator pattern: the primary agent dispatches subagents through the `task` tool and relays results between them via files or by including prior output in the next prompt.

```
[Orchestrator]
    ├── task(agent-1, ...)         — sequential or parallel, per the phase's needs
    ├── task(agent-2, ...)
    ├── read _workspace/ artifacts, relay relevant parts forward
    ├── collect results and synthesize
    └── report to the user
```

All six architecture patterns from Phase 2-2 are variations on this same loop — a pipeline calls agents one after another and relays each output forward; a fan-out/fan-in issues several `task` calls in one turn and merges the results; a supervisor keeps its own todo list (`todowrite`/`todoread`) and issues the next batch of `task` calls itself instead of letting workers self-claim work, since there's no shared, self-claimable task board for subagents to draw from.

#### 5-1. Data-passing protocol

State in the orchestrator how data moves between agents:

| Strategy | Mechanism | Good for |
|------|------|-----------|
| **File-based** | Write to an agreed `_workspace/` path, orchestrator reads it back | Large data, structured artifacts, audit trails |
| **Return-value-based** | The `task` tool's return value, going straight to the orchestrator | Small results the orchestrator needs immediately to decide the next step |

**Recommended combination:** file-based for artifacts + return-value-based for short status/summary the orchestrator needs to decide what to dispatch next.

Rules for file-based hand-off:
- Create a `_workspace/` folder under the working directory to hold intermediate artifacts.
- File naming convention: `{phase}_{agent}_{artifact}.{ext}` (e.g. `01_analyst_requirements.md`).
- Only the final artifact goes to the user-specified output path; intermediate files (`_workspace/`) are preserved (for later verification/audit).

#### 5-2. Error handling

Include an error-handling policy in the orchestrator. Core principle: retry once, and if it fails again, proceed without that result (call out the gap explicitly in the report); never silently delete conflicting data — keep it and note the source.

> Strategy table by error type and implementation detail: "Error handling" in `references/orchestrator-template.md`.

#### 5-3. Fan-out sizing guidelines

| Task scale | Recommended parallel `task` calls per phase | Tasks per subagent |
|----------|------------|--------------|
| Small (5–10 tasks) | 2–3 | 3–5 |
| Medium (10–20 tasks) | 3–5 | 4–6 |
| Large (20+ tasks) | 5–7 | 4–5 |

> More parallel subagents means more relaying work for the orchestrator between rounds. Three focused subagents beat five that need constant hand-holding.

#### 5-4. Register the harness pointer and team changelog

Once the harness is set up, register a minimal pointer in the project's `AGENTS.md` (use `CLAUDE.md` instead only if the project is intentionally kept Claude Code-compatible and already relies on that file). `AGENTS.md` loads on every session, so recording the harness's existence, trigger rule, and changelog path lets the orchestrator skill handle the rest without loading historical entries into every session.

Store each team's history at `changelog/{team-name}/CHANGELOG.md`. Use a stable lowercase-hyphen slug for `{team-name}`, normally derived from the fleet or domain name. Different teams must use different subdirectories so their histories remain independent.

**AGENTS.md template:**

````markdown
## {domain name}

**Goal:** {one line: the harness's core objective}

**Trigger:** Use the `{orchestrator-skill-name}` skill for {domain}-related requests. Simple questions can be answered directly.

**Changelog:** `changelog/{team-name}/CHANGELOG.md`
````

**Team changelog template (`changelog/{team-name}/CHANGELOG.md`):**

````markdown
# {Team Name} Changelog

| Date | Change | Target | Reason |
|------|----------|------|------|
| {YYYY-MM-DD} | Initial setup | All | - |
````

**What NOT to put in AGENTS.md:** changelog entries, the agent list, the skill list, directory structure, or detailed execution rules. Why: historical entries waste always-loaded context, while the agent/skill list is already managed by the orchestrator skill and by `.opencode/agents/`, `.opencode/skills/` themselves. `AGENTS.md` holds only **the harness pointer and the changelog file path**.

**Migrating an existing inline changelog:** move every existing row from the `AGENTS.md` changelog table into `changelog/{team-name}/CHANGELOG.md` without rewriting dates or content, then replace the inline table with the single path pointer shown above.

#### 5-5. Supporting follow-up work

The orchestrator has to handle follow-up requests, not just the initial run. Guarantee the following three things:

**1. Include follow-up keywords in the orchestrator's description:**
Initial-build keywords alone won't trigger follow-up requests. The description must also include phrasing like:
- "run again", "re-run", "update", "fix", "improve"
- "just redo the {sub-task} part of {domain}"
- "based on the previous results", "improve the result"

**2. Add a context-check step to Phase 1 of the orchestrator:**
At the start of the workflow, check whether prior artifacts exist to decide the execution mode:
- `_workspace/` exists + user asked for a partial fix → **partial re-run** (re-dispatch only the relevant agent)
- `_workspace/` exists + user provided new input → **fresh run** (move the existing `_workspace/` to `_workspace_prev/` first)
- `_workspace/` doesn't exist → **initial run**

**3. Include re-invocation guidance in each agent definition:**
Each agent `.md` file should state "what to do when prior output exists":
- If a previous result file exists, read it and fold in the improvement.
- If user feedback is given, modify only the relevant part.

> See the "Phase 0: Context check" section of the orchestrator template: `references/orchestrator-template.md`.

### Phase 6: Verification and testing

Verify the generated harness. Detailed test methodology: `references/skill-testing-guide.md`.

#### 6-1. Structural verification

- Confirm every agent file is in the right location.
- Validate each skill's frontmatter (`name`, `description`, name/directory match, length limits).
- Confirm cross-references between agents are consistent.
- Confirm no `.opencode/commands/` files were created.

#### 6-2. Dispatch verification

- Confirm each agent's input/output wiring, which agent dispatches which, and whether parallel `task` calls are used where the design calls for them.
- Confirm the orchestrator's relay logic — every hand-off that Phase 2-1 flagged as "would be direct agent-to-agent messaging in a peer system" is explicitly relayed through the orchestrator here.

#### 6-3. Skill execution testing

Run real execution tests against each generated skill:

1. **Write test prompts** — 2–3 realistic prompts per skill, phrased the way an actual user would type them.

2. **With-skill vs. without-skill comparison** — where practical, run both in parallel to confirm the skill adds value. Dispatch two subagents:
   - **With-skill**: reads the skill and performs the task.
   - **Without-skill (baseline)**: performs the same prompt with no skill.

3. **Evaluate results** — qualitatively (user review) and quantitatively (assertion-based) as appropriate. Where output is objectively checkable (file created, data extracted, etc.), define assertions; where it's subjective (prose style, design), rely on user feedback.

4. **Iterate** — if problems surface:
   - Generalize the fix (don't patch narrowly for one example only).
   - Retest after the fix.
   - Repeat until the user is satisfied or improvements plateau.

5. **Bundle repeated patterns** — if test runs show agents independently writing the same helper code, pre-bundle it under `scripts/`.

#### 6-4. Trigger verification

Verify that each skill's description triggers correctly:

1. **Should-trigger queries** (8–10) — varied phrasings that should trigger the skill (formal/casual, explicit/implicit).
2. **Should-NOT-trigger queries** (8–10) — "near-miss" queries with similar keywords where a different tool/skill is actually the right fit.

**Writing good near-misses:** an obviously unrelated query ("write a Fibonacci function") has no test value. A genuinely ambiguous query ("extract the chart from this Excel file as a PNG" — xlsx skill vs. image-conversion) is a good test case.

Check for trigger conflicts with existing skills at this stage too.

#### 6-5. Dry-run testing

- Review whether the orchestrator skill's phase ordering is logical.
- Confirm there are no dead links in the data-passing path.
- Confirm every agent's input matches the previous phase's output.
- Confirm fallback paths are actually executable for each error scenario.

#### 6-6. Write test scenarios

- Add a `## Test scenarios` section to the orchestrator skill.
- Describe at least one happy-path flow and one error flow.

### Phase 7: Harness evolution

A harness isn't a static artifact you build once and walk away from — it's a system that keeps evolving with user feedback.

#### 7-1. Collect feedback after each run

After every harness run, ask the user for feedback:
- "Is there anything about the result you'd like improved?"
- "Anything you'd change about the fleet composition or workflow?"

If there's no feedback, move on. Don't push, but always offer the opening.

#### 7-2. Where feedback routes to

Different feedback types point at different things to modify:

| Feedback type | Target | Example |
|-----------|----------|------|
| Output quality | That agent's skill | "The analysis feels shallow" → add a depth standard to the skill |
| Agent's role | Agent definition `.md` | "We also need a security review" → add a new agent |
| Workflow order | Orchestrator skill | "Verification should happen first" → reorder phases |
| Fleet composition | Orchestrator + agents | "These two could probably be merged" → merge agents |
| Missing trigger | Skill description | "This phrasing didn't work" → broaden the description |

#### 7-3. Changelog

Record every harness change in the team's dedicated changelog referenced by `AGENTS.md`, never as an inline table in `AGENTS.md`. For example, `changelog/content-team/CHANGELOG.md`:

```markdown
# Content Team Harness Changelog

| Date | Change | Target | Reason |
|------|----------|------|------|
| 2026-04-05 | Initial setup | All | - |
| 2026-04-07 | Added QA agent | .opencode/agents/qa.md | Feedback: output quality not verified enough |
| 2026-04-10 | Added tone guide | .opencode/skills/content-creator | Feedback: "too stiff" |
```

This per-team changelog tracks how each harness has evolved without making every historical entry part of the always-loaded project instructions.

#### 7-4. Evolution triggers

Propose evolving the harness not only when the user explicitly says "update the harness," but also when:
- The same type of feedback repeats 2+ times.
- A recurring failure pattern shows up in an agent.
- You notice the user routinely working around the orchestrator by hand.

#### 7-5. Operations/maintenance workflow

Systematically audit, fix, and sync an existing harness. Follow this when Phase 0 routes you into the "operate/maintain" branch.

**Step 1: Status audit**
- Compare the file list in `.opencode/agents/` against the agent composition described in the orchestrator skill → produce a list of mismatches.
- Compare the `.opencode/skills/` directory listing against the orchestrator's skill composition → produce a list of mismatches.
- Report the audit to the user.

**Step 2: Incremental add/modify**
- Add/modify/delete agents and skills per the user's request.
- One change at a time; run Step 3 (sync) immediately after each change.

**Step 3: Update the team changelog**
- Resolve the changelog path from the team's `AGENTS.md` pointer.
- Record date, change, target, and reason in `changelog/{team-name}/CHANGELOG.md`.
- If the harness still has a legacy inline changelog, migrate it using Phase 5-4 before appending the new entry.

**Step 4: Verify the change**
- Structural verification of the modified agent/skill (per Phase 6-1 criteria).
- If the change affects triggering, run trigger verification (per Phase 6-4 criteria).
- For large changes (architecture change, 3+ agents added/removed), also run Phase 6-3 (execution test) and 6-5 (dry-run).
- Final check that the `AGENTS.md` pointer, team changelog, orchestrator composition, and actual files on disk agree.

## Deliverable checklist

Confirm after generation:

- [ ] `project/.opencode/agents/` — **agent definition files created** (including for built-in-backed roles)
- [ ] `project/.opencode/skills/` — skill files (`SKILL.md` + `references/`), frontmatter valid (name matches directory, lowercase-hyphen, description ≤1024 chars)
- [ ] One orchestrator skill (includes data flow + error handling + test scenarios)
- [ ] Dispatch topology stated (which architecture pattern(s) from Phase 2-2, and the relay points between subagent calls)
- [ ] Every custom agent has an explicit `model` field set deliberately, not left to inherit by default
- [ ] Overlap review against existing agents completed before creating new ones (Phase 3-0)
- [ ] Overlap review against existing skills completed before creating new ones (Phase 4-0)
- [ ] `.opencode/commands/` — nothing created here
- [ ] No conflicts with existing agents/skills
- [ ] Skill descriptions are written pushy — **follow-up keywords included**
- [ ] SKILL.md bodies under 500 lines, split into `references/` if they exceed it
- [ ] Execution verified with 2–3 test prompts
- [ ] Trigger verification (should-trigger + should-NOT-trigger) completed
- [ ] **Harness pointer registered in `AGENTS.md`** (goal + trigger rule + team changelog path)
- [ ] **Dedicated `changelog/{team-name}/CHANGELOG.md` created for each team**
- [ ] **Agent/skill additions/removals/edits recorded in the relevant team's changelog, not inline in `AGENTS.md`**
- [ ] **Orchestrator Phase 1 has a context-check step** (initial vs. follow-up vs. partial re-run)

## References

- Harness patterns: `references/agent-design-patterns.md`
- Existing harness examples (full worked files): `references/orchestration-examples.md`
- Orchestrator template: `references/orchestrator-template.md`
- **Skill-writing guide**: `references/skill-writing-guide.md` — writing patterns, examples, data-schema standards
- **Skill-testing guide**: `references/skill-testing-guide.md` — test/evaluation/iteration methodology
- **QA agent guide**: `references/qa-agent-guide.md` — reference this when including a QA agent in a build harness. Covers integration-coherence verification methodology, boundary-bug patterns, and a QA agent definition template, based on 7 real bug cases found in production projects.
