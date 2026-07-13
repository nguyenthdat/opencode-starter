---
name: commandzero
description: "Manage CommandZero investigation records and approved remediation lifecycle through its MCP. Use when the user explicitly asks to create, inspect, update, close, or synchronize a CommandZero investigation or remediation. Not the general SecOps orchestrator and not for simple IOC reputation. All create/update/close/remediation operations require explicit approval."
compatibility: opencode
metadata:
  domain: secops
  audience: senior-secops-analyst
  edition: "2026.07"
  mcp_version: "0.1.0"
---

# Command Zero Deep SOC Investigation

## Purpose

Command Zero is an autonomous and AI-assisted SOC investigation platform that runs the full investigation lifecycle from alert through verdict using a question-led, governed, auditable method. Every investigation step is visible and reproducible.

The Command Zero MCP server (v0.1.0, base URL `https://api.cmdzero.io/public/v1`) is an **investigation management API**. It manages the lifecycle of investigations and remediation actions in the Command Zero platform. The actual question-led investigation — asking questions against connected data sources, collecting observables, building timelines, and testing hypotheses — happens inside the Command Zero platform itself.

Use Command Zero when the task requires:

- Investigation depth and cross-source reasoning.
- Case timeline reconstruction and scope analysis.
- Hypothesis formation and testing with evidence.
- Alert-to-verdict analysis with documented reasoning.
- Managing the investigation lifecycle: create, track, update, and close investigations.
- Executing and tracking remediation actions with audit trail.

Do not use Command Zero only to look up IoCs unless the IoC is part of a broader investigation. CTI, reputation, passive DNS, and detection ratios are supporting context only. They cannot be the verdict basis.

## When to Use

Trigger this skill when the task involves any of:

- Alert investigation or multi-source incident triage.
- Phishing, business email compromise, malicious attachment, malicious URL, or user click investigation.
- Identity compromise, impossible travel, suspicious MFA, mailbox rule abuse, OAuth consent abuse, privilege misuse.
- Endpoint compromise, malware execution, suspicious process tree, persistence, ransomware precursor, EDR detection.
- Suspicious cloud or SaaS activity, exposed cloud asset, unusual API access, anomalous data access, risky cloud identity change.
- Insider-risk behavior, unusual file access, suspicious sharing, data staging, policy violation with security impact.
- Lateral movement, remote execution, credential replay, privilege escalation, administrative group changes.
- Data exfiltration suspicion from endpoint, email, proxy, firewall, DNS, cloud storage, SaaS, or managed file transfer telemetry.
- Managing an investigation record: creating, reading, listing, updating, or closing.
- Executing or tracking remediation actions.

## When Not to Use

- Simple IOC reputation check, passive DNS lookup, malware family label lookup, or CTI-only summary — route to the CTI workflow.
- Raw SIEM/EDR query for a single event without investigation context — use the SIEM or EDR skill directly.
- Cloud asset inventory or vulnerability scanning without an alert or case — use Wiz directly.
- Isolated file hash or URL check — use the file scanning or sandboxing skill directly.

## MCP Tool Discovery Requirement

Before using any CommandZero MCP tool, the agent must first call `cmdzero_list_organizations` to discover available organizations. Organization ID is a required parameter for all org-scoped tools. The agent must never hardcode organization IDs.

Before creating an investigation, the agent should call `cmdzero_list_users` to find assignable users and `cmdzero_list_investigation_templates` to discover available templates.

The complete tool inventory below was extracted directly from the MCP server via `tools/list` and `strings` analysis. Every tool name, parameter, and description is verified against the actual MCP schema. Do not invent tools or parameters.

## MCP Tool Inventory

### Health and Discovery

| Tool | Description | Inputs | Outputs | Annotations |
|---|---|---|---|---|
| `cmdzero_health_check` | Check API health and API key validity. Read-only. | None | Service status | readOnly, idempotent |
| `cmdzero_list_organizations` | List organizations accessible to the API key. Supports OData filtering and pagination. Read-only. | `filter` (optional), `limit` (optional, default 50), `next` (optional cursor) | Organization list | readOnly, idempotent |
| `cmdzero_list_catalog_types` | List catalog types. Use `filter: "isAlert eq true"` for alert types only. Read-only. | `organization_id` (required), `filter` (optional) | Catalog types with field definitions | readOnly, idempotent |
| `cmdzero_get_catalog_type` | Get a specific catalog type by ID. Includes field definitions, examples, and alert type flag. Read-only. | `organization_id` (required), `type_id` (required) | Full catalog type definition | readOnly, idempotent |

### Users and Applications

| Tool | Description | Inputs | Outputs | Annotations |
|---|---|---|---|---|
| `cmdzero_list_users` | List users in an organization. Filter `role ne 'observer'` for actionable users. Read-only. | `organization_id` (required), `filter` (optional), `limit` (optional), `next` (optional) | User list (name, email, role) | readOnly, idempotent |
| `cmdzero_get_user` | Get a specific user by ID. Read-only. | `organization_id` (required), `user_id` (required) | User metadata | readOnly, idempotent |
| `cmdzero_list_applications` | List applications in an organization. Sorted by name. Read-only. | `organization_id` (required), `filter` (optional), `limit` (optional), `next` (optional) | Application list | readOnly, idempotent |
| `cmdzero_get_application` | Get a specific application by ID. Read-only. | `organization_id` (required), `application_id` (required) | Application details | readOnly, idempotent |

### Business Context Uploads (Custom Data Feeds)

