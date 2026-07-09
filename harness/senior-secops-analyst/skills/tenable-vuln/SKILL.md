---
name: tenable-vuln
description: "Tenable vulnerability exposure and asset-risk investigation. Use for searching vulnerable assets, investigating web application vulns, internal device vulns, CVE exposure across assets, plugin/finding investigation, scan coverage validation, asset inventory review, remediation prioritization, and producing owner-ready remediation outputs"
compatibility: opencode
metadata:
  audience: senior-secops-analyst
  domain: secops
  edition: "2026.07"
  workflow: vulnerability-exposure-investigation
---

# Tenable Vulnerability & Asset Investigation

Tenable is a vulnerability exposure and asset-risk investigation platform. Use Tenable findings to search and investigate vulnerable assets, web application findings, internal device vulnerabilities, scan coverage gaps, and remediation priority.

### Discovery Workflow

1. List all connected MCP servers and their tools.
2. Search for any `tenable` prefixed tools.
3. If tools exist, capture: name, purpose, required inputs, optional inputs, returned fields, limits.
4. If no Tenable MCP tools exist, **document the gap explicitly** and use the fallback workflows described below.
5. **Never invent** Tenable tool names, parameters, output fields, or capabilities.

### Gap Status

| Component | Status | Detail |
|---|---|---|
| Tenable MCP Server | **NOT CONFIGURED** | No `tenable` server in harness `mcp.json` or project `mcps.jsonc` |
| Tenable MCP Tools | **NOT AVAILABLE** | Zero Tenable-prefixed tools in the connected MCP ecosystem |
| Fallback: Tenable API | Manual | Use Tenable REST API (`https://cloud.tenable.com/api`) with API keys |
| Fallback: CSV Export | Manual | Export Tenable findings to CSV/JSON and parse with structured tools |

## When to Use

Use Tenable when the task involves:

- Vulnerable asset search by hostname, IP, subnet, web app, domain, or tag
- Web application vulnerability findings (injection, XSS, SSRF, auth bypass, file upload, access control, crypto/TLS, sensitive data exposure, outdated frameworks)
- Internal host/device vulnerabilities (OS, service, port, software, package)
- CVE exposure across assets (affected hosts, services, plugins, first/last seen)
- Plugin/finding investigation (plugin ID, plugin name, output, evidence)
- Asset inventory review (hostname, FQDN, IP, MAC, OS, owner, environment, last scanned)
- Scan coverage validation (credentialed vs uncredentialed, stale scans, missing agents)
- Remediation prioritization (severity, exploitability, VPR, exposure, asset criticality, age)
- Vulnerability report generation for asset owners
- Owner/team remediation mapping for operational handoff

## When Not to Use

Do not use Tenable as primary when:

- The task is CTI, actor, campaign, or threat intelligence (use Cyble CTI)
- The task is brand/credential leak monitoring (use Cyble)
- The task is cloud attack path, toxic combination, or cloud identity context (use Wiz)
- The task is endpoint behavior, process telemetry, or EDR investigation (use Defender/EDR)
- The task is raw log, timeline, or SIEM investigation (use Elastic, Splunk, CommandZero)
- The task is source-code security review (use SAST/code review tools)
- The task is only a CVE definition lookup with no asset context (use NVD, CVE API)
- The task is malware analysis, sandbox detonation, or reverse engineering
- The task is phishing email analysis (use phishing/email investigation tools)

## Tenable MCP Tool Mapping

Since zero Tenable MCP tools are connected, every workflow is marked with its gap and fallback.

| Workflow | Entity Type | Tenable MCP Tool | Status | Fallback |
|---|---|---|---|---|
| Asset search | hostname, FQDN, IP, subnet, asset ID | — | **Not exposed** | Tenable REST API: `GET /api/v2/assets` or CSV export via Tenable UI |
| Asset detail | asset ID | — | **Not exposed** | Tenable REST API: `GET /api/v2/assets/:id` |
| Vulnerability search | CVE, plugin ID, plugin name | — | **Not exposed** | Tenable REST API: `GET /workbenches/vulnerabilities` or `POST /analysis` |
| Web application findings | URL, domain, hostname, web app | — | **Not exposed** | Tenable REST API: `GET /was/v2/vulnerabilities` (Web App Scanning) |
| Internal device findings | hostname, IP, subnet, asset group | — | **Not exposed** | Tenable REST API: `GET /api/v2/assets` + `POST /analysis` with filters |
| CVE/plugin lookup | CVE, plugin ID | — | **Not exposed** | Tenable REST API: `GET /workbenches/vulnerabilities/:plugin_id/vulnerabilities` |
| Scan result lookup | scan ID | — | **Not exposed** | Tenable REST API: `GET /scans/:scan_id` or `GET /api/v2/scans` |
| Asset tags/groups/owners | tag, asset group | — | **Not exposed** | Tenable REST API: `GET /tags/values` or CSV export with tag columns |
| Asset exports | CSV/JSON export of findings | — | **Not exposed** | Tenable REST API: `POST /vulns/export` + `GET /vulns/export/:file_id/status` + `GET /vulns/export/:file_id/download` |
| Scan management | scan ID | — | **Not exposed** | Tenable REST API: `POST /scans/:scan_id/launch` (do not launch without approval) |
| Remediation/export/report | findings, assets | — | **Not exposed** | Tenable UI reports or API export, then parse manually |
| Web App Scanning config | web app, scan policy | — | **Not exposed** | Tenable WAS API or UI |

