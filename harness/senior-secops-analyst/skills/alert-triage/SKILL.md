---
name: alert-triage
description: "Rapid evidence-driven SOC alert triage for any source (Defender, Elastic, Wiz, email gateway, phishing, vulnerability, credential leak, etc.). Context-first, workspace-aware, specialist-routing-aware. Timebox: ≤30 min per alert. Triggers on: triage alert, investigate alert, SOC alert, security alert, Defender alert, Elastic alert, Wiz finding, phishing alert, vulnerability alert, credential leak alert, suspicious activity alert, FP/TP decision, alert verdict, escalation decision."
compatibility: opencode
metadata:
  domain: secops
  audience: senior-secops-analyst
  edition: "2026.07"
  workflow: alert-triage
---

# Alert Triage — Rapid SOC Triage

Quick, evidence-driven, context-aware SOC alert triage. Answer: what triggered the alert, what entity is involved, what evidence supports a verdict, what gaps remain, and which specialist skill or tool should handle deeper follow-up.

This is **rapid triage**, not full incident response. CTI is supporting context only. The primary workflow is: context → intake → evidence → correlation → verdict → routing.

## Timebox

Default target: ≤30 minutes per alert.

| Phase | Budget |
|---|---|
| Context check | ≤5 min |
| Alert ingest and entity extraction | ≤5 min |
| Targeted evidence correlation | ≤10 min |
| Verdict and routing | ≤5 min |
| Documentation and actions | ≤5 min |

If evidence is insufficient within 30 minutes, do not force a verdict. Classify as **Needs Investigation** and list exact missing evidence.

## Required Context Gate

Before any triage analysis:

1. Run or invoke `context-first-investigation`.
2. Load `system-context.md` if available.
3. Identify known benign, noisy, lab, sandbox, demo, and malware-lab context.
4. Identify relevant telemetry sources.
5. If context is missing or weak, lower confidence accordingly.

Never skip the context gate. Never make high-confidence environment-specific verdicts without context.

## Evidence and Workspace Rules

Every triage verdict must reference evidence IDs when possible.

Use:
- `_workspace/manifest.jsonl`
- `_workspace/evidence-index.md`
- `_workspace/raw/` — raw alert payloads, tool outputs
- `_workspace/derived/` — normalized IOCs, timelines, correlations
- `_workspace/reports/` — triage reports, gaps

If evidence is not saved or indexed, mark: `Evidence: Not indexed / needs collection`

Do not invent evidence IDs. Do not claim evidence exists unless saved, hashed, and registered in manifest.jsonl or evidence-index.md. Use the `evidence-collection` skill to register and index evidence.

Save important alert evidence under `_workspace/`:
- Raw alert payload → `_workspace/raw/`
- Query results → `_workspace/raw/queries/` or `_workspace/raw/mcp/`
- IOC lists → `_workspace/derived/iocs/`
- Timelines → `_workspace/derived/timelines/`
- Triage report → `_workspace/reports/`

## Verdict Model

Use these verdicts. Never classify with only TP/FP.

| # | Verdict | Meaning |
|---|---|---|
| 1 | True Positive — Malicious | Confirmed malicious activity or compromise |
| 2 | True Positive — Benign | Alert logic matched real behavior, but behavior is authorized/expected |
| 3 | False Positive | Alert incorrect: bad detection logic, bad parsing, stale IOC, wrong entity mapping |
| 4 | Suspicious | Evidence suggests risk, but not enough for confirmed malicious |
| 5 | Needs Investigation | Evidence insufficient or key telemetry missing |
| 6 | Duplicate / Already Handled | Same case already investigated, contained, or tracked |
| 7 | Inconclusive | Conflicting evidence or unavailable data prevents reliable classification |

## Severity and Confidence Model

**Severity:**
- **Informational** — No security impact. Noise.
- **Low** — Minor event with negligible impact potential.
- **Medium** — Observable risk requiring follow-up.
- **High** — Likely compromise or significant exposure.
- **Critical** — Active confirmed compromise, data exfiltration, or crown-jewel impact.