| Tool | Description | Inputs | Outputs | Annotations |
|---|---|---|---|---|
| `cmdzero_list_business_context_uploads` | List business context uploads (metadata only, not records). Read-only. | `organization_id` (required), `filter` (optional), `limit` (optional), `next` (optional) | Upload list (metadata) | readOnly, idempotent |
| `cmdzero_get_business_context_upload` | Get a specific upload by ID. Read-only. | `organization_id` (required), `upload_id` (required) | Upload details | readOnly, idempotent |
| `cmdzero_create_business_context_upload` | Create a new business context upload. Async (returns 202). Name, records (JSON array), and schema (array of `{path, type}`) are required. Destructive. | `organization_id` (required), `name` (required), `records` (required JSON array), `schema` (required) | Upload creation result | destructive, NOT idempotent |
| `cmdzero_replace_business_context_upload` | Replace an existing upload. Async. Records and schema required; name optional. | `organization_id` (required), `upload_id` (required), `records` (required), `schema` (required), `name` (optional) | Replace result | destructive, idempotent |
| `cmdzero_delete_business_context_upload` | Delete a business context upload. Only affects future investigations. Cannot be undone. Destructive. | `organization_id` (required), `upload_id` (required) | Deletion result | destructive, NOT idempotent |

### Investigation Templates

| Tool | Description | Inputs | Outputs | Annotations |
|---|---|---|---|---|
| `cmdzero_list_investigation_templates` | List investigation templates (preconfigured workflows) with lead types, default settings, and assignees. Read-only. | `organization_id` (required), `filter` (optional) | Template list | readOnly, idempotent |
| `cmdzero_get_investigation_template` | Get a specific template by ID. Includes full template definition. Read-only. | `organization_id` (required), `template_id` (required) | Full template definition | readOnly, idempotent |

### Investigations (Core Workflow)

| Tool | Description | Inputs | Outputs | Annotations |
|---|---|---|---|---|
| `cmdzero_list_investigations` | List investigations. Common filters: `status eq 'pending-review'`, `completed eq true`. Supports OData filtering and pagination. Read-only. | `organization_id` (required), `filter` (optional), `limit` (optional), `next` (optional) | Investigation list | readOnly, idempotent |
| `cmdzero_create_investigation` | Create or extend an investigation. Supports alert-based creation (`alert_data` + `alert_type` + `alert_schema`) or template-based creation (`template_id` + `leads`). Use `nosettle: true` to prevent merging. Destructive. | `organization_id` (required), `request` (required — alert-based or template-based payload), `nosettle` (optional boolean) | Created investigation | destructive, NOT idempotent |
| `cmdzero_get_investigation` | Get a specific investigation by ID. Returns full details including observables, assignees, status, and verdict. Read-only. | `organization_id` (required), `investigation_id` (required) | Full investigation (observables, assignees, status, verdict) | readOnly, idempotent |
| `cmdzero_update_investigation` | Update an investigation (partial update). Supports: assignees, category, description, sensitivity, severity, status, tags, title. Array fields fully replace existing values. Status transitions are validated. Destructive. | `organization_id` (required), `investigation_id` (required), `request` (required — partial update payload) | Updated investigation | destructive, NOT idempotent |

### Remediation Templates

| Tool | Description | Inputs | Outputs | Annotations |
|---|---|---|---|---|
| `cmdzero_list_remediation_templates` | List remediation templates. Available capabilities determined by organization integrations. Read-only. | `organization_id` (required), `filter` (optional) | Template list | readOnly, idempotent |
| `cmdzero_get_remediation_template` | Get a specific remediation template by ID. Includes subject type and optional undo template. Read-only. | `organization_id` (required), `template_id` (required) | Full template (subject type, undo template) | readOnly, idempotent |

### Remediations (Action Execution)

| Tool | Description | Inputs | Outputs | Annotations |
|---|---|---|---|---|
| `cmdzero_list_remediations` | List remediations sorted by creation time (newest first). Supports OData filtering by subjectType and status. Read-only. | `organization_id` (required), `filter` (optional), `limit` (optional), `next` (optional) | Remediation list | readOnly, idempotent |
| `cmdzero_create_remediation` | Execute a remediation template against a subject. Requires `templateId`, `subject` (type + value), and `justification`. Subject type must match template's subjectType. Destructive — executes the remediation action. | `organization_id` (required), `request` (required — templateId, subject, justification) | Remediation execution result | destructive, NOT idempotent |
| `cmdzero_get_remediation` | Get a specific remediation by ID. Returns execution status, subject details, and any errors. Read-only. | `organization_id` (required), `remediation_id` (required) | Remediation status, subject, errors | readOnly, idempotent |

### What the CommandZero MCP Does NOT Expose

The following capabilities are not available through the current MCP (v0.1.0). They may be available inside the CommandZero platform UI, but they cannot be driven through MCP tools:

| Missing Capability | Impact | Fallback |
|---|---|---|
| **Ask investigation question / run question against connected data** | The MCP cannot trigger a question-led investigation against SIEM, EDR, cloud, email, or identity sources. | The question-led investigation must be performed inside the CommandZero platform. Use the MCP to create/manage the investigation record. Collect evidence externally through native MCP tools (Defender, Elastic, Wiz, etc.) and surface findings through `cmdzero_update_investigation`. |
| **Get investigation timeline / evidence graph** | The MCP `cmdzero_get_investigation` returns observables and verdict, but there is no dedicated timeline or evidence graph endpoint. | Build the timeline manually from observables in the investigation response. Use the output schema in this skill to structure findings. |
| **Search across investigations** | OData filtering on `cmdzero_list_investigations` supports basic filtering, but there is no cross-investigation search, graph traversal, or entity correlation across investigations. | List investigations with relevant filters, then `cmdzero_get_investigation` on each to manually correlate. |
| **Direct query of connected data sources** | The MCP does not provide passthrough access to connected SIEM, EDR, cloud, email, identity, network, or ticket systems. | Use native MCP tools directly: `microsoft.defender` for MDE/MDO, `wiz` for cloud, `filescan` for file analysis, `atlassian` for Jira, `cyble.vision` for CTI. |
| **IOC enrichment / reputation lookup** | The MCP has no tool for IP, domain, URL, or hash intelligence. | Use `cyble.vision` MCP for CTI enrichment. Use `filescan` MCP for file analysis. |
| **Automated verdict / scoring** | The MCP returns the verdict from the platform but does not compute it. | Apply the verdict-scoring skill. Record verdict and confidence through `cmdzero_update_investigation`. |