### Entity Types Supported

These entity types are natively supported by Tenable's data model. Map entities to appropriate API endpoints or export columns:

| Entity Type | Tenable Source | Tenable Field / API Filter |
|---|---|---|
| hostname | Asset inventory, scan results | `hostname`, `dnsName`, `netbiosName` |
| FQDN | Asset inventory, scan results | `fqdns`, `dnsName` |
| IP | Asset inventory, scan results | `ipv4`, `ipv6` |
| MAC | Asset inventory | `macAddress` |
| subnet | Asset inventory, scan target | `networkId`, `ipv4` prefix filtering |
| asset ID | Asset inventory, vuln results | `id` (UUID), `agentUuid` |
| scan ID | Scan results | `id` (scan instance), `scheduleId` |
| plugin ID | Vulnerability findings | `plugin.id`, `pluginID` |
| plugin name | Vulnerability findings | `plugin.name` |
| CVE | Vulnerability findings | `plugin.cve[]` |
| severity | Vulnerability findings | `severity` (Info/Low/Medium/High/Critical) |
| VPR score | Vulnerability findings | `plugin.vprScore`, `plugin.vprContext` |
| CVSS score | Vulnerability findings | `plugin.cvss3_base_score`, `plugin.cvss2_base_score` |
| port | Vulnerability findings | `port.port`, `port.protocol`, `port.service` |
| protocol | Vulnerability findings | `port.protocol` (tcp/udp) |
| service | Vulnerability findings | `port.service`, `plugin.output` |
| OS | Asset inventory | `operatingSystem[]`, `osCPE` |
| software/package | Plugin output, asset installed software | `plugin.output`, `installedSoftware` |
| tag | Asset inventory | `tags[]`, `/tags/values` API |
| asset group | Asset inventory | Legacy grouping via `networkId` or tags |
| owner/team | Asset inventory / custom attributes | `owner`, custom fields (varies by deployment) |
| business unit | Asset inventory / custom attributes | Custom fields (varies by deployment) |
| environment | Asset inventory / tags | Tag-based (`env:prod`, `env:dev`) |
| web app / URL | Web App Scanning | WAS API: domain, target |
| credential status | Scan results | `hasCredentialedScan`, `authenticationStatus` |
| agent status | Asset inventory | `agentName`, `sources[]` |
| last scanned | Asset inventory, scan results | `lastAuthenticatedScanDate`, `lastScanDate` |
| first seen | Vulnerability findings | `firstSeen` |
| last seen | Vulnerability findings | `lastSeen` |
| last fixed | Vulnerability findings | `lastFixed` |

### Web App Scanning (WAS) Specific

| Entity Type | Tenable Source | Field |
|---|---|---|
| web app / target URL | WAS | `target` domain/URL |
| HTTP path / endpoint | WAS findings | `path`, `url` |
| HTTP method | WAS findings | `method` |
| request/response evidence | WAS findings | `request`, `response` |
| parameter | WAS findings | `parameter` |
| authentication context | WAS scan config | `authentication` settings in scan policy |
| vulnerability class | WAS plugin | OWASP category, plugin family |

## Investigation Workflow

### Phase 1: Intake — Classify the Case

Identify the case type:

| Case Type | Primary Entity | Scope | Expected Output |
|---|---|---|---|
| Web application vulnerability search | URL, domain, web app | one web app, group of URLs, domain | affected endpoints, exploitation risk, remediation |
| Internal device vulnerability search | hostname, IP, subnet | one host, subnet, asset group, business unit | affected services, CVEs, patch gaps, risk |
| Asset exposure search | hostname, IP, FQDN, MAC | one asset, asset group | asset context, scan coverage, owner, vulns |
| CVE exposure search | CVE | cross-asset | affected assets, severity, patches, exposure |
| Plugin/finding investigation | plugin ID, plugin name | one finding | evidence, affected assets, fix, false-positive analysis |
| Scan coverage validation | subnet, asset group, tag | environment scope | scan gaps, credential gaps, stale assets |
| Remediation planning | asset group, business unit, owner | owner scope | prioritized findings, owner assignments, SLAs |