**Confidence:**
- **Low** — Evidence is thin, context is weak, or key sources are missing.
- **Medium** — Sufficient evidence but some gaps or assumptions.
- **High** — Multiple corroborating evidence sources, strong context, no significant gaps.

## Phase 0: Context Gate

Run first. Every alert. No exceptions.

1. Load `system-context.md` via `context-first-investigation`.
2. Check known benign, noisy, lab, sandbox, demo, and malware-lab systems.
3. Check environment classification: prod, staging, dev, QA, demo, sandbox, malware-lab, unknown.
4. Check asset or user owner if available.
5. Check telemetry coverage for the affected environment.
6. Classify context quality: strong, usable, weak, or missing.
7. Lower confidence if context is weak or missing.

## Phase 1: Alert Intake

Parse and extract from the alert payload.

**Parse:**
- Alert ID
- Source system
- Rule name and description
- Severity
- Timestamp
- Detection logic (if available)
- Affected entity
- Raw event
- Source tool
- Alert URL or reference
- MITRE technique (if available)
- Parent incident or case (if available)

**Extract entities:**
- User / identity / service principal
- Host / device
- IP address
- Domain
- URL
- File hash
- Process / command line
- Email sender / recipient / mailbox
- Cloud asset / account / subscription / project
- Identity / app / OAuth consent
- Vulnerability / CVE / plugin
- Container / Kubernetes workload
- Repository / CI-CD entity

Save raw alert payload under `_workspace/raw/`. Register with `evidence-collection` when possible.

## Phase 2: Triage Routing

Route to the right evidence source and specialist skill. Do not run every tool. Use the minimum necessary tools based on alert type and entity.

### Routing Rules

| Alert / Entity Type | Primary Skill / Tool | Supporting | Notes |
|---|---|---|---|
| Defender / MDE / MDO alert | `defender-advanced-hunting` | `cyble-cti` for external IoC context | Query Advanced Hunting for surrounding activity |
| Elastic / SIEM alert or central logs | `elastic-siem` | `cyble-cti` for external IoC context | Discover indexes, query surrounding logs |
| Cloud / AWS / Azure / GCP / Kubernetes / container / IAM / GitHub-to-cloud / Okta-to-cloud | `wiz-cloud` | `cyble-cti` for external exposure context | Use Wiz Security Graph for asset context |
| Credential leak / brand abuse / executive monitoring / external DRP / ASM | `cyble-cti` | `wiz-cloud` if cloud asset involved | Cyble for external exposure, leak, and brand context |
| Vulnerability or vulnerable asset | `tenable-vuln` | `wiz-cloud` for cloud asset context | Tenable for CVE/plugin/asset findings |
| Phishing URL / suspicious landing page / credential harvest / redirect chain | `phishing-url-analysis` | `cyble-cti` for external domain/IoC context | Safe browser-assisted URL investigation |
| Deep multi-source investigation / unclear complex case | `commandzero` | All others as needed | Autonomous question-led investigation |
| Local exported logs / JSON / CSV / text artifacts | `cli-log-json` | — | CLI-based log parsing and correlation |
| PDF / DOCX evidence | `evidence-extraction` | — | Extract text, tables, metadata from documents |
| Action plan required | `actions-hardening` | — | Produce prioritized action plan after verdict |

Important:
- Do not run every tool. Choose only what the alert type and entities require.
- CTI is supporting context. Never base a verdict on CTI/reputation alone.
- If a tool is unavailable, document the gap. Do not invent its output.

## Phase 3: Targeted Evidence Collection

Collect only enough evidence for a rapid triage verdict. For each alert, answer:

- Did the alert match real observed behavior?
- Is the behavior expected or authorized?
- Is the entity known benign, noisy, lab, sandbox, demo, or malware-lab?
- Did the activity happen before or after the alert window?
- Are there related alerts or incidents?
- Are there affected users, hosts, or assets?
- Is there internal telemetry confirming impact?
- Is there external intelligence supporting risk?
- Is there evidence of compromise, exploitation, credential use, lateral movement, exfiltration, malware, phishing click, or policy violation?

Save key evidence under `_workspace/` as you collect it. Every piece of evidence must be:
- Saved to the correct `_workspace/` subfolder
- Registered in `_workspace/manifest.jsonl`
- Listed in `_workspace/evidence-index.md`
- Referenced by evidence ID in all conclusions

## Phase 4: Decision Logic

Classify based on evidence. Never force a verdict without evidence.

### True Positive — Malicious

Evidence includes one or more:
- Observed malicious activity
- Confirmed compromise
- Successful credential abuse
- Malware execution
- Phishing credential submission likely or confirmed
- Exploitation evidence
- Lateral movement
- Exfiltration
- Unauthorized privilege escalation
- Confirmed malicious infrastructure with internal interaction

### True Positive — Benign

- Detection matched correctly
- Behavior is real
- Behavior is expected or authorized
- Context confirms known admin, scanner, test, lab, demo, sandbox, or malware-lab activity
- No impact beyond expected activity

### False Positive

- Detection fired on incorrect parsing
- Wrong entity mapping
- Stale IOC
- Unsupported signature logic
- Labelling or reputation error with no matching behavior
- Impossible event due to data quality issue
- Duplicated or malformed telemetry

### Suspicious

- Unusual or risky behavior
- Partial corroboration
- External intel suggests risk
- Internal interaction exists
- But no confirmed malicious outcome

### Needs Investigation

- Missing telemetry
- Unclear context
- No owner or environment mapping
- Logs unavailable
- Evidence collection incomplete
- High-impact entity with insufficient proof

### Duplicate / Already Handled

- Same alert or case already triaged
- Incident already open
- Remediation already underway
- Evidence points to existing ticket or case

### Inconclusive

- Conflicting evidence
- Stale or incomplete data
- Tool failure prevents reliable decision
- No safe conclusion possible

## Phase 5: Documentation

Produce a concise but complete triage report using the output schema below. Save under `_workspace/reports/`.

Required sections:
1. Executive Summary
2. Context Check
3. Alert Details table
4. Extracted Entities table
5. Evidence Collected table
6. Timeline
7. Decision Rationale
8. Verdict
9. Escalation / Routing
10. Recommended Actions
11. Missing Evidence / Gaps
12. Rule Tuning Suggestions (if FP or benign TP)
13. Evidence and Workspace Notes

If action plan is needed, hand off to `actions-hardening`.

## Specialist Skill Routing Table

| Alert Type | Primary Skill / Tool | Supporting Skill / Tool | Notes |
|---|---|---|---|
| Defender / MDE / MDO alert | `defender-advanced-hunting` | `cyble-cti` | Advanced Hunting KQL for device, identity, email, cloud app telemetry |
| Elastic SIEM / central log alert | `elastic-siem` | `cyble-cti` | Index discovery, KQL/Lucene/EQL/ES|QL queries |
| Cloud security alert (AWS/Azure/GCP/K8s) | `wiz-cloud` | `cyble-cti` | Wiz Security Graph for asset, identity, exposure context |
| Phishing URL / credential harvest | `phishing-url-analysis` | `cyble-cti` | Safe browser analysis, redirect tracing, IOC extraction |
| Credential leak / brand abuse / DRP | `cyble-cti` | `wiz-cloud` if cloud involved | External exposure, stealer logs, brand impersonation |
| Vulnerability finding | `tenable-vuln` | `wiz-cloud` for asset context | CVE/plugin investigation, asset risk scoring |
| Complex multi-source case | `commandzero` | All relevant | Autonomous question-led investigation |
| Exported local logs / JSON / CSV | `cli-log-json` | — | CLI-based parsing and correlation |
| PDF / DOCX evidence | `evidence-extraction` | — | Extract text, tables, metadata |
| Action plan | `actions-hardening` | — | Prioritized, assignable, time-bound actions |

