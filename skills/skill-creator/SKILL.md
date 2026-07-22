---
name: skill-creator
description: "Create, edit, evaluate, package, and improve opencode skills. Use when the user asks to create a new skill, convert a workflow into a skill, refine a SKILL.md, improve a skill description, run skill evals, benchmark with-skill vs baseline behavior, package a .skill artifact, or when the harness skill needs a dedicated skill-building workflow."
compatibility: opencode
metadata:
  domain: skill-authoring
  audience: skill-authors
---

# Skill Creator — opencode Skill Authoring Workflow

Create and improve opencode skills with a lean, testable, reusable structure. This skill follows the shared harness writing standard in `skills/harness/references/skill-writing-guide.md` and is the skill that the `harness` skill should use whenever it needs to create or substantially revise a skill.

Installed project path:

```text
skills/skill-creator
```

## Relationship with `harness`

- Use `harness` when the user wants a whole agent + skill system, orchestrator, audit, sync, or harness evolution workflow.
- Use `skill-creator` when the work is specifically to create, edit, test, evaluate, package, or optimize skills.
- When `harness` reaches its skill-creation phase, it should delegate the skill-writing portion to this skill and apply `skills/harness/references/skill-writing-guide.md` as the canonical style guide.
- When this skill detects that a requested skill belongs inside a broader reusable agent workflow, load or consult `harness` before finalizing architecture.

## Core principles from the harness writing guide

1. **Description does the triggering.** Write `description` as: what the skill does + concrete user phrases/files/tasks that should trigger it + boundary cases if needed.
2. **Keep `SKILL.md` lean.** Put only the core workflow in the main file; move detailed recipes to `references/`.
3. **Explain why rules exist.** Reasoned rules generalize better than rigid all-caps commands.
4. **Avoid overfitting.** Turn user feedback and eval failures into general principles, not one-off patches.
5. **Use progressive disclosure.** Metadata first, main skill second, references/scripts only when needed.
6. **Bundle scripts only after evidence.** Add scripts when repeated runs recreate the same deterministic helper.
7. **Do not include process noise.** Production skills should not contain raw eval results, changelog prose, secrets, or temporary notes.
8. **Reuse before creating.** Inspect existing skills and extend a suitable skill instead of creating duplicates.

## Phase 0: Clarify intent and scope

Start by extracting what is already known from the conversation.

Ask at most one concise clarification question if any of these are missing and necessary:

1. What should the skill enable the model to do?
2. When should it trigger?
3. What output should it produce?
4. Does the user want test/eval scaffolding now, or only the skill draft?

Adapt communication to the user's fluency. If the user may not know terms such as "frontmatter", "assertion", or "schema", briefly explain them.

## Phase 1: Inspect existing skills and harness context

Before creating a new skill:

1. Inspect configured skill roots such as `skills/`, `.opencode/skills/`, and any `skills.paths` in `opencode.jsonc`.
2. Read nearby skill descriptions and responsibilities.
3. If this is part of a harness, read:
   - `skills/harness/SKILL.md`
   - `skills/harness/references/skill-writing-guide.md`
   - relevant harness orchestrator or agent files if they exist
4. Choose one path:

| Finding | Action |
|---|---|
| Existing skill fully covers the workflow | Reuse it; do not create a duplicate |
| Existing skill partly covers the workflow and can be generalized | Improve it and update its description |
| Domain-specific specialization is intentional | Create or keep a separate skill |
| Responsibility is different | Create a new skill |

## Phase 2: Design the skill

Create a short design before writing files.

### Required decisions

| Decision | Guidance |
|---|---|
| Skill name | Lowercase, hyphen-separated, matches the folder, 1-64 chars (regex `^[a-z0-9]+(-[a-z0-9]+)*$`) |
| Location | Prefer the configured project skill path, usually `.opencode/skills/{name}/SKILL.md` in this repository |
| Optional metadata | Add `compatibility: opencode` and a string `metadata` map when useful; add `license` only if the project declares one |
| Trigger description | Include tasks, phrases, file types, follow-up verbs, and boundaries |
| Main workflow | Keep in `SKILL.md`; use imperative steps |
| References | Add only for conditional or detailed material |
| Scripts/assets | Add only when deterministic helpers are clearly useful |
| Tests | 2-3 realistic prompts for first pass; expand later |
| Companion rule | Only if an always-on behavior is needed before a skill can trigger |