### Phase 2: Obtain Tenable Data via Fallback

Since no Tenable MCP tools are available, obtain data through one of these fallback mechanisms:

#### Option A: Tenable REST API (Preferred)

Authenticate with Tenable API keys:

```bash
export TENABLE_ACCESS_KEY="..."
export TENABLE_SECRET_KEY="..."
```

Core endpoints:

| Purpose | Endpoint | Method |
|---|---|---|
| List assets | `/api/v2/assets` | GET |
| Asset detail | `/api/v2/assets/:id` | GET |
| Vulnerability export (bulk) | `/vulns/export` | POST |
| Export status | `/vulns/export/:file_id/status` | GET |
| Export download | `/vulns/export/:file_id/download` | GET |
| Asset export (bulk) | `/assets/export` | POST |
| Workbench vulnerabilities | `/workbenches/vulnerabilities` | GET |
| Analysis (filtered query) | `/analysis` | POST |
| Web App Scanning findings | `/was/v2/vulnerabilities` | GET |
| Scans list | `/api/v2/scans` | GET |
| Scan detail | `/scans/:scan_id` | GET |
| Tags | `/tags/values` | GET |

#### Option B: CSV/JSON Export

1. Export findings from Tenable UI: **Vulnerabilities → Export** (CSV or Nessus format).
2. Use `cli-log-json` skill to parse and iterate CSV/JSON exports.
3. Filter and pivot exported data with `jq`, `mlr` (Miller), or Python/polars.

#### Option C: Tenable.sc (Security Center) API

For on-prem deployments, use Tenable.sc REST API at `https://<sc-host>/rest/`.

### Phase 3: Collect Asset Context

For each affected asset, capture:

| Field | Source | Priority |
|---|---|---|
| Asset ID | Asset export / API | Required |
| Hostname / FQDN / IP | Asset inventory | Required |
| Web app URL (if applicable) | WAS findings or host context | Required for web apps |
| OS / platform | Asset inventory `operatingSystem` | High |
| Owner / team | Asset tags, custom fields | High |
| Business unit | Custom fields, tags | High |
| Environment | Tags (`env:prod`, `env:dev`) | High |
| Tags / groups | Tags API | Medium |
| Last seen | Asset inventory `lastSeen` | Medium |
| Last scanned | Asset inventory `lastScanDate` | High |
| Scan type | `lastAuthenticatedScanDate` vs `lastScanDate` | High |
| Credentialed scan status | `hasCredentialedScan` | High |
| Agent / scanner source | `sources[]`, `agentName` | Medium |
| Internet-facing / exposure | Asset tags, subnet context, Wiz correlation | High |
| Cloud context | Wiz correlation (if cloud asset) | Optional |

**Scan coverage red flags:**
- `lastScanDate` is > 30 days old → stale scan data
- `hasCredentialedScan` is false → uncredentialed scan, higher false-negative risk
- No agent or scanner source → discovery scan only, limited depth

### Phase 4: Collect Vulnerability Context

For each finding, capture:

| Field | Source | Priority |
|---|---|---|
| Finding / plugin ID | Vulnerability export, plugin field | Required |
| Plugin name | Vulnerability export | Required |
| CVE(s) | `plugin.cve[]` | Required |
| Severity | `severity` (Info/Low/Medium/High/Critical) | Required |
| VPR score | `plugin.vprScore` (if Tenable.io) | High |
| CVSS v3 / v2 | `plugin.cvss3_base_score`, `cvss2_base_score` | High |
| EPSS | External: https://www.first.org/epss | Medium |
| CISA KEV | External: https://www.cisa.gov/known-exploited-vulnerabilities-catalog | High |
| Exploit availability | External: GitHub search, Exa, Metasploit | Medium |
| First seen | `firstSeen` | High |
| Last seen | `lastSeen` | High |
| Last fixed | `lastFixed` (if available) | Medium |
| Affected port / protocol / service | `port.port`, `port.protocol`, `port.service` | Required for network vulns |
| Web path / URL / parameter | WAS findings or plugin output | Required for web app vulns |
| Plugin output / evidence | `plugin.output` | Required |
| Recommended solution | `plugin.solution` | Required |
| Patch / fix availability | Plugin solution field, vendor advisory | High |
| Exploit maturity | CISA KEV + public exploit search | Medium |
| Affected software / version | Plugin output, `installedSoftware` | High |