## Output Schema

```
Alert Triage Report
===================

Executive Summary
-----------------
Alert ID:
Source:
Rule:
Verdict:
Severity:
Confidence:
Primary entity:
Environment:
Owner / team:
Key reason:
Recommended next step:

Context Check
-------------
Context status: strong / usable / weak / missing
Relevant known benign / noisy / lab context:
Criticality:
Telemetry coverage:
Context gaps:

Alert Details
-------------
| Field | Value |
|---|---|
| Alert ID | |
| Source system | |
| Rule name | |
| Rule severity | |
| Alert timestamp | |
| Detection logic | |
| MITRE mapping | |
| Parent incident / case | |

Extracted Entities
------------------
| Type | Value | Role | Notes |
|---|---|---|---|
| user | | | |
| host | | | |
| IP | | | |
| domain | | | |
| URL | | | |
| file hash | | | |
| process | | | |
| email sender | | | |
| ... | | | |

Evidence Collected
------------------
| Evidence ID | Source | Query / Method | Observation | Interpretation | Confidence |
|---|---|---|---|---|---|
| E0001 | | | | | |
| ... | | | | | |

If no evidence IDs exist: Evidence not indexed / needs collection.

Timeline
--------
| Time | Entity | Event | Source | Evidence ID | Notes |
|---|---|---|---|---|---|
| | | | | | |

Decision Rationale
------------------
Observed facts:
Context-based explanation:
Tool results:
Analyst inference:
Assumptions:
Gaps:

Verdict
-------
Classification:
Severity:
Confidence:
Why this verdict:
Why not a higher severity:
Why not a lower severity:

Escalation / Routing
--------------------
Escalate: Yes / No
Route to:
Reason:
Required specialist skill / tool:
Required evidence:

Recommended Actions
-------------------
Contain:
Investigate:
Notify:
Tune detection:
Update context:

If detailed action plan needed, hand off to actions-hardening.

Missing Evidence / Gaps
-----------------------
| Gap | Impact | Next step | Owner |
|---|---|---|---|
| | | | |

Rule Tuning Suggestions
-----------------------
(If FP or benign TP)
Tuning condition:
Exclusion candidate:
Field / value:
Risk of tuning:
Validation query:

Evidence and Workspace Notes
----------------------------
Raw alert saved:
Evidence index updated:
Workspace paths:
Derived artifacts:
```

## Rule Tuning Guidance

For False Positive or True Positive — Benign verdicts, suggest tuning:

- **Tuning condition:** What should the rule exclude or adjust?
- **Exclusion candidate:** Which entity, pattern, or scenario should be excluded?
- **Field / value:** Exact field and value to add to exclusion.
- **Risk of tuning:** What would be missed if this exclusion is too broad?
- **Validation query:** Query to test the proposed tuning before applying.

Example:

```
Tuning condition: Exclude this specific host from the detection rule.
Exclusion candidate: Host "LAB-SCAN-01" used for internal vulnerability scanning.
Field / value: DeviceName = "LAB-SCAN-01"
Risk of tuning: If this host is compromised, scanner-like traffic would be missed.
Validation query: DeviceProcessEvents | where DeviceName == "LAB-SCAN-01" and Timestamp > ago(7d) | summarize count() by ProcessCommandLine
```

## Escalation Guidance

Escalation is required when:

- **Verdict is True Positive — Malicious** with severity High or Critical.
- **Verdict is Suspicious** on a critical asset or crown-jewel system.
- **Verdict is Needs Investigation** on a high-impact entity with insufficient telemetry to rule out compromise.
- **Compromise is confirmed** (malware execution, lateral movement, exfiltration, credential abuse).
- **Phishing credential submission is likely** and the affected identity has privileged access.
- **PII, regulated data, or crown-jewel data** may be affected.

