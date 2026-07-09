---
name: wiz-cloud
description: "First-class multi-cloud security investigation skill for Wiz. Use Wiz as the primary security context engine for cloud infrastructure, Kubernetes, containers, identities, vulnerabilities, exposure, attack paths, code-to-cloud, CI/CD, runtime threats, remediation, and compliance across AWS/Azure/GCP. Trigger: cloud security investigation, cloud vulnerability triage, exposed cloud asset analysis, cloud identity/IAM risk, toxic risk combination, cloud posture/misconfiguration, Kubernetes/container risk, GitHub-to-cloud risk, cloud incident response, cloud remediation, vulnerability prioritization, CVE exploitability, attack path analysis, cloud compliance gap. Do NOT use for pure endpoint/email/phishing/brand-leak/raw-SIEM tasks without cloud asset context."
compatibility: opencode
metadata:
  audience: senior-secops-analyst
  domain: secops
  edition: "2026.07"
  workflow: cloud-security-investigation
---

# Wiz Cloud Security

Wiz is the first-class security context engine for multi-cloud, Kubernetes, container, identity, code-to-cloud, runtime, and exposure security investigation.

Wiz is not only a vulnerability scanner. Wiz is not only CSPM. Wiz is not only asset inventory. Wiz is not only AWS security. Wiz is a multi-cloud security platform for code, cloud, identity, workload, runtime, and exposure context — unified through the Wiz Security Graph.

The Wiz MCP Server (Python package `wiz-mcp-server`, remote endpoint `https://mcp.app.wiz.io`) exposes Wiz GraphQL API capabilities as MCP tools. Tools are dynamically fetched — some from local YAML definitions, others from remote tool definitions synchronized with the Wiz platform. Always inspect the connected server's tool list before assuming a specific tool name.

## Wiz MCP Configuration

Add to `.opencode/opencode.jsonc` under `mcp`:

```jsonc
"wiz": {
  "enabled": true,
  "type": "remote",
  "url": "https://mcp.app.wiz.io",
  "headers": {
    "Wiz-Client-Id": "{env:WIZ_CLIENT_ID}",
    "Wiz-Client-Secret": "{env:WIZ_CLIENT_SECRET}",
    "Wiz-DataCenter": "{env:WIZ_TENANT_DC}"
  }
}
```

