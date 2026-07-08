---
name: splunk-siem
description: "Query and investigate in Splunk using SPL. Covers transaction correlation, timechart anomaly detection, lookup enrichment, risk-based alerting, and pivot strategies across indexes and sourcetypes."
compatibility: opencode
metadata:
  domain: secops
  audience: senior-secops-analyst
  edition: "2026.07"
---

# Splunk Investigation

Query and investigate security events in Splunk using SPL.

## SPL Patterns

### Basic Searches
```
index=wineventlog EventCode=4625 user=* earliest=-1h latest=now
| stats count by user, src_ip, ComputerName
| sort -count
```

### Correlation with Transaction
```
index=wineventlog (EventCode=4688 OR EventCode=5156) host=target_host
| transaction host startswith=(EventCode=4688) endswith=(EventCode=5156)
| table _time, host, process, dest_ip, dest_port
```

### Anomaly Detection
```
index=firewall action=denied
| timechart span=5m count by src_ip
| eventstats avg(count) as avg_count stdev(count) as stdev_count
| where count > avg_count + 3*stdev_count
```

### Lookup Enrichment
```
index=auth_logs src_ip=*
| lookup threat_intel ip as src_ip OUTPUT threat_category
| where isnotnull(threat_category)
```

### Risk-Based Alerting (Splunk ES)
```
| from datamodel:"Authentication"."Authentication"
| stats count by user, src, action
| where count > 10 AND action="failure"
```

## Pivot Strategy
1. Start with notable event or raw alert.
2. Use `transaction` or `streamstats` for event chaining.
3. Enrich with asset/identity lookups.
4. Expand time window in increments.

## Output Structure
1. SPL query (copy-paste ready).
2. Indexes and sourcetypes queried.
3. Time window.
4. Result count.
5. Key findings with field analysis.
6. Related notable events from Splunk ES.

## Fallback
If Splunk is unavailable, note gap and check alternative access (exported CSV, forwarded events to SIEM).