Escalation routing:
- P0 (active compromise, exfiltration in progress) → Incident Response lead immediately.
- P1 (confirmed malicious, no active exfiltration) → SecOps lead within 1 hour.
- P2 (suspicious on critical asset) → Asset owner and SecOps within 24 hours.

Do not escalate FPs, benign TPs, duplicates, or informational alerts.

## Guardrails

- Never make a high-confidence verdict without evidence.
- Never rely on CTI or reputation alone.
- Never classify as benign only because no logs were found.
- Never classify as false positive without explaining why the alert logic, entity, or data is wrong.
- Never ignore `system-context.md`.
- Never ignore known benign, noisy, lab, sandbox, demo, or malware-lab context.
- Never invent evidence IDs, queries, owners, or tool results.
- Never claim a tool was queried unless it was actually queried.
- Never execute containment or remediation automatically. Recommend only.
- Never expose secrets, tokens, passwords, cookies, private keys, or sensitive PII.
- Always defang URLs and domains in human-readable output.
- Always state confidence and gaps.
- Always route to the correct specialist skill when rapid triage is insufficient.
- Always save important evidence under `_workspace/` when possible.

## Examples

### Example 1: Defender Suspicious PowerShell Alert

**Alert:** Defender XDR — "Suspicious PowerShell command line activity" on host WIN-PROD-07 for user jdoe.

**Phase 0:** Context is usable. WIN-PROD-07 is a production app server. jdoe is a developer, not an admin. No known benign PowerShell activity documented for jdoe. Telemetry: Defender, sign-in logs available.

**Phase 1:**
- Alert ID: AL-20260709-001
- Source: Microsoft Defender XDR
- Rule: Suspicious PowerShell command line
- Severity: Medium
- Entity: WIN-PROD-07, jdoe
- Process: powershell.exe -enc SQBFAFgAIAAoAE4AZQB3AC0ATwBiAGoAZQBjAHQAIABOAGUAdAAuAFcAZQBiAEMAbABpAGUAbgB0ACkALgBEAG8AdwBuAGwAbwBhAGQAUwB0AHIAaQBuAGcAKAAnAGgAdAB0AHAAOgAvAC8AZQB2AGkAbAAuAGUAeABhAG0AcABsAGUALgBjAG8AbQAvAHAAYQB5AGwAbwBhAGQALgBwAHMAMQAnACkA

**Phase 2:** Route to `defender-advanced-hunting` for surrounding activity. Route decoded URL domain `evil.example.com` to `cyble-cti` for external context.

**Phase 3:** Defender Advanced Hunting shows: outbound connection from WIN-PROD-07 to evil[.]example[.]com at same timestamp. No other hosts contacted this domain. Cyble reports: C2 infrastructure, first seen 2 days ago, medium confidence.

**Phase 4:** True Positive — Malicious. Base64-encoded download cradle, confirmed outbound to known C2 domain, no authorized use.

**Verdict:** True Positive — Malicious, Severity: High, Confidence: Medium (no post-download execution evidence yet).

**Routing:** Escalate to Incident Response. Hand off to `commandzero` for full investigation and `actions-hardening` for containment plan.

---

### Example 2: Elastic NDR Syslog Alert

**Alert:** Elastic Security — "Suspicious outbound SMB traffic to external IP" from host 10.20.30.40.

**Phase 0:** Context is weak. 10.20.30.40 not mapped in system-context.md. No owner known. Environment unknown.

**Phase 1:**
- Alert ID: EL-20260709-002
- Source: Elastic Security
- Rule: External SMB Connection
- Severity: High
- Destination: 203.0.113.50:445

**Phase 2:** Route to `elastic-siem` for surrounding logs.

**Phase 3:** Elastic query shows 10.20.30.40 is a file server. SMB connections to multiple external IPs over 7 days — all part of a cloud storage gateway migration (project MIGRATE-2026). Destination IPs belong to a known cloud storage provider. No anomalous data volume.

