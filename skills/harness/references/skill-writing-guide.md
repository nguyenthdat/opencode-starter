# Skill Writing Guide for opencode Harnesses

Use this guide when creating or improving skills as part of a harness. For the executable skill-authoring workflow, load `skill-creator` from `/Users/datnguyen/Projects/harness-skill/skills/skill-creator`; the harness skill uses that skill for skill creation, eval design, packaging, and description tuning.

## Table of contents

1. Description patterns
2. Body writing style
3. Output format definitions
4. Examples
5. Progressive disclosure
6. When to bundle scripts
7. Data schemas for tests
8. What not to include
9. Skill reuse design

## 1. Description patterns

The `description` field is the primary trigger signal. The model sees skill names and descriptions before it decides whether loading the full skill is worthwhile.

### 1-1. Description goals

A good description says:

1. What the skill does.
2. When to use it, with concrete phrases and file types the user may mention.
3. What nearby cases should not trigger it, if the boundary is ambiguous.

### 1-2. Good examples

```yaml
description: "PDF editing and extraction: read, extract text/tables, split, merge, rotate, watermark, encrypt/decrypt, and OCR PDF files. Use when the user mentions .pdf files or asks for PDF outputs, especially for multi-step conversion, editing, or analysis."
```

```yaml
description: "Spreadsheet transformation for Excel/CSV/TSV files: add columns, compute formulas, clean data, sort/filter rows, format sheets, and create charts. Use when the user mentions xlsx/csv/tsv files, spreadsheet columns, workbook tabs, or casual phrases like 'the Excel in Downloads'."
```

### 1-3. Weak examples

- `"Process data"` — too vague.
- `"PDF skill"` — no concrete operations or trigger conditions.
- `"Helps with files"` — overlaps too many domains.

### 1-4. Trigger boundary checklist

Before finalizing a description, ask:

- Would a user phrase this task differently? Add those phrases.
- Are there adjacent skills with similar keywords? Add boundary language.
- Does the description include follow-up verbs when the skill supports reruns or revisions?
- Is it concise enough to scan quickly?

## 2. Body writing style

### 2-1. Explain the why

Rules generalize better when the reason is included.

Weak:

```markdown
Always use tool X. Never use tool Y.
```

Better:

```markdown
Use tool X for table extraction because it preserves row/column structure. Tool Y is acceptable for plain text but loses cell boundaries, so avoid it when the user needs CSV or spreadsheet output.
```

### 2-2. Generalize from feedback

When a test or user review exposes a flaw, fix the principle rather than overfitting to the example.

Overfit:

```markdown
If the file has a column named "Q4 revenue", convert that column to a number.
```

Generalized:

```markdown
When column names imply numeric values, such as revenue, cost, quantity, amount, or percentage, attempt numeric conversion. If conversion fails, preserve the original value and report the row/column.
```

### 2-3. Use imperative instructions

A skill is an operating procedure. Prefer direct verbs:

- Inspect...
- Validate...
- Write...
- Report...

### 2-4. Keep context lean

Every line should earn its place.

Remove content when:

- It is generic knowledge the model already has.
- It describes the skill creation process rather than the future workflow.
- It belongs in a reference file loaded only for a specific case.

Keep content when:

- Omitting it would cause repeated mistakes.
- It defines a required output format.
- It protects against a real edge case.

## 3. Output format definitions

Use exact templates when output shape matters.

```markdown
## Report structure

Use this structure:

# [Title]
## Executive summary
## Key findings
## Evidence
## Recommendations
## Risks and limitations
```

For machine-readable outputs, include field names and types.

```json
{
  "items": [
    {
      "id": "string",
      "title": "string",
      "confidence": "high | medium | low",
      "evidence": "string"
    }
  ]
}
```

## 4. Examples

Examples are often shorter and clearer than long rules.

```markdown
## Commit message format

Example 1:
Input: Added JWT-based authentication
Output: feat(auth): implement JWT authentication

Example 2:
Input: Fixed broken password visibility toggle on login page
Output: fix(login): repair password visibility toggle
```

Use examples to show boundary cases, not only the happy path.

## 5. Progressive disclosure

Skills use layered loading:

1. **Metadata:** name + description.
2. **SKILL.md body:** loaded when the skill is used.
3. **Bundled resources:** references, scripts, assets loaded only when needed.

### Pattern A: Domain split

```text
cloud-deploy/
├── SKILL.md
└── references/
    ├── aws.md
    ├── gcp.md
    └── azure.md
```

The main skill tells the model which reference to read for each cloud.

### Pattern B: Conditional detail

```markdown
## DOCX generation
Use the standard document builder. Read `references/docx-generation.md` when creating a new document from scratch.

## Redlines / tracked changes
Read `references/redlines.md` only when the user asks for tracked changes or legal-style revision markup.
```

### Pattern C: Large reference files

For any reference over roughly 300 lines, include a table of contents at the top.

## 6. When to bundle scripts

Bundle scripts only when repetition proves they are useful.

| Signal | Action |
|---|---|
| Multiple test runs recreate the same helper script | Move it into `scripts/` |
| Every run installs the same dependency | Document the setup or provide a deterministic script |
| The same multi-step transformation repeats | Encode it as a standard procedure |
| Runs repeatedly hit the same error and workaround | Add a known-issue note with the fix |

Bundled scripts must be tested before recommending them.

## 7. Data schemas for tests

Use consistent schemas when evaluating skills.

### eval_metadata.json

```json
{
  "eval_id": 0,
  "eval_name": "descriptive-name-here",
  "prompt": "User task prompt",
  "assertions": [
    "Output contains X",
    "File Y is created with format Z"
  ]
}
```

### grading.json

```json
{
  "expectations": [
    {
      "text": "Output includes a risk section",
      "passed": true,
      "evidence": "The generated report contains '## Risks and limitations'."
    }
  ],
  "summary": {
    "passed": 1,
    "failed": 0,
    "total": 1,
    "pass_rate": 1.0
  }
}
```

Use the exact fields `text`, `passed`, and `evidence` so benchmark tooling can read the results.

### timing.json

```json
{
  "total_tokens": 84852,
  "duration_ms": 23332,
  "total_duration_seconds": 23.3
}
```

Capture timing from subagent completion notifications immediately when available.

## 8. What not to include

Do not put these in a production skill:

- README, changelog, installation guide, or marketing copy.
- The history of how the skill was created.
- Raw eval results or temporary feedback.
- Generic information that the model already knows.
- Secrets, credentials, private tokens, or user-specific sensitive data.

## 9. Skill reuse design

Before creating a skill, inspect existing skills.

| Situation | Action |
|---|---|
| Existing skill fully covers the workflow | Reuse it |
| Existing skill partly covers the workflow and can be generalized | Extend it and update its description |
| Domain-specific specialization is intentional | Keep it separate |
| Responsibility is different | Create a new skill |

Generalize only within the intended responsibility. Do not turn a useful domain skill into a vague all-purpose skill.

Example:

| Step | Result |
|---|---|
| Remove accidental vendor dependency from a risk-report skill | Better reusable risk-report skill |
| Remove risk-report responsibility entirely | Too broad; likely overlaps document-formatting skills |

After extending a skill, verify dependent agents and orchestrators still behave as expected.
