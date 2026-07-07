# opencode Agent Design Patterns

Use this reference when deciding how many agents to create, how they should be coordinated, and how agents and skills should relate inside an opencode harness.

## 1. Execution modes

opencode harnesses are orchestrated by the primary agent. Specialist subagents are called with `task`, return results to the caller, and should not be assumed to communicate with each other directly.

### 1-1. Parallel task subagents — default for independent specialist work

Use when multiple specialists can work from the same input or from disjoint work packages.

```text
[primary orchestrator]
   ├── task → specialist A → summary + artifacts
   ├── task → specialist B → summary + artifacts
   └── task → specialist C → summary + artifacts
              ↓
       primary integrates results
```

**Good for**

- Fan-out research and synthesis.
- Independent implementation batches.
- Security/performance/test review from different perspectives.
- Producer output plus independent QA.

**Working rules**

- Launch independent tasks in the same turn when possible.
- Give each task a complete prompt: goal, context, exact files, constraints, acceptance criteria, and verification command.
- Tell subagents where to write large outputs under `_workspace/`.
- The primary agent resolves conflicts and creates the final user-facing output.

**Constraints**

- Subagents do not share context unless the primary prompt or `_workspace/` artifact gives it to them.
- Subagent output is summarized; do not rely on it for large raw data unless the agent writes files.
- The primary agent owns integration, verification, and final reporting.

### 1-2. Sequential pipeline

Use when the next phase cannot start until the prior phase produces a decision or artifact.

```text
[analysis] → [design] → [implementation] → [verification]
```

**Good for**

- Architecture before implementation.
- Migration planning before code edits.
- Draft → review → revise loops.

**Risk**

A blocked phase stalls everything. Keep each phase as independent and verifiable as possible.

### 1-3. Single-agent workflow

Use when the task is small, tightly coupled, or cheaper to do directly than to coordinate.

Examples:

- Single-file skill cleanup.
- Minor description rewrite.
- Small config-only change.

### 1-4. Hybrid workflow

Use different modes in different phases.

Examples:

- Parallel discovery → primary integration → independent QA.
- Sequential design → parallel implementation batches → sequential build/test fix.
- Parallel content drafts → primary editorial pass.

State the execution mode at the top of each orchestrator phase.

## 2. Architecture patterns

### 2-1. Pipeline

A sequence of dependent stages.

```text
[analyst] → [designer] → [implementer] → [qa]
```

**Use when** each step depends on a specific output from the previous step.

**Watch for** bottlenecks. If a stage has independent subparts, split that stage into parallel tasks.

### 2-2. Fan-out / fan-in

Independent specialists work in parallel, then one integrator combines their results.

```text
          ┌→ [specialist A] ─┐
[input] → ├→ [specialist B] ─┼→ [integrator]
          └→ [specialist C] ─┘
```

**Use when** the same topic needs several perspectives: official docs, community reports, code inspection, security, performance, tests, UX, etc.

**Quality rule**

The integration step determines the final quality. Require specialists to include evidence, confidence, limitations, and artifact paths.

### 2-3. Expert pool

Route each request to the relevant specialist only.

```text
[router] → { security | performance | docs | tests | data }
```

**Use when** not every request needs every expert.

**Risk**

Router accuracy matters. Write clear trigger boundaries in each agent description.

### 2-4. Producer-reviewer

One agent produces output; another validates it.

```text
[producer] → [reviewer] → primary decides whether to revise
```

**Use when** objective quality gates exist: schema conformance, tests, citations, API contracts, layout requirements, accessibility checks.

**Loop rule**

Limit revision loops. Usually one retry is enough; a second failure should be reported with evidence and options.

### 2-5. Supervisor

The primary agent partitions work and assigns batches dynamically.

```text
[primary supervisor]
   ├→ [worker 1] batch A
   ├→ [worker 2] batch B
   └→ [worker 3] batch C
```

