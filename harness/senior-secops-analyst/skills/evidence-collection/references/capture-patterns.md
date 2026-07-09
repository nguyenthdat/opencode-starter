# Evidence Capture Patterns

Detailed procedures for collecting evidence from each source type.

## MCP / Tool / API Output

### Procedure

1. Execute the tool/API call.
2. Capture the full raw response (JSON, text, or binary).
3. Save to `_workspace/raw/mcp/`, `_workspace/raw/tools/`, or `_workspace/raw/api/`.
4. If the query/command itself is evidence, save it separately to `_workspace/raw/queries/`.
5. Assign an evidence ID to the raw output.
6. Record the tool name, version, input parameters, and relevant schema in the manifest `command_or_query` and `notes` fields.

### Manifest Fields

- `source_tool`: The MCP server name or tool name (e.g., `defender-mcp`, `github-mcp`).
- `source_system`: The upstream system (e.g., `Microsoft Defender XDR`, `GitHub`).
- `original_location`: Tool invocation path or endpoint.
- `command_or_query`: The exact tool call with parameters.

### Example

```
Evidence ID: E0012
Source Tool: defender-mcp
Source System: Microsoft Defender XDR
Artifact Type: mcp-response
Workspace Path: _workspace/raw/mcp/20260709-083000Z_CASE-123_defender_advanced-hunting.json
```

## SIEM / Defender / Wiz / Tenable / Cyble / CommandZero

### Procedure

1. Run the query or export from the security tool.
2. Save the raw export as structured data (JSON, CSV) — never rely on screenshots alone.
3. Store under `_workspace/raw/queries/` for query results, `_workspace/raw/logs/` for event exports.
4. If the tool provides API access, prefer API exports over manual UI exports.
5. For large exports, note row counts and any pagination limits in the manifest `notes`.
6. Screenshots of dashboards or UI are supplemental evidence — assign separate evidence IDs.

### Manifest Fields

- `source_tool`: The MCP, CLI, or API tool used (e.g., `defender-mcp`, `elastic-mcp`, `tenable-api`).
- `source_system`: The security platform (e.g., `Elastic Security`, `Wiz`, `Tenable`, `Cyble`, `CommandZero`).
- `command_or_query`: The exact query string (KQL, SPL, Lucene, SQL) or API endpoint.
- `event_time_start` / `event_time_end`: The query time window.

### Example

```
Evidence ID: E0005
Source Tool: elastic-mcp
Source System: Elastic Security
Artifact Type: query-result
Workspace Path: _workspace/raw/queries/20260709-080000Z_CASE-123_elastic_failed-logins.json
Query: event.dataset:auth AND event.outcome:failure AND @timestamp:[now-24h TO now]
```

## Browser Evidence

### Screenshots

1. Navigate to the target page or state.
2. Capture a full-page screenshot (PNG preferred).
3. Save to `_workspace/raw/screenshots/`.
4. Record the URL, viewport size, and browser identity in the manifest.
5. If the screenshot contains sensitive data, mark `redaction_status: needs-review`.

### HAR / Network Logs

1. Capture network activity during the session.
2. Save HAR to `_workspace/raw/browser/`.
3. Record the capture duration and any filters applied.

### DOM / Page Source

1. Capture the page's accessibility snapshot or full DOM source.
2. Save to `_workspace/raw/browser/`.
3. Record the URL and capture timestamp.

### Browser Tool Identity

- `source_tool`: `cloakbrowser`, `playwright`, or specific browser MCP.
- Record isolation mode (headless, CloakBrowser, standard browser) in `notes`.

### Example

```
Evidence ID: E0020
Source Tool: cloakbrowser
Source System: CloakBrowser / Playwright
Artifact Type: screenshot
Workspace Path: _workspace/raw/screenshots/20260709-083122Z_CASE-123_phishing-example-com_landing.png
URL: https://phishing.example.com/login
```

## Logs and PCAPs

### Procedure

1. Copy or download the raw log file / PCAP to `_workspace/raw/logs/`.
2. Compute SHA256 immediately.
3. If the source is a remote system, record the retrieval method (SCP, API download, SIEM export).
4. Create normalized/filtered versions only in `_workspace/derived/normalized/`.
5. Never modify the original in `_workspace/raw/logs/`.

### Manifest Fields

- `original_location`: Source path or URL where the log was retrieved from.
- `event_time_start` / `event_time_end`: Time range covered by the log (if known).
- `notes`: Log format, encoding, any known corruption or gaps.

### Example

```
Evidence ID: E0015
Source Tool: scp
Source System: web-server-01
Artifact Type: log-file
Workspace Path: _workspace/raw/logs/20260709-084500Z_CASE-123_web-server-01_auth.log
Original Location: web-server-01:/var/log/auth.log
```

## IOC Lists

### Procedure

1. Extract IOCs from evidence (IPs, domains, hashes, URLs, email addresses).
2. Save the extracted list to `_workspace/derived/iocs/`.
3. Create a **defanged** version for human-readable reports (e.g., `hxxp://` instead of `http://`, `example[.]com` instead of `example.com`).
4. The machine-actionable raw IOC list must be clearly labeled as raw and contain only actionable IOCs.
5. Every IOC in the list must reference the source evidence ID.
6. Record confidence per IOC (High, Medium, Low).

### Output Columns

| IOC Type | IOC | Source Evidence ID | First Seen | Last Seen | Confidence | Defanged | Notes |

### Example

```
Evidence ID: E0030
Source Tool: manual-extraction
Artifact Type: ioc-list
Workspace Path: _workspace/derived/iocs/20260709-084000Z_CASE-123_iocs_defanged.csv
Parent Evidence IDs: E0020, E0021, E0025
```

## Timelines

### Procedure

1. Extract timestamped events from all collected evidence.
2. Normalize to a common schema: timestamp, event type, source, entity, description, evidence ID.
3. Save to `_workspace/derived/timelines/`.
4. Every row must reference the source evidence ID.
5. Mark estimated or uncertain timestamps.

### Output Columns

| Timestamp UTC | Event Type | Source System | Entity | Description | Evidence ID | Confidence |

### Example

```
Evidence ID: E0040
Source Tool: manual-reconstruction
Artifact Type: timeline
Workspace Path: _workspace/derived/timelines/20260709-090000Z_CASE-123_master-timeline.csv
Parent Evidence IDs: E0001-E0040
```

## IOC Harvesting from Extracted Documents

1. Extract document content using the evidence-extraction skill.
2. Run IOC extraction on the extracted text.
3. Cross-reference extracted IOCs with CTI sources when available.
4. Record source document evidence ID and page/section for each IOC.
5. Store in `_workspace/derived/iocs/`.
