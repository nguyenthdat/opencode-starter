---
name: elastic-siem
description: "Investigate security events in Elastic as a central log platform. Covers index discovery, schema detection, KQL/Lucene/EQL/ES|QL/DSL query strategies, NDR syslog investigation, pivot analysis, and correlation across Elastic Security alerts, endpoint logs, auth logs, firewall/proxy/DNS, raw syslog, and cloud logs. Use when investigating incidents, hunting threats, triaging alerts, or analyzing log data from any source ingested into Elastic."
compatibility: opencode
metadata:
  domain: secops
  audience: senior-secops-analyst
  edition: "2026.07"
---

# Elastic Central Log Investigation

Elastic is the central log platform. It may contain Elastic Security alerts, endpoint logs, authentication logs, firewall/proxy/DNS logs, raw syslog, NDR syslogs, M365/cloud logs, ECS-normalized logs, partially ECS-normalized logs, and custom/raw logs. Fields may or may not follow ECS. Never assume schema.

## Mandatory Phase 1: Index Discovery

Before writing any query, discover what indexes exist and which are relevant to the investigation.

### Candidate Index Patterns

Run index discovery against all of these patterns. The environment may use any subset.

```
GET _cat/indices/logs-*?v&h=index,docs.count,store.size
GET _cat/indices/.ds-logs-*?v&h=index,docs.count,store.size
GET _cat/indices/filebeat-*?v&h=index,docs.count,store.size
GET _cat/indices/winlogbeat-*?v&h=index,docs.count,store.size
GET _cat/indices/packetbeat-*?v&h=index,docs.count,store.size
GET _cat/indices/auditbeat-*?v&h=index,docs.count,store.size
GET _cat/indices/.alerts-security.alerts-*?v&h=index,docs.count,store.size
GET _cat/indices/*syslog*?v&h=index,docs.count,store.size
GET _cat/indices/*ndr*?v&h=index,docs.count,store.size
GET _cat/indices/*firewall*?v&h=index,docs.count,store.size
GET _cat/indices/*proxy*?v&h=index,docs.count,store.size
GET _cat/indices/*dns*?v&h=index,docs.count,store.size
GET _cat/indices/*m365*?v&h=index,docs.count,store.size
GET _cat/indices/*o365*?v&h=index,docs.count,store.size
GET _cat/indices/*azure*?v&h=index,docs.count,store.size
GET _cat/indices/*defender*?v&h=index,docs.count,store.size
GET _cat/indices/*auth*?v&h=index,docs.count,store.size
```

Also run a broad discovery to catch custom index patterns unique to the environment:

```
GET _cat/indices?v&h=index,docs.count,store.size&s=index
```

Only query indexes confirmed to exist. Never assume an index pattern.

## Mandatory Phase 2: Schema Detection

Before using any field in a query, validate that the field exists in the target index.

### Field Capabilities

```
GET <target-index>/_field_caps?fields=*&filters=-metadata
```

This returns every field, its type, and whether it is searchable/aggregatable. Use this to confirm field existence.

### Mapping Inspection

```
GET <target-index>/_mapping
```

Inspect mappings to distinguish `keyword` from `text` fields. Keyword fields support exact match and aggregation. Text fields support full-text search only.

If a `.keyword` sub-field exists, prefer it for exact matching (e.g., `host.name.keyword` over `host.name`).

### Sample Documents

```
GET <target-index>/_search
{
  "size": 5,
  "sort": [{"@timestamp": {"order": "desc"}}]
}
```

Read at least 3-5 sample documents to understand the actual field population and data shape.

### Timestamp Field Detection

Check whether `@timestamp` exists. If not, inspect samples for alternative timestamp fields (e.g., `timestamp`, `event.created`, `event.ingested`, `syslog_timestamp`, `_source.@timestamp`). Always confirm the primary time field before running time-scoped queries.

### Schema Classification

After discovery, classify each relevant index into one of:

| Classification | Signals |
|---|---|
| **ECS-normalized** | `event.category`, `event.type`, `event.action` populated; standard `source.*`, `destination.*`, `host.*`, `user.*` fields |
| **Partially ECS-normalized** | Some ECS fields present but not all; some custom fields alongside ECS |
| **Raw/custom syslog** | No ECS fields; data primarily in `message`, `log.original`, or custom parsed fields |
| **Elastic Security alert index** | `.alerts-security.alerts-*` or similar; contains `signal.*`, `kibana.alert.*` fields |

This classification determines which query language and field references are safe to use.

## Query Language Selection

Choose the query language based on the task and the schema classification:

| Language | Use when |
|---|---|
| **KQL** | Kibana filtering, quick searches on known fields, dashboard filtering. Works in Kibana Discover and most UI contexts. |
| **Lucene** | Raw text searches across message fields or unmapped content. Useful for raw syslog indexes where structure is unknown. |
| **EQL** | Only when ECS event fields (`event.type`, `event.category`, `event.action`) exist on the target index. EQL requires these fields for sequence and correlation queries. Do not use EQL on raw syslog or non-ECS indexes. |
| **ES|QL** | Pipeline exploration, field extraction from raw strings, summary aggregation. If the Elastic version supports it (8.11+), ES|QL can explore unknown data shapes without pre-existing mappings. |
| **Elasticsearch DSL** | Precise searches, aggregations, metadata retrieval (`_index`, `_id`, `_version`), raw evidence collection. Use DSL when you need control over `_source` filtering, term aggregations, or metadata fields. |

## NDR Syslog Investigation

### Context

NDR (Network Detection and Response) logs arrive as syslog, typically into `logs-udp.syslog*`. These are raw/custom syslog, not automatically ECS-normalized. Do not assume ECS fields exist.

### NDR Index Discovery

```
GET _cat/indices/logs-udp.syslog*?v&h=index,docs.count,store.size
GET _cat/indices/*ndr*?v&h=index,docs.count,store.size
GET _cat/indices/*syslog*?v&h=index,docs.count,store.size
```

### NDR Filter

When `ndr_host` field exists, filter:

```
ndr_host: "NDR-Manager"
```

If `ndr_host.keyword` does not exist as a keyword sub-field, test these alternatives in order:

- `ndr_host` (text field match)
- `observer.name: "NDR-Manager"`
- `host.name: "NDR-Manager"`
- `agent.name: "NDR-Manager"`
- Full-text search on `message` or `log.original` for "NDR-Manager"

### NDR Evidence Fields

When available, include these in evidence output:

- `_index`, `_id`, `_version`
- `ndr_host`
- Source IP
- Destination IP
- Destination port
- Protocol
- Action/verdict
- Signature/rule name
- Raw `message`

### NDR Use Cases

NDR logs are valuable for:

- Suspicious network connections (beaconing, C2 patterns)
- NDR alerts and signatures
- Port scans and reconnaissance
- Lateral movement detection (SMB, RDP, SSH, WinRM)
- SMTP/HTTP/TLS/SSH/RDP/SMB activity
- Data exfiltration suspicion (large outbound transfers, unusual protocols)
- Protocol anomalies

## Pivot Strategy

1. **Identify primary entity** (user, host, IP, process, file hash) and time window from the alert or initial finding.
2. **Discover indexes** using Phase 1 patterns.
3. **Detect schema** on candidate indexes using Phase 2 methods. Classify each index.
4. **Run narrow initial query** scoped to the primary entity and a tight time window (±1 hour).
5. **Expand time window gradually** (±6 hours, ±24 hours, ±7 days) only when results warrant it.
6. **Pivot using validated fields only** — every field used in a pivot must have been confirmed via `_field_caps` or `_mapping`.
7. **Correlate with alerts** from `.alerts-security.alerts-*` and other log sources.
8. **Build timeline** chronologically. Mark events where timestamps are approximate or from different time sources.
9. **State data gaps** explicitly — missing log sources, retention gaps, ingestion delay, parsing failures, timezone mismatch.

## Central-Log Query Templates

### Index Discovery

```
GET _cat/indices/<pattern>?v&h=index,docs.count,store.size
```

### Field Capabilities

```
GET <index>/_field_caps?fields=*&filters=-metadata
```

### Mapping Inspection

```
GET <index>/_mapping
```

### Sample Document Inspection

```json
GET <index>/_search
{
  "size": 5,
  "sort": [{"<timestamp-field>": {"order": "desc"}}]
}
```

### Elastic Security Alerts (DSL)

```json
GET .alerts-security.alerts-*/_search
{
  "query": {
    "bool": {
      "must": [
        {"range": {"@timestamp": {"gte": "now-24h", "lte": "now"}}}
      ]
    }
  },
  "size": 50,
  "sort": [{"@timestamp": {"order": "desc"}}]
}
```

### Authentication Failures (KQL, ECS index only)

```
event.category: "authentication" AND event.outcome: "failure"
```

Only use when `event.category` and `event.outcome` are confirmed present.

### Process Execution (KQL, ECS index only)

```
process.name: * AND event.type: "start"
```

Only use when `process.name` and `event.type` are confirmed present.

### Network Connections (KQL, ECS index only)

