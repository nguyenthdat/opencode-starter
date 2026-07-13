# Manifest JSONL Schema

Every permanent evidence artifact must have a corresponding entry in `_workspace/manifest.jsonl`. Exclude workspace control files and temporary files as defined by `evidence-collection`.

## Format

One JSON object per line. No trailing commas. UTF-8 encoded. Unix line endings.

## Field Definitions

| Field | Type | Required | Description |
|---|---|---|---|
| `evidence_id` | string | Yes | Unique ID: E0001, E0002, … . Zero-padded to 4+ digits. |
| `case_id` | string | Yes | Investigation case ID. Use `CASE-UNKNOWN` if not yet assigned. |
| `artifact_type` | string | Yes | Type of artifact. See allowed values below. |
| `source_tool` | string | Yes | Tool that produced the evidence (e.g., `defender-mcp`, `xberg`, `cloakbrowser`). |
| `source_system` | string | Yes | System or platform (e.g., `Microsoft Defender XDR`, `Elastic Security`). |
| `original_location` | string | Yes | Where evidence originated: URL, file path, tool output handle, query name. |
| `workspace_path` | string | Yes | Relative path within `_workspace/` where the artifact is stored. |
| `created_at_utc` | string | Yes | ISO 8601 UTC timestamp of collection: `2026-07-09T08:30:00Z`. |
| `collected_by` | string | Yes | Entity that collected: `opencode-agent`, analyst name, or automated system. |
| `command_or_query` | string | No | Exact command, query, or API call that produced this evidence. |
| `event_time_start` | string | No | ISO 8601 UTC start of observed event window. |
| `event_time_end` | string | No | ISO 8601 UTC end of observed event window. |
| `entity` | string | No | Subject entity (user, host, IP, domain). Redact if sensitive. |
| `hash_sha256` | string | Yes | SHA256 hex digest of the permanent artifact file. |
| `raw_or_derived` | string | Yes | `raw` for unmodified originals, `derived` for processed outputs. |
| `redaction_status` | string | Yes | `raw-sensitive`, `redacted`, `not-sensitive`, `needs-review`. |
| `sensitivity` | string | Yes | Classification: `internal`, `confidential`, `restricted`, `public`. |
| `description` | string | Yes | Human-readable summary of what this evidence contains. |
| `parent_evidence_ids` | array[string] | Yes | Source evidence IDs for derived artifacts. Empty for raw evidence. |
| `notes` | string | No | Free-form notes: extraction quality, parsing gaps, limitations. |

## Allowed `artifact_type` Values

| Value | Description |
|---|---|
| `screenshot` | Browser or desktop screenshot |
| `har-file` | HTTP Archive network log |
| `dom-snapshot` | Page DOM state capture |
| `browser-source` | Raw page source HTML |
| `query-result` | Structured query output (JSON, CSV) |
| `query-text` | Query text (KQL, SPL, SQL) |
| `api-response` | Raw HTTP API response |
| `mcp-response` | Raw MCP tool response |
| `tool-output` | CLI or script output |
| `log-file` | Raw log file |
| `pcap` | Packet capture |
| `document` | Original document file (PDF, DOCX, XLSX) |
| `extracted-text` | Text extracted from document |
| `extracted-table` | Table extracted from document |
| `extracted-image` | Image extracted from document |
| `extracted-metadata` | Document metadata |
| `ioc-list` | Extracted indicator list |
| `timeline` | Normalized event timeline |
| `correlation` | Cross-source correlation output |
| `summary` | Analyst-written summary |
| `normalized-output` | Schema-normalized data |
| `report` | Human-readable report |
| `redacted-copy` | Redacted version of raw evidence |
| `archive` | Compressed case bundle |

## Example Manifest Entry (Full)

```json
{
  "evidence_id": "E0001",
  "case_id": "CASE-123",
  "artifact_type": "query-result",
  "source_tool": "defender-mcp",
  "source_system": "Microsoft Defender XDR",
  "original_location": "advanced-hunting",
  "workspace_path": "_workspace/raw/queries/20260709-083000Z_CASE-123_defender_user-jsmith_query.json",
  "created_at_utc": "2026-07-09T08:30:00Z",
  "collected_by": "opencode-agent",
  "command_or_query": "DeviceLogonEvents | where AccountName == 'jsmith' | take 1000",
  "event_time_start": "2026-07-09T07:00:00Z",
  "event_time_end": "2026-07-09T08:00:00Z",
  "entity": "redacted-user",
  "hash_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "raw_or_derived": "raw",
  "redaction_status": "raw-sensitive",
  "sensitivity": "internal",
  "description": "Advanced Hunting query result for DeviceLogonEvents filtered to user jsmith within 1-hour window.",
  "parent_evidence_ids": [],
  "notes": "Query limited to 1000 rows. Full dataset may be larger."
}
```

## Validation Rules

1. `evidence_id` must be unique across the entire manifest.
2. `evidence_id` must follow the pattern `E` followed by 4+ zero-padded digits.
3. `workspace_path` must point to an existing file (once written).
4. `hash_sha256` must be a 64-character lowercase hex string.
5. `raw_or_derived` must be `raw` or `derived`.
6. Every value in `parent_evidence_ids` must reference an existing `evidence_id` in the manifest.
7. `created_at_utc` must be ISO 8601 with seconds and `Z` suffix.
8. `case_id` must not be empty.