### Phase 5: Validate and Correlate

Use other sources only when needed:

| Cross-Reference | Tool / Source | When to Use |
|---|---|---|
| Cloud context, attack paths, owner mapping | Wiz | When asset is a cloud workload, identity, or has cloud exposure |
| Endpoint runtime evidence | Defender/EDR | When verifying if exploit payload was executed |
| Network / log validation | Elastic, Splunk, CommandZero | When validating exploitability through SIEM evidence |
| Ownership and remediation tracking | Jira (Atlassian MCP) | When assigning Jira tickets for remediation |
| External exploitation context | Cyble CTI, CISA KEV | When confirming active exploitation in the wild |
| Web app testing | Playwright / CloakBrowser / Burp | Only if explicitly approved for validation |
| CVE definition and advisory | NVD, vendor advisories | When plugin output lacks CVE detail |

**Do not perform intrusive validation without explicit approval.**
**Do not exploit, scan, fuzz, or send payloads without authorization.**

### Phase 6: Risk Decision

Produce one of these verdicts for each finding:

| Verdict | Criteria |
|---|---|
| **Confirmed vulnerable** | Finding present, scan is credentialed and recent, evidence confirms, fix not applied |
| **Likely vulnerable** | Finding present, but scan is uncredentialed or stale; evidence consistent with vulnerability |
| **Needs validation** | Finding present but evidence is inconsistent, scan data is stale, or conflicting signals |
| **Fixed / no longer observed** | Finding was seen before, not in latest scan, and fix dates align |
| **False positive suspected** | Finding has characteristics of false positive: uncredentialed scan, non-standard port, version-only detection with patch backport |
| **Out of scope** | Affected asset is not in scope for this investigation |

### Phase 7: Remediation Planning

For each confirmed or likely vulnerable finding:

1. **Recommend exact remediation** from plugin solution or vendor advisory.
2. **Identify owner/team** from asset context (tags, custom fields, Wiz project).
3. **Prioritize** by:
   - Severity (Critical > High > Medium > Low > Info)
   - Exploitability (CISA KEV > public exploit available > no known exploit)
   - VPR score (if available, higher = higher priority)
   - Internet exposure (internet-facing > internal only)
   - Asset criticality (domain controller > server > workstation)
   - Business owner / revenue impact
   - Vulnerable service reachability
   - Patch availability (patch available > workaround only > no fix)
   - Age of finding (older = accumulating risk)
   - Recurring/reopened status
   - Compensating controls (WAF, segmentation, MFA)
4. **Provide validation steps** to confirm remediation.
5. **Do not perform destructive or intrusive validation without explicit approval.**

## Web Application Review Rules

For web application findings, always capture if available:

| Field | Source | Priority |
|---|---|---|
| Affected URL / path | WAS findings `path`, `url` | Required |
| HTTP method | WAS findings `method` | Required |
| Parameter / input | WAS findings `parameter` | High |
| Request / response evidence | WAS findings `request`, `response` | Required |
| Authentication requirement | WAS scan config, plugin context | High |
| User role / context | WAS scan config | Medium |
| Vulnerability class | WAS plugin family, OWASP mapping | Required |
| Exploitability | Plugin severity + exploit search | High |
| Sensitive data impact | Plugin output (data exposed) | High |
| WAF / proxy exposure | Plugin context, asset context | Medium |
| Remediation owner | Asset tags, Wiz project | Required |

**Prioritize these web application vulnerability classes:**

1. Auth bypass / broken authentication
2. Access control / privilege escalation
3. Injection (SQL, command, LDAP, template, NoSQL)
4. SSRF (Server-Side Request Forgery)
5. RCE / arbitrary code execution
6. Arbitrary file upload
7. Path traversal / LFI
8. Sensitive data exposure (PII, credentials, tokens, secrets)
9. Weak TLS / crypto (deprecated protocols, weak ciphers, expired certs)
10. Session / cookie issues (missing flags, predictable tokens, fixation)
11. Exposed admin panels / management interfaces
12. Outdated vulnerable frameworks (known RCE CVEs in framework version)

**Separate scan finding from confirmed exploitability.** A web app finding is a detection, not a proof of exploit. Confirm:
- Is the finding from an authenticated scan?
- Is the finding from an active (exploit-based) check or passive detection?
- Is there request/response evidence?
- Is the affected endpoint reachable?
- Is there a WAF or compensating control?

## Internal Device Review Rules

For internal device findings, always capture if available:

