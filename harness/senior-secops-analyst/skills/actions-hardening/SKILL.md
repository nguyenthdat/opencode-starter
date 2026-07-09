---
name: actions-hardening
description: "Produce decision-quality recommended-actions and control-hardening plans for SecOps, CloudSec, IR, phishing, vulnerability management, identity security, endpoint security, and detection engineering. Consumes investigation findings, verdicts, evidence, and context to output prioritized, assignable, time-bound, evidence-backed, Jira-ready actions across containment, remediation, hardening, detection, and governance. Use after investigation and verdict are complete. Triggers on: recommended actions, control hardening, next steps, action plan, containment plan, remediation plan, hardening plan, Jira tickets, follow-up actions, actions from findings."
compatibility: opencode
metadata:
  domain: secops
  audience: senior-secops-analyst
  edition: "2026.07"
---

# Recommended Actions and Control Hardening

Produce decision-quality, evidence-backed, prioritized, assignable, time-bound, verification-ready, Jira-ready recommended actions from completed investigation findings, verdicts, and evidence.

This skill does not investigate. It consumes findings, evidence, verdicts, risk context, and system context, then converts them into actionable response and hardening tasks.

This skill does not execute actions. It recommends actions only. The user must explicitly approve execution through an approved tool before any containment, remediation, IAM change, firewall change, credential rotation, account disable, host isolation, domain blocking, or ticket creation is performed.

## When to Use

Use this skill after:

- Investigation is complete or has sufficient findings to act on.
- Verdict, severity, and confidence are assigned.
- Evidence is collected and indexed under `_workspace/`.
- The case is ready for actionable next steps.

Do not use for:

- Investigation itself. Delegate to the appropriate investigation skill.
- Evidence collection. Use the `evidence-collection` skill.
- Verdict or confidence scoring. Use the `verdict-scoring` skill.
- Report writing. Use the Report Writer agent or `docx` skill.

## Input Requirements

Before producing actions, read or request these inputs. If any are missing, note the gap and adjust confidence.

### Required

- Investigation findings (any format: markdown report, workspace outputs, agent summaries)
- Verdict (Benign / Suspicious / Malicious / Inconclusive)
- Confidence (Low / Medium / High)
- Severity (Low / Medium / High / Critical)

### Strongly Recommended

- `_workspace/evidence-index.md` — evidence table with IDs and interpretations
- `_workspace/manifest.jsonl` — machine-readable evidence registry
- `_workspace/reports/findings.md` — structured findings
- `_workspace/reports/gaps.md` — known evidence gaps
- Affected entities: users, hosts, IPs, domains, URLs, cloud resources, file hashes

### Context-Dependent

- `system-context.md` or `_workspace/system-context.md` — environment, owners, assets, known benign
- Environment classification (prod/staging/dev)
- Criticality of affected assets
- Known benign / noisy list
- Owner / team mapping (CMDB, Jira, Wiz tags, cloud tags, CODEOWNERS)
- Business impact assessment
- Available tools and constraints (EDR, SIEM, firewall, proxy, DNS, SOAR)

If `system-context.md` is unavailable, mark `CONTEXT GAP` and produce actions with lower owner confidence. Create an action to build or update the context file.

### Risk Score Input

If available, incorporate:

- Risk score (numerical or categorical)
- Business impact (service/function affected)
- Exposure level (internet-facing, internal-only, segmented)
- Exploitability (known exploit, weaponized, PoC, theoretical)
- Blast radius (number of affected users/hosts/services)

## Evidence Referencing Rule

Every action must reference supporting evidence IDs when possible. Evidence sources:

- `_workspace/evidence-index.md`
- `_workspace/manifest.jsonl`
- Investigation report findings
- Tool outputs saved under `_workspace/raw/`, `_workspace/derived/`

If no evidence ID exists for an action's rationale, write:

```
Evidence: Not indexed / needs collection
```

Do not invent evidence IDs. Do not claim evidence exists unless it is registered in `manifest.jsonl` or `evidence-index.md`.

If evidence is missing and the action depends on it, create an Investigation Extension action to collect it, and mark the dependent action with the dependency.

## Action Categories

Produce actions across these six categories. Not every case needs every category. Include only categories relevant to the findings.

### 1. Immediate Containment

Stop active or imminent harm. Time-sensitive. Prefer the least disruptive effective option.