## MCP Tool Mapping

Map each investigation type to the available MCP tools. Where a capability is not exposed by the MCP, use the documented fallback.

### Investigation Lifecycle (All Types)

| Step | MCP Tool(s) | Notes |
|---|---|---|
| Discover org | `cmdzero_list_organizations` | First call; use first org if only one. |
| Discover assignable users | `cmdzero_list_users` (filter: `role ne 'observer'`) | For assigning investigations. |
| Discover templates | `cmdzero_list_investigation_templates` | Check if a template exists for the case type. |
| Discover alert catalog types | `cmdzero_list_catalog_types` (filter: `isAlert eq true`) | For alert-based investigation creation. |
| Create investigation record | `cmdzero_create_investigation` | Use alert-based or template-based payload. |
| Read investigation | `cmdzero_get_investigation` | Retrieve observables, status, verdict. |
| Update investigation | `cmdzero_update_investigation` | Record findings, evidence summary, verdict, assignee. |
| List existing investigations | `cmdzero_list_investigations` | Check for related or duplicate investigations. |
| Discover remediation templates | `cmdzero_list_remediation_templates` | Before recommending actions. |
| Execute remediation | `cmdzero_create_remediation` | Only with approved justification. |
| Check remediation status | `cmdzero_get_remediation` | Verify execution. |

### Investigation Type Mapping

| Investigation Type | Primary MCP Tool | Supporting MCP Tools | Evidence Sources (External) | Notes |
|---|---|---|---|---|
| Alert investigation | `cmdzero_create_investigation` (alert-based) | `cmdzero_list_catalog_types`, `cmdzero_get_catalog_type`, `cmdzero_get_investigation` | SIEM (Defender / Elastic), EDR | Alert-based creation requires alert_data, alert_type, alert_schema matched to a catalog type. |
| Phishing investigation | `cmdzero_create_investigation` (alert-based or template) | `cmdzero_get_investigation`, `cmdzero_update_investigation` | MDO (message trace, headers, Safe Links, Safe Attachments), filescan (detonation) | Email observables (sender, subject, URLs, attachments) should be captured in the investigation record. No MCP tool for email analysis — use MDO MCP directly. |
| Identity compromise | `cmdzero_create_investigation` (alert-based or template) | `cmdzero_get_investigation`, `cmdzero_update_investigation` | Entra ID / Defender for Identity (sign-ins, MFA, group changes, role changes, OAuth grants) | Identity observables (user, IPs, devices, geographies, sessions) should be captured in the investigation record. The MCP does not query identity providers directly. |
| Endpoint compromise | `cmdzero_create_investigation` (alert-based or template) | `cmdzero_get_investigation`, `cmdzero_update_investigation` | MDE Advanced Hunting (DeviceProcessEvents, DeviceFileEvents, DeviceNetworkEvents, DeviceLogonEvents, DeviceRegistryEvents) | Process trees, file writes, persistence, network connections from EDR. The MCP does not query EDR directly. |
| Malware execution | `cmdzero_create_investigation` (alert-based or template) | `cmdzero_get_investigation`, `cmdzero_update_investigation` | MDE Advanced Hunting, filescan (detonation) | File hashes, process trees, detonation results. The MCP does not query file analysis tools directly. |
| Cloud / SaaS anomaly | `cmdzero_create_investigation` (alert-based or template) | `cmdzero_get_investigation`, `cmdzero_update_investigation` | Wiz (cloud asset exposure, vulnerability, identity risk, toxic combinations), Entra ID | Cloud asset IDs, exposure status, identity context. The MCP does not query Wiz directly. |
| Insider-risk investigation | `cmdzero_create_investigation` (template) | `cmdzero_get_investigation`, `cmdzero_update_investigation` | MDE (file access, USB, printing, browsing), MDO (email, sharing), Jira (tickets, change records), DNS/proxy/firewall logs | User behavior context across multiple sources. |
| Lateral movement | `cmdzero_create_investigation` (alert-based or template) | `cmdzero_get_investigation`, `cmdzero_update_investigation` | MDE Advanced Hunting (DeviceLogonEvents, DeviceProcessEvents with PsExec/WMI/WinRM/RDP), Elastic SIEM | Cross-host authentication events, process creation with remote execution patterns. |
| Privilege escalation | `cmdzero_create_investigation` (alert-based or template) | `cmdzero_get_investigation`, `cmdzero_update_investigation` | MDE (process elevation, token manipulation), Entra ID (role/group changes, service principal changes) | New admin group membership, role assignment, token changes. |
| Data exfiltration | `cmdzero_create_investigation` (alert-based or template) | `cmdzero_get_investigation`, `cmdzero_update_investigation` | MDE (file copies, archive creation, USB), MDO (sharing links, forwarding rules), DNS/proxy/firewall (egress volume, destination), Wiz (storage exposure) | Outbound data transfer across multiple channels. |
| Multi-source incident triage | `cmdzero_create_investigation` (alert-based) | `cmdzero_list_investigations` (check for related), `cmdzero_get_investigation` | All available sources: SIEM, EDR, MDO, Wiz, CTI, tickets | Correlate alerts across sources into one investigation. |
| Case closure / verdict | `cmdzero_update_investigation` | None | None | Set status, severity, assignee, description with verdict summary. |