| Field | Source | Priority |
|---|---|---|
| Hostname / IP | Asset inventory | Required |
| OS / version | Asset inventory `operatingSystem` | Required |
| Port / protocol / service | Vulnerability finding `port` | Required |
| Software / package version | Plugin output, `installedSoftware` | High |
| Credentialed scan status | `hasCredentialedScan` | High |
| Domain role | Asset context, plugin output | Medium |
| Environment | Tags (`env:prod`) | High |
| Owner / team | Asset tags, custom fields | High |
| Business criticality | Tags, custom fields, Wiz project | High |
| Lateral movement relevance | Vulnerability type, service exposure | Medium |
| Exploitability | CISA KEV, EPSS, public exploit | High |
| Patch / remediation | Plugin solution, vendor advisory | Required |

**Prioritize these internal device vulnerability classes and asset types:**

1. Domain controllers (any critical finding)
2. Identity infrastructure (AD FS, Entra Connect, LDAP, Kerberos, NTLM)
3. VPN, firewall, security appliances (critical findings)
4. Internet-facing internal services (override internal-only risk)
5. EOL OS / unsupported software (Windows Server 2012, 2008, EOL Linux)
6. Remotely exploitable critical CVEs (CVSS >9.0, network attack vector)
7. Known exploited vulnerabilities (CISA KEV)
8. Missing EDR / agent coverage combined with critical vulns
9. Exposed admin services: RDP (3389), SSH (22), SMB (445), WinRM (5985/5986), SQL (1433, 3306, 5432), HTTP admin panels (8443, 8080, 9090)

**Internal is not safe by default.** A critical CVE on an internal domain controller is higher priority than a low-severity finding on an internet-facing web server. Do not downgrade a finding only because it is internal.

## Evidence Model

Every finding must include these mandatory fields:

| Field | Source | Required |
|---|---|---|
| Tenable tool / export used | API endpoint or export file | Yes |
| Entity type | Asset, WAS target, or plugin | Yes |
| Asset ID | Asset inventory or export | Yes (if available) |
| Hostname / IP / URL | Asset inventory or WAS | Yes |
| Finding / plugin ID | Vulnerability data | Yes |
| Plugin name | Vulnerability data | Yes |
| CVE(s) | Plugin `cve[]` or external lookup | Yes (if applicable) |
| Severity | Severity field | Yes |
| VPR / CVSS / EPSS | Plugin scores + external | If available |
| First seen / last seen | Finding timestamps | Yes |
| Port / service / path | Port + WAS path | For network/web vulns |
| Plugin output / evidence | `plugin.output` | Yes |
| Scan source | `sources[]`, scan type | Yes |
| Credentialed status | `hasCredentialedScan` | Yes |
| Confidence | Analyst assessment | Yes |
| Validation status | Corroborated / unvalidated | Yes |
| Recommended fix | `plugin.solution` + vendor advisory | Yes |
| Owner / team | Asset context | Yes |
| Evidence gap | What data is missing | If applicable |

**Redact sensitive values.** Never expose passwords, tokens, API keys, session cookies, or PII from plugin output. Replace with `[REDACTED]` and note the data type.

## Output Schema

### Executive Summary

```
Case type:                web-app-vuln / internal-device-vuln / asset-exposure / cve-exposure / plugin-investigation / scan-coverage / remediation-planning
Risk decision:            confirmed-vulnerable / likely-vulnerable / needs-validation / fixed / false-positive-suspected / out-of-scope
Confidence:               High / Medium / Low
Scope:                    [one asset / asset group / subnet / domain / web app / environment / business unit]
Affected assets:          [count and summary]
Critical findings:        [count and top items]
Recommended priority:     P1-Critical / P2-High / P3-Medium / P4-Low
Owner/team:               [primary owner]
Immediate action:         [one-line summary]
Data source:              [API endpoint, export file, or gap note]
```

### Tenable Findings (Tabular)

```
Finding ID | Asset | Type | Severity | VPR/CVSS | CVE | Port/Path | First Seen | Last Seen | Owner | Status
```

### Asset Context (Tabular)

```
Asset ID | Hostname/IP/URL | OS | Environment | Owner | Last Seen | Last Scanned | Scan Type | Tags | Credentialed | Sources
```

### Vulnerability Evidence (Tabular)

```
Finding ID | Evidence Summary | Exploitability | Exposure | Business Impact | Confidence | Evidence Gap
```

### Risk Rationale

Separate into:

- **Tenable-reported finding:** Verbatim plugin output and metadata
- **Confirmed asset context:** Independently verified from asset inventory
- **Internal validation:** Corroborated by other tools (Wiz, Defender, SIEM)
- **Analyst inference:** Conclusions drawn from multiple data points
- **Unknowns / gaps:** What could not be verified and why

### Scan Coverage Assessment

