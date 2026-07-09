# Extraction Output Schemas

Detailed schemas for extraction outputs, quality assessment, and gap reporting.

## Quality Assessment

After extracting any document, assess quality in these dimensions:

| Dimension | Assessment |
|---|---|
| Text completeness | All pages extracted? Any blank pages? Any garbled text? |
| Table accuracy | Are column counts consistent? Are headers preserved? Any merged-cell artifacts? |
| Metadata presence | Is title present? Author? Dates? Page count correct? |
| Image extraction | Are images extracted? Are they legible? Correct positions? |
| OCR quality | If OCR was needed, are there character recognition errors? |
| Password/DRM | Is the document password-protected? DRM-restricted? |

Record quality notes in the manifest `notes` field and in the extraction summary.

## Extraction Summary Template

```markdown
## Extraction Summary — [Document Name]

- **Source document:** `_workspace/raw/documents/<filename>`
- **Parent evidence ID:** E####
- **Extraction tool:** xberg (vX.Y.Z) / python-docx / pymupdf / pdfplumber
- **Extraction command:** (exact command run)
- **Workspace outputs:**
  - `_workspace/extracted/pdf/<file>.xberg.json` (full Xberg output)
  - `_workspace/extracted/text/<file>_content.md` (extracted text)
  - `_workspace/extracted/tables/<file>_tables.csv` (extracted tables)
  - `_workspace/extracted/metadata/<file>_meta.json` (document metadata)
  - `_workspace/extracted/images/<file>_img_N.png` (extracted images)
- **Pages/sections extracted:** N of M total
- **Tables extracted:** N
- **Images extracted:** N
- **Metadata extracted:** title, author, created date, modified date, page count
- **Quality notes:**
  - (any OCR issues, garbled text, missing sections)
  - (table parsing accuracy notes)
- **Gaps:**
  - (unreadable pages, missing attachments, password-protected sections, DRM blocks)
```

## Extracted Tables Schema

Each extracted table should be recorded with:

| Field | Type | Description |
|---|---|---|
| `evidence_id` | string | Evidence ID of the table output |
| `source_document` | string | `_workspace/` path to source document |
| `page_or_section` | string | Document page number or section heading |
| `output_path` | string | `_workspace/` path to table file |
| `row_count` | integer | Number of data rows (excluding header) |
| `column_count` | integer | Number of columns |
| `has_header` | boolean | Whether first row is a header |
| `column_names` | array of strings | Header names if present |
| `table_title` | string | Table caption or title if available |
| `notes` | string | Quality notes, merged cell issues, parsing errors |

## Extracted IOCs Schema

| Field | Type | Description |
|---|---|---|
| `ioc_type` | string | `IPv4`, `IPv6`, `domain`, `url`, `email`, `SHA256`, `MD5`, `SHA1`, `filename`, `filepath`, `registry_key`, `mutex`, `cve`, `user_agent` |
| `ioc_value` | string | The raw IOC value |
| `defanged_value` | string | Defanged version for reports |
| `source_evidence_id` | string | Evidence ID where this IOC was found |
| `source_page_or_section` | string | Location within the source |
| `context` | string | Surrounding text or description |
| `first_seen` | string | ISO 8601 timestamp if known |
| `last_seen` | string | ISO 8601 timestamp if known |
| `confidence` | string | `High`, `Medium`, `Low` |
| `ioc_category` | string | `C2`, `phishing`, `malware`, `scanning`, `exfiltration`, `unknown` |
| `notes` | string | Additional context |

## Timeline Candidates Schema

| Field | Type | Description |
|---|---|---|
| `timestamp_utc` | string | ISO 8601 UTC timestamp |
| `timestamp_original` | string | Original timestamp format from source |
| `timestamp_confidence` | string | `exact`, `approximate`, `estimated`, `inferred` |
| `event_type` | string | `initial_access`, `execution`, `persistence`, `privilege_escalation`, `defense_evasion`, `credential_access`, `discovery`, `lateral_movement`, `collection`, `exfiltration`, `c2`, `impact`, `remediation`, `detection`, `unknown` |
| `source_system` | string | System that generated the event |
| `entity` | string | Affected user, host, IP, or asset |
| `description` | string | Human-readable event description |
| `source_evidence_id` | string | Evidence ID where this event was documented |
| `source_page_or_section` | string | Location within the source |
| `corroborating_evidence_ids` | array of strings | Other evidence supporting this timeline entry |
| `notes` | string | Additional context |

## Gap Reporting

When extraction reveals missing or incomplete data, record each gap:

| Field | Description |
|---|---|
| `gap_type` | `unreadable_page`, `missing_attachment`, `password_protected`, `drm_blocked`, `ocr_failure`, `table_parse_error`, `image_extraction_failure`, `metadata_missing`, `incomplete_content` |
| `evidence_id` | Evidence ID of the affected artifact |
| `description` | What is missing and why |
| `impact` | How this gap affects analysis |
| `remediation` | Can it be resolved? (re-extract with different tool, manual review, request original) |

## Manifest Entry for Extracted Artifacts

```json
{
  "evidence_id": "E0016",
  "case_id": "CASE-123",
  "artifact_type": "extracted-text",
  "source_tool": "xberg",
  "source_system": "Xberg Document Extraction",
  "original_location": "_workspace/raw/documents/20260709-083500Z_CASE-123_prior-report_incident.docx",
  "workspace_path": "_workspace/extracted/docx/20260709-083500Z_CASE-123_prior-report_incident.docx.xberg.json",
  "created_at_utc": "2026-07-09T08:35:00Z",
  "collected_by": "opencode-agent",
  "command_or_query": "xberg extract _workspace/raw/documents/20260709-083500Z_CASE-123_prior-report_incident.docx --format json --content_format markdown",
  "event_time_start": null,
  "event_time_end": null,
  "entity": null,
  "hash_sha256": "def456...",
  "raw_or_derived": "derived",
  "redaction_status": "needs-review",
  "sensitivity": "internal",
  "description": "Full Xberg extraction of prior incident report. Contains text content, metadata, tables.",
  "parent_evidence_id": "E0015",
  "notes": "Extraction quality: all 12 pages extracted. 3 tables detected. No OCR issues. Document metadata present: author, created date, modified date."
}
```