## Investigation Workflow

### Phase 1: Frame the Case

1. Parse the alert or case: ID, source system, rule name, severity, detection logic, raw payload.
2. Identify the initial entity: user, host, IP, domain, URL, file hash, process, mailbox, cloud asset, or ticket.
3. Define the initial time window from the alert. Expand only when evidence justifies it.
4. Extract all entities for tracking: users, hosts, IPs, domains, URLs, files, hashes, mailboxes, cloud resources, SaaS objects, processes, tickets, and data objects.
5. Call `cmdzero_list_organizations` to get the organization ID.
6. Check for existing related investigations with `cmdzero_list_investigations` (filter by entity or time range if possible).
7. Record known constraints: missing logs, unavailable tools, retention limits, tenant boundaries, permissions.

### Phase 2: Create the Investigation Record

1. Call `cmdzero_list_investigation_templates` and `cmdzero_list_catalog_types` to discover available templates and alert types.
2. If the alert type exists as a catalog type, call `cmdzero_get_catalog_type` to get its schema.
3. Create the investigation:
   - **Alert-based**: Use `cmdzero_create_investigation` with `alert_data`, `alert_type`, `alert_schema` matching the catalog type.
   - **Template-based**: Use `cmdzero_create_investigation` with `template_id` and `leads`.
   - Set `nosettle: true` to prevent automatic merging into an existing investigation.
4. Record the returned investigation ID. All subsequent evidence tracking references this ID.

### Phase 3: Ask Investigation Questions

Investigation questions are formed here and pursued through external tools (SIEM, EDR, MDO, Wiz, CTI) and the CommandZero platform. The MCP manages the investigation record; the platform and external tools generate evidence.

1. Start with broad timeline and entity-context questions.
2. Ask alternative-benign questions early: maintenance, approved change, scanner, user travel, known admin task, expected automation.
3. For each question, note: the question text, the source system queried, the tool used, the query/method, the result, and the interpretation.
4. Convert every meaningful answer into evidence with source, timestamp, entity, observation, interpretation, and confidence.

### Phase 4: Collect and Corroborate Evidence

1. Query the highest-fidelity source for the behavior first, then corroborate with independent telemetry.
2. Use native MCP tools directly, not through CommandZero:
   - **MDE Advanced Hunting**: `microsoft.defender` MCP for DeviceProcessEvents, DeviceFileEvents, DeviceNetworkEvents, DeviceLogonEvents, DeviceRegistryEvents, IdentityInfo, CloudAppEvents, EmailEvents, AlertInfo.
   - **Elastic SIEM**: Elasticsearch queries for raw events, detection rule context, host/user timelines.
   - **MDO (Defender for Office 365)**: `microsoft.defender` MCP for EmailEvents, UrlClickEvents, AttachmentInfo, message trace.
   - **Wiz**: `wiz` MCP for cloud asset exposure, vulnerability context, identity risks, toxic combinations.
   - **CTI**: `cyble.vision` MCP for campaign, infrastructure, malware, actor, and prevalence context.
   - **File analysis**: `filescan` MCP for file behavior, detonation artifacts, extracted IOCs, dynamic behavior.
   - **Jira / tickets**: `atlassian` MCP for approved work, maintenance windows, user requests, prior incidents.
3. Preserve raw results or query references where possible. Do not rely only on screenshots or summaries.
4. Tie every inference to evidence IDs (E1, E2, E3...).
5. Separate observed facts from analyst interpretation.
6. Track gaps explicitly instead of filling them with assumptions.

### Phase 5: Test Hypotheses

1. Define a primary malicious hypothesis and at least one plausible benign or administrative hypothesis.
2. List what evidence would support, contradict, or fail to test each hypothesis.
3. Search for contradictory evidence, not only confirming evidence.
4. Re-score confidence when data sources conflict, are unavailable, or have known false-positive patterns.
5. Mark a hypothesis as supported only when evidence shows behavior, intent, or impact beyond reputation alone.
6. Update the CommandZero investigation with findings through `cmdzero_update_investigation` (description, severity, category, tags).

### Phase 6: Analyze Scope and Impact

1. Pivot from the initial entity to related users, hosts, mailboxes, files, cloud resources, IPs, domains, sessions, tokens, and processes.
2. Identify the first known activity, latest known activity, affected assets, affected data, and blast radius.
3. Check whether the same TTP, IOC, account, host, process, rule, mailbox action, or cloud action appears elsewhere.
4. Distinguish confirmed scope from potential scope and state the evidence gap for potential scope.

### Phase 7: Decide and Recommend Actions

1. Assign verdict: Benign, Suspicious, Malicious, or Inconclusive.
2. Assign confidence: Low, Medium, or High.
3. Recommend priority based on impact, active risk, confidence, and containment urgency.
4. Call `cmdzero_list_remediation_templates` to discover available remediation actions.
5. For each recommended remediation, call `cmdzero_get_remediation_template` to verify the subject type matches.
6. **Do not execute `cmdzero_create_remediation` automatically.** Recommend the action with justification. Execute only when explicitly approved.
7. Update the investigation record with verdict and status through `cmdzero_update_investigation`.
8. Provide detection improvements and follow-up hunting queries.

## Investigation Questions

### Universal Case Questions

- What exactly triggered the alert and what behavior did the detection logic observe?
- What entity is the center of the investigation?
- Is the activity expected for this user, host, or application?
- What happened before, during, and after the alert window?
- Are there related alerts, processes, sign-ins, emails, network events, or cloud events?
- Is there an approved change, known automation, scanner, admin action, or legitimate user behavior that explains this activity?
- What evidence would make this benign, suspicious, malicious, or inconclusive?
- What evidence would disprove the malicious hypothesis?

