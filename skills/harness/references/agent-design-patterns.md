# Agent Design Patterns

## Execution model: orchestrator + `task`-tool subagents

OpenCode has one native multi-agent mechanism, and every pattern in this document is built on it.

### How it works

The primary agent (the orchestrator) dispatches subagents through the `task` tool. Subagents run as isolated child sessions: they don't see each other's context and can't message each other directly. Every hand-off is mediated by the orchestrator — either the subagent's return value goes straight back to the orchestrator, or the subagent writes an artifact to `_workspace/` that the orchestrator reads and relays (in full or in part) into the next subagent's prompt.

```
[Orchestrator] → task(agent-A) → returns to orchestrator
              → task(agent-B) → returns to orchestrator
              → task(agent-C) → returns to orchestrator
                     │
                     ↓ orchestrator reads _workspace/ artifacts, relays context forward, synthesizes
```

**Core tool:**
- `task({ description, prompt, subagent_type })` (or the `@agent-name` mention in the OpenCode TUI, for a user-triggered dispatch) — invokes a subagent defined in `.opencode/agent/` or a built-in (`general`, `explore`, `scout`).

**Characteristics:**
- Fast, lightweight, token-efficient — results summarize back into the orchestrator's context.
- Multiple `task` calls in the same turn run in parallel.
- The orchestrator owns all coordination; there is no shared, self-claimable task board subagents pull work from on their own.
- A subagent can itself call `task` to delegate further, if its `permission.task` allows it — useful for hierarchical delegation, but keep nesting to ≤2 levels since latency and context loss compound quickly.

**What this means for design:** if you're used to Claude Code's Agent Teams (`SendMessage`, a shared `TaskCreate`/`TaskUpdate` board), the mental model to drop is "agents negotiate with each other in real time." In OpenCode, cross-agent negotiation has to be simulated: the orchestrator collects both sides' output, and either synthesizes the resolution itself or re-dispatches one agent with the other's findings included in the prompt. This adds a round-trip compared to a peer-messaging system, but the resulting workflow is simpler to reason about and just as capable for the vast majority of harnesses.

### When you need more than one agent

```
Do you have 2+ agents?
├── Yes → decide the dispatch topology (see architecture patterns below):
│         sequential (pipeline), parallel (fan-out/fan-in), conditional (expert pool),
│         iterative (producer-reviewer), dynamic (supervisor), or nested (hierarchical).
│         All of these are orchestrator + task-tool dispatch; they differ in shape, not mechanism.
│
└── No (1 agent) → dispatch it directly, no fleet design needed.
```

> **Core principle:** every pattern below is a variation on "the orchestrator decides who runs, when, and what gets relayed forward." Design the relay points explicitly — they're where quality is won or lost, since that's where information that would flow automatically between peers in a messaging system has to be deliberately carried over.

---

## Fleet architecture types

### 1. Pipeline
Sequential workflow. Each agent's output becomes the next agent's input.

```
[Analyze] → [Design] → [Implement] → [Verify]
```

**Good for:** each step depends heavily on the previous step's output.
**Example:** novel writing — worldbuilding → characters → plot → drafting → editing.
**Watch out for:** a bottleneck anywhere delays the whole pipeline. Design each step to be as self-contained as possible.
**Dispatch shape:** strictly sequential `task` calls, each fed the previous agent's file output. Parallelize any sub-steps within a stage that don't actually depend on each other.

### 2. Fan-out/Fan-in
Parallel work, merged at the end. Independent tasks run simultaneously.

```
         ┌→ [Specialist A] ─┐
[Split] → ├→ [Specialist B] ─┼→ [Merge]
         └→ [Specialist C] ─┘
```

**Good for:** the same input needs analysis from several independent angles.
**Example:** comprehensive research — official sources / media / community / background investigated at once, then merged into one report.
**Watch out for:** the merge step's quality determines the whole result's quality. Since subagents can't cross-check each other mid-flight the way peers in a messaging system could, the orchestrator's synthesis step has to actively look for and reconcile conflicting findings, not just concatenate them.
**Dispatch shape:** N parallel `task` calls in one turn, each writing to its own `_workspace/` artifact; orchestrator reads all N and merges.

### 3. Expert pool
Route to whichever specialist fits the input.

```
[Router] → { Specialist A | Specialist B | Specialist C }
```

**Good for:** different input types need different handling.
**Example:** code review — call only the security/performance/architecture specialist that's relevant.
**Watch out for:** the router's classification accuracy is the crux of the pattern.
**Dispatch shape:** the orchestrator classifies first (cheaply, often without a subagent at all), then makes a single targeted `task` call.

### 4. Producer-reviewer
A producer and a reviewer agent work as a pair.

