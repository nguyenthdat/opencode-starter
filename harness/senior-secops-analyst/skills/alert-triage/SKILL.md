---
name: alert-triage
description: "Standardized rapid alert triage workflow. Ingest, enrich IOCs via CTI, query SIEM/EDR for context, decide True/False Positive, and document verdict with escalation guidance. Timebox: ≤30 min per alert."
compatibility: opencode
metadata:
  domain: secops
  audience: senior-secops-analyst
  edition: "2026.07"
---

# Alert Triage Workflow

Standardized rapid alert triage with consistent verdict and escalation logic.

## Phase 1: Ingest (≤5 min)
1. Parse alert payload: timestamp, source system, rule name, severity, raw data.
2. Extract all IOCs: IP addresses, domains, URLs, file hashes, usernames, hostnames, email addresses.
3. Identify the detection logic: what behavior or signature triggered this alert?

## Phase 2: Enrich (≤10 min)
1. Run IOCs through CTI correlation (Cyble, CommandZero, VT, OTX).
2. Check IOCs against company context for known benign.
3. Query relevant SIEM/EDR for surrounding activity: same user ±1 hour, same host ±1 hour, same source IP ±1 hour.
4. If URL present, route to Phishing URL Analyst.
5. If cloud-related, route to Wiz or Entra analyst.

## Phase 3: Decide (≤5 min)
1. Evaluate all evidence.
2. Classify: True Positive, False Positive, or Needs Investigation.
3. If True Positive: assign severity, recommend immediate containment, note escalation path.
4. If False Positive: document specific justification, suggest rule tuning.
5. If Needs Investigation: list specific additional evidence required.

## Phase 4: Document (≤5 min)
1. Populate triage verdict template.
2. Include all IOCs, evidence sources, and decision rationale.
3. Flag for Evidence Reviewer if severity is High/Critical.

## Verdict Template
```
Alert ID: ...
Source: ...
Alert Rule: ...
Timestamp: ...
Triage Verdict: True Positive | False Positive | Needs Investigation
Severity: Low | Medium | High | Critical
Confidence: Low | Medium | High
Key IOCs: ...
Benign Indicators: ...
Evidence Summary: ...
Recommended Actions: ...
Rule Tuning Suggestions (if FP): ...
Missing Evidence: ...
```
