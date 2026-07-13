---
name: verdict-scoring
description: "Normalize a SecOps decision into canonical verdict, disposition, domain classification, severity, confidence, evidence sufficiency, and gaps. Use when scoring or reassessing a finding, alert, phishing case, cloud exposure, vulnerability, or report; also use to update a verdict after new evidence or compare prior decisions."
compatibility: opencode
metadata:
  domain: secops
  audience: senior-secops-analyst
  edition: "2026.07"
---

# Verdict and Confidence Scoring

Use one decision schema across every specialist. Domain-specific labels add detail but never replace the canonical fields.

## Canonical Schema

```yaml
verdict: benign | suspicious | malicious | inconclusive
disposition: true-positive | false-positive | duplicate | needs-investigation | confirmed-exposure | confirmed-vulnerable | fixed | out-of-scope | not-applicable
domain_classification: string
severity: informational | low | medium | high | critical
confidence: low | medium | high
evidence_sufficiency: sufficient | partial | insufficient | conflicting
evidence_ids: [E0001]
gaps: []
rationale: string
```

Examples of `domain_classification` include `credential-harvesting`, `brand-impersonation`, `malware-delivery`, `cloud-toxic-combination`, and `cve-exposure`.

## Verdict Rules

| Verdict | Use When |
|---|---|
| `benign` | A positive, evidence-backed explanation shows authorized or expected activity and no credible harmful behavior remains unexplained |
| `suspicious` | Behavior or exposure is abnormal or risky, but compromise or malicious intent is not confirmed |
| `malicious` | Direct behavior, confirmed exposure/impact, or internally relevant corroboration demonstrates phishing, malware, unauthorized access, exploitation, abuse, or data exposure |
| `inconclusive` | Required evidence is missing, stale, contradictory, or unavailable |

Reputation-only evidence or a single known-malicious IOC is not enough for `malicious` unless it is directly tied to the scoped entity and activity. Absence of evidence is not a benign explanation.

## Disposition Rules

- `true-positive`: detection matched real activity; pair with the appropriate verdict.
- `false-positive`: the detection itself was wrong because of parsing, logic, stale intelligence, or entity mapping.
- `needs-investigation`: more evidence can realistically resolve the decision.
- `confirmed-exposure` and `confirmed-vulnerable`: describe exposure state; they do not imply exploitation or malicious activity.
- `duplicate`, `fixed`, `out-of-scope`, and `not-applicable`: describe workflow state, not threat intent.

## Severity Rules

| Severity | Meaning |
|---|---|
| `informational` | No current security impact; useful for record or tuning |
| `low` | Minimal impact and limited realistic escalation path |
| `medium` | Credible risk requiring planned follow-up |
| `high` | Significant compromise/exposure or likely major business impact |
| `critical` | Active or imminent severe impact to critical systems, identities, or data |

Severity measures impact and urgency, not confidence. A high-impact but weakly evidenced hypothesis can have high severity and low confidence; state both.

## Confidence Rules

| Confidence | Criteria |
|---|---|
| `high` | Direct, reproducible evidence with strong context; material contradictions resolved; minor gaps only |
| `medium` | Credible evidence supports the result but relevant gaps or assumptions remain |
| `low` | Key telemetry/context is missing, evidence is stale or indirect, or material contradictions remain |

Increase confidence for independent direct telemetry, reproducible queries, consistent timelines, and owner/context confirmation. Decrease it for public-only enrichment, shared infrastructure, stale data, weak context, missing coverage, and unexecuted queries.

Context impact from `context-first-investigation` applies after evidence scoring:

- `none`: no cap.
- `reduced`: lower confidence one tier.
- `severely_reduced`: cap at `low`.
- `cannot_rely`: environment-specific conclusions remain provisional.

## Action Matrix

| Severity / Confidence | Low | Medium | High |
|---|---|---|---|
| Critical | Escalate and gather minimum decisive evidence | Immediate investigation with approval-gated protective actions | Immediate approved containment and full IR escalation |
| High | Protectively monitor and gather evidence | Targeted investigation and action planning | Investigation and approved containment/remediation |
| Medium | Gather evidence or monitor | Investigate and document | Investigate and remediate |
| Low / Informational | Gather evidence or monitor; close only with a positive benign explanation | Monitor or tune with evidence | Address, tune, or close with rationale |

## Decision Record

The SecOps Lead writes `_workspace/89_verdict.json`:

```json
{
  "verdict": "suspicious",
  "disposition": "needs-investigation",
  "domain_classification": "credential-harvesting",
  "severity": "high",
  "confidence": "medium",
  "evidence_sufficiency": "partial",
  "evidence_ids": ["E0001", "E0004"],
  "gaps": ["Mailbox sign-in telemetry unavailable"],
  "rationale": "Direct page evidence shows credential collection, but internal account impact is not confirmed."
}
```

Only the lead locks this record. Report writers reproduce it unchanged.