```
destination.ip: "10.0.0.0/8" AND event.category: "network"
```

Only use when `destination.ip` and `event.category` are confirmed present.

### DNS / Domain Pivot (KQL)

```
dns.question.name: "example.com" OR destination.domain: "example.com"
```

Test which of these fields exists before running the query. If neither exists, fall back to full-text search on `message`.

### Raw Syslog Search (Lucene)

```
message: "failed password" OR log.original: "failed password"
```

Use for raw syslog indexes where structure is unknown.

### NDR Syslog Search (DSL)

```json
GET logs-udp.syslog*/_search
{
  "query": {
    "bool": {
      "must": [
        {"range": {"@timestamp": {"gte": "now-24h", "lte": "now"}}},
        {"query_string": {"query": "ndr_host: \"NDR-Manager\" OR message: \"NDR-Manager\""}}
      ]
    }
  },
  "size": 50,
  "sort": [{"@timestamp": {"order": "desc"}}],
  "fields": ["_index", "_id", "_version", "@timestamp", "ndr_host", "source.ip", "destination.ip", "destination.port", "message"]
}
```

### Metadata-Aware DSL Query

Include `_index`, `_id`, `_version` in evidence by requesting them in `fields` or using `_source` with a field list:

```json
GET <index>/_search
{
  "query": {"match_all": {}},
  "size": 20,
  "fields": ["_index", "_id", "@timestamp", "*"],
  "_source": false
}
```

## Output Structure

Every investigation must produce:

1. **Executive Summary** — what was investigated, primary entity, time window, key conclusion.
2. **Index and Schema Discovery** — which indexes were found, which were queried, schema classification for each.
3. **Query Plan** — which queries were planned and in what order.
4. **Queries Executed** — each query in copy-paste-ready form, with index, time window, result count, and field validation status.
5. **Key Events** — per the evidence model below.
6. **Timeline** — chronological event table with `_id` references where available.
7. **Anomalies / Findings** — unusual patterns, outliers, deviations from baseline.
8. **Related Alerts** — correlated Elastic Security alerts or other detection sources.
9. **Data Gaps** — missing indexes, retention limits, ingestion delays, parsing failures, timezone mismatches, sensor coverage gaps.
10. **Recommended Actions** — containment, further investigation, log source improvements.

## Evidence Model

Every finding must include these fields:

| Field | Description |
|---|---|
| `index` | Full index name |
| `_id` | Document `_id` if available |
| `timestamp` | Event timestamp with timezone |
| `entity` | Primary entity (user, host, IP, process, file hash) |
| `source_field(s)` | Which field(s) contained the evidence |
| `raw_observation` | Verbatim field value or log excerpt |
| `interpretation` | Analyst-level meaning of the observation |
| `confidence` | High / Medium / Low |
| `query_used` | The exact query that retrieved this evidence |
| `data_gap` | Any caveat about completeness or field availability |

For NDR syslog, additionally include when available:

| Field | Description |
|---|---|
| `_index` | Full index name |
| `_id` | Document `_id` |
| `_version` | Document `_version` |
| `ndr_host` | NDR appliance identifier |
| `source.ip` | Source IP |
| `destination.ip` | Destination IP |
| `destination.port` | Destination port |
| `protocol` | Protocol (TCP, UDP, etc.) |
| `action` / `verdict` | Allow/block/detect verdict |
| `signature` / `rule` | Detection signature or rule name |
| `raw_message` | Raw syslog message text |

## Guardrails

- Never assume the index pattern. Discover first.
- Never assume ECS schema exists. Detect first.
- Never assume `@timestamp` exists without checking.
- Never invent field names. Every field must come from `_field_caps`, `_mapping`, or sample documents.
- Never use EQL unless required ECS event fields (`event.type`, `event.category`, `event.action`) are confirmed present.
- Never claim malicious activity without supporting events from the logs.
- Never treat absence of logs as benign — the event may not have been ingested.
- Never ignore: ingestion delay, retention limits, parsing failures, timezone mismatch, sensor coverage gaps.
- Never run broad unbounded searches across all indexes — always scope by index and time.
- Never expose secrets or sensitive tokens from raw logs in output.
- Always distinguish raw log evidence from analyst inference.
- Always state which indexes and fields were searched.
- Always validate that a field exists before using it in a query.

## Fallback

If Elastic is unavailable or missing required data, state the gap explicitly and check whether equivalent data exists in:

- Defender Advanced Hunting (M365D)
- Splunk
- CommandZero
- Wiz
- Cyble
- Tenable
- Jira / CMDB
- Raw appliance exports (firewall, proxy, NDR, EDR console)
