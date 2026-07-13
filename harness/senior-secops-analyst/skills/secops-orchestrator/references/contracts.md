# SecOps Orchestration Contracts

Use these contracts for every current-run artifact and specialist call.

## Task Call Contract

```text
Goal: <one measurable question>
Mode: <role-specific mode or N/A>
Read: <exact manifest-listed paths>
Write: <exact allowed output paths>
Scope: <entities, systems, time window, and exclusions>
Use: <required skills, tools, and data sources>
Safety: read-only; <additional restrictions and approved exceptions>
Acceptance criteria:
- <evidence and output requirement>
- <verification requirement>
Return to lead:
- status
- summary
- artifacts
- evidence_refs
- gaps
- handoff_requests
```

Prompts must be self-contained. Do not assume a specialist can see another task's conversation.

## Specialist Return Contract

```yaml
status: COMPLETE | PARTIAL | BLOCKED
summary: string
artifacts:
  - path: string
    purpose: string
evidence_refs: [E0001]
gaps:
  - description: string
    impact: string
handoff_requests:
  - agent: senior-secops-analyst/<name>
    objective: string
    required_inputs: [path]
    reason: string
```

`handoff_requests` are recommendations only. The lead owns every subsequent dispatch.

## Evidence Record

For each material claim record:

```yaml
evidence_id: E0001
source: string
tool_or_system: string
operation_or_query: string
execution_status: EXECUTED | PROPOSED | FAILED
collected_at_utc: RFC3339 timestamp
event_time_start: RFC3339 timestamp | null
event_time_end: RFC3339 timestamp | null
raw_observation: string
interpretation: string
confidence: low | medium | high
artifact_path: string
parent_evidence_ids: []
redaction_status: raw-sensitive | redacted | not-sensitive
```

An unexecuted query uses `PROPOSED` and cannot support a factual observation.

## Run Manifest Minimum Fields

```json
{
  "run_id": "RUN-YYYYMMDD-HHMMSSZ",
  "case_id": "CASE-UNKNOWN",
  "mode": "new | targeted-rerun",
  "objective": "",
  "scope": {},
  "allowed_actions": ["read-only"],
  "artifacts": [
    {
      "path": "_workspace/12_elastic.md",
      "owner": "senior-secops-analyst/elastic-siem-analyst",
      "required": true,
      "status": "PLANNED | COMPLETE | PARTIAL | BLOCKED | ACCEPTED | SUPERSEDED"
    }
  ]
}
```

Reviewers and writers read only artifacts listed for the active run. A targeted rerun marks replaced artifacts `SUPERSEDED` rather than silently overwriting their status.

## Canonical Decision Record

Use `verdict-scoring` for the exact schema. Domain labels such as `phishing`, `confirmed-vulnerable`, or `credential-exposure` belong in `domain_classification`; they do not replace the canonical verdict.

## Retry and Stop Rules

- Retry one failed read-only tool call once with narrower scope.
- Retry one failed specialist task once using the same task ID and explicit failure context.
- Never automatically retry a potentially mutating operation.
- Stop when a majority of critical tasks fail, required evidence would need unsafe collection, or the result could cause an unsafe action.
- Preserve error text and partial artifacts; never convert absence of evidence into evidence of absence.