Required environment variables: `WIZ_CLIENT_ID`, `WIZ_CLIENT_SECRET`, `WIZ_TENANT_DC`. Obtain credentials from the [Wiz Integration Portal](https://app.wiz.io/settings/automation/integrations/new/wiz-mcp).

The Wiz MCP Server can also run locally:
```bash
uvx wiz-mcp-server
# or
WIZ_DOTENV_PATH=/path/to/.env uv run mcp run src/wiz_mcp_server/server.py
```

## Important: Wiz MCP Tool Discovery Requirement

Before using or documenting any Wiz MCP tool, inspect the actual tools available in the connected server. The Wiz MCP Server fetches tool definitions dynamically — some from local YAML files, others from remote sources via the Wiz platform. Tool names, parameters, and capabilities may differ between versions.

This skill documents the canonical tools discovered from the official `wiz-mcp-server` source (v0.1.0). The remote endpoint at `https://mcp.app.wiz.io` may serve additional or updated tool definitions.

## When to Use

Use Wiz first when the task involves:

- AWS, Azure, or GCP security investigation
- Kubernetes cluster, pod, workload, or container security
- Container image vulnerability or misconfiguration
- Cloud vulnerability triage and prioritization (CVEs, packages, images)
- Cloud posture and misconfiguration (public storage, open security groups, insecure IAM)
- Cloud identity and IAM risk (excessive privileges, escalation paths, service accounts)
- Cloud attack paths and toxic risk combinations
- Internet-exposed cloud assets (storage, databases, admin panels, load balancers)
- Secrets in cloud workloads or connected code repositories
- GitHub repository or CI/CD pipeline risk with cloud asset linkage
- Okta or IdP identity context connected to cloud access
- Cloud runtime threat alerts (Wiz Defend) and incident triage
- Cloud incident scope and blast-radius analysis
- Cloud compliance and control failure investigation
- Cloud remediation planning and owner assignment

## When Not to Use

Do not use Wiz as primary when:

- The task is purely endpoint process telemetry with no cloud asset context (use Defender/EDR)
- The task is pure email/phishing investigation (use MDO/Defender)
- The task is pure external brand/credential leak monitoring (use Cyble)
- The task is deep multi-source case orchestration (use CommandZero)
- The task is raw SIEM log analysis with no cloud correlation (use Elastic/Sentinel)
- The task is local source-code review with no cloud, IaC, secret, or CI/CD context

**If an investigation touches cloud infrastructure, cloud identity, cloud exposure, cloud vulnerability, cloud runtime, GitHub-to-cloud, Okta-to-cloud, or Kubernetes/container risk, check Wiz early before relying only on SIEM, EDR, or CTI.**

## Wiz MCP Tool Mapping

### Discovered Tools (Official wiz-mcp-server v0.1.0)

These tools were discovered by inspecting the official `wiz-mcp-server` source code, YAML tool definitions, and the `tool.yaml` manifest.

#### Primary Tool

| Tool | Description | Key Inputs | Key Outputs |
|---|---|---|---|
| **`wiz_search`** | **PRIMARY tool.** Convert natural language to Wiz Graph Query and execute it. Use FIRST for most queries about cloud resources, vulnerabilities, exposures, and configurations. Returns structured results from Wiz Security Graph. | `query` (NL string), `limit` (1-1000, default 10), `project_id` (default `*`), `fetch_total_count` (bool), `after` (cursor for pagination) | `generated_query` (the Wiz Graph Query JSON), `query_results` (execution results with entities, exposures, lateral movement paths, Kubernetes paths, costs) |

#### Issue and Threat Tools

| Tool | Description | Key Inputs | Key Outputs |
|---|---|---|---|
| **`get_issues`** | Retrieve Wiz Issues with comprehensive filtering. Use when asked specifically about Wiz Issues or Issue IDs. | `first` (1-20, default 10), `severity` ([CRITICAL,HIGH,MEDIUM,LOW,INFORMATIONAL]), `status` ([OPEN,IN_PROGRESS,RESOLVED,REJECTED]), `type` ([TOXIC_COMBINATION,CLOUD_CONFIGURATION]), `entity_types` ([VIRTUAL_MACHINE,...]), `cloud_platforms` ([AWS,Azure,GCP,GKE,EKS,AKS,Kubernetes,...]), `project_names`/`project_ids`, `created_after`/`created_before`, `search` (free text), `fetch_total_count` (bool), `cursor` (pagination) | Issue `id`, `severity`, `status`, `type`, `entitySnapshot` (id, name, type, cloudPlatform, region, tags, subscriptionExternalId, subscriptionName, providerId), `sourceRules` (control/rule name, description, remediation, framework category), `projects` (name, businessUnit, riskProfile), `notes`, `serviceTickets`, `dueAt`, `createdAt`, `totalCount` |
| **`get_issue_data_by_id`** | Get full details of a single Wiz Issue including remediation strategies and threat detection context. | `issue_id` (string, required) | Full issue with `description`, `remediationStrategies` (name, target resources), `threatDetectionDetails` (detections, insights, cloud event groups with timeline), `entitySnapshot`, `projects` with `cloudAccountLinks` |
| **`get_threats`** | Retrieve Wiz Threat Detection issues specifically. Returns threat intelligence data: actors, resources, detection details, insights, cloud event groups. | `first` (1-20, default 10), `severity`, `status` (default [OPEN,IN_PROGRESS]), `project_ids`, `created_after`/`created_before`, `threat_resource`, `filter_scope` (ALL_ISSUE_DETECTIONS/LATEST_ISSUE_DETECTION), `fetch_total_count` (bool) | Threat `id`, `severity`, `status`, `cloudAccounts` (name, externalId, cloudProvider), `cloudOrganizations`, `threatDetectionDetails` (eventOrigin, detections with rule matches, insights with scores, cloudEventGroups with timelines and event counts) |
| **`get_projects`** | Lookup table of Wiz projects. Call ONCE per session and cache results. Convert project names to IDs before querying other tools. | `first` (1-500, default 500), `root` (bool, default true) | Project `id`, `name`, `isFolder`, `totalCount` |

#### AI-Assistant Tools (from tool.yaml manifest)

| Tool | Description | Key Inputs |
|---|---|---|
| **`ai_assistant_send_message`** | Interact with the Wiz AI Assistant to ask security questions about your tenant. | `query` (NL string), `conversation_id` |
| **`ai_graph_query`** | Generate a Wiz GraphQL query from natural language (without executing it). | `query` (NL string) |
| **`pull_cloud_resources`** | Retrieve cloud resources using natural language. | `query` (NL string) |
| **`get_vulnerability_findings`** | Retrieve vulnerability findings using natural language. | `query` (NL string) |

#### Internal / Disabled Tools (used by `wiz_search` internally)

| Tool | Description |
|---|---|
| `text_to_wiz_query` (disabled) | Convert NL to Wiz GraphQL query JSON. Called internally by `wiz_search`. |
| `execute_wiz_query` (disabled) | Execute a Wiz Graph Query with exposure paths, lateral movement, Kubernetes paths, costs. Called internally by `wiz_search`. |

### Workflow-to-Tool Mapping Table

| Investigation Workflow | Primary Tool(s) | Fallback Tool(s) | Notes |
|---|---|---|---|
| General cloud resource/asset search | `wiz_search` | `pull_cloud_resources` | Use NL: "Find all S3 buckets with public access", "Show exposed databases" |
| Vulnerability findings search | `wiz_search` | `get_vulnerability_findings` | Use NL: "Show VMs with critical CVEs", "Find resources with CISA KEV vulnerabilities" |
| Formal Wiz Issue triage (filtered) | `get_issues` | - | Filter by severity, status, type, entity, project, cloud platform, date |
| Single issue deep-dive | `get_issue_data_by_id` | `get_issues` with `issue_ids` | Returns remediation strategies, threat detection details, timeline |
| Threat detection / runtime alert | `get_threats` | `wiz_search` | Returns threat actor, detection rules, insights, cloud event groups |
| Attack path / toxic combination | `get_issues` with `type=[TOXIC_COMBINATION]` | `wiz_search` | `get_issues` returns structured TOXIC_COMBINATION issues |
| Cloud posture / misconfiguration | `get_issues` with `type=[CLOUD_CONFIGURATION]` | `wiz_search` | Filter by `cloud_platforms`, `entity_types` |
| Identity / IAM risk | `wiz_search` | `get_issues` with `stack_layer=[SECURITY_AND_IDENTITY,CLOUD_ENTITLEMENTS]` | Wiz Security Graph surfaces identity context; no standalone identity MCP tool |
| Kubernetes / container risk | `get_issues` with `cloud_platforms=[EKS,GKE,AKS,Kubernetes]` | `wiz_search` | Wiz Graph Search supports `fetchKubernetes=true` for pod/container paths |
| Code / GitHub / IaC risk | `get_issues` with `stack_layer=[CODE,CI_CD]` | `wiz_search` | Code-to-cloud mapping available via Security Graph context in issues |
| Compliance / framework status | `wiz_search` | `ai_assistant_send_message` | No dedicated compliance MCP tool; use NL queries or Wiz AI Assistant |
| Security posture dashboard | `wiz_search` with `fetch_total_count=true` | `ai_assistant_send_message` | No dedicated posture snapshot tool; aggregate via NL queries |
| Asset inventory count / stats | `wiz_search` with `fetch_total_count=true` | `get_projects` | Use `fetch_total_count=true` then report `totalCount` |
| Project lookup | `get_projects` | - | Call once per session, cache results |
| Natural-language security Q&A | `ai_assistant_send_message` | `wiz_search` | Conversational interface to Wiz platform |
| Remediation guidance | `get_issue_data_by_id` → `remediationStrategies` | `get_issues` → `sourceRules.remediationInstructions` | Remediation steps embedded in issue details |

### Capability Gaps

| Capability | Gap | Fallback |
|---|---|---|
| Dedicated vulnerability (CVE) search with exploit/KEV filters | No standalone `search_vulnerabilities` tool in official server | Use `wiz_search` with NL: "Find resources with CISA KEV vulnerabilities" or `get_vulnerability_findings` |
| Dedicated compliance status tool | No `get_compliance_status` MCP tool | Use `wiz_search` or `ai_assistant_send_message` for compliance questions |
| Dedicated security posture snapshot | No `get_security_posture` MCP tool | Aggregate via multiple `wiz_search`/`get_issues` calls |
| Cloud asset inventory (typed query) | No `query_assets` with `asset_type` filter | Use `wiz_search` with NL: "List all VIRTUAL_MACHINE assets in AWS" |
| Issue write-back (status update, notes) | No `update_issue` MCP tool in official server | Use Wiz web UI at `https://app.wiz.io/issues` |
| Cloud audit log correlation | No Wiz MCP tool for CloudTrail/Azure Activity Log/GCP Audit Logs | Use cloud-native CLIs (read-only) |
| Sensitive data classification query | Data sensitivity in issue/entity context, no standalone query | Look in `wiz_search` entity properties or `get_issue_data_by_id` context |
| Okta/IdP identity context | Wiz integrates with Okta but no dedicated MCP identity tool | Use Okta/Entra logs independently |
| Wiz AI Agent (Red/Blue/Green) intelligence | Agent analyses not exposed as standalone MCP tools | Agent insights may appear in issue context |
| Wiz AI Skills execution | Skills (predefined workflows) not callable as raw MCP tools | Use `ai_assistant_send_message` as conversational alternative |
| Bulk data export | No CSV/JSON dump tool | Paginate through `get_issues` or `get_threats` |

### Entity Types Reference

Wiz tracks these entity types (partial list):

| Category | Entity Types |
|---|---|
| Compute | `VIRTUAL_MACHINE`, `VIRTUAL_MACHINE_SCALE_SET`, `SERVERLESS_FUNCTION` |
| Kubernetes | `KUBERNETES_CLUSTER`, `KUBERNETES_NODE`, `KUBERNETES_POD`, `KUBERNETES_SERVICE` |
| Storage | `BUCKET`, `FILE_SYSTEM`, `VOLUME`, `OBJECT_STORE` |
| Database | `DATABASE`, `MANAGED_DATABASE`, `DATA_WAREHOUSE` |
| Network | `LOAD_BALANCER`, `PUBLIC_IP`, `DNS_RECORD`, `NETWORK_INTERFACE`, `SECURITY_GROUP`, `FIREWALL` |
| Identity | `USER`, `SERVICE_ACCOUNT`, `ROLE`, `MANAGED_IDENTITY`, `IDENTITY_PROVIDER` |
| Container/Registry | `CONTAINER_IMAGE`, `CONTAINER_REGISTRY`, `CONTAINER_REPOSITORY` |
| Code/CI-CD | `REPOSITORY`, `PULL_REQUEST`, `CI_CD_PIPELINE` |

Cloud platforms: `AWS`, `Azure`, `GCP`, `Alibaba`, `AKS`, `EKS`, `GKE`, `Kubernetes`, `OCI`, `OKE`, `OpenShift`, `vSphere`

Issue types: `TOXIC_COMBINATION`, `CLOUD_CONFIGURATION`, `THREAT_DETECTION`, `VULNERABILITY`

Stack layers: `APPLICATION_AND_DATA`, `CI_CD`, `SECURITY_AND_IDENTITY`, `COMPUTE_PLATFORMS`, `CODE`, `CLOUD_ENTITLEMENTS`, `DATA_STORES`

## Investigation Workflow

### Phase 1: Intake

Identify the case type, primary entity, cloud provider, time window, and expected output.

| Case Type | Scope | Key Wiz Query |
|---|---|---|
| Vulnerability | CVE on workload | `wiz_search`: "Find resources with critical CVEs that are internet-exposed" |
| Exposed asset | Public resource | `wiz_search`: "List all internet-facing storage buckets in production" |
| Misconfiguration | Cloud resource | `get_issues` filter: `type=[CLOUD_CONFIGURATION]`, entity type, cloud platform |
| Identity/IAM risk | Identity, role | `wiz_search`: "Find identities with excessive permissions" |
| Kubernetes/container | Cluster, pod, image | `wiz_search`: "Show pods running images with critical vulnerabilities" |
| Code-to-cloud risk | Repository, secret | `get_issues` filter: `stack_layer=[CODE,CI_CD]` |
| Runtime alert | Workload, threat | `get_threats` filter: severity, status, time window |
| Cloud incident | Compromised asset | `wiz_search` for blast radius; `get_threats` for related detections |
| Toxic combination | Chained risks | `get_issues` filter: `type=[TOXIC_COMBINATION]` |
| Compliance gap | Framework, control | `wiz_search`: "Show compliance gaps for CIS framework" or `ai_assistant_send_message` |

### Phase 2: Wiz Context Collection

For every investigation, capture these data points (sources noted):

1. **Cloud provider** — `entitySnapshot.cloudPlatform` from `get_issues`, or `wiz_search` entity `type`
2. **Account / subscription / project** — `entitySnapshot.subscriptionExternalId` / `subscriptionName`
3. **Resource ID and type** — `entitySnapshot.id`, `entitySnapshot.nativeType`, `entitySnapshot.type`
4. **Resource name** — `entitySnapshot.name`
5. **Tags, owner, business unit, environment** — `entitySnapshot.tags`, `projects.businessUnit`
6. **Exposure** — `wiz_search` with `fetchPublicExposurePaths=true` returns exposure paths
7. **Issue ID and severity** — From `get_issues` or `get_threats`
8. **Issue description and source rule** — `get_issue_data_by_id` → `description`, `sourceRules`
9. **Blast radius** — `wiz_search` with `fetchLateralMovement=true`, `fetchInternalExposurePaths=true`
10. **Related identities and permissions** — `wiz_search` entity properties, issue context
11. **Related vulnerabilities (CVEs)** — `get_vulnerability_findings` or `wiz_search`
12. **Attack path** — `get_issues` with `type=[TOXIC_COMBINATION]`
13. **Runtime context** — `get_threats` → `threatDetectionDetails` (detections, insights, cloudEventGroups)
14. **Code/repo context** — `get_issues` with `stack_layer=[CODE,CI_CD]`

**Recommended call sequence:**
1. `get_projects` once → cache project name→ID mapping
2. `wiz_search(query)` for broad resource/vulnerability/exposure discovery
3. `get_issues` with relevant filters for structured issue triage
4. `get_issue_data_by_id(issue_id)` for deep-dive on critical findings
5. `get_threats` for runtime/threat-specific investigation
6. `ai_assistant_send_message` for conversational analysis or summarization

### Phase 3: Risk Correlation

Correlate across these dimensions:

| Dimension | Source | Risk Signal |
|---|---|---|
| Exposure | `wiz_search` public exposure paths, `get_issues` entity metadata | Internet-facing, public IP, public DNS, open port |
| Exploitability | `get_vulnerability_findings` or NL query for CISA KEV | Known exploit, active exploitation |
| Privileges | Entity properties in `wiz_search`, issue context | Admin role, broad IAM scope, cross-account trust |
| Sensitive data | Entity properties, issue description | PII, PCI, PHI, credentials |
| Runtime activity | `get_threats` → `threatDetectionDetails.cloudEventGroups` | Suspicious process, network, file access |
| Business criticality | `get_issues` → `projects.riskProfile.businessImpact`, tags | Production, revenue impact |
| Internet reachability | `wiz_search` → `entities.publicExposures` | Public IP, open port, public DNS |
| Secrets in code | `get_issues` with `stack_layer=[CODE,CI_CD]` | Exposed credential, IaC misconfig |
| Identity paths | `wiz_search` with `fetchLateralMovement=true` | Privilege escalation, lateral movement |

**Risk scoring:**
- Internet-exposed + CISA KEV vuln → **Critical Risk**
- Internet-exposed + critical CVE (no KEV) → **High Risk**
- Internet-exposed + misconfiguration + sensitive data → **High Risk**
- Privileged identity + secret exposure → **High Risk**
- Internal-only + critical CVE + no exploit → **Medium Risk**
- Low-severity + no exposure + no sensitive data → **Low Risk**
- Active threat detection + internet exposure → **Malicious** (investigate immediately)
- Toxic combination (3+ factors) → **Critical Risk** (regardless of individual severity)

### Phase 4: Cross-Tool Validation

| Validation Need | Tool |
|---|---|
| Endpoint process / EDR telemetry | Defender Advanced Hunting |
| Raw cloud audit logs | `aws cloudtrail lookup-events`, `az monitor activity-log list`, `gcloud logging read` (read-only) |
| SIEM / network logs | Elastic, Sentinel |
| Multi-source incident orchestration | CommandZero |
| External brand/credential leak / ASM / CTI | Cyble |
| Repository code/secret verification | GitHub MCP (`github_search_code`, `github_get_file_contents`, `github_run_secret_scanning`) |
| Identity provider sign-in validation | Okta logs, Entra ID sign-in logs |
| Cloud resource verification (read-only) | `aws cli`, `az cli`, `gcloud` (describe/list/get only) |

### Phase 5: Verdict / Risk Decision

| Verdict | Criteria |
|---|---|
| **Benign** | Expected, no exposure, no exploitability, no business impact |
| **Low Risk** | Minor issue, no exposure, no sensitive data |
| **Medium Risk** | Notable risk but limited exposure or exploitability; internal-only |
| **High Risk** | Internet-exposed critical vuln, or privileged identity at risk, or sensitive data exposed |
| **Critical Risk** | Internet-exposed + CISA KEV, toxic combination (3+ factors), or active compromise |
| **Suspicious** | Anomalous activity, unconfirmed compromise; requires monitoring |
| **Malicious** | Confirmed compromise, active threat, attacker activity confirmed by `get_threats` |
| **Confirmed Exposure** | Verified public access to sensitive data/service |
| **Inconclusive** | Insufficient data; requires more telemetry or manual investigation |

### Phase 6: Remediation Planning

For each finding, produce:

1. **Immediate mitigation** (stop the bleeding)
2. **Durable fix** (permanent solution)
3. **Owner / team** (from `get_issues` → `projects.businessUnit`, entity tags)
4. **Cloud-provider-specific guidance** (CLI/console steps for AWS, Azure, or GCP)
5. **Validation steps** (how to confirm the fix)
6. **SLA timeline** (Critical: 24h, High: 72h, Medium: 7d, Low: 30d)

**Remediation sources in Wiz:**
- `get_issue_data_by_id` → `remediationStrategies[]` (name, target resources, category)
- `get_issues` → `sourceRules.remediationInstructions` (for cloud configuration rules)
- `get_issues` → `sourceRules.resolutionRecommendation` (for controls)

**Do not execute destructive remediation without explicit approval.** Never rotate secrets, delete resources, change IAM, block traffic, or modify cloud config automatically. Propose; wait for approval.

## Evidence Model

Every finding must include these mandatory fields:

| Field | Source in Wiz MCP Tools |
|---|---|
| Wiz tool used | e.g. `wiz_search`, `get_issues`, `get_issue_data_by_id`, `get_threats` |
| Entity / resource name | `entitySnapshot.name` |
| Cloud provider | `entitySnapshot.cloudPlatform` |
| Account / subscription / project | `entitySnapshot.subscriptionExternalId` / `subscriptionName` |
| Resource ID | `entitySnapshot.id` or `entitySnapshot.providerId` |
| Resource type | `entitySnapshot.nativeType` or `entitySnapshot.type` |
| Environment | `entitySnapshot.tags` or `projects.name` |
| Owner / team | `projects.businessUnit` or `entitySnapshot.tags` |
| Issue ID | `id` field from `get_issues` / `get_threats` |
| Severity | `severity` field |
| Exposure | `wiz_search` public exposure paths or issue context |
| Vulnerability / CVE | From `get_vulnerability_findings` or `wiz_search` entity properties |
| Identity / permission context | `wiz_search` entity properties, issue context |
| Attack path | `get_issues` TOXIC_COMBINATION type |
| Observation | Verbatim Wiz output |
| Interpretation | Analyst assessment |
| Confidence | High / Medium / Low |
| Validation source | Independent verification tool |
| Evidence gap | What data is missing |

## Output Schema

### Executive Summary

```
Case type:                [vulnerability / exposed asset / misconfiguration / identity risk / container risk / code-to-cloud / runtime alert / cloud incident / toxic combination / compliance]
Verdict / Risk:           [Benign / Low / Medium / High / Critical / Suspicious / Malicious / Confirmed Exposure / Inconclusive]
Confidence:               [High / Medium / Low]
Cloud provider:           [AWS / Azure / GCP / multi-cloud]
Affected account/sub/proj:[account ID / subscription ID / project ID]
Affected resource(s):     [name(s) and ID(s)]
Business owner/team:      [from Wiz projects/tags]
Recommended priority:     [P1-Critical / P2-High / P3-Medium / P4-Low]
Immediate action:         [one-line summary]
```

### Wiz Findings (Tabular)

```
Finding ID | Entity | Provider | Account/Project | Exposure | Severity | Attack Path / Toxic Combo | Owner | Confidence
```

### Cloud Context

```
Resource type:            [VIRTUAL_MACHINE / BUCKET / DATABASE / KUBERNETES_CLUSTER / ...]
Environment:              [production / staging / development]
Tags:                     [key=value]
Internet exposure:        [yes/no + details]
Sensitive data access:    [yes/no + classification]
Identity/permissions:     [role/policy summary]
Runtime context:          [from get_threats threatDetectionDetails]
Code/repo context:        [from get_issues stack_layer filter]
Related issues:           [linked issue IDs]
```

### Attack Path / Toxic Combination

```
Risk Combination | Evidence | Impact | Likelihood | Priority
```

### Validation

```
Check | Source | Result | Interpretation
```

### Risk Rationale

Separate into:
- **Wiz-reported finding** (verbatim tool output)
- **Confirmed cloud context** (independently verified)
- **Internal telemetry confirmation** (SIEM/EDR/audit)
- **Analyst inference** (reasoned assessment)
- **Unknowns / gaps** (missing data)

### Recommended Actions

```
Immediate mitigation:   [what to do now]
Permanent remediation:  [what to do permanently]
Owner / team:           [who]
Validation steps:       [how to confirm]
Follow-up hunting:      [detection queries]
Detection improvement:  [new rules]
```

### Jira-Ready Remediation

```
Title:                  [action-oriented]
Severity:               [Critical / High / Medium / Low]
Affected resource:      [name, ID, cloud provider/account]
Risk explanation:       [1-2 sentences]
Evidence:               [Wiz finding ID, tools used]
Required fix:           [specific steps with cloud-provider commands]
Validation:             [verification steps]
Owner / team:           [assignee]
Due date suggestion:    [SLA-based]
```

## KQL / SIEM Pivot Suggestions

| Pivot | Intent |
|---|---|
| Cloud identity sign-in activity | Find sign-ins from suspicious IPs to affected identity |
| Suspicious source IPs | Locate the IP from Wiz threat in sign-in/audit logs |
| Workload endpoint events | Process creation, network, file mods on affected VM/container |
| DNS / proxy access to exposed asset | Clients accessing the exposed endpoint |
| Service principal activity | API calls by affected service principal/managed identity |
| GitHub / CI/CD actor activity | Correlate code push/pipeline with cloud changes |
| Data access logs | Read/write on exposed storage bucket/database |

## Guardrails

- **Never invent** Wiz MCP tool names, parameters, output fields, or capabilities. Only reference tools confirmed in the connected server.
- **Never assume** a cloud asset is exploitable only because it has a CVE. Correlate exposure, exploitability, runtime, and business criticality.
- **Never ignore** exposure, identity permissions, runtime context, or business criticality in severity assessment.
- **Never downgrade** internet-exposed critical vulnerabilities without evidence.
- **Never treat** Wiz findings as final verdict without context validation from independent sources.
- **Never perform** destructive remediation automatically. Propose; wait for approval.
- **Never** rotate secrets, delete resources, change IAM, block traffic, or modify cloud config without explicit approval.
- **Never expose** secrets, tokens, keys, or sensitive data in reports. Redact.
- **Always state** data coverage gaps.
- **Always distinguish** Wiz-reported context from independently validated evidence.

## When Wiz MCP Is Not Configured

1. **State the gap:** "Wiz MCP server is not configured. Analysis is based on [alternative source]."
2. **Use alternatives:** AWS Security Hub/Config, Azure Security Center/Defender for Cloud, GCP Security Command Center, cloud-native CLIs (read-only).
3. **Recommend setup:** Add the Wiz MCP config block (see Configuration section above) and set required environment variables.
4. **Document gaps:** What Wiz would have provided that the alternative cannot.

## Examples

### 1. Internet-Exposed Critical Vulnerability on AWS EC2

```
1. wiz_search: "Find internet-exposed EC2 instances with critical CVEs"
   → returns entity list with CVE details, public IP, exposure paths
2. get_issues: filter severity=[CRITICAL], entity_types=[VIRTUAL_MACHINE], cloud_platforms=[AWS], entity_id=<instance_id>
   → returns structured Wiz Issue with control name, resolution recommendation
3. get_issue_data_by_id(issue_id):
   → returns remediationStrategies, threatDetectionDetails (if runtime threat)
Risk: Internet-exposed + critical CVE → High/Critical (check CISA KEV)
Remediation: Restrict security group (immediate), patch OS (permanent)
```

### 2. Azure Storage Account Public Exposure

```
1. wiz_search: "Show Azure storage accounts with public blob access"
2. get_issues: filter type=[CLOUD_CONFIGURATION], cloud_platforms=[Azure], entity_types=[BUCKET]
3. get_issue_data_by_id → remediationStrategies, resolutionRecommendation
Risk: Public + sensitive data → Confirmed Exposure / High
```

### 3. Kubernetes Pod Running Vulnerable Image

```
1. wiz_search: "Find Kubernetes pods running images with critical vulnerabilities"
   → returns pod entities, image names, CVE details, cluster context
2. get_issues: filter cloud_platforms=[EKS,GKE,AKS,Kubernetes], entity_types=[KUBERNETES_POD], severity=[CRITICAL]
3. wiz_search with fetchKubernetes=true for pod-to-node-to-cluster path
Risk: Critical CVE + running in production → High
```

### 4. Cloud Runtime Threat Triage

```
1. get_threats: filter severity=[CRITICAL,HIGH], status=[OPEN,IN_PROGRESS], created_after=<24h_ago>
   → returns threat IDs, cloudAccounts, detections (rule matches), insights (scores), cloudEventGroups (timelines)
2. get_issue_data_by_id(threat_id):
   → threatDetectionDetails with full event timeline, detection descriptions, insight scores
3. wiz_search: "Find exposed resources related to <affected_entity_id>"
   → blast radius: lateral movement paths, public exposures, Kubernetes paths
Risk: Suspicious/Malicious depending on detection confidence and exposure
```

### 5. Toxic Combination Analysis

```
1. get_issues: filter type=[TOXIC_COMBINATION], severity=[CRITICAL,HIGH]
   → returns chained risk issues
2. get_issue_data_by_id(issue_id):
   → description explains the chain (exposure + vuln + privilege + sensitive data)
3. wiz_search with fetchLateralMovement=true on affected entity
Risk: Multi-factor toxic combination → Critical
```

### 6. Compliance Gap Assessment

```
1. ai_assistant_send_message: "Show me compliance gaps for CIS Azure Foundations"
   → conversational response with framework coverage
2. wiz_search: "List Azure resources failing CIS controls"
   → entity-level compliance findings
3. get_issues: filter by framework_category, severity, cloud_platforms=[Azure]
```
