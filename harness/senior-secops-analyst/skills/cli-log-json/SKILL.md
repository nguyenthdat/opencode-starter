---
name: cli-log-json
description: "Process security logs, JSON, CSV, and text evidence with CLI tools: rg (ripgrep), jq, jless, xsv, duckdb, gron, miller (mlr), and shell pipelines. Pattern-based IOC extraction, cross-file correlation, and timeline analysis."
compatibility: opencode
metadata:
  domain: secops
  audience: senior-secops-analyst
  edition: "2026.07"
---

# CLI Log and JSON Iteration

Process security logs, JSON exports, CSV datasets, and text evidence using CLI tools.

## Tool Reference

### rg (ripgrep) — Pattern Search
```bash
rg -o '\b(?:\d{1,3}\.){3}\d{1,3}\b' *.log | sort | uniq -c | sort -rn
rg -C 3 "error|failure|denied|blocked" auth.log
```

### jq — JSON Processing
```bash
cat alerts.json | jq '[.[] | {id: .alert_id, severity: .severity, rule: .rule_name}]'
cat alerts.json | jq '.[] | select(.severity >= "high") | {id, rule: .rule_name, src_ip: .source.ip}'
cat events.json | jq 'group_by(.event_type) | map({type: .[0].event_type, count: length})'
cat logs.json | jq '[.[].source_ip] | unique'
```

### jless — Interactive JSON
```bash
cat large_export.json | jless
```

### xsv — CSV/TSV
```bash
xsv headers alerts.csv
xsv select timestamp,src_ip,alert_name alerts.csv
xsv search -s severity "Critical" alerts.csv
xsv frequency -s src_ip alerts.csv | xsv sort -s value -R | head -20
```

### duckdb — SQL on Files
```bash
duckdb -c "
  SELECT src_ip, count(*) as cnt, array_agg(DISTINCT alert_name)
  FROM read_csv_auto('alerts.csv')
  GROUP BY src_ip HAVING cnt > 5 ORDER BY cnt DESC
"

duckdb -c "
  SELECT a.timestamp, a.src_ip, e.reputation
  FROM read_json_auto('alerts.json') a
  LEFT JOIN read_csv_auto('threat_intel.csv') e ON a.src_ip = e.ip
  WHERE e.reputation = 'malicious'
"
```

### gron — Flatten JSON for Grep
```bash
cat nested.json | gron | rg "ip_address|domain"
```

## Common Pipelines

### Top Talkers from JSON
```bash
cat logs.json | jq -r '.source_ip' | sort | uniq -c | sort -rn | head -20
```

### IOC Extraction from Mixed Text
```bash
rg -o '\b([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}\b' report.txt | sort -u
```

### Alert Volume Timeline
```bash
cat alerts.json | jq -r '.timestamp[0:13]' | sort | uniq -c | sort -k2
```

## Safety
- Work on copies of evidence files, never modify originals.
- Quote shell variables and paths.
- Use `head` or `limit` on large outputs before full processing.