**Phase 4:** True Positive — Benign. Alert matched correctly (external SMB) but behavior is authorized cloud storage gateway migration.

**Verdict:** True Positive — Benign, Severity: Informational, Confidence: High.

**Routing:** No escalation. Recommend adding file server and destination IPs to known benign list. Update `system-context.md` with migration project context.

---

### Example 3: MDO Phishing URL Click Alert

**Alert:** Microsoft Defender for Office 365 — "User clicked a potentially malicious URL" for user asmith on URL hxxps://login-microsoft365-verify[.]com/auth.

**Phase 0:** Context is usable. asmith is a finance department user with access to sensitive financial data. No known benign context.

**Phase 1:**
- Alert ID: MDO-20260709-003
- Source: Microsoft Defender for Office 365
- Rule: Potentially malicious URL click
- Severity: Medium
- URL: hxxps://login-microsoft365-verify[.]com/auth
- User: asmith

**Phase 2:** Route URL to `phishing-url-analysis`. Route domain to `cyble-cti` for external context. Route user activity to `defender-advanced-hunting` for surrounding sign-in and email context.

**Phase 3:** Phishing URL analysis shows: domain registered 3 days ago, Cloudflare-hosted, Microsoft-branded credential harvest form with POST to external endpoint. Cyble: domain flagged as phishing, no prior internal sightings. Defender: asmith received email from external sender, clicked URL, no UrlClickEvents showing credential submission (browser blocked the page). No anomalous sign-ins after click.

**Phase 4:** Suspicious. URL is confirmed phishing infrastructure. User clicked. But no confirmed credential submission and no anomalous post-click activity.

**Verdict:** Suspicious, Severity: Medium, Confidence: Medium.

**Routing:** Route to `commandzero` for deeper investigation. Hand off to `actions-hardening` for: reset asmith credentials, check for other recipients of same email, block domain at proxy.

---

### Example 4: Wiz Cloud Exposed Critical Vulnerability

**Alert:** Wiz — "Internet-exposed Azure VM with critical RCE vulnerability CVE-2026-12345" on VM prod-web-03.

**Phase 0:** Context is usable. prod-web-03 is in production, in the web tier, internet-facing, owned by Platform Engineering.

**Phase 1:**
- Alert ID: WIZ-20260709-004
- Source: Wiz
- Rule: Exposed critical vulnerability
- Severity: Critical
- Entity: VM prod-web-03 (Azure), CVE-2026-12345
- Finding: Internet-exposed, CVSS 9.8, known exploit available

**Phase 2:** Route to `wiz-cloud` for full asset context, attack path, and exposure analysis. Route CVE to `tenable-vuln` for additional vulnerability detail.

**Phase 3:** Wiz shows: prod-web-03 exposed on port 443, running vulnerable version of web server, no WAF in front, public IP 198.51.100.10. Tenable: CVE-2026-12345 has public PoC, actively exploited in the wild. No evidence of exploitation on this host from Wiz runtime sensors.

**Phase 4:** Suspicious (pending exploitation verification). Vulnerability is real, exposed, and weaponized. No confirmed exploitation yet but active threat.

**Verdict:** Suspicious, Severity: Critical, Confidence: High (vulnerability confirmed, exploitation status still being verified through Wiz runtime telemetry).

**Routing:** Escalate to Platform Engineering and Cloud Security. Hand off to `commandzero` for full investigation. Hand off to `actions-hardening` for: apply emergency patch or deploy WAF virtual patch, restrict network access temporarily, verify no exploitation occurred.

---

### Example 5: Tenable Critical Internal Device Vulnerability

**Alert:** Tenable — "Critical vulnerability on internal device HR-DB-01: CVE-2026-99999 (CVSS 9.0)".

**Phase 0:** Context is usable. HR-DB-01 is a production HR database server, internal-only, contains PII.

