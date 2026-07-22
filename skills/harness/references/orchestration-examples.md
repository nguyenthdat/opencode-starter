# Orchestration Examples

Five worked examples, each showing the orchestrator + `task`-tool dispatch pattern applied to a different architecture shape. Every "relay" step below — where one agent's finding gets forwarded into another agent's prompt — is something a peer-messaging system would handle via direct agent-to-agent chat; here the orchestrator does it explicitly.

---

## Example 1: Research fleet

### Architecture: fan-out/fan-in

```
[Orchestrator]
    ├── task(official-researcher)   ─┐
    ├── task(media-researcher)       ├─ parallel, same turn
    ├── task(community-researcher)   │
    ├── task(background-researcher) ─┘
    ├── read all 4 artifacts
    └── synthesize final report
```

### Fleet composition

| Agent | Type | Role | Output |
|------|-------------|------|------|
| official-researcher | `general` | Official docs/blogs | research_official.md |
| media-researcher | `general` | Media/investment coverage | research_media.md |
| community-researcher | `general` | Community/social sentiment | research_community.md |
| background-researcher | `general` | Background/competitive/academic context | research_background.md |
| (orchestrator) | — | Synthesized report | final_report.md |

> Each researcher uses the `general` built-in subagent, but is still defined as a `.opencode/agent/{name}.md` file specifying its role and research scope, so the definition is reusable across sessions.

### Orchestrator workflow

```
Phase 1: Preparation
  - Analyze user input (topic, research mode)
  - Create _workspace/

Phase 2: Dispatch
  - task(official-researcher, prompt: "Research official channels...")
  - task(media-researcher, prompt: "Research media/investment trends...")
  - task(community-researcher, prompt: "Research community reaction...")
  - task(background-researcher, prompt: "Research background/competitive landscape...")
  - All four issued in the same turn → run in parallel
  - Each writes its own _workspace/0X_{agent}_research.md

Phase 3: Cross-check (relay step)
  - Orchestrator reads all four artifacts
  - If media-researcher surfaced investment news that's relevant to background-researcher's
    competitive analysis, the orchestrator either folds it into the synthesis directly, or
    re-dispatches background-researcher with that finding included in the prompt for a
    second pass — this replaces what would be a direct SendMessage between the two in a
    peer-messaging system
  - Conflicting claims across sources are kept, with source attribution, not silently dropped

Phase 4: Integration
  - Orchestrator synthesizes all findings into one report
  - Conflicting information is presented side-by-side with sources cited

Phase 5: Wrap-up
  - _workspace/ preserved (for later verification/audit)
```

### Data flow

```
official ──┐
media ──────┼── each writes _workspace/0X_*.md ──→ [orchestrator reads all] ──→ synthesized report
community ──┤        (no direct agent-to-agent contact — orchestrator relays as needed)
background ─┘
```

---

## Example 2: Sci-fi novel-writing fleet

### Architecture: pipeline + fan-out

```
Phase 1 (parallel): worldbuilder + character-designer + plot-architect
  → orchestrator relays each other's key decisions forward for consistency
Phase 2 (sequential): prose-stylist (drafting)
Phase 3 (parallel): science-consultant + continuity-manager (review)
  → orchestrator relays both sets of findings to prose-stylist
Phase 4 (sequential): prose-stylist (revision)
```

### Fleet composition

| Agent | Type | Role | Skill |
|------|-------------|------|------|
| worldbuilder | custom | World-building | world-setting |
| character-designer | custom | Character design | character-profile |
| plot-architect | custom | Plot structure | outline |
| prose-stylist | custom | Prose style + drafting | write-scene, review-chapter |
| science-consultant | custom | Scientific plausibility check | science-check |
| continuity-manager | custom | Consistency check | consistency-check |

### Full agent definition example: `worldbuilder.md`