- Block domain / IP / URL / hash at firewall, proxy, DNS, or endpoint
- Isolate host (network containment via EDR)
- Disable user account or service principal
- Revoke active sessions (cloud IdP, VPN, OAuth tokens)
- Rotate compromised credentials / API keys / secrets
- Remove phishing email from mailboxes (admin delete via security tool)
- Quarantine file or attachment (EDR / Defender)
- Add temporary firewall, proxy, DNS, or NACL rule
- Add cloud temporary deny rule (IAM policy, security group, WAF)
- Submit takedown request for phishing / impersonation domain
- Suspend risky OAuth app consent / service principal
- Disable exposed service or port temporarily
- Disable compromised CI/CD pipeline job or runner
- Revoke compromised certificate / signing key

### 2. Investigation Extension

Close evidence gaps before declaring the case resolved. These are analysis tasks, not containment.

- Expand hunting time window (before/after detected event)
- Check related users, hosts, cloud resources, or service principals
- Collect additional logs (firewall, proxy, DNS, authentication, cloud audit)
- Query SIEM / Defender / Elastic / Splunk for related activity
- Inspect mailbox recipients and UrlClickEvents for phishing campaigns
- Validate cloud asset ownership and tags
- Request packet capture or log export from network team
- Engage DFIR for forensic analysis
- Preserve evidence (disk image, memory dump, log snapshot)
- Check prior incidents, cases, or tickets for similar patterns
- Validate affected identity sign-in logs and risky sign-in history
- Check lateral movement indicators from affected host
- Verify data access or exfiltration from affected resource
- Validate configuration drift from baseline

### 3. Remediation

Fix confirmed issues. Remove the vulnerability, persistence, misconfiguration, or exposure.

- Patch vulnerable systems (with CVE, patch version, KB if known)
- Fix web application vulnerability (XSS, SQLi, SSRF, auth bypass)
- Remove persistence mechanism (scheduled task, service, registry, cron, startup)
- Rebuild / reimage compromised host from trusted image
- Rotate secrets (passwords, API keys, tokens, certificates)
- Remove exposed credential from code, config, logs, or public repo
- Fix cloud misconfiguration (open bucket, over-privileged role, public endpoint)
- Correct IAM permissions (remove excessive roles, tighten policies)
- Update vulnerable dependency, container image, or library
- Remediate exposed asset (public IP, open port, unprotected database)
- Fix email / domain / DNS configuration (SPF, DKIM, DMARC, MX)
- Update asset owner inventory
- Remove unused or orphaned resources
- Clean up stale DNS records

### 4. Control Hardening

Prevent recurrence. Raise the security baseline. These are durable improvements, not incident-specific fixes.

- Enforce MFA / Conditional Access for affected user or role
- Reduce service principal / IAM role permissions (least privilege)
- Tighten cloud IAM roles and trust policies
- Enable logging for unmonitored systems (cloud audit, VPC flow, DNS, endpoint)
- Onboard missing assets to EDR, SIEM, Wiz, Tenable, or monitoring
- Improve network segmentation (VLAN, subnet, security group, NSG)
- Harden email security policies (anti-phishing, anti-spoof, attachment filtering)
- Improve DNS / proxy / firewall controls (block categories, enable TLS inspection)
- Harden Kubernetes / container security (Pod Security Standards, network policies)
- Improve secrets management (move from env vars to vault)
- Improve backup / recovery controls (immutable backups, tested restore)
- Add asset tagging and ownership metadata
- Implement application allowlisting or deny-listing
- Deploy certificate / key rotation automation

### 5. Detection and Monitoring

Detect the same or similar activity in the future. Surface early warning signals.

- New SIEM detection rule (correlation, threshold, anomaly)
- Defender Advanced Hunting custom detection
- Elastic detection rule (EQL, ES|QL, ML job)
- YARA rule for file/memory detection
- Sigma rule for cross-platform detection
- KQL / EQL / ES|QL query for hunting or detection
- Watchlist entry (IP, domain, URL, hash, user-agent, certificate)
- Alert tuning (reduce false positives, adjust thresholds)
- Dashboard or report for ongoing visibility
- Threat hunting query saved for recurring use
- Cyble / Wiz / Tenable watch or monitoring improvement
- Add IOC to blocklist or deny list

### 6. Communication and Governance

Notify stakeholders, create formal records, update documentation, and maintain traceability.

- Notify affected users (template-driven, security-approved wording)
- Notify asset / system owner
- Notify legal, compliance, or privacy officer (if PII, regulatory, or breach concern)
- Create Jira ticket (incident, task, or story)
- Create incident ticket in ITSM platform
- Update runbook or playbook with lessons learned
- Update `system-context.md` with new findings, owners, or known benign
- Update known benign / noisy list
- Executive notification (if severity is Critical or business impact is high)
- Schedule post-incident review or lessons-learned meeting