**Phase 1:**
- Alert ID: TEN-20260709-005
- Source: Tenable
- Plugin: CVE-2026-99999
- Severity: Critical (CVSS 9.0)
- Entity: HR-DB-01 (internal, non-internet-facing)

**Phase 2:** Route to `tenable-vuln` for full finding details and asset context.

**Phase 3:** Tenable confirms: database software vulnerable, patch available (version 12.4.2). Not internet-exposed (verified by Wiz). No evidence of exploitation. But PII data at risk if internal compromise occurs.

**Phase 4:** True Positive — Malicious potential. Vulnerability is real on a sensitive asset. But no exploitation evidence and no external exposure.

**Verdict:** Suspicious (not confirmed exploited, but risk is real on PII-containing asset), Severity: High, Confidence: High.

**Routing:** Route to `actions-hardening` for prioritized remediation plan. No escalation unless exploitation evidence found.

---

### Example 6: Cyble Leaked Credential Alert

**Alert:** Cyble — "Corporate credential found in stealer logs: jsmith@company.com:Spring2026!".

**Phase 0:** Context is usable. jsmith is a marketing user, no privileged access. Known to reuse passwords.

**Phase 1:**
- Alert ID: CYB-20260709-006
- Source: Cyble Vision
- Rule: Credential leak detection
- Severity: High
- Entity: jsmith@company.com
- Source: RedLine stealer logs, Telegram channel, discovered 2026-07-08

**Phase 2:** Route to `cyble-cti` for full leak context (source, timestamp, associated malware, other leaked data). Route to `defender-advanced-hunting` for jsmith sign-in anomalies.

**Phase 3:** Cyble confirms: credential from RedLine infostealer log, machine likely infected 2026-07-01. Password matches last known password (changed 30 days ago — stale). Defender: no anomalous sign-ins from unusual locations, no MFA bypass, no suspicious activity on jsmith account in last 30 days.

**Phase 4:** Suspicious. Credential is real but likely stale (password changed since leak). No sign of active abuse. But user's machine may still be infected.

**Verdict:** Suspicious, Severity: Medium, Confidence: Medium.

**Routing:** Route to `commandzero` for deeper investigation of jsmith endpoint. Hand off to `actions-hardening` for: force password reset and session revocation for jsmith, check endpoint for infostealer, notify user.

---

### Example 7: False Positive Due to Known Scanner

**Alert:** Defender XDR — "Multiple failed login attempts" from host SCANNER-01 to multiple hosts.

**Phase 0:** Context is strong. SCANNER-01 is documented in system-context.md as internal vulnerability scanner. Owned by Security Engineering. Known benign system.

**Phase 1:**
- Alert ID: AL-20260709-007
- Source: Microsoft Defender XDR
- Rule: Brute force attempt (multiple failed logins)
- Severity: Medium
- Entity: SCANNER-01 (source), multiple target hosts

**Phase 2:** Route to `defender-advanced-hunting` for activity context.

**Phase 3:** Defender confirms: SCANNER-01 is performing authenticated vulnerability scans as part of scheduled weekly scan (every Wednesday 02:00-04:00 UTC). Target hosts match scan scope. No successful logins with privileged accounts. No anomalous process behavior.

**Phase 4:** False Positive. Detection logic correctly identified brute-force-like pattern, but the entity is a known authorized scanner performing scheduled work.

**Verdict:** False Positive, Severity: Informational, Confidence: High.

**Routing:** No escalation. Tune detection: exclude SCANNER-01 from brute-force alerting during scan window (Wednesday 02:00-04:00 UTC).

---

### Example 8: Benign True Positive — Malware Lab Activity

**Alert:** Elastic — "Suspicious process injection detected" on host MALWARE-LAB-02.

**Phase 0:** Context is strong. MALWARE-LAB-02 is documented as malware analysis lab, air-gapped, owned by Threat Intelligence team. Known benign lab context.

