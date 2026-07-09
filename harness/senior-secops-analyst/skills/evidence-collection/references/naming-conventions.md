# File Naming Conventions

All evidence artifacts in `_workspace/` must use deterministic, safe, sortable names.

## Naming Pattern

```
<YYYYMMDD-HHMMSSZ>_<case-id>_<source>_<entity>_<artifact-type>.<ext>
```

## Field Definitions

| Segment | Format | Example | Notes |
|---|---|---|---|
| Timestamp | `YYYYMMDD-HHMMSSZ` | `20260709-083000Z` | UTC collection time. Use `Z` suffix. |
| Case ID | Alphanumeric + hyphens | `CASE-123`, `CASE-UNKNOWN` | Use `CASE-UNKNOWN` if not yet assigned. |
| Source | Lowercase, hyphens | `defender`, `elastic`, `cloakbrowser` | The tool or system that produced it. |
| Entity | Lowercase, hyphens | `user-jsmith`, `host-web-01`, `192-168-1-100` | Subject of the evidence. Redact if sensitive. |
| Artifact Type | Lowercase, hyphens | `query`, `screenshot-landing`, `iocs-defanged` | Short descriptor of what the file contains. |
| Extension | Standard extension | `.json`, `.csv`, `.png`, `.md`, `.har`, `.pcap` | Must match the actual file format. |

## Entity Redaction Rules

If the entity is a real person's name, email, or other PII:
- Replace with `redacted-user`, `redacted-email`, or `redacted-entity`.
- Never use real names, email addresses, or usernames in filenames.

If the entity is a hostname or IP:
- Use the actual hostname or a slugified version (dots become hyphens).
- For internal hostnames that are sensitive, use `internal-host-NN`.

## Examples

### Query Results

```
_workspace/raw/queries/20260709-083000Z_CASE-123_defender_user-jsmith_query.json
_workspace/raw/queries/20260709-080000Z_CASE-UNKNOWN_elastic_failed-logins_query.json
_workspace/raw/queries/20260709-084500Z_CASE-123_splunk_192-168-1-100_search.spl
```

### Screenshots

```
_workspace/raw/screenshots/20260709-083122Z_CASE-123_phishing-example-com_landing.png
_workspace/raw/screenshots/20260709-083200Z_CASE-123_defender_alert-dashboard.png
_workspace/raw/screenshots/20260709-083300Z_CASE-UNKNOWN_wiz_vuln-overview.png
```

### Browser Artifacts

```
_workspace/raw/browser/20260709-083122Z_CASE-123_phishing-example-com_network.har
_workspace/raw/browser/20260709-083122Z_CASE-123_phishing-example-com_dom.json
_workspace/raw/browser/20260709-083122Z_CASE-123_phishing-example-com_source.html
```

### Documents

```
_workspace/raw/documents/20260709-083500Z_CASE-123_prior-report_incident.docx
_workspace/raw/documents/20260709-083500Z_CASE-123_asset-inventory_hosts.pdf
```

### Extracted Content

```
_workspace/extracted/pdf/20260709-083500Z_CASE-123_prior-report_content.md
_workspace/extracted/tables/20260709-083500Z_CASE-123_asset-inventory_host-table.csv
_workspace/extracted/metadata/20260709-083500Z_CASE-123_prior-report_meta.json
```

### Derived Artifacts

```
_workspace/derived/iocs/20260709-084000Z_CASE-123_iocs_defanged.csv
_workspace/derived/iocs/20260709-084000Z_CASE-123_iocs_raw.csv
_workspace/derived/timelines/20260709-090000Z_CASE-123_master-timeline.csv
_workspace/derived/normalized/20260709-085000Z_CASE-123_auth-logs_normalized.json
```

### Reports

```
_workspace/reports/evidence-appendix.md
_workspace/reports/findings.md
_workspace/reports/gaps.md
```

## Characters to Avoid

- Spaces (use hyphens)
- Special characters (`!@#$%^&*()+=[]{}|;:'",<>?/~`)
- Non-ASCII characters
- Leading or trailing hyphens
- Consecutive hyphens (use single hyphens)
- Leading dots (except hidden files in _workspace root like `.gitkeep`)

## Sorting

Files sort chronologically when listed alphabetically because the timestamp comes first. This makes directory listings naturally chronological.
