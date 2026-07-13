---
name: evidence-collection
description: "Create and maintain a SecOps case workspace, evidence manifest, evidence index, hashes, provenance, timeline, IOC artifacts, and evidence appendix. Use when collecting or preserving investigation evidence, recording findings, resuming a case, adding new evidence, rebuilding an appendix, or auditing chain-of-custody. Not for general note-taking."
compatibility: opencode
metadata:
  domain: secops
  audience: senior-secops-analyst
  edition: "2026.07"
---

# Evidence Collection and Chain-of-Custody

Systematically collect, preserve, index, hash, and explain investigation evidence under `_workspace/`. Permanent evidence artifacts are tracked in a manifest, assigned an evidence ID, and referenced in conclusions.

## Workspace Requirement

**All evidence must be saved under `_workspace/`.** No evidence artifacts — raw output, screenshots, extracted documents, query exports, browser captures, IOC lists, timelines, or derived analysis files — may be stored outside `_workspace/`.

Register every permanent evidence artifact except `_workspace/README.md`, `_workspace/manifest.jsonl`, `_workspace/evidence-index.md`, `_workspace/run_manifest.json`, and files under `_workspace/temp/`.

## When to Use

Use this skill for any task that produces or references investigation evidence:

- Incident investigations, phishing investigations, cloud investigations, vulnerability investigations
- SOC alert triage and case documentation
- Browser evidence capture (screenshots, HAR, DOM snapshots)
- SIEM/Defender/Wiz/Tenable/Cyble/CommandZero tool outputs
- Document evidence (PDF, DOCX) intake
- Screenshots and raw logs
- API, MCP, and CLI tool response capture
- IOC harvesting and timeline reconstruction
- Final evidence appendix generation

Do not use this skill for general note-taking or code editing that does not involve investigation evidence.

## Workspace Layout

Create the following structure under `_workspace/` at the start of every investigation:

```
_workspace/
├── README.md                  # Case summary, scope, investigation ID
├── manifest.jsonl             # Machine-readable evidence registry
├── evidence-index.md          # Human-readable evidence table
├── raw/                       # Unmodified original evidence
│   ├── tools/                 # CLI/tool raw output
│   ├── logs/                  # Raw logs, PCAPs
│   ├── queries/               # Query text and structured results
│   ├── screenshots/           # Browser/desktop screenshots
│   ├── browser/               # HAR, DOM snapshots, network logs
│   ├── documents/             # Original PDF/DOCX/other files
│   ├── api/                   # Raw API responses
│   └── mcp/                   # Raw MCP tool responses
├── extracted/                 # Extracted content from documents
│   ├── pdf/
│   ├── docx/
│   ├── tables/
│   ├── images/
│   ├── text/
│   └── metadata/
├── derived/                   # Normalized, correlated, enriched outputs
│   ├── iocs/
│   ├── timelines/
│   ├── correlations/
│   ├── summaries/
│   └── normalized/
├── reports/                   # Human-readable deliverables
│   ├── evidence-appendix.md
│   ├── findings.md
│   └── gaps.md
├── redacted/                  # Shareable redacted versions
├── temp/                      # Temporary scratch files
└── archive/                   # Archived case bundles
```

Detailed layout with per-folder explanations is in `references/workspace-layout.md`.

## Evidence Intake Workflow

For every artifact collected:

1. **Ensure `_workspace/` exists.** Create it and all required subdirectories if missing.
2. **Create or update** `_workspace/manifest.jsonl` and `_workspace/evidence-index.md`.
3. **Assign the next evidence ID** (E0001, E0002, E0003, …).
4. **Save the raw artifact** to the correct `_workspace/raw/` subfolder using the naming convention.
5. **Compute SHA256** of the artifact and record it.
6. **Write a manifest entry** to `_workspace/manifest.jsonl`.
7. **Add a row** to `_workspace/evidence-index.md`.
8. **Create derived or redacted versions** only under `_workspace/derived/` or `_workspace/redacted/`.
9. **Reference the evidence ID** in all analysis, findings, and conclusions.

Never skip steps. Every collected artifact must have an evidence ID and manifest entry before it is used in analysis.

## File Naming Convention

Use deterministic, safe names:

```
<YYYYMMDD-HHMMSSZ>_<case-id>_<source>_<entity>_<artifact-type>.<ext>
```

Examples:
- `_workspace/raw/queries/20260709-083000Z_CASE123_defender_user-jsmith_query.json`
- `_workspace/raw/screenshots/20260709-083122Z_CASE123_phishing-example-com_landing.png`
- `_workspace/derived/iocs/20260709-084000Z_CASE123_iocs_defanged.csv`
- `_workspace/reports/evidence-appendix.md`