```
Scope:                    [environment / subnet / asset group]
Total assets in scope:    [count]
Assets with recent scan:  [count and %]
Assets with credentialed scan: [count and %]
Stale scans (>30d):       [count]
Assets without agent:     [count]
Coverage gaps:            [subnet, asset group, environment gaps]
```

### Recommended Actions

```
Immediate mitigation:     [stop-the-bleeding action, apply now]
Permanent remediation:    [long-term fix]
Validation steps:         [how to confirm remediation]
Owner/team:               [who is responsible]
Suggested SLA:            [by severity and exploitability]
Follow-up scan:           [when to re-scan]
Jira-ready summary:       [one paragraph for ticket creation]
```

### Jira-Ready Remediation Format

```
Title:                    [action-oriented, e.g. "Patch CVE-2024-XXXX on prod-web-01 (port 443)"]
Severity:                 Critical / High / Medium / Low
Asset(s):                 [hostname / IP / URL with asset ID]
CVE / plugin:             [CVE-YYYY-XXXXX / Plugin ID XXXXX]
Evidence:                 [plugin output summary, affected service/version]
Risk:                     [exploitability + exposure + business impact in 1-2 sentences]
Required fix:             [exact steps: patch version, config change, mitigation]
Validation:               [how to verify the fix: re-scan, manual check, script]
Owner/team:               [name or team]
Suggested SLA:            [24h / 7d / 14d / 30d]
Tenable ticket ref:       [plugin ID or finding reference]
```

## Guardrails

- **Never invent** Tenable MCP tool names, parameters, output fields, or capabilities. Only use tools confirmed as connected.
- **Never treat** a Tenable finding as exploitable without checking exposure, service context, scan type, and evidence.
- **Never downgrade** a critical finding only because it is internal. Internal domain controllers with critical CVEs are high priority.
- **Never mark** a finding as fixed unless scan evidence or validation supports it (re-scan after patch, version check, config verification).
- **Never expose** secrets, tokens, passwords, API keys, session cookies, or PII from plugin output. Redact with `[REDACTED]` and note data type.
- **Never perform** intrusive exploitation, active scanning, payload delivery, fuzzing, or destructive validation without explicit written approval.
- **Never modify** assets, scan configs, credentials, target lists, scan policies, or remediation state without explicit approval.
- **Always state** scan coverage gaps, credential gaps, stale scan data, and false-positive uncertainty.
- **Always distinguish** between Tenable-reported data, externally validated evidence, and analyst inference.
- **Always document** that no Tenable MCP server is connected and describe the fallback used.
- **Never call** Wiz, Defender, Cyble, or other tools unless the cross-correlation is explicitly needed for the investigation.
- **Do not launch** Tenable scans without approval. Review existing scan results first.

## Examples

### Example 1: Search All Assets Affected by a CVE

**Case:** Determine which assets are affected by CVE-2024-XXXXX and prioritize remediation.

1. **Classify:** CVE exposure search.
2. **Entity:** CVE-2024-XXXXX.
3. **Tool selection:** No Tenable MCP tools available.
   - Fallback: Query Tenable API `POST /analysis` with CVE filter, or use exported vulnerability CSV filtered by CVE.
   - Cross-reference: Check CISA KEV for exploitation status; query NVD for CVSS and affected products.
4. **Collect:**
   - List all affected assets (hostname, IP, asset ID).
   - For each asset: OS, environment, owner, last scanned, credentialed status.
   - Per asset: port/service affected, plugin output, first seen, last seen.
   - External: CISA KEV status, EPSS score, public exploit availability.
5. **Validate:** Correlate affected assets with Wiz for cloud context and internet exposure. Check internal asset inventory for business criticality.
6. **Risk decision:** Confirmed vulnerable if asset is affected by the CVE with credentialed scan evidence. Priority by exposure + asset criticality + CISA KEV.
7. **Remediation:** Produce Jira-ready tickets per asset/owner with patch guidance.

### Example 2: Search Vulnerabilities for One Hostname/IP

**Case:** Security operations needs all open vulnerabilities for host `prod-db-01.internal`.

1. **Classify:** Internal device vulnerability search.
2. **Entity:** `prod-db-01.internal` / IP `10.x.x.x`.
3. **Tool selection:**
   - Fallback: Query Tenable API `POST /analysis` with asset filter, or `GET /api/v2/assets` to find asset ID first, then fetch vulnerabilities.
4. **Collect:**
   - Asset context: hostname, IP, OS, environment, owner, tags, last scanned, credentialed status.
   - All open findings grouped by severity.
   - Per finding: plugin ID, plugin name, CVE, severity, VPR/CVSS, port/service, first/last seen, plugin output, solution.