```
[Produce] → [Review] → (if issues) → [Produce] again
```

**Good for:** output quality matters and objective review criteria exist.
**Example:** webcomic panels — artist generates → reviewer checks → flagged panels get regenerated.
**Watch out for:** always cap the retry count (2–3) to avoid infinite loops.
**Dispatch shape:** the orchestrator alternates `task` calls to producer and reviewer, feeding the reviewer's report back into the producer's next prompt each round — this loop replaces the direct producer↔reviewer messaging a peer system would use.

### 5. Supervisor
A central agent tracks state and dynamically assigns work to workers.

```
         ┌→ [Worker A]
[Supervisor] ─┼→ [Worker B]    ← supervisor reads progress, assigns dynamically
         └→ [Worker C]
```

**Good for:** variable workload, or work that needs runtime-decided batching.
**Example:** large-scale code migration — the supervisor analyzes the file list and assigns batches to workers.
**Difference from fan-out:** fan-out fixes the split up front; a supervisor adjusts assignment as it goes.
**Watch out for:** keep delegation units large enough that the supervisor itself doesn't become the bottleneck.
**Dispatch shape:** since OpenCode subagents can't self-claim from a shared board, the supervisor (the orchestrator, or a dedicated supervisor agent one level down) keeps its own todo list (`todowrite`/`todoread`) and explicitly issues each worker's next `task` call itself — there's no "workers pull their own next task" mechanic to lean on.

### 6. Hierarchical delegation
A top-level agent recursively delegates to sub-agents. Complex problems get broken down in stages.

```
[Lead] → [Team lead A] → [Worker A1]
                        → [Worker A2]
       → [Team lead B] → [Worker B1]
```

**Good for:** problems that naturally decompose into a hierarchy.
**Example:** full-stack app development — lead → frontend lead → (UI/logic/tests) + backend lead → (API/DB/tests).
**Watch out for:** more than 3 levels deep adds significant latency and context loss. Keep it to 2 levels.
**Dispatch shape:** this is the one pattern where nested `task` calls (a subagent invoking `task` itself) are the natural fit — grant `permission.task` to the mid-level "lead" agents so they can dispatch their own workers, and keep the depth cap in mind.

## Composite patterns

Real harnesses more often combine patterns than use a single one in isolation:

| Composite pattern | Composition | Example |
|----------|------|------|
| **Fan-out + producer-reviewer** | Parallel generation, each independently reviewed | Multilingual translation — 4 languages translated in parallel, each checked by a native reviewer |
| **Pipeline + fan-out** | Some sequential stages parallelized internally | Analysis (sequential) → implementation (parallel) → integration test (sequential) |
| **Supervisor + expert pool** | Supervisor dynamically calls the right specialist | Customer inquiry handling — supervisor classifies the inquiry, then assigns the matching specialist |

### Dispatch discipline in composite patterns

Whatever the composition, the orchestrator is always the one deciding what gets relayed between rounds — there's no shortcut where two subagents settle something between themselves. Be deliberate about what each relay carries forward:

| Scenario | What the orchestrator relays |
|---------|----------|
| **Research + analysis** | Each researcher's raw findings, so the analyzer sees potentially conflicting sources together |
| **Design + implement + verify** | The design doc forward to the implementer; the implementer's diff/output forward to the verifier |
| **Supervisor + workers** | Per-worker task assignments plus enough shared context that workers don't duplicate effort |
| **Produce + review** | The reviewer's specific, actionable feedback back into the producer's next prompt |

> A single-subagent dispatch (no fleet at all) is the right call only when the work is genuinely a one-shot, fully isolated task.

## Choosing an agent type

Specify which agent to dispatch via the `task` tool's `subagent_type` parameter (or `@agent-name` for a manual, user-triggered call).

### Built-in types

| Type | Tool access | Good for |
|------|----------|-----------|
| `general` | Full, except `todo` (includes web search/fetch) | Web research, general-purpose multi-step work |
| `explore` | Read-only (no edit/write) | Codebase exploration, pattern search, analysis |
| `scout` | Read-only, dependency-aware | External docs/dependency research, cross-referencing local code against upstream sources |

Note: unlike Claude Code's built-in `Plan` type, OpenCode's `plan` is a **primary** agent (mode: `primary`) that the user switches into via Tab — it cannot be dispatched as a subagent through `task`. If you need a delegated, read-only "think before acting" role, define a **custom** agent with `permission: { edit: deny, bash: deny }` rather than reaching for `plan`.

### Custom types

Define an agent at `.opencode/agent/{name}.md` and dispatch it with `subagent_type: "{name}"`. Custom agents get whatever tool access their `permission` config grants — up to full access.

### Selection guide