### Phishing and Email Questions

- Who received, opened, clicked, replied to, forwarded, or reported the email?
- What do message trace, headers, SPF/DKIM/DMARC, attachment metadata, URL, Safe Links verdict, and detonation results show?
- Were credentials submitted, OAuth grants approved, MFA prompts triggered, mailbox rules changed, forwarding rules created, or unusual sign-ins observed after interaction?
- Did the campaign reach other users, mailboxes, tenants, or distribution lists?
- What is the sender infrastructure: domain age, registrant, hosting, MX, SPF include chain?

### Identity Compromise Questions

- What sign-ins, MFA events, device joins, token events, conditional access outcomes, and impossible-travel signals involve this identity?
- Were privileges, groups, roles, service principals, OAuth consents, mailbox rules, forwarding rules, or recovery settings changed?
- Are source IPs, devices, geographies, user agents, and sessions consistent with normal behavior for this user?
- What actions occurred after authentication that show misuse or impact?
- Are there signs of token replay, session hijacking, or MFA fatigue?

### Endpoint and Malware Questions

- What process tree, command line, parent process, file writes, registry changes, scheduled tasks, services, drivers, or persistence indicators were observed?
- Which files were executed, downloaded, renamed, quarantined, or deleted? What are their hashes and paths?
- What network connections, DNS queries, proxy requests, or firewall sessions followed execution?
- Did the same file, command, process, or behavior appear on other endpoints?
- Is the binary signed? What is the signer? Is the certificate valid?

### Cloud and SaaS Questions

- What cloud identities, resources, API calls, roles, policies, secrets, storage objects, or SaaS records changed during the window?
- Is the resource public, exposed, vulnerable, overprivileged, internet-facing, or connected to sensitive data?
- Were files viewed, downloaded, copied, shared, deleted, or moved in SharePoint, OneDrive, Exchange, cloud storage, or SaaS applications?
- Are there risky paths such as exposed workload + exploitable vulnerability + privileged identity?

### Insider Risk and Exfiltration Questions

- Is the user's access pattern abnormal for their role, location, device, peer group, and recent ticket/change history?
- What data was accessed, searched, staged, compressed, copied, shared, uploaded, printed, or deleted?
- What outbound channels show transfer: proxy, DNS, firewall, SaaS audit, email, cloud storage, removable media, or MFT?
- Does the timeline align with HR events, manager-approved work, incident response activity, or legitimate business process?

### Lateral Movement and Privilege Escalation Questions

- What remote logons, admin shares, WinRM, RDP, PsExec-like behavior, service creation, WMI, SSH, or cloud role assumption occurred?
- Were credentials reused across systems? Did authentication fan out from one source to multiple targets?
- What groups, roles, policies, service accounts, access keys, or delegated permissions changed?
- Which hosts or accounts are confirmed impacted versus only adjacent in the graph?
- What is the lateral movement path from initial compromise to current state?

## Evidence Model

Represent every material finding as an evidence record with these fields:

| Field | Requirement |
|---|---|
| Evidence ID | Stable identifier: E1, E2, E3... |
| Source | System or tool: MDE Advanced Hunting, Elastic SIEM, Wiz, MDO, EDR, DNS, proxy, firewall, Jira, filescan, Cyble CTI, or other. |
| CommandZero MCP Tool | If applicable: `cmdzero_get_investigation`, `cmdzero_list_*`, etc. |
| Query / Method | Exact question, KQL, Lucene query, ES\|QL, API call, file path, ticket number, or artifact reference. |
| Timestamp / Time Range | Event timestamp(s). Include collection timestamp if different. |
| Entity | User, host, IP, domain, URL, file, hash, mailbox, cloud resource, SaaS object, ticket, or process. |
| Observation | Raw behavior or fact, not a conclusion. |
| Interpretation | Analyst interpretation tied to the observation. What does this evidence mean? |
| Hypothesis Link | Which hypothesis does this evidence support or contradict? |
| Confidence | Low / Medium / High based on source reliability, fidelity, and corroboration. |
| Reference | Link, query result ID, investigation ID, file path, or tool result reference. |

### Minimum Evidence Standards

- **Malicious** verdict requires behavior or impact evidence, not only CTI or reputation.
- **Benign** verdict requires a positive benign explanation: approved change, owner confirmation, known automation, verified expected behavior.
- **Suspicious** means anomalous or risky behavior with insufficient proof of confirmed malicious activity. State what additional evidence would resolve it.
- **Inconclusive** means material evidence is unavailable, conflicting, or insufficient for a defensible verdict. List exactly what evidence is missing.

## Hypothesis-Testing Method

1. State the hypothesis in testable form. Example: "This alert represents credential compromise because the sign-in used an anomalous IP and was immediately followed by mailbox rule creation."
2. Add at least one competing hypothesis. Example: "This activity is benign because the user was traveling and accessed email from a local IP, and the mailbox rule was a legitimate rule the user creates weekly."
3. Define expected evidence for each hypothesis before querying.
4. Collect supporting and contradicting evidence across independent sources.
5. Evaluate whether each source proves behavior, context, identity, scope, or impact.
6. Decide the result: **Supported**, **Partially Supported**, **Contradicted**, or **Untested**.
7. Convert untested material questions into recommended follow-up hunting queries or documented data-source gaps.
8. Base the final verdict on the strongest supported hypothesis and explicitly state uncertainty.
9. Record hypothesis results in the investigation through `cmdzero_update_investigation`.

## Output Schema

### 1. Executive Summary