5. **Validate:** Check if asset is internet-facing (Wiz or network context). Check if credentialed scan was used. Check for stale scan data.
6. **Risk decision:** For each finding, classify as confirmed vulnerable, likely vulnerable, or false positive suspected.
7. **Remediation:** Prioritize by severity + exploitability. Produce owner-ready report with fix steps.

### Example 3: Search Critical Web Application Findings for a Domain

**Case:** Review all critical/high web application findings for `app.example.com`.

1. **Classify:** Web application vulnerability search.
2. **Entity:** Domain `app.example.com`.
3. **Tool selection:**
   - Fallback: Query Tenable WAS API `GET /was/v2/vulnerabilities` with domain filter, or use WAS export.
4. **Collect:**
   - All critical and high findings for the domain.
   - Per finding: URL/path, HTTP method, parameter, request/response evidence, vulnerability class, plugin ID, plugin name, severity.
   - Scan context: authenticated scan? credentialed? which scan policy?
5. **Validate:** Check if findings are from active (exploit) checks or passive detection. Verify endpoint reachability. Check for WAF or compensating controls. Cross-reference with Burp/manual testing if available.
6. **Risk decision:** Separate confirmed exploitable from passive detections. Prioritize auth bypass, injection, SSRF, RCE, file upload, sensitive data exposure.
7. **Remediation:** Produce per-finding remediation guidance. Assign to web app owner. Recommend re-test after fix.

### Example 4: Investigate an Exposed Admin Panel Finding

**Case:** Tenable reported an exposed admin panel (`/admin`) on `https://app.example.com:8443`.

1. **Classify:** Web application vulnerability search (WAS finding investigation).
2. **Entity:** URL `https://app.example.com:8443/admin`.
3. **Tool selection:**
   - Fallback: WAS API for finding details, or WAS export filtered by URL.
4. **Collect:**
   - Finding details: plugin output, request/response evidence, authentication requirement.
   - Admin panel type: framework-specific (e.g., Django admin, Tomcat manager, phpMyAdmin, Grafana).
   - Authentication: is auth required? default credentials? accessible anonymously?
   - Exposure: is this internet-facing? Wiz or network context.
   - Asset context: owner, environment, business criticality.
5. **Validate:** Browser-based investigation (CloakBrowser/Playwright) only if explicitly approved and read-only. Check if authentication is enforced. Check if WAF rules block access.
6. **Risk decision:** Confirmed vulnerable if admin panel is exposed without auth. High risk if internet-facing. Medium if internal-only but accessible to non-admin users.
7. **Remediation:** Restrict access (IP whitelist, VPN-only, authentication enforcement), disable directory listing, apply strong authentication (MFA).

### Example 5: Prioritize Internal Devices with Critical Remotely Exploitable CVEs

**Case:** Identify and prioritize all internal devices with critical (CVSS >9.0) remotely exploitable CVEs.

1. **Classify:** Internal device vulnerability search + remediation planning.
2. **Entity:** Cross-asset, severity=Critical, exploitability=Network.
3. **Tool selection:**
   - Fallback: Tenable API `POST /analysis` with severity filter, or vulnerability export filtered by severity + network attack vector.
4. **Collect:**
   - All internal assets with critical CVEs and network-exploitable (CVSS vector AV:N).
   - Per finding: CVE, plugin, CVSS, VPR, CISA KEV status, affected service/port, exploit availability.
   - Per asset: hostname, OS, environment, owner, credentialed scan status, domain role, internet exposure.
5. **Validate:** Check CISA KEV for active exploitation. Search for public exploit PoCs. Correlate with Wiz for cloud context and exposure. Check EDR/agent coverage.
6. **Risk decision:** Prioritize by CISA KEV + internet-facing + asset criticality. Domain controllers, VPN/firewalls, internet-facing services first.
7. **Remediation:** Produce prioritized list with owner mapping and Jira-ready tickets. Highest priority: patch immediately. If patch unavailable: apply mitigation (disable service, restrict access, WAF/IPS rule).

### Example 6: Validate Whether a Finding Is Stale or Still Observed

**Case:** A critical CVE finding from 90 days ago on `web-server-03`. Has it been fixed?

1. **Classify:** Plugin/finding investigation + staleness check.
2. **Entity:** Plugin ID XXXXX on asset `web-server-03`.
3. **Tool selection:**
   - Fallback: Tenable API to find latest scan data for the asset. Compare `lastSeen` with current date. Check if `lastFixed` is populated.
4. **Collect:**
   - Latest scan for the asset: scan date, finding present?
   - Finding history: first seen date, last seen date, last fixed date.
   - Asset change history: was the asset patched? Rebuilt? Decommissioned?
   - Plugin output: latest evidence vs historical evidence.