```markdown
---
description: "Builds the world of a sci-fi novel — physical laws, social structure, technology level, history."
mode: subagent
model: anthropic/claude-opus-4-5
permission:
  edit: allow
  bash: deny
---

You are a world-building expert for science fiction novels. You ground your
work in scientific plausibility while extending it imaginatively, establishing
the physical, social, and technological foundation the story unfolds in.

## Core role
1. Define the world's physical laws and technology level.
2. Design social structure, political systems, economic systems.
3. Establish historical context and current sources of conflict.
4. Describe the environment and mood of each location.

## Working principles
- Internal consistency comes first — settings must not contradict each other.
- Chain "what if this technology existed?" questions to reason through ripple effects.
- The world serves the story — don't over-elaborate settings that get in the plot's way.

## Input/output protocol
- Input: the user's world-concept and genre requirements
- Output: `_workspace/01_worldbuilder_setting.md`
- Format: markdown, sectioned by physical/social/technological/historical/locations

## Hand-off protocol
- Receives from: nothing upstream (this is a Phase-1 agent)
- Produces for: the orchestrator relays the social-structure/class/occupation
  sections to character-designer, and the world's core conflicts/crises to
  plot-architect, in each of their dispatch prompts

## Error handling
- If the concept is vague, propose three directions and ask the user to choose.
- If science-consultant flags an error, propose an alternative alongside the fix.

## Collaboration
- Feeds social-structure detail to character-designer (via the orchestrator)
- Feeds conflict structure to plot-architect (via the orchestrator)
- Revises settings based on science-consultant's feedback (relayed by the orchestrator)
```

### Detailed workflow

```
Phase 1: task(worldbuilder), task(character-designer), task(plot-architect) — same turn, parallel
         → orchestrator reads worldbuilder's output; once the social-structure section is ready,
           it's included in character-designer's prompt (if dispatched in a later round) or in a
           follow-up context note if all three ran together
         → orchestrator relays character-designer's protagonist setup into plot-architect's context

Phase 2: task(prose-stylist) — reads all three Phase 1 artifacts from _workspace/, drafts the scene
         → result saved to _workspace/02_prose_draft.md

Phase 3: task(science-consultant), task(continuity-manager) — same turn, parallel, both given
         _workspace/02_prose_draft.md as input
         → orchestrator reads both reports; if science-consultant flags a physics error that
           continuity-manager should also know about, the orchestrator includes it when
           preparing the next dispatch

Phase 4: task(prose-stylist) again — prompt includes both review reports, asks for a revision
         → final draft saved to _workspace/04_prose_final.md
```

---

## Example 3: Webcomic production fleet

### Architecture: producer-reviewer

> With only two agents and a tight generate → check → fix loop, this is a straightforward
> sequential dispatch — no parallel fan-out needed.

```
Phase 1: task(webtoon-artist) → generate panels
Phase 2: task(webtoon-reviewer) → review
Phase 3: task(webtoon-artist) → regenerate flagged panels (max 2 rounds)
```

### Fleet composition

| Agent | Type | Role | Skill |
|------|-------------|------|------|
| webtoon-artist | custom | Panel image generation | generate-webtoon |
| webtoon-reviewer | custom | Quality review | review-webtoon, fix-webtoon-panel |

### Full agent definition example: `webtoon-reviewer.md`

```markdown
---
description: "Reviews webcomic panel quality — composition, character consistency, text readability, pacing."
mode: subagent
model: anthropic/claude-opus-4-5
permission:
  edit: deny
  bash: deny
---

You are a webcomic quality reviewer. You judge panels on visual polish, story
clarity, and character consistency.

## Core role
1. Assess each panel's composition and visual polish.
2. Verify character appearance stays consistent across panels.
3. Evaluate speech-bubble text readability and placement.
4. Review the episode's overall pacing and flow.

## Working principles
- Judge with a clear three-way verdict: PASS / FIX / REDO.
- FIX means a partial touch-up will resolve it; REDO means it needs full regeneration.
- Judge against objective criteria (consistency, readability, composition) — not personal taste.

## Input/output protocol
- Input: panel images in `_workspace/panels/`
- Output: `_workspace/review_report.md`
- Format:
  ```
  ## Panel {N}
  - Verdict: PASS | FIX | REDO
  - Reason: [specific reason]
  - Fix instructions: [concrete direction, if FIX/REDO]
  ```

## Error handling
- If an image fails to load, mark that panel REDO.
- After 2 regeneration rounds, mark any still-REDO panel PASS with a warning noted.

## Collaboration
- The orchestrator relays this agent's fix instructions to webtoon-artist's next dispatch
- Regenerated panels are reviewed again (up to 2 rounds)
```