- **Verdict**: Benign / Suspicious / Malicious / Inconclusive
- **Confidence**: Low / Medium / High
- **Impacted entities**: users, hosts, mailboxes, cloud resources, SaaS objects, IPs, domains, files, data stores, or tickets
- **Recommended priority**: Low / Medium / High / Critical with one-sentence reason
- **CommandZero investigation ID**: reference to the managed investigation

### 2. Case Context

- **Alert/case**: ID, source system, rule name, severity, detection logic
- **Initial entity**: user, host, mailbox, IP, domain, URL, file, cloud resource, or SaaS object
- **Time window**: original window and any expansions with rationale
- **Organization ID**: from `cmdzero_list_organizations`
- **Data sources checked**: available, unavailable, and partially available sources
- **Templates / catalog types used**: if applicable

### 3. Investigation Timeline

Chronological sequence of relevant events. For each event:
- Timestamp (mark inferred or approximate times clearly)
- Source system
- Entity
- Event description
- Interpretation

### 4. Key Evidence

| Evidence ID | Source | MCP Tool | Query/Method | Timestamp | Entity | Observation | Interpretation | Hypothesis Link | Confidence | Reference |
|---|---|---|---|---|---|---|---|---|---|---|

### 5. Hypotheses Tested

| Hypothesis | Supporting Evidence | Contradicting Evidence | Result |
|---|---|---|---|
| H1: ... | E1, E3, E5 | E2, E4 | Supported / Partially Supported / Contradicted / Untested |
| H2: ... | E2, E4 | E1 | Supported / Partially Supported / Contradicted / Untested |

### 6. Scope and Impact

- **Confirmed scope**: users, hosts, mailboxes, cloud assets, IPs, domains, files, processes, data affected
- **Potential scope** (with evidence gaps): entities that may be affected but lack confirming evidence
- **Active risk**: is the threat ongoing?
- **Blast radius**: what would be affected if confirmed?
- **Remaining scope gaps**: what additional pivoting is needed?

### 7. Verdict Rationale

Explain why the final verdict and confidence were selected. Cite evidence IDs. Explicitly name:
- Uncertainty: what is not known
- Data gaps: what sources were missing
- Alternate explanations: what else could explain the evidence
- Confidence modifiers: what increased or decreased confidence

### 8. Recommended Actions

- **Containment** (actions requiring approval): isolate host, disable account, revoke sessions, block IOC, quarantine email, remove sharing link, restrict cloud resource. Reference `cmdzero_list_remediation_templates` / `cmdzero_get_remediation_template` output where applicable.
- **Remediation**: cleanup, credential reset, mailbox rule removal, persistence removal, patching, secret rotation, policy correction, user awareness.
- **Detection improvement**: rule tuning, enrichment, suppression with justification, telemetry onboarding, threshold adjustment, new correlation.
- **Follow-up hunting queries**: exact questions, KQL, Elastic query, Wiz checks, MDO searches, EDR pivots, DNS/proxy/firewall pivots, or ticket validation.
- **Escalation requirement**: IR, legal, privacy, HR, cloud owner, endpoint team, identity team, or management escalation criteria.

## Guardrails

- **Never invent CommandZero MCP tool names, parameters, or output fields.** Every tool referenced in this skill was verified against the actual MCP `tools/list` response.
- **Never claim malicious activity without evidence.** A verdict requires behavior or impact evidence, not only CTI, reputation, detection ratio, or vendor label.
- **Never base verdict only on CTI, reputation, passive DNS, or vendor label.** These are supporting context. They cannot be the basis for a Malicious verdict.
- **Never hide uncertainty.** State missing evidence, data gaps, confidence impact, and alternate explanations directly.
- **Never treat lack of evidence as benign.** Benign requires a positive benign explanation (approved change, owner confirmation, known automation, verified expected behavior).
- **Never perform persistent actions automatically.** Creating/updating/closing investigations, uploading business context, and executing remediation all change CommandZero state and require explicit user approval immediately before the call. Read-only listing and retrieval may proceed without that approval. Examples below do not waive this gate.
- **Never skip the organization discovery step.** Always call `cmdzero_list_organizations` before any org-scoped tool.
- **Keep every investigation auditable and reproducible.** Preserve questions, queries, source systems, timestamps, evidence IDs, tool call references, and rationale.
- **Separate facts from interpretation.** Label assumptions explicitly. State what was observed vs. what was concluded.
- **Prefer corroborated evidence from independent telemetry** before recommending containment that affects users or production systems.
- **If a CommandZero MCP tool does not expose a required capability, document the gap instead of pretending support exists.** Use the documented fallback.
- **Do not stop at enrichment results.** Use them to form or disprove hypotheses.

## Examples

### Example 1: Alert Investigation

**Scenario**: MDE alert "Suspicious PowerShell execution" for host DESKTOP-01, user jdoe.

1. `cmdzero_list_organizations` → org_id: `org-abc`
2. `cmdzero_list_catalog_types` (org-abc, filter: `isAlert eq true`) → find "Microsoft Defender for Endpoint Alert"
3. `cmdzero_get_catalog_type` (org-abc, type_id) → get alert schema fields
4. `cmdzero_create_investigation` (org-abc, alert-based, nosettle: true) → investigation ID `inv-001`
5. Collect evidence externally:
   - MDE Advanced Hunting: `DeviceProcessEvents | where DeviceName == "DESKTOP-01" and AccountName == "jdoe" | where Timestamp between (datetime(...) .. datetime(...))`
   - MDE Advanced Hunting: `DeviceNetworkEvents | where DeviceName == "DESKTOP-01" | where Timestamp between (...)`
   - filescan MCP: submit file hash for detonation
   - Cyble CTI: check destination IP reputation