## Priority Model

Assign priority based on evidence strength, impact, urgency, exposure, reversibility, and blast radius.

### P0 — Emergency

Criteria:

- Confirmed active compromise (attacker present)
- Ongoing data exfiltration
- Active credential abuse (validated session hijack or token theft)
- Internet-exposed critical vulnerability exploitation
- Ransomware or destructive activity in progress
- Privileged identity compromise (domain admin, global admin, root)
- Production crown-jewel system impact

Timeline: now / same hour.

### P1 — Immediate

Criteria:

- Confirmed malicious activity requiring containment
- High-confidence credential harvest with user interaction (phishing success)
- Critical exposed asset with confirmed accessibility
- Critical vulnerability with known exploitability and internet exposure
- Malware execution on important system
- Phishing campaign with users who clicked
- Cloud toxic combination (e.g., exposed + privileged + sensitive-data access) with high blast radius

Timeline: same day / 24 hours.

### P2 — High

Criteria:

- High-risk suspicious activity (not confirmed, but strong indicators)
- High-severity vulnerability on important asset
- Confirmed exposure without active exploitation
- Control gap that enables likely compromise
- Missing logging on critical system
- Repeated phishing / credential attacks targeting the organization

Timeline: 24–72 hours.

### P3 — Medium

Criteria:

- Medium-risk remediation or hardening
- Detection improvement with meaningful risk reduction
- Hardening that closes a real control gap
- Scan / log coverage improvement
- Non-critical vulnerable assets

Timeline: 1–2 weeks.

### P4 — Low / Backlog

Criteria:

- Security hygiene improvements
- Documentation updates
- Lower-risk hardening
- Long-term control improvement
- Process or runbook improvement
- Non-urgent asset tagging / ownership

Timeline: 1–3 months.

## Action Quality Rules

Every action must be **specific, scoped, assignable, evidence-backed, measurable, verifiable, safe, risk-reducing, and realistic** for the environment.

### Avoid These Vague Actions

| Vague | Replace With |
|---|---|
| "Monitor closely" | "Create SIEM alert for repeated failed Windows logon EventID 4625 from external IPs, threshold ≥10 in 5 minutes" |
| "Improve security" | "Enforce MFA via Conditional Access policy for all users with privileged roles (target: CA policy 'Require MFA for admins')" |
| "Investigate more" | "Query Defender Advanced Hunting for network connections from host X to any new external IP in the 7 days prior to E0012" |
| "Patch systems" | "Apply KB5040434 (July 2026 CU) to Windows Server 2022 hosts in group 'prod-web' within 72 hours" |
| "Block bad things" | "Add domain evil.example.com to proxy blocklist category 'malware' and DNS RPZ zone 'blocked-domains'" |

### Action Quality Checklist

Before finalizing any action, confirm:

- [ ] Exact entity named (user, host, IP, domain, resource, role, policy)
- [ ] Exact control point named (firewall rule, IAM policy, SIEM rule, GPO, registry key)
- [ ] Exact query or check provided for verification
- [ ] Owner or team assigned (or "Owner unknown" with action to identify)
- [ ] Timeline or deadline stated
- [ ] Verification condition is concrete and testable
- [ ] Rollback or safety consideration noted for high-impact actions
- [ ] Evidence IDs referenced where available

## Action Format

Use this format for every action:

```
Action A001:
- Priority: P0 / P1 / P2 / P3 / P4
- Category: Immediate Containment / Investigation Extension / Remediation / Control Hardening / Detection and Monitoring / Communication and Governance
- Status: Recommended
- Owner: <team/role/person, or "Owner unknown — assign via Jira/CMDB/system-context.md">
- Affected entity: <specific host, user, IP, domain, resource, role>
- Evidence: <Evidence IDs, or "Not indexed / needs collection">
- Risk addressed: <what risk this action reduces>
- Rationale: <1–2 sentences why this action is necessary, tied to findings>
- Implementation:
    1. <Step>
    2. <Step>
    3. <Step>
- Verification:
    - How to confirm completion: <description>
    - Query / tool / check: <exact command or query>
    - Expected result: <what success looks like>
- Rollback / safety consideration: <reversibility, blast radius, safety note; "N/A — low-risk read-only action" if applicable>
- Deadline / SLA: <timeframe>
- Dependencies: <other action IDs or prerequisites; "None" if independent>
- Jira-ready summary: <one-line ticket title and description>
```

## Owner Selection

Use owner context from these sources, in priority order:

1. `system-context.md` — team/role mappings
2. Jira / Confluence — asset owner, service owner
3. Wiz cloud tags — resource owner, team
4. Tenable asset owner / group
5. Defender device / user ownership
6. GitHub CODEOWNERS / repository owner
7. Cloud resource tags (AWS, Azure, GCP)
8. CMDB / asset inventory
9. DNS / WHOIS admin contact (for domain-related actions)

If owner is unknown:

- Do not guess or invent an owner.
- Write: `Owner unknown — assign via Jira/CMDB/system-context.md`
- Create a Communication and Governance action to identify the owner (update CMDB, query tags, check system-context.md).

For actions with unknown owner but high urgency (P0/P1), assign to `SOC / SecOps triage` temporarily.

## Risk-Based Action Rules

These rules guide when and how aggressively to recommend specific actions based on the type of investigation. Never recommend destructive or disruptive actions without evidence justification.

### Phishing

- Block URL/domain only when evidence supports malicious or suspicious verdict.
- Remove emails from mailboxes if delivered to users. Target only the specific campaign.
- Check UrlClickEvents, proxy logs, DNS logs for user interaction before recommending credential reset.
- Reset credentials and revoke sessions only if credential submission is likely or confirmed.
- Submit takedown when impersonation/credential-harvest evidence exists and domain is attacker-controlled.
- Add detection for similar sender, domain, URL pattern, or email content fingerprint.
- If multiple users received the email, expand scope to all recipients, not only the reporter.

### Credential Leak / Compromise

- Validate affected identity in the actual identity provider before recommending action.
- Check recent sign-ins, risky sign-ins, and MFA status.
- Revoke sessions and reset password if active abuse or high risk is confirmed.
- Check password reuse risk (same password used on other systems).
- Notify user/identity owner after containment, not before (to avoid tipping the attacker).
- Add identity to watchlist for elevated monitoring.
- Check service principal / API key usage if the identity had those privileges.

### Endpoint Compromise

- Isolate host only if evidence supports active compromise or high risk of lateral movement.
- Collect triage package via EDR before destructive remediation where possible.
- Preserve evidence: disk image, memory dump, or EDR timeline export.
- Remove persistence or rebuild based on confidence in full cleanup. Rebuild is safer than cleanup when confidence is medium or low.
- Validate no lateral movement from the affected host before closing.
- Check for credential theft (LSASS access, token theft, browser credential stores).

### Cloud / Wiz Findings

- Prioritize by the combination: exposed + exploitable + privileged + sensitive-data.
- For P0/P1, recommend temporary mitigation first (revoke access, close port, detach policy).
- Include cloud-specific verification commands (CLI, API, or console check).
- Never modify IAM, network, or storage automatically. Recommend only.
- Include owner/team from Wiz tags, Jira, or cloud tags if available.
- For exposed storage, check access logs before recommending broad blocking to avoid disrupting legitimate access.

### Vulnerability / Tenable Findings

- Prioritize by: severity → exploitability (weaponized > PoC > theoretical) → exposure (internet-facing > internal) → asset criticality → age → owner.
- Include patch/fix version if known from advisory.
- Include compensating control (WAF rule, IPS signature, access restriction) if patch is not immediately possible.
- Verify remediation with rescan, config check, or package version check.
- Group related vulnerabilities on the same asset into a single remediation action.

### Identity / Entra ID

- Revoke sessions / reset credentials only when evidence justifies it (confirmed or high-risk compromise).
- Check MFA and Conditional Access gaps before recommending enforcement.
- Check privileged roles and service principals for excessive permissions.
- Verify sign-in logs after any revocation to confirm the session is terminated.
- Check for unusual OAuth app consent grants.

### Detection Engineering

- Include detection logic source (KQL, SPL, EQL, Sigma, YARA).
- Specify data source and required log category / table.
- Map to MITRE ATT&CK technique if appropriate.
- Define false-positive tuning considerations (what might trigger benign matches).
- Define a test plan: how to validate the detection fires and does not flood.
- Define owner and deployment process (who deploys, which system, testing phase).
- Do not create or deploy detections automatically unless the user explicitly requests it.

### Evidence Gaps

- Create Investigation Extension actions for unresolved gaps. Do not claim remediation certainty without evidence.
- Mark actions that depend on missing evidence with the dependency.
- Explain how the gap affects confidence in the recommended action.

## Required Output Structure

Always produce the complete structure below. If a section has no actions, state the reason briefly.

---

# Recommended Actions and Control Hardening Plan

## Executive Summary