### Standard folder layout

```text
{skill-name}/
├── SKILL.md
├── references/      # optional: detailed conditional docs
├── scripts/         # optional: tested deterministic helpers
└── assets/          # optional: templates, images, fixtures
```

## Phase 3: Write or edit `SKILL.md`

### Frontmatter schema

opencode recognizes exactly five frontmatter fields. Unknown fields are silently ignored, so do not rely on custom top-level keys.

| Field | Required | Rules |
|---|---|---|
| `name` | Yes | 1-64 chars, lowercase alphanumeric with single hyphen separators, no leading/trailing `-`, no consecutive `--`. Must match the folder that contains `SKILL.md`. Regex: `^[a-z0-9]+(-[a-z0-9]+)*$`. |
| `description` | Yes | 1-1024 characters. What the skill does + when to use it, with concrete triggers. This is the primary signal the model uses to choose the skill. |
| `license` | No | SPDX identifier or license name (e.g. `MIT`). Omit when the project declares no license — do not guess one. |
| `compatibility` | No | Target runtime; use `opencode` for opencode skills. |
| `metadata` | No | Free-form **string-to-string** map of hints such as `audience`, `domain`, or `workflow`. Every value must be a string. |

Minimal frontmatter:

```markdown
---
name: skill-name
description: "What the skill does and exactly when to use it. Mention concrete user phrases, file types, workflows, and boundary conditions."
---
```

Full frontmatter (all recognized fields):

```markdown
---
name: git-release
description: "Draft release notes from merged PRs, propose a version bump, and produce a copy-pasteable gh release command. Use when preparing a tagged release."
license: MIT
compatibility: opencode
metadata:
  audience: maintainers
  workflow: github
---
```

Keep `description` within 1024 characters. If a keyword-rich description grows past the limit, condense the tool and phrase lists rather than dropping the trigger intent — an over-limit description is a validity error, not a style preference.

### Where the file must live

opencode discovers a skill from a folder named for the skill, with an upper-case `SKILL.md` inside, in any of these roots (project paths are searched by walking up to the git worktree):

- `.opencode/skills/<name>/SKILL.md` (project) or `~/.config/opencode/skills/<name>/SKILL.md` (global)
- `.claude/skills/<name>/SKILL.md` (project) or `~/.claude/skills/<name>/SKILL.md` (global)
- `.agents/skills/<name>/SKILL.md` (project) or `~/.agents/skills/<name>/SKILL.md` (global)

Skill names must be unique across all locations. Access is governed by `permission.skill` patterns in `opencode.json` (`allow` / `ask` / `deny`), which can be overridden per agent.

Then write the body with this structure unless the skill has a better domain-specific shape:

```markdown
# Skill Title

One short paragraph describing the workflow and outcome.

## When to use
Short reinforcement of the description, only if it clarifies boundaries.

## Workflow
### Phase 1: ...
### Phase 2: ...

## Output format
Exact template or schema when output shape matters.

## Verification
Commands, checks, assertions, or manual review steps.

## References
- `references/...` — when to read it.
```

### Writing checklist

- [ ] `name` matches the folder and passes `^[a-z0-9]+(-[a-z0-9]+)*$` (1-64 chars).
- [ ] `description` is 1-1024 characters and includes what + when + concrete triggers.
- [ ] Only recognized frontmatter fields are used (`name`, `description`, `license`, `compatibility`, `metadata`); any `metadata` values are strings.
- [ ] Main body is lean and procedural.
- [ ] Detailed optional content is moved to `references/`.
- [ ] Rules explain why they matter where edge cases are likely.
- [ ] Examples show boundary cases, not only happy paths.
- [ ] No secrets, temporary notes, raw eval results, or marketing copy.
- [ ] No stale references to unsupported tools or old file paths.

## Phase 4: Special skill types

### CLI tool skills

For skills that document a command-line tool, verify commands from the actual tool before writing examples.

1. Run top-level help and relevant subcommand help.
2. Extract exact subcommands, arguments, flags, defaults, and missing features.
3. Write examples using only verified command shapes.
4. Re-run help for critical commands after drafting.

Never invent flags based on another tool's conventions.

### Library, framework, SDK, or API skills

For skills about a library or API:

1. Fetch current official documentation before drafting code examples.
2. Cover setup, core concepts, public API, configuration, error handling, testing, and migration notes when relevant.
3. Prefer official examples and recommended patterns.
4. Verify import paths, function signatures, config keys, and deprecated APIs.

