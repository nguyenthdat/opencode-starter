---
name: docx-reporting
description: "Generate professional DOCX investigation reports from template and structured findings. Executive summaries, incident reports, vulnerability reports with proper formatting, classification marking, and evidence tables."
compatibility: opencode
metadata:
  domain: secops
  audience: senior-secops-analyst
  edition: "2026.07"
---

# DOCX Report Generation from Template

Generate professional DOCX investigation reports from structured findings and a template.

## Template Approach

1. Read template with Xberg to understand placeholders.
2. Use `python-docx` to replace placeholders and populate tables.
3. Preserve template styles, headers, footers, page numbers.
4. Save with timestamp and classification marking.

## Report Sections (Standard Order)

1. Title Page (classification, author, distribution)
2. Executive Summary (≤5 sentences, business impact focus)
3. Scope & Question
4. Context Used
5. Evidence Table
6. Timeline (if relevant)
7. Affected Users / Assets
8. Detection Sources Queried
9. Findings (detailed)
10. False Positive Considerations
11. Verdict (Benign / Suspicious / Malicious / Inconclusive)
12. Severity & Confidence with rationale
13. Recommended Actions (prioritized, with owner and timeline)
14. Control Hardening Recommendations
15. Gaps & Next Steps

## python-docx Snippets

### Open Template and Replace
```python
from docx import Document
doc = Document("template.docx")
for p in doc.paragraphs:
    if "{{EXECUTIVE_SUMMARY}}" in p.text:
        p.text = p.text.replace("{{EXECUTIVE_SUMMARY}}", executive_summary)
```

### Populate Table
```python
table = doc.tables[0]
for row_data in evidence_rows:
    row = table.add_row()
    for i, cell_text in enumerate(row_data):
        row.cells[i].text = cell_text
```

### Add Classification Footer
```python
from docx.enum.text import WD_ALIGN_PARAGRAPH
section = doc.sections[0]
footer = section.footer
footer.paragraphs[0].text = "TLP:AMBER — CONFIDENTIAL"
footer.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
```

### Save
```python
from datetime import datetime
ts = datetime.now().strftime("%Y%m%d_%H%M%S")
doc.save(f"investigation_report_{ts}.docx")
```

## Quality Gates
- Template styles preserved.
- No placeholder text remains.
- Tables complete and aligned.
- Classification marking on every page.
- File saved with timestamp and descriptive name.
