# Skill Testing and Iterative Improvement Guide

Use this guide to verify that harness-created skills actually improve outcomes.

## Table of contents

1. Testing framework overview
2. Writing test prompts
3. With-skill vs baseline runs
4. Quantitative evaluation with assertions
5. Evaluation roles
6. Iteration loop
7. Description trigger checks
8. Workspace structure

## 1. Testing framework overview

Skill quality is best evaluated with both qualitative and quantitative evidence.

| Evaluation type | Method | Best for |
|---|---|---|
| Qualitative | User reviews outputs directly | Writing style, design, creative work, judgment-heavy outputs |
| Quantitative | Assertions or scripts check objective facts | File creation, data extraction, schemas, code generation, reproducible transforms |

Core loop:

```text
draft → test → evaluate → improve → retest
```

## 2. Writing test prompts

Test prompts should sound like real user requests, not lab commands.

Weak prompts:

```text
Process the PDF.
Extract data.
Create a chart.
```

Stronger prompts:

```text
In my Downloads folder there's a workbook named something like Q4_sales_final_v2.xlsx. Add a profit margin percentage column using revenue in column C and cost in column D, then sort by profit margin descending.
```

```text
Extract the table on page 3 of this PDF into CSV. The table header has two rows: the first row is the category and the second row is the actual column name.
```

Coverage guidelines:

- Mix formal and casual phrasing.
- Mix explicit and implicit intent.
- Include at least one edge case.
- Include one core happy path.
- Use 2-3 prompts for a first draft; expand later if the skill becomes important.

## 3. With-skill vs baseline runs

When practical, compare the skill to a baseline.

### 3-1. Run structure

For each prompt, run two configurations:

**With-skill**

```text
Task: {test prompt}
Skill path: {path-to-skill}
Instruction: read and follow the skill before doing the task
Save outputs to: {workspace}/iteration-N/{eval-name}/with_skill/outputs/
```

**Baseline**

```text
Task: {same test prompt}
Skill path: none
Save outputs to: {workspace}/iteration-N/{eval-name}/baseline/outputs/
```

For an existing skill improvement, the baseline can be a snapshot of the old skill.

### 3-2. Launching runs in opencode

Use `task` subagents for independent runs. Launch matching with-skill and baseline tasks in the same turn when possible so timing and environment are comparable.

Make the prompt explicit about:

- Input files.
- Output directory.
- Files to create.
- Tools allowed or forbidden.
- Verification to perform.

### 3-3. Timing data

If subagent completion provides token and duration data, save it immediately:

```json
{
  "total_tokens": 84852,
  "duration_ms": 23332,
  "total_duration_seconds": 23.3
}
```

This information may not be recoverable later.

## 4. Quantitative evaluation with assertions

Use assertions when outputs are objectively checkable.

Good assertions:

- Are true/false.
- Have descriptive text.
- Check the skill's intended value, not trivial existence.
- Can often be verified by a script.

Weak assertions:

- "Output exists" when every run will output something.
- "Looks good" when subjective judgment is required.
- Assertions that pass equally for baseline and with-skill runs.

### 4-1. Programmatic checks

If an assertion can be checked by code, prefer a script. Scripts are faster, repeatable, and reduce evaluator bias.

Examples:

- Parse JSON and validate required keys.
- Open a CSV and verify row counts and column names.
- Search a report for required headings.
- Run tests or a typecheck command.

### 4-2. Grading schema

```json
{
  "expectations": [
    {
      "text": "Profit margin column is added",
      "passed": true,
      "evidence": "Column E is named profit_margin_pct."
    },
    {
      "text": "Rows are sorted by profit margin descending",
      "passed": false,
      "evidence": "Rows remain in original order."
    }
  ],
  "summary": {
    "passed": 1,
    "failed": 1,
    "total": 2,
    "pass_rate": 0.5
  }
}
```

Use exactly `text`, `passed`, and `evidence` in each expectation.

## 5. Evaluation roles

Specialist evaluation roles improve quality.

### 5-1. Grader

The grader checks assertions against outputs and provides evidence.

Responsibilities:

- Decide pass/fail for each assertion.
- Quote or point to evidence.
- Flag vague or non-discriminating assertions.
- Use scripts when possible.

### 5-2. Comparator

The comparator reviews two outputs anonymously and judges which is better.

Use when the user asks whether a new skill version is truly better. Most iteration loops can skip this.

### 5-3. Analyzer

The analyzer reads benchmark data and looks for hidden patterns:

- Assertions that pass for every configuration.
- High variance prompts.
- Time/token tradeoffs.
- Improvements that help one prompt but harm another.

## 6. Iteration loop

### 6-1. Collect feedback

Show outputs to the user and ask for targeted feedback. Empty feedback means the output was acceptable.

### 6-2. Improve the skill

When improving:

1. Generalize feedback into principles.
2. Remove instructions that cause waste or confusion.
3. Explain why important rules exist.
4. Bundle deterministic helpers only after repeated evidence.
5. Re-read the draft with fresh eyes before retesting.

### 6-3. Retest

```text
1. Update the skill.
2. Run all test prompts into a new iteration directory.
3. Compare with prior iteration and baseline.
4. Ask the user to review.
5. Repeat until quality stabilizes.
```

Stop when:

- The user is satisfied.
- Feedback is empty or only minor.
- Further changes are not meaningfully improving results.

## 7. Description trigger checks

Descriptions should trigger for the right prompts and stay quiet for near-misses.

### 7-1. Trigger eval set

Create 16-20 realistic prompts:

- 8-10 should trigger.
- 8-10 should not trigger.

Should-trigger prompts should include:

- Formal and casual wording.
- Explicit and implicit intent.
- File paths, domain details, or concrete context.
- Follow-up requests if the skill supports reruns.

Should-not-trigger prompts should be near-misses:

- Shared keywords but different task.
- Adjacent domain that belongs to another skill.
- Ambiguous phrasing where this skill should not take over.

Avoid obviously irrelevant negatives; they do not test boundary quality.

### 7-2. Conflict checks

1. Collect existing skill names and descriptions.
2. Compare new should-trigger prompts against adjacent skills.
3. If another skill should handle a prompt, tighten the description boundary.

### 7-3. Description optimization

If the project has automated description-eval tooling, run it only after the skill content is stable. Do not optimize the description around a weak or unfinished skill.

## 8. Workspace structure

Keep eval outputs organized:

```text
{skill-name}-workspace/
├── evals/
│   └── evals.json
├── iteration-1/
│   ├── eval-core-happy-path/
│   │   ├── eval_metadata.json
│   │   ├── with_skill/
│   │   │   ├── outputs/
│   │   │   ├── timing.json
│   │   │   └── grading.json
│   │   └── baseline/
│   │       ├── outputs/
│   │       ├── timing.json
│   │       └── grading.json
│   └── benchmark.json
└── iteration-2/
    └── ...
```

Rules:

- Use descriptive eval directory names, not only numbers.
- Never overwrite prior iterations.
- Preserve `_workspace/` artifacts for audit and debugging.
