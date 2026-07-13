---
name: evidence-extraction
description: "Extract text, tables, metadata, and images from PDF and DOCX evidence files using Xberg. Save all extracted outputs under _workspace/. Use for incident report review, asset inventory parsing, prior investigation review, evidence chain verification, IOC harvesting from documents, and timeline reconstruction from document evidence. Triggers on: extract PDF, extract DOCX, parse document evidence, extract tables from report, get metadata from file, extract IOCs from document, review prior incident report."
compatibility: opencode
metadata:
  domain: secops
  audience: senior-secops-analyst
  edition: "2026.07"
---

# PDF / DOCX Evidence Extraction

Extract text, tables, metadata, and images from PDF and DOCX evidence files. All source copies, extraction outputs, tables, images, metadata, and derived IOCs/timelines must be stored under `_workspace/`.

## Workspace Requirement

**All extraction artifacts must be saved under `_workspace/`.** The source document is copied to `_workspace/raw/documents/`. Extracted content goes to `_workspace/extracted/`. Derived outputs (IOCs, timelines) go to `_workspace/derived/`.

Every artifact — source copy, extraction output, derived artifact — must be registered in `_workspace/manifest.jsonl` with a unique evidence ID and parent-child relationships.

If `_workspace/` does not exist, use the evidence-collection skill to initialize it before extracting.

## Input Handling

When given a PDF or DOCX file:

1. **Copy the source document** into `_workspace/raw/documents/` using the naming convention:
   ```
   <YYYYMMDD-HHMMSSZ>_<case-id>_<source>_<entity>_<desc>.<ext>
   ```
2. **Compute SHA256** of the copied file.
3. **Register the source document** in `_workspace/manifest.jsonl` with:
   - `artifact_type: document`
   - `raw_or_derived: raw`
   - `original_location`: the original file path or URL
4. **Extract content** into `_workspace/extracted/` (see Xberg Extraction below).
5. **Register each extracted artifact** in the manifest with `parent_evidence_ids` containing the source document.
6. **Create derived IOCs or timelines** only under `_workspace/derived/`, also with parent evidence IDs.

## Xberg Extraction

Use Xberg as the primary extraction tool when it is available.

### Basic Extraction

```bash
mkdir -p _workspace/extracted/{pdf,docx,metadata,tables,images,text}

# PDF
xberg extract "_workspace/raw/documents/<file>.pdf" \
  --format json --content_format markdown \
  > "_workspace/extracted/pdf/<file>.xberg.json"

# DOCX
xberg extract "_workspace/raw/documents/<file>.docx" \
  --format json --content_format markdown \
  > "_workspace/extracted/docx/<file>.xberg.json"
```

### Large Documents

For large documents where speed matters, use plain content format to reduce processing time:

```bash
xberg extract "_workspace/raw/documents/<file>.pdf" \
  --format json --content_format plain \
  > "_workspace/extracted/text/<file>.plain.xberg.json"
```

Extract metadata first, then decide whether full content extraction is needed:

```bash
xberg extract "_workspace/raw/documents/<file>.pdf" --format json \
  | jq '{title: .metadata.title, author: .metadata.author, pages: .metadata.pages, created: .metadata.created}'
```

### Batch Extraction

```bash
find _workspace/raw/documents -type f \( -iname '*.pdf' -o -iname '*.docx' \) -print0 |
while IFS= read -r -d '' f; do
  base="$(basename "$f")"
  ext_dir="pdf"
  case "$f" in
    *.docx|*.DOCX) ext_dir="docx" ;;
  esac
  xberg extract "$f" --format json --content_format markdown \
    > "_workspace/extracted/${ext_dir}/${base}.xberg.json"
done
```

### Xberg Output Structure

Xberg returns JSON with these fields:
- `content`: Extracted text in the requested `content_format` (markdown, plain, html, djot, json).
- `metadata`: Document metadata (title, author, dates, page count, file size).
- `tables`: Extracted tables with headers and rows.
- `images`: Extracted images with positions and metadata.

## Extraction Output Handling

Xberg outputs must be organized into these subdirectories:

| Xberg Field | Destination |
|---|---|
| `content` (markdown/plain) | `_workspace/extracted/text/` or `_workspace/extracted/pdf/` / `_workspace/extracted/docx/` |
| `tables` | `_workspace/extracted/tables/` |
| `images` | `_workspace/extracted/images/` |
| `metadata` | `_workspace/extracted/metadata/` |

If the Xberg output is a single JSON file, register that raw extraction JSON as the primary extracted artifact. Create separate table/text/image files under `_workspace/extracted/` only when they serve a distinct analytical purpose.

### Splitting Extraction Output

When separate files are useful:

```bash
# Extract tables to CSV
xberg extract doc.pdf --format json | jq -r '.tables[] | @csv' \
  > "_workspace/extracted/tables/<file>_tables.csv"

# Extract metadata
xberg extract doc.pdf --format json | jq '.metadata' \
  > "_workspace/extracted/metadata/<file>_meta.json"

# Extract text content only
xberg extract doc.pdf --format json --content_format markdown | jq -r '.content' \
  > "_workspace/extracted/text/<file>_content.md"
```

## Analysis Patterns

### Pattern 1: Incident Report Review

1. Copy the incident report to `_workspace/raw/documents/`.
2. Register as evidence (document artifact type).
3. Extract with Xberg to `_workspace/extracted/`.
4. Register extraction output with parent evidence IDs.
5. Parse metadata for author, creation date, revision history.
6. Extract IOCs from the content to `_workspace/derived/iocs/`.
7. Extract timeline candidates to `_workspace/derived/timelines/`.
8. Cross-reference extracted IOCs and events with existing evidence IDs.
9. Record any unresolved recommendations or actions in `_workspace/reports/findings.md`.

### Pattern 2: Asset Inventory Parsing

1. Copy the asset inventory document to `_workspace/raw/documents/`.
2. Extract tables with Xberg.
3. Save tables to `_workspace/extracted/tables/`.
4. Normalize the asset data to a common schema under `_workspace/derived/normalized/`.
5. Cross-reference assets with current system context (CMDB, live queries).
6. Record the source document evidence ID for every asset entry.

### Pattern 3: Prior Investigation Review

1. Copy the prior investigation document to `_workspace/raw/documents/`.
2. Extract full content with Xberg.
3. Identify: findings, IOCs, recommendations, dates, affected assets, unresolved actions.
4. Compare with current investigation evidence:
   - Overlap: matching IOCs, consistent timelines.
   - Conflicts: contradictory findings, different asset scope.
   - New: items in prior report not yet addressed.
   - Resolved: items from prior report that have been remediated.
5. Save review summary under `_workspace/reports/` with a descriptive name.

### Pattern 4: Evidence Chain Verification

1. Extract all relevant evidence documents.
2. Compare timestamps, IOCs, entities, and claims across documents.
3. Validate consistency — do timestamps align? Do IOCs match? Do entity names agree?
4. Flag contradictions: mismatched timestamps, conflicting IOCs, entity mismatches.
5. Identify gaps: missing documents, incomplete extraction, OCR errors.
6. Save verification notes to `_workspace/reports/gaps.md` (gap type: inconsistent evidence).

## Fallback Tools

If Xberg is unavailable, use these tools in order of preference.

### DOCX

```bash
# python-docx
uv run python3 -c "
from docx import Document
doc = Document('_workspace/raw/documents/report.docx')
for p in doc.paragraphs:
    print(p.text)
" > "_workspace/extracted/text/report.docx.txt"

# Tables from DOCX
uv run python3 -c "
from docx import Document
import csv, sys
doc = Document('_workspace/raw/documents/report.docx')
w = csv.writer(sys.stdout)
for table in doc.tables:
    for row in table.rows:
        w.writerow([cell.text for cell in row.cells])
" > "_workspace/extracted/tables/report_tables.csv"
```

### PDF

```bash
# pymupdf (fitz) — text + images
uv run python3 -c "
import fitz
doc = fitz.open('_workspace/raw/documents/report.pdf')
for page in doc:
    print(page.get_text())
" > "_workspace/extracted/text/report.pdf.txt"

# pdftotext — simple text extraction
pdftotext "_workspace/raw/documents/report.pdf" \
  "_workspace/extracted/text/report.pdf.txt"

# pdfplumber — table extraction
uv run python3 -c "
import pdfplumber, csv, sys
with pdfplumber.open('_workspace/raw/documents/report.pdf') as pdf:
    w = csv.writer(sys.stdout)
    for page in pdf.pages:
        for table in page.extract_tables():
            for row in table:
                w.writerow(row)
" > "_workspace/extracted/tables/report_tables.csv"
```