If case ID is unknown, use `CASE-UNKNOWN`. If entity is sensitive, use a safe redacted slug.

Full naming rules and examples are in `references/naming-conventions.md`.

## Evidence Standards

For every piece of evidence, record:

1. **Evidence ID**: Unique identifier (E0001, E0002, …).
2. **Source**: Tool, system, or person that produced the evidence.
3. **Source tool/system**: Specific tool name and version if known.
4. **Query/Method/Command**: Exact query, URL, file path, or interaction that produced it.
5. **Collection time UTC**: When the evidence was collected.
6. **Event time / time range**: When the observed events occurred (may differ from collection time).
7. **Original location**: Where the evidence originated (URL, file path, tool output handle).
8. **Workspace path**: Where the evidence is stored in `_workspace/`.
9. **SHA256**: Hash of the stored artifact.
10. **Raw output or raw file reference**: The unmodified data or a pointer to it.
11. **Interpretation**: Analyst conclusion drawn from the raw data.
12. **Confidence**: High, Medium, Low.
13. **Corroboration**: Any independent supporting evidence IDs.
14. **Sensitivity / Redaction status**: Whether the evidence contains PII, secrets, or sensitive data.
15. **Parent evidence IDs**: If derived from one or more artifacts, all source evidence IDs.

## Evidence Table Template

Use this table format in reports and `_workspace/evidence-index.md`:

| ID | Source | Query/Method | Collection Time UTC | Event Time | Workspace Path | SHA256 | Raw Finding | Interpretation | Confidence | Corroborated By |
|---|---|---|---|---|---|---|---|---|---|---|

## Manifest JSONL Entry Format

Every artifact saved in `_workspace/` must be recorded in `_workspace/manifest.jsonl` with these fields:

```json
{
  "evidence_id": "E0001",
  "case_id": "CASE-123",
  "artifact_type": "defender-query-result",
  "source_tool": "defender-mcp",
  "source_system": "Microsoft Defender XDR",
  "original_location": "advanced-hunting",
  "workspace_path": "_workspace/raw/queries/20260709-083000Z_CASE-123_defender_query.json",
  "created_at_utc": "2026-07-09T08:30:00Z",
  "collected_by": "opencode-agent",
  "command_or_query": "",
  "event_time_start": "2026-07-09T07:00:00Z",
  "event_time_end": "2026-07-09T08:00:00Z",
  "entity": "redacted-user",
  "hash_sha256": "abc123...",
  "raw_or_derived": "raw",
  "redaction_status": "raw-sensitive",
  "sensitivity": "internal",
  "description": "Advanced Hunting query result for failed logins",
  "parent_evidence_ids": [],
  "notes": ""
}
```

Full field definitions are in `references/manifest-schema.md`.

## Evidence Capture Patterns

### MCP / Tool Output

- Save raw MCP/tool response to `_workspace/raw/mcp/` or `_workspace/raw/tools/`.
- Save query text separately to `_workspace/raw/queries/` when the query itself is evidence.
- Record the tool name, input parameters, and relevant schema in the manifest entry.

### SIEM / Defender / Wiz / Tenable / Cyble / CommandZero Output

- Save raw export as JSON or CSV when structured export is available.
- Prefer raw structured exports over screenshots — screenshots are supplemental, not primary.
- Store under the appropriate `_workspace/raw/` subfolder (`queries/`, `api/`, `mcp/`).

### Browser Evidence

- Save screenshots under `_workspace/raw/screenshots/`.
- Save HAR/network logs under `_workspace/raw/browser/`.
- Save DOM snapshots and page source under `_workspace/raw/browser/`.
- Record the browser tool used and any isolation notes in the manifest.

### Logs and PCAPs

- Store raw logs under `_workspace/raw/logs/`.
- Store normalized/filtered outputs under `_workspace/derived/normalized/`.
- Never overwrite or modify raw logs in place.

### IOC Lists

- Store extracted IOC lists under `_workspace/derived/iocs/`.
- Defanged, human-readable IOCs go in `_workspace/reports/`.
- Machine-actionable raw IOCs must be clearly labeled and created only when needed.

### Timelines

- Store normalized timelines under `_workspace/derived/timelines/`.
- Every timeline row must reference evidence IDs when possible.

### Reports

- Store evidence appendix in `_workspace/reports/evidence-appendix.md`.
- Store gaps in `_workspace/reports/gaps.md`.
- Store findings in `_workspace/reports/findings.md`.

