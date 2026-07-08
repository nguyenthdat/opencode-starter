---
name: verdict-scoring
description: "Consistent framework for verdict (Benign/Suspicious/Malicious/Inconclusive), severity, and confidence scoring. Includes scoring definitions, confidence modifiers, and the severity-confidence action matrix."
compatibility: opencode
metadata:
  domain: secops
  audience: senior-secops-analyst
  edition: "2026.07"
---

# Verdict and Confidence Scoring

Consistent framework for verdict, severity, and confidence scoring. Evidence-backed, comparable across investigations.

## Verdict Framework

| Verdict | Definition |
|---|---|
| **Benign** | Confirmed non-malicious (e.g., authorized scan, known tool, FP confirmed by context) |
| **Suspicious** | Anomalous but insufficient evidence of malicious intent; warrants monitoring |
| **Malicious** | Confirmed malicious (known malicious IOC, unauthorized action, attacker TTPs observed) |
| **Inconclusive** | Insufficient evidence; key data sources unavailable |

## Severity Framework

| Severity | Definition |
|---|---|
| **Critical** | Active compromise of critical system/data; immediate action required |
| **High** | Significant threat with potential for major impact |
| **Medium** | Moderate threat or limited impact |
| **Low** | Minimal threat or routine noise |

## Confidence Framework

| Confidence | Criteria |
|---|---|
| **High** | Multiple independent sources agree; IOCs confirmed by ≥2 CTI sources; clear TTP match |
| **Medium** | At least one reliable source; reasonable interpretation but not fully corroborated |
| **Low** | Single source; unreliable/unknown source; significant gaps; heavy assumption reliance |

### Confidence Modifiers
- **Increase**: Multiple independent sources, clear TTP match, confirmed IOC, corroborated timeline.
- **Decrease**: Single source, old/incomplete data, high FP risk (CDN IP, shared hosting), tool unavailable, context gap.

## Scoring Matrix

| Severity \ Confidence | Low | Medium | High |
|---|---|---|---|
| **Critical** | Escalate, gather more evidence | Immediate action + evidence | Immediate containment + full IR |
| **High** | Monitor + evidence | Targeted investigation | Investigation + containment |
| **Medium** | Monitor, document | Investigate, document | Investigate + remediation |
| **Low** | Dismiss or rule tune | Monitor, rule tune | Address, close |

## Output
```
Verdict: [Benign | Suspicious | Malicious | Inconclusive]
Severity: [Low | Medium | High | Critical]
Confidence: [Low | Medium | High]
Rationale: [1-3 sentences citing key evidence]
Evidence Sources: [Evidence IDs]
```