### Error handling

```
Retry policy:
- REDO-verdict panels → orchestrator re-dispatches webtoon-artist with the specific fix
  instructions included in the prompt
- After 2 rounds, force-pass remaining REDO panels
- If 50%+ of all panels are REDO, suggest the user revise the original prompt
```

---

## Example 4: Code review fleet

### Architecture: fan-out/fan-in + synthesis

> Code review is where fan-out shines even without peer messaging — the orchestrator's
> synthesis step is what surfaces cross-cutting issues, by deliberately looking for overlap
> between the three reports rather than just concatenating them.

```
[Orchestrator]
    ├── task(security-reviewer): security vulnerability check
    ├── task(performance-reviewer): performance impact analysis
    └── task(test-reviewer): test coverage check
    → orchestrator reads all three, cross-references, and synthesizes
```

### Cross-referencing pattern

```
security-reviewer flags: "this SQL query may be injectable"
performance-reviewer flags: "this same query causes N+1 pattern"
test-reviewer flags: "no test coverage on the auth module"

Orchestrator's synthesis step explicitly cross-references these three reports against the
same file/line ranges — a query that's both an injection risk and an N+1 problem is a
higher-priority finding than either report alone would suggest, and the missing auth test
coverage becomes more urgent once the security review has flagged that area.
```

This cross-referencing is the orchestrator doing, deliberately in one step, what three peer
agents chatting directly would otherwise stumble into piecemeal — worth calling out explicitly
in the orchestrator's Phase 4 rather than leaving it implicit.

---

## Example 5: Supervisor pattern — code migration fleet

### Architecture: supervisor

```
[Orchestrator/supervisor] → analyze file list → assign batches
    ├→ task(migrator-1, batch A)
    ├→ task(migrator-2, batch B)
    └→ task(migrator-3, batch C)
    ← reads each result → assigns next batch or reassigns on failure
```

### Fleet composition

| Agent | Role |
|------|------|
| (orchestrator = migration-supervisor) | File analysis, batch assignment, progress tracking |
| migrator-1..3 | Migrate the assigned batch of files |

### The supervisor's dynamic-assignment logic

```
1. Collect the full list of target files.
2. Estimate complexity (file size, import count, dependency depth).
3. Keep a todo list (todowrite) of file batches, including dependencies between batches.
4. Dispatch the first round of task() calls — one per available migrator, each with its batch.
5. As each migrator's task() call returns:
   - Success → mark the batch done, dispatch the next available batch to that migrator
   - Failure → the orchestrator reads the failure detail, then either re-dispatches the same
     batch to the same migrator with more context, or reassigns it to a different migrator
6. Once every batch is done → orchestrator runs the integration test.
```

Since OpenCode subagents can't self-claim from a shared board the way Claude Code Agent Teams can, the supervisor here is doing the claiming on their behalf — maintaining its own todo list and deciding, after each `task()` return, exactly what gets dispatched next. This is more orchestrator work than a peer-messaging system would require, but it also means the whole assignment history stays visible in one place.

Difference from fan-out: fan-out fixes the split up front; a supervisor adjusts assignment as it goes, based on each round's results.

---

## Deliverable pattern summary

### Agent definition files
Location: `project/.opencode/agent/{agent-name}.md`
Required sections: core role, working principles, input/output protocol, error handling, collaboration.
Additional required section: **Hand-off protocol** (what it receives from upstream, what it produces for downstream — since there's no direct messaging, this has to be explicit).

### Skill file structure
Location: `project/.opencode/skills/{skill-name}/SKILL.md` (project level)
Or: `~/.config/opencode/skills/{skill-name}/SKILL.md` (global level)
(`.claude/skills/...` and `.agents/skills/...` are also discovered natively, for interop with other tools.)

### Integration skill (orchestrator)
The top-level skill coordinating the whole fleet. Defines the agent composition and workflow for a given scenario.
Template: `references/orchestrator-template.md`.
**Always state the dispatch topology** (which architecture pattern(s) from `SKILL.md` Phase 2-2) and call out every point where the orchestrator relays information between agents.