If no official docs are available, state the limitation and rely on local code or package metadata instead of guessing.

### Harness-integrated skills

When `harness` is creating the skill:

1. Confirm which agent or orchestrator will use it.
2. Define the skill's input/output protocol so the orchestrator can pass artifacts cleanly.
3. Include follow-up triggers such as rerun, update, revise, improve, sync, and partial redo if the skill supports iterative use.
4. Update the harness orchestrator or pointer only if the routing changes.

## Phase 5: Test and evaluate

Testing can be lightweight or formal depending on the user's request and the skill's risk.

### Lightweight validation

Use for quick edits and low-risk reference skills:

- Parse frontmatter and confirm only recognized fields are present (`name`, `description`, `license`, `compatibility`, `metadata`).
- Validate `name` against the regex and the folder name; confirm `description` is 1-1024 characters.
- Check required files exist.
- Search for stale platform/path references.
- Read the skill as a future model would and dry-run one realistic prompt mentally.

### Formal eval loop

Use for important workflow skills or when the user asks for benchmarking.

1. Create `evals/evals.json` with 2-3 realistic prompts.
2. For each prompt, run a with-skill and baseline configuration when practical.
3. Save outputs under `{skill-name}-workspace/iteration-N/{eval-name}/`.
4. Draft objective assertions for checkable outputs.
5. Grade using `expectations[]` entries with exact fields: `text`, `passed`, `evidence`.
6. Aggregate benchmark data if timing/token/pass-rate comparison matters.
7. Show outputs to the user and improve based on feedback.

Use the local helper files when useful:

- `references/schemas.md` — eval, grading, timing, and benchmark schemas.
- `agents/grader.md` — grader role instructions.
- `agents/comparator.md` — blind comparison guidance.
- `agents/analyzer.md` — benchmark analysis guidance.
- `eval-viewer/generate_review.py` — review UI generator if the environment supports it.
- `scripts/aggregate_benchmark.py` — benchmark aggregation.
- `scripts/package_skill.py` — package a completed skill.

## Phase 6: Improve from feedback

When feedback or evals reveal issues:

1. Identify the underlying principle behind the failure.
2. Revise the skill so the fix generalizes beyond the test case.
3. Remove instructions that cause wasted effort or confusion.
4. Add examples only where they reduce ambiguity.
5. Move long detail into references.
6. Retest the affected prompts.

Avoid adding rigid rules solely to pass one eval. A production skill should work for many future prompts, not only the examples used during development.

## Phase 7: Description trigger checks

For important skills, create near-miss trigger checks.

- Write 8-10 should-trigger prompts with varied wording.
- Write 8-10 should-not-trigger prompts that share keywords but need a different skill.
- Check conflicts with existing skill descriptions.
- Improve the description based on failures, but keep it honest and concise.

Good trigger prompts are concrete and realistic. Weak prompts such as "format data" or "create chart" are too abstract to test meaningful skill selection.

## Phase 8: Package and report

If the user wants a portable skill artifact, run or adapt:

```bash
uv run python3 skills/skill-creator/scripts/package_skill.py /path/to/skill-folder
```

Final report format:

```markdown
## Summary
[What was created or improved]

## Changed Files
| File | Change | Reason |
|---|---|---|

## Verification
- Frontmatter: pass/fail
- Link/path checks: pass/fail
- Evals/tests: pass/fail/not run
- Manual dry run: pass/fail/not run

## Harness Linkage
[How this skill connects to harness, if relevant]

## Known Risks
[Any unverified docs, missing evals, environment limitations]
```

## Companion rule decision

Create a companion opencode rule only when the behavior must be always-on before the skill can trigger, such as security posture, required test gates, or harness routing policy.

For normal skill authoring guidance, do not create a rule; keep this as an on-demand skill.

## Reference map

| Need | Read |
|---|---|
| Shared writing standard | `skills/harness/references/skill-writing-guide.md` |
| Harness architecture and skill routing | `../harness/SKILL.md` |
| Skill testing methodology | `skills/harness/references/skill-testing-guide.md` |
| Eval/benchmark schemas | `references/schemas.md` |
| Grading outputs | `agents/grader.md` |
| Comparing two skill versions | `agents/comparator.md` |
| Analyzing benchmark patterns | `agents/analyzer.md` |