6. Test hypotheses:
   - H1 (malicious): PowerShell downloaded and executed malware → check process tree, network connections, file writes
   - H2 (benign): IT admin ran approved script during maintenance window → check Jira for change ticket, verify user role
7. Record findings: `cmdzero_update_investigation` (org-abc, inv-001, request: severity, description, status)
8. If malicious: `cmdzero_list_remediation_templates` → `cmdzero_get_remediation_template` → recommend isolation, credential reset
9. Produce full output schema.

### Example 2: Phishing Investigation

**Scenario**: User reported suspicious email with attachment "invoice.pdf.exe".

1. `cmdzero_list_organizations` → org-abc
2. `cmdzero_list_investigation_templates` (org-abc) → check for phishing template
3. `cmdzero_create_investigation` (org-abc, template_id: phishing-template, leads: [{type: "email", value: "sender@evil.com"}], nosettle: true)
4. Collect evidence externally:
   - MDO: `EmailEvents | where SenderMailFromAddress == "sender@evil.com"` → message trace, recipient list, delivery action
   - MDO: `EmailAttachmentInfo` → attachment hash, filename
   - filescan MCP: submit attachment hash for detonation → behavioral report, extracted IOCs, signatures
   - MDO: `UrlClickEvents` → who clicked, Safe Links verdict
   - Cyble CTI: check sender domain infrastructure, URL reputation
   - Entra ID / Defender for Identity: sign-in anomalies for recipients in the hour after delivery
5. Test hypotheses:
   - H1: Phishing email led to credential compromise for 2 users who clicked and submitted credentials
   - H2: Email was blocked by Safe Links and no user interaction occurred
   - H3: Email was a legitimate invoice misidentified by the user
6. Record findings and verdict through `cmdzero_update_investigation`.
7. Recommend actions: quarantine remaining copies, reset credentials if compromised, block sender domain, hunt for forwarding rules on affected mailboxes.

### Example 3: Identity Compromise

**Scenario**: Impossible travel alert for user alice: sign-in from New York at 09:00 and Tokyo at 09:30.

1. `cmdzero_list_organizations` → org-abc
2. `cmdzero_create_investigation` (org-abc, alert-based using Entra ID alert catalog type, nosettle: true)
3. Collect evidence externally:
   - Entra ID sign-in logs: all sign-ins for alice ±24h, IPs, devices, user agents, MFA status, conditional access outcomes
   - MDE: `DeviceLogonEvents | where AccountName == "alice"` → confirm device presence in NY
   - MDO: `EmailEvents | where RecipientEmailAddress == "alice@corp.com"` → mailbox rule changes, forwarding rules
   - Cyble CTI: check Tokyo IP reputation
4. Test hypotheses:
   - H1: Credential compromise — attacker signed in from Tokyo VPN/proxy after obtaining alice's password
   - H2: Benign — alice is traveling and used corporate VPN, and the NY sign-in was a background token refresh
   - H3: Token theft — attacker replayed a stolen session token from a different geography
5. If H1 supported: `cmdzero_update_investigation` (status: open, severity: high, description: findings)
6. `cmdzero_list_remediation_templates` → find "Disable User" and "Revoke Sessions" templates
7. Recommend: disable alice's account, revoke all sessions, reset password, review MFA registration, hunt for persistence (mailbox rules, OAuth grants, registered MFA methods).

### Example 4: Endpoint Compromise

**Scenario**: EDR detected regsvr32.exe loading a suspicious DLL on host SRV-SQL-01.

1. `cmdzero_list_organizations` → org-abc
2. `cmdzero_create_investigation` (org-abc, alert-based MDE alert, nosettle: true)
3. Collect evidence externally:
   - MDE: `DeviceProcessEvents | where DeviceName == "SRV-SQL-01" and ProcessCommandLine contains "regsvr32"` → full process tree, parent process, command line
   - MDE: `DeviceFileEvents | where DeviceName == "SRV-SQL-01"` → DLL path, file hash, file creation time, preceding downloads
   - MDE: `DeviceNetworkEvents | where DeviceName == "SRV-SQL-01" and Timestamp >= process_start` → C2 connections, beaconing
   - MDE: `DeviceRegistryEvents` → persistence via Run keys, scheduled tasks
   - filescan MCP: submit DLL hash for behavioral detonation
   - Cyble CTI: check DLL hash, C2 IP/domain
4. Test hypotheses:
   - H1: Malicious DLL execution leading to C2 beaconing and attempted lateral movement
   - H2: Legitimate software registration with a benign DLL that triggered an overly broad detection rule
5. Build timeline: regsvr32 execution → DLL load → network connection to C2 → scheduled task creation → lateral RDP to DC-01
6. `cmdzero_update_investigation`: severity critical, description with timeline
7. `cmdzero_list_remediation_templates` → "Isolate Host", "Disable Scheduled Task"
8. Recommend: isolate SRV-SQL-01, block C2 IOC at firewall, investigate DC-01 for follow-on activity, remove persistence.

### Example 5: Malware Execution

**Scenario**: MDE alert "Malware detected: Trojan:Win32/Agent" on host DESKTOP-05 for file setup.exe.

1. `cmdzero_create_investigation` (org-abc, alert-based)
2. External evidence:
   - MDE: `DeviceProcessEvents | where FileName == "setup.exe"` → process tree, child processes, injection events
   - MDE: `DeviceFileEvents` → file origin (download URL, email attachment, USB), file writes, renamed files
   - MDE: `DeviceNetworkEvents` → C2 destinations, protocols, byte counts
   - filescan MCP: full detonation of setup.exe → behavioral report, extracted configs, payload stages, MITRE mappings
   - Cyble CTI: campaign association, actor attribution, related infrastructure
