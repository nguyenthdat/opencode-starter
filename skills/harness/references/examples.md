# opencode Harness Examples

Use these examples as patterns, not as copy-paste final designs. Adapt agent names, skill names, paths, verification commands, and permissions to the project.

## Example 1: Research harness

### Architecture

Fan-out/fan-in with parallel task subagents.

```text
[primary orchestrator]
    ├── official-researcher
    ├── community-researcher
    ├── technical-researcher
    └── background-researcher
          ↓
    integrated report
```

### Agent map

| Specialist | Suggested agent type | Role | Output |
|---|---|---|---|
| official-researcher | research-web or general | Official docs, standards, vendor posts | `_workspace/02_official.md` |
| community-researcher | research-community or general | Field reports, issue trackers, forums | `_workspace/02_community.md` |
| technical-researcher | research-academic or general | Papers, benchmarks, technical reports | `_workspace/02_technical.md` |
| background-researcher | general | Competitors, historical context, adjacent tools | `_workspace/02_background.md` |
| primary orchestrator | current agent | Integration, contradiction handling, final report | final report |

### Workflow

```text
Phase 1: Prepare
  - Clarify topic, decision, audience, and source quality requirements.
  - Create _workspace/ and save research questions.

Phase 2: Parallel research
  - Dispatch each specialist with explicit source scope and output path.
  - Require citations/evidence, confidence, and limitations.

Phase 3: Integration
  - Read all artifacts.
  - Resolve conflicts by source quality and recency.
  - Preserve contradictions when not resolvable.

Phase 4: Validation
  - Run an independent validator if claims are high stakes.
  - Check that final claims trace back to sources.

Phase 5: Report
  - Produce decision-ready summary, findings, recommendations, and gaps.
```

## Example 2: Fiction or long-form writing harness

### Architecture

Hybrid: parallel world/character/plot planning → sequential drafting → parallel review → revision.

```text
Phase 1 parallel: worldbuilder + character-designer + plot-architect
Phase 2 sequential: prose-writer
Phase 3 parallel: continuity-reviewer + style-reviewer + fact-consultant
Phase 4 sequential: prose-writer revision
```

### Agent map

| Specialist | Role | Output |
|---|---|---|
| worldbuilder | Setting, rules, history, locations | `_workspace/01_world.md` |
| character-designer | Character arcs, motivations, relationships | `_workspace/01_characters.md` |
| plot-architect | Plot beats, conflict, pacing | `_workspace/01_plot.md` |
| prose-writer | Draft and revise scenes | `_workspace/02_draft.md`, final manuscript |
| continuity-reviewer | Internal consistency | `_workspace/03_continuity_review.md` |
| style-reviewer | Voice, tone, readability | `_workspace/03_style_review.md` |

### Agent definition excerpt

```markdown
---
description: "Worldbuilding specialist for speculative fiction. Designs physical rules, society, history, locations, and constraints that support the story."
mode: subagent
---

# Worldbuilder

## Core role
Design the story world's physical, social, technological, and historical foundations.

## Working principles
- Preserve internal consistency.
- Ask "if this is true, what changes?" to explore consequences.
- Serve the story; avoid encyclopedic detail that does not affect character or plot.

## Input/output protocol
- Input: user premise, genre constraints, prior artifacts.
- Output: `_workspace/01_world.md`.
- Format: sections for physical rules, society, technology, history, locations, open questions.
```

## Example 3: Producer-reviewer content harness

### Architecture

Sequential producer-reviewer loop with one retry.

```text
[content-producer] → [reviewer] → primary decides pass/revise
```

### Workflow

```text
Phase 1: Producer creates draft in _workspace/01_draft.md.
Phase 2: Reviewer checks against rubric and writes _workspace/02_review.md.
Phase 3: If review has critical failures, producer revises once.
Phase 4: Primary performs final polish and reports unresolved tradeoffs.
```

### Error handling

- If reviewer finds subjective disagreements, primary resolves based on user requirements.
- If reviewer finds objective missing requirements, retry once.
- If retry still fails, report the remaining failure instead of hiding it.

## Example 4: Code review harness

### Architecture

Fan-out/fan-in with independent review perspectives.

```text
[primary]
   ├── security-reviewer
   ├── performance-reviewer
   ├── test-reviewer
   └── architecture-reviewer
       ↓
   consolidated review
```

### Specialist scopes

| Specialist | Focus |
|---|---|
| security-reviewer | Injection, authz/authn, secrets, unsafe deserialization, data exposure |
| performance-reviewer | N+1 queries, hot paths, memory pressure, blocking I/O |
| test-reviewer | Coverage of changed behavior, missing edge cases, flaky tests |
| architecture-reviewer | API compatibility, module boundaries, maintainability |

### Integration rule

The primary report should deduplicate overlapping findings and rank by severity. If reviewers disagree, keep both positions with evidence and state the recommended action.

## Example 5: Code migration harness

### Architecture

Supervisor pattern with batched work.

```text
[primary supervisor]
  1. Discover files and dependencies.
  2. Batch files by risk/complexity.
  3. Dispatch worker subagents per batch.
  4. Integrate and run tests.
```

### Batch strategy

| Batch type | Example | Notes |
|---|---|---|
| Low-risk mechanical | import rename, config key rename | Can run in parallel |
| Medium-risk localized | component API changes | Give each worker clear file ownership |
| High-risk shared | database schema, global types, routing | Prefer sequential work and central review |

### Supervisor loop

```text
1. Inventory target files.
2. Estimate complexity by imports, size, and dependency position.
3. Create batches with minimal overlap.
4. Dispatch workers with exact file lists and acceptance criteria.
5. Review diffs after each batch.
6. Run lint/build/tests.
7. Fix integration issues centrally.
```

### Worker output contract

Each worker returns:

- Files changed.
- Summary of transformation.
- Commands run.
- Failures or skipped files.
- Risk notes for integration.
