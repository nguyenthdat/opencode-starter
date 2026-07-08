---
name: evidence-extraction
description: "Extract text, tables, metadata, and images from PDF and DOCX evidence files using Xberg. Structured extraction for IOC harvesting, timeline reconstruction, asset inventory parsing, and prior report review."
compatibility: opencode
metadata:
  domain: secops
  audience: senior-secops-analyst
  edition: "2026.07"
---

# PDF / DOCX Evidence Extraction

Extract text, tables, metadata, and images from PDF and DOCX evidence files using Xberg.

## Xberg Extraction

### Basic
```bash
xberg extract document.pdf --format json --content_format markdown
xberg extract report.docx --format json --content_format markdown
```

### Batch
```bash
for f in evidence/*.pdf evidence/*.docx; do
  xberg extract "$f" --format json --content_format markdown > "$f.json"
done
```

## Output Structure
Xberg returns JSON with: `content` (markdown/plain), `metadata` (title, author, dates, pages), `tables`, `images`.

## Analysis Patterns

### Pattern 1: Incident Report Review
1. Extract DOCX/PDF with Xberg.
2. Parse metadata: author, dates.
3. Extract IOCs: `rg -o '\b(?:\d{1,3}\.){3}\d{1,3}\b'`
4. Cross-reference IOCs with CTI.
5. Extract timeline events for correlation.

### Pattern 2: Asset Inventory
1. Extract PDF/DOCX.
2. Parse tables containing asset lists.
3. Structure with `jq` or `duckdb`.
4. Cross-reference with company context.

### Pattern 3: Prior Investigation Review
1. Extract prior investigation DOCX.
2. Identify findings, IOCs, recommendations.
3. Compare with current investigation for overlap.
4. Note unresolved actions from prior report.

### Pattern 4: Evidence Chain Verification
1. Extract evidence documents.
2. Compare timestamps and IOCs across documents.
3. Validate consistency.
4. Flag inconsistencies or gaps.

## Handling Large Documents
- Use `--content_format plain` for faster extraction on large PDFs.
- Extract metadata first; then decide if full content needed.
- For multi-hundred page PDFs, extract chapter by chapter if possible.

## Fallback
- `python-docx` for DOCX files directly.
- `pymupdf` (fitz) for PDF extraction.
- `pdftotext` for simple text extraction.
- `pdfplumber` for table extraction from PDFs.