Detailed capture patterns per source type are in `references/capture-patterns.md`.

## Analysis Chain / Reasoning Summary

Every major conclusion must reference evidence IDs. Use this reasoning format:

```
Observation -> Evidence ID -> Interpretation -> Assumption Checked -> Conclusion -> Confidence
```

Example:

```
Observation: 47 failed logins in 5 minutes from a single external IP.
Evidence: E0012, E0013.
Interpretation: High-rate authentication failure pattern consistent with brute force.
Assumptions checked:
  - Not a known internal scanner: E0014.
  - Target is a human user, not a service account: E0015.
Conclusion: Likely external brute-force attempt targeting the identified account.
Confidence: High.
```

Rules for reasoning:
- Do not write unsupported reasoning or infer beyond evidence.
- Do not expose private chain-of-thought — only document concise analyst rationale.
- Use "reasoning summary", "evidence rationale", or "analysis chain" headings, not "chain-of-thought".
- Every factual claim in findings must be traceable to at least one evidence ID.

## Handling Uncertainty

Apply these rules when evidence is incomplete or ambiguous:

- **Ambiguous evidence**: State all plausible interpretations. Do not pick one without justification.
- **Tool unavailable**: Note which tool was unavailable, what evidence is missing, and how confidence is affected.
- **Missing logs / data**: Document the gap in `_workspace/reports/gaps.md`. Do not call the absence "benign" without corroborating evidence.
- **Unverified assumption**: Mark it explicitly. Lower confidence for any conclusion that depends on it.
- **Stale evidence**: Record collection time and event time separately. Note staleness in the interpretation.
- **Inconsistent evidence**: Flag the conflict. Do not silently discard either piece.

## Gap Analysis

Track these gap types in `_workspace/reports/gaps.md`:

| Gap Type | Example |
|---|---|
| Missing data source | Firewall logs unavailable for the incident window |
| Missing field | Authentication logs lack source port |
| Missing time range | DNS logs only retained for 7 days; incident is 14 days old |
| Retention limitation | Endpoint logs rotated before collection |
| Sensor coverage gap | No EDR on affected subnet |
| Parsing error | Corrupt log entry at 2026-07-09T08:15:00Z |
| Stale document | Prior incident report is from 2024, may not reflect current state |
| Unavailable tool | Tenable API unreachable during investigation |
| Inconsistent evidence | Defender and Elastic report different process paths |
| Unverified assumption | Assumed user account was not compromised before evidence review |

Each gap entry must state:
- What is missing or uncertain
- Which evidence IDs it affects
- How it impacts confidence
- Whether it can be resolved (and how) or is permanent

## Output

This skill produces or updates:

- `_workspace/README.md` — case summary and scope
- `_workspace/manifest.jsonl` — machine-readable evidence registry
- `_workspace/evidence-index.md` — human-readable evidence table
- `_workspace/reports/evidence-appendix.md` — complete evidence appendix
- `_workspace/reports/findings.md` — investigation findings
- `_workspace/reports/gaps.md` — gap analysis
- All raw, extracted, derived, and redacted artifacts under `_workspace/`

## Rerun Rules

- Reuse a workspace only when the case ID and investigation scope match the active run manifest.
- Append new evidence with new IDs; never recycle an evidence ID.
- Mark regenerated or replaced artifacts as superseded in the run manifest and preserve their provenance.
- Version regenerated reports instead of silently replacing prior accepted output.

## Guardrails

- **Never store evidence outside `_workspace/`.**
- **Never overwrite raw evidence.** Derived versions go in `_workspace/derived/`.
- **Never modify original evidence in place.** Copy first, then derive.
- **Never expose secrets, tokens, passwords, private keys, cookies, or sensitive PII in human-readable reports.** Keep approved originals in restricted raw evidence and store shareable copies under `_workspace/redacted/`.
- **Never delete evidence** unless explicitly approved and logged.
- **Never claim evidence exists** unless it has been saved, hashed, and registered in the manifest.
- **Never claim a command or query was run** unless it was actually executed and its output captured.
- **Never use screenshots as the only evidence** when a structured export (JSON, CSV) is available.
- **Never treat absence of evidence as evidence of absence.**
- **Always record uncertainty and gaps.**
- **Always reference evidence IDs in conclusions.**

## References

- `references/workspace-layout.md` — Full `_workspace/` directory tree with per-folder explanations.
- `references/manifest-schema.md` — Complete JSONL field definitions and validation rules.
- `references/capture-patterns.md` — Detailed capture procedures per evidence source type.
- `references/naming-conventions.md` — File naming rules, entity redaction, and case ID handling.