| Situation | Recommended | Why |
|------|------|------|
| Complex role, reused across sessions | **Custom agent** (`.opencode/agent/`) | Persona and working principles live in a file |
| Simple one-off research/collection, a prompt is enough | **`general`** + a detailed prompt | No agent file needed; instructions live in the prompt |
| Read-only code inspection (analysis/review) | **`explore`** | Prevents accidental file edits |
| External dependency/docs research | **`scout`** | Purpose-built for that; avoids polluting the main workspace |
| Read-only planning/design delegated to a subagent | **Custom agent** with `permission: { edit: deny, bash: deny }` | `plan` itself can't be dispatched as a subagent |
| Implementation work requiring file edits | **Custom agent** | Full tool access + specialized instructions |

**Principle:** define every agent as a `.opencode/agent/{name}.md` file, even when it's a thin wrapper around a built-in type — the role, principles, and hand-off protocol need to exist as a file to be reusable in the next session and to keep dispatch quality consistent.

**Model:** give every custom agent an explicit `model` field. Use the strongest reasoning model your provider offers for quality-critical roles; a faster/cheaper model is fine for mechanical, low-stakes roles. Don't leave it unset by default — subagents otherwise silently inherit the primary agent's model.

## Agent definition structure

```markdown
---
description: "One or two sentences describing the role. List trigger keywords."
mode: subagent
model: provider/model-id
permission:
  edit: allow   # or deny/ask, per role
  bash: allow
---

You are an expert [role] for [domain].

## Core role
1. Responsibility 1
2. Responsibility 2

## Working principles
- Principle 1
- Principle 2

## Input/output protocol
- Input: [where it comes from, what it contains]
- Output: [where it's written, what it contains]
- Format: [file format, structure]

## Hand-off protocol
- Receives from: [which upstream agent's output the orchestrator will feed this agent, and in what shape]
- Produces for: [what the orchestrator relays onward, to which downstream agent or to the final synthesis]

## Error handling
- [behavior on failure]
- [behavior on timeout]

## Collaboration
- [relationship to other agents in the fleet]
```

Note the frontmatter differences from a Claude Code agent definition: there's no `name:` field (the filename — `{name}.md` — is the agent's name), and `mode`/`permission`/`model` replace Claude Code's implicit tool-access model.

## Agent-separation criteria

| Criterion | Split | Merge |
|------|------|------|
| Specialization | Different domains → split | Overlapping domains → merge |
| Parallelizability | Can run independently → split | Sequentially dependent → consider merging |
| Context load | Heavy context burden → split | Light and fast → consider merging |
| Reusability | Used by other fleets too → split | Only used in this fleet → consider merging |

## Agent reuse design

Before creating a new agent, check it against existing ones. Building harnesses repeatedly tends to accumulate agents with overlapping roles under different names.

| Situation | Action |
|------|------|
| An existing agent fully covers the new role | Don't create a new one — reuse the existing agent |
| An existing agent partially covers it and can be generalized | Generalize the existing agent to extend it |
| The overlap is intentional domain specialization | Proceed with a new agent — keep them separate |
| The role is entirely different | Proceed with a new agent |

**Principle:** the more an agent focuses on a single role, the more reusable it is and the less duplication accumulates. If a role covers two or more responsibilities, check first whether it can be split.

**When generalizing an existing agent:** this can change behavior for any orchestrator/fleet that depends on it. Check dependencies before extending, and dry-run afterward to confirm existing behavior is preserved.

## Skill vs. agent distinction

| Aspect | Skill | Agent |
|------|-------------|-----------------|
| Definition | Procedural knowledge + tool bundle | Expert persona + behavioral principles |
| Location | `.opencode/skills/` | `.opencode/agent/` |
| Trigger | Matches a user request's keywords, or loaded via the `skill` tool | Explicitly dispatched via the `task` tool (or `@mention`) |
| Size | Small to large (a full workflow) | Small (a role definition) |
| Purpose | "How it's done" | "Who does it" |

A skill is the **procedural guide** an agent consults while doing work. An agent is the **expert-role definition** that makes use of skills.

## How skills connect to agents

Three ways an agent can make use of a skill:

| Approach | Implementation | Good for |
|------|------|-----------|
| **Skill-tool invocation** | The agent's prompt says to call the `skill` tool for `skill-name` | The skill is an independent, reusable workflow that's also user-invokable on its own |
| **Inline in the prompt** | The skill's content is embedded directly in the agent definition | The skill is short (≤50 lines) and used only by this agent |
| **Loaded reference** | The agent reads the skill's `references/` files on demand | The skill's content is large and only conditionally relevant |

Recommendation: use the `skill` tool when reusability matters, inline it when it's agent-specific, and load-on-demand when it's large.
