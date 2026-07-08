---
name: evidence-collection
description: "Systematic evidence collection and chain-of-reasoning documentation. Evidence table format, traceability from observation to conclusion, assumption tracking, and gap analysis."
compatibility: opencode
metadata:
  domain: secops
  audience: senior-secops-analyst
  edition: "2026.07"
---

# Evidence Collection and Chain-of-Reasoning

Document evidence systematically and maintain chain-of-reasoning from raw observation to conclusion.

## Evidence Standards

For every piece of evidence, record:
1. **Source**: Tool, system, or person.
2. **Query / Method**: Exact query, URL, file path, or interaction.
3. **Timestamp**: Collection time and event time if different.
4. **Raw Output**: Unmodified data or reference to it.
5. **Interpretation**: Analyst conclusion from raw data.
6. **Confidence**: High, Medium, Low.
7. **Corroboration**: Any independent supporting source.

## Evidence Table Template

| ID | Source | Query/Method | Collection Time | Event Time | Raw Finding | Interpretation | Confidence | Corroborated By |
|---|---|---|---|---|---|---|---|---|

## Chain-of-Reasoning

```
Observation -> Interpretation -> Assumption Checked -> Conclusion -> Confidence

Example:
O: 47 failed logins in 5 min from single IP [E1]
I: Brute force pattern (high rate, single source, single target)
A: Not misconfigured service account (verified: jsmith is human user)
A: Not internal scanner (verified: IP is external)
C: External brute force attack targeting jsmith account
Confidence: High
```

## Handling Uncertainty
- Ambiguous evidence: state both interpretations.
- Tool unavailable: note missing evidence and confidence impact.
- Unverified assumption: mark and lower confidence.

## Evidence Preservation
- Save screenshots with timestamps.
- Export query results as JSON/CSV (not screenshots of tables).
- Record exact API responses, not summaries.
- Archive raw logs/PCAPs (reference path).

## Output
Evidence appendix with: table, chain-of-reasoning per major conclusion, unverified assumptions, missing evidence (gap analysis).