5. **Validate:** If last seen > 30 days and no recent scan, mark as stale. If last seen is recent, check if finding changed (port closed, version updated, plugin output changed). Check Jira/change management for patch records.
6. **Risk decision:**
   - **Fixed** if last scan shows finding gone and fix date aligns with change records.
   - **Still vulnerable** if recent scan still shows finding.
   - **Stale** if no recent scan and cannot confirm status.
   - **False positive** if evidence was always weak (version-only detection with patched backport).
7. **Remediation:** If still vulnerable, prioritize patch. If stale, request re-scan. If fixed, close ticket.

### Example 7: Produce Jira-Ready Remediation for a Web App Finding

**Case:** WAS finding: SQL injection in `https://app.example.com/api/search?q=` (Critical).

```
Title:                    Fix SQL Injection in /api/search endpoint (Critical)
Severity:                 Critical
Asset(s):                 https://app.example.com/api/search (WAS target ID XXXXX)
CVE / plugin:             Plugin ID 112345 / OWASP A03:2021 Injection
Evidence:                 Parameter 'q' in GET /api/search reflects SQL error messages.
                          Request: GET /api/search?q=test' OR '1'='1
                          Response: SQL syntax error in MySQL 8.0.x
Risk:                     Unauthenticated SQL injection on production API endpoint.
                          Attacker can extract database contents, bypass authentication.
Required fix:             1. Use parameterized queries / prepared statements for all SQL
                          2. Input validation on 'q' parameter (allowlist alphanumeric)
                          3. Least-privilege database user for application
                          4. Enable WAF SQL injection rules as compensating control
Validation:               1. Re-scan with Tenable WAS after fix
                          2. Manual test with sqlmap (read-only, approved)
                          3. Review code for parameterized queries in search handler
Owner/team:               platform-engineering (from asset tags)
Suggested SLA:            24 hours
Tenable ticket ref:       Plugin ID 112345 on WAS target XXXXX
```

### Example 8: Produce Jira-Ready Remediation for an Internal Device Finding

**Case:** Critical RCE CVE on internal domain controller `dc-prod-01` (SMB port 445).

```
Title:                    Patch Critical RCE CVE-2024-XXXXX on dc-prod-01 (port 445)
Severity:                 Critical
Asset(s):                 dc-prod-01 (10.x.x.x, Asset ID XXXXX)
CVE / plugin:             CVE-2024-XXXXX / Plugin ID 198765
Evidence:                 Windows Server 2019 Build 17763, SMBv3 on port 445.
                          CISA KEV: YES - actively exploited.
                          CVSS: 9.8 (AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H)
Risk:                     Domain controller with critical RCE on SMB. Actively exploited
                          per CISA KEV. Network-exploitable without authentication.
                          Compromise leads to full domain takeover.
Required fix:             1. Apply Microsoft security patch KBXXXXXXX immediately
                          2. Verify SMBv3 patch version after reboot
                          3. If immediate patching impossible:
                             - Enable SMB signing (requires SMBv3)
                             - Restrict SMB (445) to domain-joined hosts only
                             - Enable IPS/IDS rules for CVE-2024-XXXXX
Validation:               1. Re-scan dc-prod-01 after patching
                          2. Verify Windows Update patch KBXXXXXXX installed
                          3. Check SMB version with: Get-SmbConnection
                          4. Verify finding gone from next Tenable scan
Owner/team:               domain-admins / infra-windows (from asset tags)
Suggested SLA:            24 hours (CISA KEV, domain controller)
Tenable ticket ref:       Plugin ID 198765 on Asset ID XXXXX
```

## Fallback: Working Without Tenable MCP

When Tenable is unavailable via MCP and API is not accessible:

1. **State the gap:** "No Tenable MCP server is configured. Tenable API is also not accessible. Investigation is based on [source]."
2. **Use available exports:** If CSV/JSON exports were provided, parse with structured tools (jq, polars, python). Use `cli-log-json` skill.
3. **Use alternative vulnerability sources:**
   - Wiz MCP for cloud workload vulnerabilities (CVE, package, image)
   - NVD CVE API for vulnerability definitions
   - CISA KEV for exploitation context
   - EPSS for exploit probability
4. **Mark gaps:**
   - No Tenable asset inventory → no host-level context
   - No Tenable plugin output → no detailed evidence
   - No Tenable scan data → no first/last seen, no scan coverage
5. **Recommend setup:** Add Tenable MCP server configuration if available, or use Tenable REST API with API keys.
6. **Document what Tenable would have provided** that the alternative cannot: scan context, asset-level correlation, plugin evidence, historical finding data, credentialed scan status.
