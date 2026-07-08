---
name: elastic-siem
description: "Query and investigate in Elastic Security/Kibana using KQL and EQL. Covers index selection, pivot strategies, process chain analysis, authentication hunting, and detection alert correlation."
compatibility: opencode
metadata:
  domain: secops
  audience: senior-secops-analyst
  edition: "2026.07"
---

# Elastic SIEM Investigation

Query and investigate security events in Elastic Security / Kibana.

## Query Patterns

### KQL (Kibana Query Language)
```
// Process execution
process.name: "powershell.exe" AND process.args.text: "-enc"

// Network connections
destination.ip: "10.0.0.0/8" AND NOT source.ip: "10.0.0.0/8"

// Authentication
event.category: "authentication" AND event.outcome: "failure"

// File events
file.path: "/etc/shadow" OR file.path: "C:\\Windows\\System32\\config\\SAM"
```

### EQL (Event Query Language)
```
// Sequence: process create -> network connection
sequence by host.name
  [process where event.type == "start" and process.name == "cmd.exe"]
  [network where event.type == "connection" and destination.ip != "10.0.0.0/8"]
```

### Pivot Strategy
1. Start with the alerting entity (user, host, IP).
2. Expand time window ±1 hour, then ±24 hours.
3. Pivot by field: user.name -> source.ip -> process.name -> file.path.
4. Cross-reference with Elastic Security detection alerts.

## Output Structure
1. Query executed (copy-paste ready).
2. Index and time window.
3. Result count and key events.
4. Timeline of correlated events.
5. Anomalies flagged.
6. Related detection alerts.

## Common Pitfalls
- Not scoping to the correct index pattern (e.g., `logs-*` vs `metrics-*`).
- Missing time zone alignment in queries.
- KQL is case-insensitive but EQL is case-sensitive.

## Fallback
If Elastic is unavailable, note gap and check if the same data is available via Splunk or Defender.
