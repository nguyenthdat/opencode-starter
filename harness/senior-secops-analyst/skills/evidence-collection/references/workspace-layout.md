# Workspace Layout Reference

The `_workspace/` directory is the sole evidence root. Every subfolder has a specific purpose.

## Complete Directory Tree

```
_workspace/
├── README.md
│   Case summary, investigation scope, case ID, start date, analysts involved.
│   Created once at investigation start; updated as scope changes.
│
├── manifest.jsonl
│   Machine-readable evidence registry. One JSON object per line.
│   Every artifact in _workspace/ must have a corresponding entry.
│   Updated atomically: write to temp file, validate, then move.
│
├── evidence-index.md
│   Human-readable evidence table in Markdown format.
│   Columns: Evidence ID | Type | Source | Entity | Time Range | Workspace Path | SHA256 | Notes
│   Updated whenever new evidence is collected.
│
├── raw/
│   └── Unmodified original evidence. Never altered after initial save.
│   ├── tools/
│   │   Raw CLI tool output (JSON, text, CSV). Any tool that produces evidence.
│   ├── logs/
│   │   Raw log files, PCAPs, event logs. Never filtered before storing here.
│   ├── queries/
│   │   Query text (KQL, SPL, SQL) and structured query results (JSON, CSV).
│   ├── screenshots/
│   │   Browser screenshots, desktop screenshots. PNG preferred.
│   ├── browser/
│   │   HAR files, DOM snapshots, page source, network logs from browser tools.
│   ├── documents/
│   │   Original PDF, DOCX, XLSX, images, and other document files.
│   ├── api/
│   │   Raw HTTP API responses. Include status code and headers when relevant.
│   └── mcp/
│       Raw MCP tool responses. One file per tool invocation when practical.
│
├── extracted/
│   └── Content extracted from documents (not raw — these are derived from raw/documents/).
│   ├── pdf/
│   │   Xberg or fallback extraction output from PDF files.
│   ├── docx/
│   │   Xberg or fallback extraction output from DOCX files.
│   ├── tables/
│   │   Extracted tables in CSV, JSON, or Markdown format.
│   ├── images/
│   │   Images extracted from documents.
│   ├── text/
│   │   Plain or markdown text extracted from documents.
│   └── metadata/
│       Document metadata (author, dates, page count, title).
│
├── derived/
│   └── Transformed, normalized, correlated, or enriched outputs.
│       Each is a new evidence artifact with its own evidence ID
│       and parent_evidence_id linking to the raw source.
│   ├── iocs/
│   │   Extracted IOC lists (CSV, JSON). Clearly label defanged vs raw.
│   ├── timelines/
│   │   Normalized event timelines (CSV, JSON). Each row references evidence IDs.
│   ├── correlations/
│   │   Cross-source correlation outputs.
│   ├── summaries/
│   │   Condensed, analyst-written summaries of large evidence sets.
│   └── normalized/
│       Logs, tables, or outputs converted to a common schema.
│
├── reports/
│   └── Human-readable deliverables for analysts and stakeholders.
│   ├── evidence-appendix.md
│   │   Complete evidence table with all collected evidence.
│   ├── findings.md
│   │   Investigation findings with evidence ID references.
│   └── gaps.md
│       Gap analysis: missing data, limitations, unresolved questions.
│
├── redacted/
│   └── Shareable versions of evidence with secrets, PII, and sensitive data removed.
│       Each redacted artifact has parent_evidence_id pointing to the raw original.
│       Redaction method must be documented in the manifest entry.
│
├── temp/
│   └── Temporary files: intermediate processing, scratch work, in-progress artifacts.
│       Cleaned periodically. Nothing in temp/ is considered permanent evidence.
│       Move finalized artifacts out of temp/ before registering in manifest.
│
└── archive/
    └── Compressed case bundles (tar.gz, zip) for long-term storage.
        Created only when an investigation is closed or handed off.
```

## Folder Creation Command

```bash
mkdir -p _workspace/{raw/{tools,logs,queries,screenshots,browser,documents,api,mcp},extracted/{pdf,docx,tables,images,text,metadata},derived/{iocs,timelines,correlations,summaries,normalized},reports,redacted,temp,archive}
```

## Folder Rules

1. **raw/** is append-only after initial save. Never edit, overwrite, or delete raw evidence.
2. **extracted/** contains content mechanically extracted from documents. Track parent-child relationships.
3. **derived/** contains analyst-created or tool-processed outputs. Always reference the source evidence ID.
4. **reports/** is for human consumption. No raw data, only summaries with evidence ID references.
5. **redacted/** is for external sharing. Never put unredacted evidence here.
6. **temp/** is temporary. Do not register temp files in the manifest.
7. **archive/** is for closed cases. Do not archive active investigations.