### Metadata Extraction

```bash
# exiftool or equivalent
xberg extract "_workspace/raw/documents/report.pdf" --format json | jq '.metadata'
```

All fallback outputs must be saved under `_workspace/extracted/` and registered in the manifest. Record the fallback tool used and any known limitations in the manifest `notes` field.

## Evidence Model

Every extracted artifact must include these fields in the manifest:

| Field | Description |
|---|---|
| `evidence_id` | Unique ID for this extracted artifact |
| `parent_evidence_ids` | Evidence IDs of source documents in `_workspace/raw/documents/` |
| `source_tool` | Tool used for extraction (`xberg`, `python-docx`, `pymupdf`, `pdfplumber`) |
| `command_or_query` | Exact extraction command run |
| `workspace_path` | Path to the extracted output file |
| `hash_sha256` | SHA256 of the extracted output |
| `artifact_type` | `extracted-text`, `extracted-table`, `extracted-image`, or `extracted-metadata` |
| `notes` | Page/sheet/section if available, confidence/quality, parsing gaps |

## Output Schemas

### Extraction Summary

For each document extracted, produce:

```
Source document: _workspace/raw/documents/<filename>
Parent evidence ID: E####
Extraction tool: xberg (or fallback tool name)
Workspace outputs:
  - _workspace/extracted/pdf/<file>.xberg.json
  - _workspace/extracted/tables/<file>_tables.csv (if split)
  - _workspace/extracted/metadata/<file>_meta.json (if split)
Pages/sections extracted: N
Tables extracted: N
Images extracted: N
Metadata extracted: title, author, dates
Quality notes: (any OCR issues, garbled text, missing sections)
Gaps: (unreadable pages, missing attachments, password-protected sections)
```

### Extracted Tables

| Evidence ID | Source Document | Page/Section | Output Path | Rows | Columns | Notes |
|---|---|---|---|---|---|---|
| E#### | report.pdf | p.3 | `_workspace/extracted/tables/...csv` | 42 | 8 | First row is header |

### Extracted IOCs

| IOC Type | IOC | Source Evidence ID | Page/Section | Confidence | Notes |
|---|---|---|---|---|---|
| IPv4 | 198.51.100.23 | E0015 | p.4 | High | Listed as C2 IP |
| Domain | evil.example.com | E0015 | p.4 | Medium | Referenced in body text |
| SHA256 | abc123... | E0015 | p.7 | High | Listed as malware hash |

### Timeline Candidates

| Time | Event | Source Evidence ID | Page/Section | Confidence | Notes |
|---|---|---|---|---|---|
| 2026-07-09T08:00:00Z | Initial access detected | E0015 | p.2 | High | Exact timestamp from report |
| 2026-07-09T09:30:00Z | Lateral movement observed | E0015 | p.3 | Medium | Approximate time from narrative |

## Guardrails

- **Never extract into arbitrary paths outside `_workspace/`.** All outputs go under `_workspace/extracted/` or `_workspace/derived/`.
- **Never overwrite source documents** in `_workspace/raw/documents/`. The copy is the golden record.
- **Never treat OCR or extraction text as perfect.** Always record extraction quality and parsing gaps in the manifest `notes`.
- **Never expose sensitive PII or secrets in reports.** Redact before including in `_workspace/reports/`. Keep unredacted originals in `_workspace/raw/` or `_workspace/redacted/`.
- **Always record parent-child evidence relationships.** Every extracted artifact must have `parent_evidence_ids`.
- **Prefer structured extraction over screenshots.** Text/tables from Xberg are primary; screenshots of document pages are supplemental.
- **Preserve original documents unchanged.** The copy in `_workspace/raw/documents/` is immutable after initial save.

## References

- `references/extraction-schemas.md` — Detailed output schemas for extracted artifacts, quality assessment, and gap reporting.