| Field | Value |
|---|---|
| Verdict / risk basis | <verdict and key risk factors> |
| Confidence | Low / Medium / High |
| Total actions | <count> |
| P0 / P1 count | <count> |
| Immediate containment needed | Yes / No |
| Highest-risk entity | <entity name> |
| Main owner / team | <owner> |
| Major blockers | <blockers or "None identified"> |

## Action Priority Table

| ID | Priority | Category | Action | Owner | Deadline | Evidence | Status |
|---|---|---|---|---|---|---|---|
| A001 | P0 | Containment | Block domain evil.example.com at proxy | NetSec | 1h | E0012, E0015 | Recommended |
| ... | ... | ... | ... | ... | ... | ... | ... |

## 1. Immediate Containment

Action A001:
- Priority: ...
- Category: Immediate Containment
- ...

(Actions ordered by priority within this section.)

## 2. Investigation Extension

Action A0XX:
- Priority: ...
- Category: Investigation Extension
- ...

## 3. Remediation

Action A0XX:
- Priority: ...
- Category: Remediation
- ...

## 4. Control Hardening

Action A0XX:
- Priority: ...
- Category: Control Hardening
- ...

## 5. Detection and Monitoring

Action A0XX:
- Priority: ...
- Category: Detection and Monitoring
- ...

## 6. Communication and Governance

Action A0XX:
- Priority: ...
- Category: Communication and Governance
- ...

## Jira-Ready Tickets

For each ticket-worthy action:

| Field | Value |
|---|---|
| Title | <one-line summary with entity and action> |
| Priority | P0 / P1 / P2 / P3 / P4 |
| Owner / team | <assignee> |
| Description | <context, what happened, why this action matters> |
| Evidence | <evidence IDs> |
| Impact | <business/security impact if not done> |
| Required action | <concise description of what to do> |
| Acceptance criteria | <verifiable condition for done> |
| Verification | <how to confirm, query/check> |
| Due date | <deadline> |
| Labels / components | <e.g., security, phishing, vulnerability, cloud, identity> |
| Dependencies | <blocking tickets or prerequisites> |

## Verification Plan

| Action ID | Verification Method | Tool / Query | Expected Result | Evidence to Save |
|---|---|---|---|---|
| A001 | ... | ... | ... | ... |

## Assumptions and Dependencies

| Assumption / Dependency | Impact | Owner | Required Resolution |
|---|---|---|---|
| <e.g., "Firewall team can deploy rule within 1h"> | <if wrong, containment delayed> | <owner> | <what to confirm> |

## Residual Risk

Explain what risk remains after all recommended actions are completed. Include:

- Risk that is accepted (no further action planned).
- Risk that requires monitoring.
- Risk that depends on evidence gaps being closed.
- Risk that requires investment or organizational change beyond this case.

## Updates Needed to Context

List updates needed for:

- `system-context.md` — new assets, owners, known benign, tool coverage
- Known benign / noisy list — new entries to reduce false positives
- Asset owner mapping — missing or incorrect owners
- Telemetry gaps — systems that need logging onboarding
- Runbooks / playbooks — lessons learned from this case

---

## Guardrails

### Execution Rules

- Never execute containment or remediation automatically. Recommend only.
- Never disable accounts, isolate hosts, block domains, rotate secrets, delete resources, change IAM, change firewall rules, modify detections, create Jira tickets, or submit takedowns unless the user explicitly asks and the approved tool is available.
- Never recommend destructive actions (rebuild, delete, revoke all) without evidence-preservation steps where appropriate.
- Never recommend "benign / no action" when evidence gaps remain. Create investigation actions instead.

### Safety Rules

- Never recommend credential resets or session revocation without evidence of exposure, compromise, or high risk.
- Never recommend blocking shared infrastructure, CDNs, or cloud-provider IPs broadly without scoping to the specific threat.
- Never recommend actions that would disrupt production without a rollback/safety consideration.
- Always include safety/rollback considerations for high-impact actions (P0/P1 containment, IAM changes, network changes).
- Always include verification steps for every action.

### Evidence Rules

- Always reference evidence IDs when available. Use exact IDs from `manifest.jsonl` or `evidence-index.md`.
- Never invent evidence IDs, owners, affected assets, or tool results.
- Never claim a tool was queried unless its output is captured in evidence.
- Always create Investigation Extension actions for unresolved gaps.
- Never hide uncertainty. State confidence and assumptions explicitly.

### Structural Rules

- Always separate immediate containment from durable remediation and long-term hardening.
- Always produce Jira-ready summaries for every action.
- Always include the Verification Plan table.
- Always state residual risk.
- Always list updates needed to context files.