**Phase 1:**
- Alert ID: EL-20260709-008
- Source: Elastic Security
- Rule: Suspicious process injection
- Severity: High
- Entity: MALWARE-LAB-02

**Phase 2:** Route to `elastic-siem` for context on surrounding events.

**Phase 3:** Elastic shows: process injection is from a known malware sample being detonated by Threat Intelligence analyst tianalyst. Malware sample hash matches case TR-2026-045. Activity confined to sandbox environment. No external network connectivity.

**Phase 4:** True Positive — Benign. Detection correctly identified real process injection from actual malware. But the activity is authorized malware analysis in a controlled lab environment.

**Verdict:** True Positive — Benign, Severity: Informational, Confidence: High.

**Routing:** No escalation. Ensure MALWARE-LAB-02 is in the detection exclusion list for Elastic rules. Update system-context.md if lab hosts changed.

---

### Example 9: Needs Investigation — Missing Telemetry

**Alert:** Wiz — "Suspicious outbound data transfer from AWS S3 bucket prod-uploads".

**Phase 0:** Context is weak. prod-uploads bucket owner unknown. No CloudTrail logging enabled for this bucket. No VPC Flow Logs available. Environment: production, but telemetry gaps are severe.

**Phase 1:**
- Alert ID: WIZ-20260709-009
- Source: Wiz
- Rule: Anomalous data transfer
- Severity: High
- Entity: S3 bucket prod-uploads

**Phase 2:** Route to `wiz-cloud` for asset context. Route to `cyble-cti` for external exposure check.

**Phase 3:** Wiz shows: 15 GB data transferred out in 2 hours (baseline: <1 GB/day). But CloudTrail logging not enabled for this bucket — cannot determine who accessed it, from where, or what was transferred. No VPC Flow Logs to trace network path. Cyble: no external exposure of this bucket data found on dark web or paste sites. Wiz: bucket is private, not publicly exposed.

**Phase 4:** Needs Investigation. Suspicious data transfer pattern, but critical telemetry is missing. Cannot determine if this is authorized data migration, backup, or exfiltration without CloudTrail logs.

**Verdict:** Needs Investigation, Severity: High, Confidence: Low.

**Routing:** Route to `commandzero` for deeper investigation. Hand off to `actions-hardening` for: enable CloudTrail logging on S3 bucket immediately, enable VPC Flow Logs, investigate via AWS CloudTrail (once logging is on), contact potential bucket owners.

**Missing evidence:**
- CloudTrail logs (not enabled)
- VPC Flow Logs (not enabled)
- Bucket owner (unknown)
- Data classification of transferred objects (unknown)

---

### Example 10: Duplicate Alert — Already Tracked in Jira

**Alert:** Defender XDR — "Possible lateral movement detected" from host WIN-APP-05 to WIN-DB-02.

**Phase 0:** Context is usable. Both hosts are production, owned by Application Team.

**Phase 1:**
- Alert ID: AL-20260709-010
- Source: Microsoft Defender XDR
- Rule: Lateral movement detection
- Severity: High
- Entities: WIN-APP-05, WIN-DB-02

**Phase 2:** Route to `defender-advanced-hunting` for activity context.

**Phase 3:** Defender shows: lateral movement activity matches incident IR-2026-012, opened 2026-07-08. Jira ticket SEC-1234 already tracking this case. Incident Response team has already isolated WIN-APP-05 (2026-07-08 14:00 UTC). WIN-DB-02 was validated as not compromised. This is a duplicate alert from the same incident — Defender re-triggered on stale telemetry.

**Phase 4:** Duplicate / Already Handled. Same incident already investigated, contained, and tracked.

**Verdict:** Duplicate / Already Handled, Severity: N/A (already handled), Confidence: High.

**Routing:** No escalation. Link this alert to incident IR-2026-012 / Jira SEC-1234. Suppress duplicate alert. Update alert to "Closed — Duplicate."