**Use when** work volume is variable: migration across many files, issue triage, large document conversion, or dataset cleanup.

**Batching rule**

Make batches large enough to amortize coordination overhead, but small enough that a failed batch can be retried without losing too much work.

### 2-6. Hierarchical delegation

Use sparingly. Deep trees add latency and lose context.

Preferred maximum depth:

```text
primary → specialist subagent
```

For complex programs, flatten into a primary-led set of specialists unless there is a strong reason to add another layer.

## 3. Choosing agent types

### 3-1. Built-in opencode agents

Use built-ins when they fit the work:

| Agent type | Best use |
|---|---|
| `explore` | Fast codebase search, file discovery, architecture reconnaissance. Use for read-only exploration. |
| `plan` | Research strategy, technical decision support, architecture alternatives, validation of plans. |
| `general` | Broad execution, writing, targeted implementation, QA scripts, data transformation. |
| `build` | Engineering architecture, decomposition, implementation ownership, integration and verification. |
| Research specialists | Official docs, web research, academic research, community signals, validation, synthesis. |

### 3-2. Custom agents

Create a custom agent file when the role will be reused, requires a stable protocol, or has domain-specific constraints.

Accepted locations:

```text
.opencode/agent/{name}.md
.opencode/agents/{name}.md
```

Recommended frontmatter:

```markdown
---
description: "Reviews API contracts and integration boundaries for web apps."
mode: subagent
permission:
  edit: ask
  bash: ask
---
```

The body should define role, principles, I/O protocol, collaboration protocol, and error handling.

## 4. Agent separation criteria

| Criterion | Split into separate agents when... | Merge when... |
|---|---|---|
| Expertise | The work needs different domain knowledge or quality criteria | Roles share the same knowledge and outputs |
| Parallelism | The work can proceed independently | One role cannot start without the other output |
| Context load | A single prompt would become too large or noisy | Context is small and tightly coupled |
| Reuse | The role will be used by other orchestrators | The role is unique to one narrow workflow |
| Risk | Independent review reduces failure risk | Coordination would add more risk than value |

Avoid creating many thin agents that differ only by name. A useful agent owns a coherent responsibility.

## 5. Agent reuse design

Before creating a new agent, compare it to existing agents.

| Finding | Action |
|---|---|
| Existing agent fully covers the role | Reuse it |
| Existing agent partly covers the role and can be generalized | Update it and verify dependent workflows |
| Existing agent is intentionally domain-specific | Create a separate agent |
| No meaningful overlap | Create a new agent |

When generalizing an existing agent, inspect all orchestrators and skills that depend on it. Run a dry run afterward to ensure the old behavior still works.

## 6. Skill vs agent distinction

| Aspect | Skill | Agent |
|---|---|---|
| Defines | Procedure, workflow, references, scripts | Expert role, behavior, constraints, I/O protocol |
| Typical location | `.opencode/skills/{name}/SKILL.md` or configured `skills/{name}/SKILL.md` | `.opencode/agent(s)/{name}.md` |
| Trigger | Skill description and explicit loading | Explicit subagent task or configured default behavior |
| Size | Can be large through references | Should be concise and role-focused |
| Purpose | "How to do this" | "Who should do this" |

A skill can be shared by many agents. An agent can use several skills.

## 7. Connecting skills and agents

Use one of these patterns:

| Pattern | How | Best for |
|---|---|---|
| Explicit skill loading | Agent or orchestrator says to load/use `{skill-name}` | Reusable, user-visible workflows |
| Reference loading | Agent reads a skill reference file or domain reference only when needed | Large detailed material |
| Inline protocol | Agent definition includes a short procedure directly | Tiny agent-specific routines under ~50 lines |
| Orchestrator routing | Orchestrator maps task type → agent + skill | Multi-agent harnesses |

Prefer explicit skill loading for reusable workflows. Prefer references for large content. Avoid copying full skill bodies into agent definitions.