3. H1: User downloaded and executed a trojanized installer from a malicious download site
4. H2: False positive — setup.exe is a legitimate enterprise software with a bad signature
5. If confirmed: contain host, block IOCs, search for same hash/behavior on other endpoints, check for data exfiltration.

### Example 6: Cloud / SaaS Anomaly

**Scenario**: Wiz detected a public S3 bucket with "customer-data" prefix and anonymous read access.

1. `cmdzero_create_investigation` (org-abc, template-based, leads: cloud asset)
2. External evidence:
   - Wiz: full asset context — who created the bucket, when, IAM policies, logging status, connected identities
   - Wiz: vulnerability scan on associated workload
   - CloudTrail / Entra: who accessed the bucket, any data egress, credential usage
   - Entra ID: identity risk for the bucket owner
3. H1: Accidental exposure during development — bucket was made public by a developer testing a CDN config
4. H2: Deliberate data exfiltration — attacker compromised a privileged identity and made the bucket public to exfiltrate data
5. If accidental: restrict bucket, enable logging, review policy. If malicious: full IR, revoke compromised identity, rotate all secrets, audit data access.

### Example 7: Lateral Movement

**Scenario**: Multiple failed RDP logons from SRV-WEB-01 to DC-01, followed by successful logon.

1. `cmdzero_create_investigation` (org-abc, alert-based)
2. External evidence:
   - MDE: `DeviceLogonEvents | where DeviceName == "DC-01"` → all logon events, source IPs, logon types
   - MDE: `DeviceProcessEvents | where DeviceName == "SRV-WEB-01" and ProcessCommandLine contains "mstsc" or ProcessCommandLine contains "PsExec"` → lateral tooling
   - MDE: `DeviceNetworkEvents | where DeviceName == "SRV-WEB-01" and RemotePort == 3389` → RDP connections
   - MDE: process tree on SRV-WEB-01 → how did the attacker get there first?
3. H1: Attacker compromised SRV-WEB-01 via web app exploit, dumped credentials, RDP'd to DC-01 using domain admin credentials
4. H2: Legitimate IT admin performing maintenance from the jump host
5. Map the full kill chain. If confirmed: isolate both hosts, rotate all domain admin credentials, check DC-01 for persistence (golden ticket, scheduled tasks, new accounts).

### Example 8: Data Exfiltration

**Scenario**: Proxy logs show 50 GB upload from host FIN-USER-03 to an IP in a country with no business presence.

1. `cmdzero_create_investigation` (org-abc, alert-based or template)
2. External evidence:
   - Proxy/firewall: full egress logs for FIN-USER-03 over past 7 days — destinations, byte counts, protocols, SNI
   - DNS: queries from FIN-USER-03 in the same window
   - MDE: `DeviceFileEvents | where DeviceName == "FIN-USER-03"` → files accessed, staged (archive creation), copied to removable media
   - MDE: `DeviceProcessEvents` → rclone, megasync, FileZilla, curl, scp, or other exfiltration tools
   - MDO: `EmailEvents | where SenderMailFromAddress contains "@corp.com" and hasAttachment == true` → large outbound emails
   - Jira: any approved data transfer or migration for this user?
   - Cyble CTI: destination IP and domain reputation
3. H1: Insider data exfiltration — user staging finance data and uploading to personal cloud storage
4. H2: Approved data migration to a new cloud region by the finance team during a scheduled change window
5. If insider: legal and HR escalation, preserve forensic evidence, suspend account, revoke remote access, block destination at firewall.

### Example 9: Multi-Source Incident Triage

**Scenario**: Three alerts fire within 5 minutes:
- MDE: "Suspicious credential dump via procdump" on SRV-APP-01
- Entra ID: "User added to Domain Admins group" for account svc-backup
- MDO: "Mailbox forwarding rule created for CEO's mailbox"

1. `cmdzero_list_organizations` → org-abc
2. `cmdzero_create_investigation` (org-abc, alert-based using the first/most critical alert, nosettle: true)
3. `cmdzero_update_investigation` (add related alert IDs, expand time window, update severity to critical)
4. External evidence (parallel collection):
   - SIEM/EDR: correlate all three alerts by user, host, IP, and time
   - MDE: credential dump process tree, LSASS access, token impersonation
   - Entra ID: who added svc-backup to Domain Admins, from which IP, using which credential
   - MDO: forwarding rule created by which user, forwarding to which address, when
   - MDE: lateral movement from initial host to DC
5. H1: Unified attack chain — attacker compromised SRV-APP-01 → dumped credentials → used DA credential to add backdoor account → created forwarding rule on CEO mailbox to monitor communications
6. H2: Three unrelated events that coincidentally fired at the same time (unlikely but test)
7. `cmdzero_update_investigation` with unified timeline, severity critical, full findings
8. `cmdzero_list_remediation_templates` → discover all available containment options
9. Recommend complete incident response: isolate SRV-APP-01, disable svc-backup, remove forwarding rule, rotate all DA credentials, initiate full IR investigation, escalate to CISO.

## References

- `https://www.commandzero.ai/` — Autonomous and AI-assisted SOC platform. Question-led, governed AI. Runs Tier-1 through Tier-3 investigation lifecycle across identity, endpoint, email, cloud, and SaaS.
- `https://www.commandzero.ai/use-cases` — Use cases: alert triage, phishing analysis, threat hunting, insider investigations, SOC modernization, M&A, incident response, identity investigations.
- `https://api.cmdzero.io/public/v1` — CommandZero API base URL used by the MCP server.
- MCP server binary: `cmdzero-mcp-server` v0.1.0 (Rust/rmcp 2.1.0). Configuration: `harness/senior-secops-analyst/mcp.json` (entry: `"cmdzero"`).
- API key: configured via `CMDZERO_API_KEY` environment variable.
