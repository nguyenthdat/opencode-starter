---
name: cyble-cti
description: "External Threat Intelligence + Digital Risk Protection + Brand Protection + Credential Leak + Executive Monitoring + Attack Surface Management investigation via Cyble Vision. Use for external exposure, credential leaks, stealer logs, brand abuse, executive risk, ASM findings, typosquat/homoglyph/phishing domains, dark web mentions, threat actor activity, campaign intelligence, vulnerability intelligence, third-party exposure, and broader CTI context. Not for purely internal endpoint/log triage unless there is an external intelligence or exposure angle."
compatibility: opencode
metadata:
  domain: secops
  audience: senior-secops-analyst
  edition: "2026.07"
---

# Cyble External Threat Intelligence & Digital Risk Investigation

Cyble Vision provides external cyber risk visibility across credential leaks, brand protection, executive monitoring, attack surface management, digital risk protection, vulnerability intelligence, and threat actor/campaign CTI. Treat Cyble as a broad external cyber risk and intelligence platform, not a simple IT CTI lookup tool.

Default to read-only retrieval. Updating alerts, adding comments, scheduling scans, adding or deleting monitored entities, and takedown-related operations are persistent mutations and require explicit user approval immediately before execution.

## When to Use

Use Cyble when the case involves:

- Leaked credentials, stealer logs, paste leaks, dark web/forum/Telegram exposure
- Brand protection: typosquat, homoglyph, fake domains, phishing pages, fake apps, fake social accounts, impersonation
- Executive monitoring: executive PII leaks, impersonation, VIP phishing, threat actor mentions
- Attack Surface Management: exposed assets, shadow IT, vulnerable internet-facing services, exposed APIs, admin panels, cloud exposure
- CTI: actors, campaigns, IoCs, TTPs, CVEs exploited in the wild
- Digital risk protection: sensitive data leaks, third-party exposure, source-code/secret exposure, fraud infrastructure
- Vulnerability intelligence: CVE details, exploit/PoC availability, affected software, MITRE ATT&CK mappings
- Ransomware intelligence: victim organizations, ransomware gang attribution, affected industries
- Third-party/vendor risk: vendor exposure scores, supply chain risk
- Takedown monitoring: status of submitted takedown requests

## When Not to Use

Do not use Cyble as the primary tool when:

- The investigation is purely internal endpoint/log/identity triage with no external exposure angle (use Command Zero, MDE, or Elastic instead)
- The task is only an IoC reputation check with no broader investigation (still may use Cyble, but route through the investigation workflow)
- Internal cloud posture assessment without external exposure (use Wiz instead)
- Internal email/phishing analysis focused on mailbox forensics (use MDO/Command Zero instead)

Cyble is a supporting intelligence source for internal investigations when external indicators are present. It should not replace SIEM, EDR, or cloud security tools for internal triage.

## MCP Tool Discovery Requirement

**Before using or documenting any Cyble capability, the agent MUST inspect the available Cyble MCP tools.** The Cyble MCP server (`cyble.vision`, binary: `cyble-mcp-server`) exposes 50 tools across 15 API domains. Tool names, parameters, and output fields are discovered programmatically. Never invent tool names, parameters, or capabilities. If the MCP server is unreachable or a tool is unavailable, document it as a gap.

### Discovery Workflow

1. List all available tools from the `cyble.vision` MCP server.
2. For each tool relevant to the case, capture: name, purpose, required inputs, optional inputs, returned fields.
3. Validate that required parameters exist before calling any tool.
4. If a capability area has no matching tool, document the gap and provide a fallback workflow.

## MCP Tool Mapping

Map each investigation type to the actual Cyble MCP tool. Tool names are exact as registered in the `cyble.vision` MCP server.

### Core CTI / IoC Intelligence

| Investigation Type | Entity Type | Cyble MCP Tool | Required Inputs | Key Output Fields | Notes / Gaps |
|---|---|---|---|---|---|
| IOC lookup (single/bulk) | IP, domain, URL, hash, email | `cyble_iocs_search_v4` | `ioc` (comma-separated, up to 100) | risk_rating, ioc_type, sources, threat_actors, malware_families, tags, first_seen, last_seen | Prefer V4 for bulk lookups. V3 supports CSV upload. |
| IOC lookup (legacy single) | IP, domain, URL, hash, email | `cyble_iocs_search_v2` | `ioc` (single value), `ioc_type` | Same as V4 minus bulk | Use V4 instead unless V2-specific fields needed. |
| IOC lookup (CSV bulk) | Multiple IOCs | `cyble_iocs_search_v3` | Multipart CSV upload (up to 100) | Same as V2/V4 | Use for CSV file uploads. |
| IOC filter discovery | — | `cyble_iocs_get_filters` | None | tags, sources, types, industries, countries, threat_actors, malware_families | Run before IOC search to validate filter values. |
| OT/ICS threat feed | IP | `cyble_otics_search` | `ip`, `industry` (optional) | threat_actor, malware_family, target_region, target_country, last_seen | Specialized for OT/ICS environments. |

### Credential Leaks / Stealer Logs / Breach Data

| Investigation Type | Entity Type | Cyble MCP Tool | Required Inputs | Key Output Fields | Notes / Gaps |
|---|---|---|---|---|---|
| Breach details | S3 key from alert | `cyble_alerts_get_breach_details` | `s3_key` | Breach data content | Use when an alert references a breach S3 key. |
| Compromised card check | Card number (12-19 digits) | `cyble_compromised_cards_check` | `card_no` | Found/not found, card_brand, bank info | For payment card compromise investigations. |
| Compromised cards by BIN | BIN (6-8 digits) | `cyble_compromised_cards_fetch_by_bin` | `bin` | Compromised card records | Paginated. Use for bulk card exposure analysis. |
| All compromised cards | — | `cyble_compromised_cards_fetch_all` | None (pagination params) | All compromised card records | Large dataset; use pagination. |
| BIN lookup | BIN (6-8 digits) | `cyble_compromised_cards_search_bin` | `bin` | Bank name, card brand | Preliminary BIN identification. |

**Gap: Stealer logs, credential dumps, paste leaks, dark web, Telegram exposure** — These are covered by the Cyble alerts system (`cyble_alerts_fetch`) with service filters for `darkweb`, `telegram`, `paste`, `stealer_logs`, etc. (40+ services available). There is no dedicated "search credential leaks" tool; credential intelligence surfaces through alerts. Use `cyble_alerts_list_services` to discover the exact service names available for credential-related data sources.

### Brand Protection / Digital Risk

| Investigation Type | Entity Type | Cyble MCP Tool | Required Inputs | Key Output Fields | Notes / Gaps |
|---|---|---|---|---|---|
| Negative/suspicious domain check | Domain | `cyble_negative_domains_check` | `domain` | Flagged status | Single domain check for typosquat/suspicious domains. |
| Negative domain search | Domain pattern, date range | `cyble_negative_domains_search` | `from_date` (optional), `page_size` | Paginated list of negative domains | Use to discover typosquat/homoglyph/phishing domains. |
| Brand/phishing alerts | Company UUID | `cyble_alerts_fetch` | `company_uuid`, `filters` (service, status, severity) | Alert data, source, entity, severity, timestamps | Filter by service (phishing, social_media, mobile_apps, etc.). |
| Alert services discovery | — | `cyble_alerts_list_services` | None | List of 40+ alert services | Run first to understand available brand protection services. |
| Botnet/botshield feed | Date range | `cyble_botshield_list_feed` | `feed_type` ("botfeed"), `from_date`/`to_date` (optional) | Malware family, feed records | Fraud infrastructure / botnet intelligence. |

**Gap: Fake mobile apps, fake social accounts** — These are surfaced through `cyble_alerts_fetch` with appropriate service filters (e.g., `mobile_apps`, `social_media`). No dedicated tool exists; the alerts system is the primary interface. Use `cyble_alerts_list_services` to discover available brand abuse services.

### Executive Monitoring

| Investigation Type | Entity Type | Cyble MCP Tool | Required Inputs | Key Output Fields | Notes / Gaps |
|---|---|---|---|---|---|
| Executive alerts (mentions, impersonation) | Company UUID | `cyble_exec_alerts_fetch` | `company_uuid` | service (executive_mention, executive_impersonation), severity, status, assignee, data_message | Services: "executive_mention", "executive_impersonation". |
| Update executive alert | Alert ID | `cyble_exec_alerts_update` | `alerts` (array, max 100) | Updated alert status/severity/assignee | Bulk update up to 100 alerts. |
| Comment on executive alert | Alert ID | `cyble_exec_alerts_add_comment` | `content` | Comment added | For collaboration and tracking. |

**Gap: Executive PII leak search, VIP phishing search** — These are surfaced through `cyble_exec_alerts_fetch`. There is no dedicated executive PII search tool. Broader credential leak context for executives should be correlated with `cyble_alerts_fetch` using credential-related service filters.

### Attack Surface Management

| Investigation Type | Entity Type | Cyble MCP Tool | Required Inputs | Key Output Fields | Notes / Gaps |
|---|---|---|---|---|---|
| ASM IP details | IP, company UUID | `cyble_asm_get_ip_details` | `company_uuid`, `ip` | Attack surface information for the IP | Company-scoped IP intelligence. |
| ASM CVE details | CVE | `cyble_asm_get_cve_details` | `cve` | CVSS scores, affected software | ASM-specific CVE endpoint. |
| System info | System ID | `cyble_alerts_get_system_info` | `system_id` | System metadata, configuration | Single system lookup. |
| System batch info | Multiple system IDs | `cyble_alerts_get_system_batch` | `system_ids` (array) | Batch system metadata | For bulk system lookups. |
| System autofill data | System ID, file_name | `cyble_alerts_get_system_autofill` | `system_id`, `type`, `file_name` | Autofill data/files | Discover exposed system data. |

**Gap: Exposed APIs, admin panels, cloud exposure, shadow IT** — These are covered by the ASM tools and alerts system but may not have dedicated search tools for each subtype. Use `cyble_asm_get_ip_details` for IP-level exposure and `cyble_alerts_fetch` for service-specific exposure alerts (e.g., `exposed_api`, `admin_panel`, `cloud_storage`). Discover available services with `cyble_alerts_list_services`.

### Vulnerability Intelligence

| Investigation Type | Entity Type | Cyble MCP Tool | Required Inputs | Key Output Fields | Notes / Gaps |
|---|---|---|---|---|---|
| CVE details | CVE | `cyble_cve_get_details` | `cve` | CVSS score, affected software, exploit/PoC links, MITRE ATT&CK mappings | Primary CVE lookup. |
| List all CVEs | — | `cyble_cve_list_all` | `start_date`/`end_date`, `zero_day`, `poc` | CVE list with pagination | Use filters for zero-day, PoC, date range. |
| Org-specific CVEs | Company UUID | `cyble_cve_list_org` | `company_id` | Org-relevant CVEs | Scoped to organization's assets. |
| ASM CVE details | CVE | `cyble_asm_get_cve_details` | `cve` | CVSS scores, affected software | ASM-specific; may have different detail level. |
| Alert vulnerability details | vulnerability_id, company_id | `cyble_alerts_get_vulnerability_details` | `vulnerability_id`, `company_id` | Vulnerability details from alert context | Use when drilling down from an alert. |

### Threat Actor / Campaign / Ransomware Intelligence

| Investigation Type | Entity Type | Cyble MCP Tool | Required Inputs | Key Output Fields | Notes / Gaps |
|---|---|---|---|---|---|
| Threat news/articles search | Keyword, filters | `cyble_newsfeed_search` | `search_value` (optional) | Articles with IOCs, AI summaries, threat actors, malware, industries | 15+ filter dimensions. |
| NewsFeed filter discovery | — | `cyble_newsfeed_get_filters` | None | Available industries, countries, tags, CVEs, threat actors, malware, sources | Run before newsfeed search to validate filters. |
| Flash threat reports | Keyword, filters | `cyble_newsflash_search` | Search/filter params (optional) | Victim/actor info, impacted industries/countries/regions | Time-sensitive threat intelligence briefs. |
| NewsFlash filter discovery | — | `cyble_newsflash_get_filters` | None | Available industry types, countries, tags | Run before newsflash search. |
| Ransomware incidents | Gang name, filters | `cyble_ransomware_search` | `search` (optional), gang/industry/country/region filters | Victim organizations, affected websites, gang attribution | Specialized ransomware intelligence. |
| Ransomware filter discovery | — | `cyble_ransomware_get_filters` | None | Available gangs, industries, countries, regions | Run before ransomware search. |
| Advisory by ID | Advisory ID | `cyble_advisory_get_by_id` | `advisory_id` | PDF download link, advisory details | Full advisory report access. |
| Advisory list | — | `cyble_advisory_list` | `date_range`, `countries`, `tags`, `vulnerabilities` | Paginated advisory list | Filter by date, country, vulnerability. |

### Third-Party / Vendor Risk

| Investigation Type | Entity Type | Cyble MCP Tool | Required Inputs | Key Output Fields | Notes / Gaps |
|---|---|---|---|---|---|
| Vendor details | Vendor name, domain | `cyble_vendor_get_details` | `vendor_domain` (required), `vendor_name` (optional) | Vendor risk details, scores | Search and filter vendors. |
| Vendor scan details | Vendor domain | `cyble_vendor_get_scan_details` | `vendor_domain` (required) | Risk scores across 18+ threat categories | Deep scan results. |
| Vendor scan dates | Vendor domain | `cyble_vendor_get_scan_dates` | `vendor_domain` | Available scan dates | Check when scans were performed. |
| Schedule vendor scan | Vendor domain, date range | `cyble_vendor_schedule_scan` | `vendor_domain`, `scheduler_details` (date range), `report_type` | Scheduled scan confirmation | Set up recurring monitoring. |
| Add vendor | Vendor entry | `cyble_vendor_add` | `vendors` (array of VendorEntry) | Added vendor confirmation | Onboard new vendor for monitoring. |
| Delete vendor | Vendor name/domain | `cyble_vendor_delete` | `vendor_name` (optional), `vendor_domain` (optional) | Deletion confirmation | Remove vendor from monitoring. |
| List countries | — | `cyble_vendor_list_countries` | None | Countries available for vendor risk | Lookup reference data. |
| List industries | — | `cyble_vendor_list_industries` | None | Industry types available for vendor risk | Lookup reference data. |
| Credit balance | — | `cyble_vendor_get_credit_details` | None | Account credit balance and usage | Check API credit availability. |

### Takedown

| Investigation Type | Entity Type | Cyble MCP Tool | Required Inputs | Key Output Fields | Notes / Gaps |
|---|---|---|---|---|---|
| List takedown incidents | — | `cyble_takedown_list` | None | Takedown incident list | Current takedown status. |

**Gap: Submit takedown request** — The current MCP tools expose `cyble_takedown_list` (read-only) but do not expose a takedown submission tool. Takedowns must be submitted through the Cyble Vision web portal or API directly. Document the gap and escalate to the appropriate team.

### Alert Management (Cross-Cutting)

| Investigation Type | Entity Type | Cyble MCP Tool | Required Inputs | Key Output Fields | Notes / Gaps |
|---|---|---|---|---|---|
| Fetch alerts (all types) | Company UUID | `cyble_alerts_fetch` | `company_uuid` | Alerts with service, status, severity, source data | 40+ services across all risk categories. |
| Update alerts | Alert IDs | `cyble_alerts_update` | `alerts` (array, max 100) | Updated alerts | Bulk status/severity/assignee changes. |
| Add alert comment | Alert ID | `cyble_alerts_add_comment` | `content` | Comment added | Collaboration/incident tracking. |
| List companies | — | `cyble_alerts_list_companies` | None | Accessible companies | Discover available company UUIDs. |
| List users | Company UUID | `cyble_alerts_list_users` | `company_uuid` | Company users | For alert assignment. |
| Alert filter data | Company UUID, services | `cyble_alerts_get_filter_data` | `company_uuid`, `filters` (services, optional date_range) | Available filter values | Discover filter options for specific services. |

## Investigation Workflow

### 1. Classify Case Type

Determine which capability area(s) apply:

- **Credential leak**: leaked passwords, stealer logs, paste dumps, breach data
- **Brand abuse**: typosquat, phishing domains, fake apps, fake social accounts, impersonation
- **Executive exposure**: executive PII, mentions, impersonation, VIP phishing
- **ASM exposure**: exposed assets, vulnerable services, shadow IT
- **Phishing/domain abuse**: phishing domains, homoglyph, malicious URLs
- **Threat actor/campaign**: actor TTPs, campaign tracking, IoC enrichment
- **Vulnerability intelligence**: CVE exploitation, PoC availability, affected software
- **Third-party exposure**: vendor risk, supply chain intelligence
- **CTI**: broad threat intelligence context, news, flash reports

### 2. Identify Entities

Extract relevant entities from the case:

| Entity Type | Examples |
|---|---|
| Domain | example.com, sub.example.com |
| URL | https://example.com/path |
| IP | 1.2.3.4 |
| ASN | AS12345 |
| Email | user@example.com |
| Username | jdoe |
| Executive name | John Doe |
| Company name | Acme Corp |
| Product/Brand name | AcmeWidget |
| Brand keyword | acme |
| File hash | MD5, SHA1, SHA256 |
| CVE | CVE-2023-38167 |
| Vendor domain | vendor.com |
| Subdomain | api.example.com |
| BIN | 123456 |
| Card number | 4111111111111111 |

### 3. Select the Correct Cyble MCP Tool

Choose tools based on case type and entity type. Validate inputs against the tool schema before calling. Do not call unrelated tools just because Cyble is available. If multiple tools are relevant, run them in an evidence-driven order:

1. Start with the most specific tool for the investigation type.
2. Expand to broader intelligence tools (newsfeed, newsflash) for context.
3. Cross-reference with IOC search if indicators are available.
4. Check alerts system for surfaced findings.

### 4. Collect Cyble Evidence

For each finding, capture:

| Field | Description |
|---|---|
| Source/category | Which Cyble tool and data source |
| First seen / last seen | Temporal scope of the finding |
| Affected entity | Domain, IP, email, executive, brand, etc. |
| Severity | LOW, MEDIUM, HIGH |
| Confidence | Low, Medium, High |
| Source type | darkweb, telegram, paste, phishing, stealer_logs, etc. |
| Campaign/actor | If attribution is available |
| Related IoCs | Connected indicators |
| Notes | Analyst observations |
| Raw reference/link/ID | For audit trail |

### 5. Validate with Other Sources

Corroborate Cyble findings with internal telemetry where applicable:

- **Microsoft Defender Advanced Hunting**: endpoint/email/identity events
- **MDO/email logs**: message trace, sender auth, Safe Links, quarantine
- **Entra ID sign-in logs**: identity compromise correlation
- **Elastic SIEM**: raw event correlation
- **DNS/proxy/firewall logs**: resolution, connection, egress evidence
- **EDR**: process, file, network behavior
- **Wiz**: cloud asset exposure, vulnerability context
- **Jira/asset inventory**: ownership, change records, approved activity
- **WHOIS/RDAP**: domain registration context
- **Certificate transparency logs**: domain validation
- **Passive DNS**: resolution history
- **Filescan/sandbox**: file behavior analysis
- **VirusTotal or similar**: secondary reputation context (never primary)

### 6. Produce Verdict

| Verdict | Criteria |
|---|---|
| Benign | Positive benign explanation with corroborating evidence |
| Suspicious | Anomalous or risky with insufficient proof of malicious activity |
| Malicious | Behavior or impact evidence beyond reputation alone |
| Confirmed exposure | Credential leak, data exposure, or breach confirmed with evidence |
| Inconclusive | Material evidence unavailable, conflicting, or insufficient |

### 7. Recommend Actions

| Action | When to Recommend |
|---|---|
| Monitor | Low-severity finding with no active exploitation |
| Validate internally | Cyble finding needs internal telemetry correlation |
| Reset credential | Confirmed credential leak |
| Revoke session | Active session compromise suspected |
| Block domain/IP/URL/hash | Confirmed malicious infrastructure |
| Takedown | Phishing domain, fake app, impersonation account |
| Notify user/executive | PII leak, impersonation, targeted phishing |
| Open incident | Confirmed exposure or active threat |
| Escalate to IR | Active compromise or critical exposure |
| Create Jira ticket | Remediation tracking, ownership assignment |
| Add to watchlist | Suspicious but unconfirmed indicator for ongoing monitoring |
| Improve detection | Gap identified in detection coverage |

## Evidence Model

Every finding must include:

| Field | Requirement |
|---|---|
| Evidence source | Cyble tool name used |
| Query/entity | Exact parameters and entity queried |
| Timestamp or time range | When the query was made and the data's temporal scope |
| First seen / last seen | If available from Cyble |
| Observation | Raw fact, not interpretation |
| Interpretation | Analyst interpretation of the observation |
| Confidence | Low, Medium, High |
| Raw reference/link/ID | For audit trail |
| Validation status | Corroborated, unvalidated, partially validated, contradictory |

## Output Schema

### Executive Summary

| Field | Value |
|---|---|
| Case type | credential_leak / brand_abuse / executive_exposure / asm_exposure / phishing_domain / threat_actor / vulnerability_intel / third_party_exposure / cti |
| Verdict | Benign / Suspicious / Malicious / Confirmed exposure / Inconclusive |
| Confidence | Low / Medium / High |
| Severity | LOW / MEDIUM / HIGH |
| Affected entity | Primary entity under investigation |
| Recommended action | Primary recommended action |

### Cyble Findings

| Finding | Entity | MCP Tool | Source Type | First Seen | Last Seen | Severity | Confidence | Notes |
|---|---|---|---|---|---|---|---|---|

### Validation

| Check | Source | Result | Interpretation |
|---|---|---|---|

### Risk Assessment

| Dimension | Value | Rationale |
|---|---|---|
| Exposure | Confirmed / Likely / Possible / Unlikely | |
| Likelihood | High / Medium / Low | |
| Impact | High / Medium / Low | |
| Urgency | Immediate / Short-term / Monitor | |

### Internal Correlation

| Signal | Source | Result |
|---|---|---|
| Identity (Entra ID) | | |
| Email (MDO) | | |
| Endpoint (EDR/MDE) | | |
| DNS/proxy/firewall | | |
| Cloud/Wiz | | |
| Jira/owner | | |

### Verdict Rationale

Separate findings into categories:

- **Cyble-reported intelligence**: What Cyble tools reported
- **Internally confirmed evidence**: What internal telemetry corroborates
- **Analyst inference**: Conclusions drawn from multiple data points
- **Unverified assumptions**: Gaps filled with assumptions (state explicitly)
- **Evidence gaps**: What could not be verified and why

### Recommended Actions

- **Immediate**: Actions requiring urgent execution (with approval)
- **Short-term**: Actions within 24-72 hours
- **Detection/hunting**: Queries or rules to improve detection
- **Watchlist/takedown**: Indicators to monitor or submit for takedown
- **Owner/team**: Responsible party for each action

## Guardrails

- Never invent Cyble MCP tool names, parameters, or output fields. Use only tools discovered from the `cyble.vision` MCP server.
- Never treat a Cyble alert as automatically confirmed malicious. Intelligence requires validation.
- Never base a verdict only on reputation. Require behavior or context evidence.
- Never downgrade leaked credentials just because internal telemetry has no alert yet. Leaked credentials are confirmed exposure regardless of internal detection.
- Never expose leaked passwords, tokens, secrets, or sensitive PII in reports. Redact sensitive values.
- Never perform takedown, blocking, password reset, or notification without explicit approval.
- Keep findings auditable and evidence-based. Preserve raw references.
- If a Cyble MCP tool does not expose a required capability, document the gap instead of pretending support exists.
- Do not call unrelated Cyble tools just because Cyble is available. Each tool call must be justified by the case type and entity.
- Distinguish between Cyble-reported data, internally validated evidence, and analyst inference.

## Examples

### Example 1: Credential Leak Investigation

**Case**: Employee credentials found in a stealer log dump.

1. **Classify**: Credential leak.
2. **Entities**: user@company.com, company domain, employee username.
3. **Tool selection**:
   - `cyble_alerts_fetch` with company_uuid, filter by credential-related services (stealer_logs, darkweb, paste).
   - `cyble_alerts_get_breach_details` if an S3 key is referenced.
   - `cyble_iocs_search_v4` with the email address to check for associated IoCs.
4. **Collect**: Timestamp of exposure, source type (stealer log, dark web forum, paste site), affected credentials (type, not values), associated malware family, other exposed data in the same dump.
5. **Validate**: Check Entra ID sign-in logs for anomalous logins from the exposure timeframe. Check MDE for malware execution matching the stealer family. Check if credential has been used in suspicious authentications.
6. **Verdict**: Confirmed exposure if credential data matches employee. Suspicious if source is unverified.
7. **Recommend**: Reset credential, revoke sessions, enable MFA if not already, scan endpoint for stealer malware, notify user.

### Example 2: Brand Impersonation / Phishing Domain

**Case**: Typosquat domain mimicking company brand hosting a credential harvesting page.

1. **Classify**: Brand abuse / phishing domain.
2. **Entities**: Legitimate domain (company.com), suspicious domain (cornpany.com), phishing URL.
3. **Tool selection**:
   - `cyble_negative_domains_check` for the suspicious domain.
   - `cyble_negative_domains_search` with date range to find related typosquat domains.
   - `cyble_alerts_fetch` with phishing/mobile_apps/social_media service filters.
   - `cyble_iocs_search_v4` for the domain and URL.
4. **Collect**: Domain registration date, hosting IP, redirect chain, phishing kit identification, targeted brand, other domains in same campaign.
5. **Validate**: Check DNS/proxy logs for internal users who visited the domain. Check email logs for phishing campaigns delivering this URL. WHOIS/RDAP lookup for registrant details. Screenshot the phishing page.
6. **Verdict**: Malicious if confirmed phishing with credential harvesting. Suspicious if domain structure is suspicious but no phishing content confirmed.
7. **Recommend**: Block domain, submit takedown, search for other typosquat variants, notify users if internal access detected.

### Example 3: Executive Monitoring Exposure

**Case**: CEO's personal email and phone number found on a dark web forum with threatening discussion.

1. **Classify**: Executive exposure.
2. **Entities**: Executive name, personal email, personal phone, company name.
3. **Tool selection**:
   - `cyble_exec_alerts_fetch` with company_uuid, filter by executive_mention and executive_impersonation services.
   - `cyble_alerts_fetch` with darkweb/forum service filters.
   - `cyble_iocs_search_v4` for the executive's email and any associated domains.
   - `cyble_newsfeed_search` for threat actor mentions of the company or executive.
4. **Collect**: Source forum/market, post content (summarized, not verbatim PII), threat actor attribution, timeline of mentions, context (targeted attack discussion vs. data dump).
5. **Validate**: Check if the exposed PII matches current executive contact details. Check for any related phishing campaigns targeting the executive. Check for physical security implications if location data is exposed. Correlate with any recent incidents.
6. **Verdict**: Confirmed exposure if PII verified. Severity depends on threat context (targeted discussion vs. passive data dump).
7. **Recommend**: Notify executive and executive protection team, monitor for impersonation attempts, enhance executive digital footprint monitoring, consider personal account security review.

### Example 4: ASM Exposed Asset

**Case**: Internet-facing admin panel discovered on a non-standard port with known vulnerabilities.

1. **Classify**: ASM exposure.
2. **Entities**: IP address, open port, service/software, associated company.
3. **Tool selection**:
   - `cyble_asm_get_ip_details` with company_uuid and IP.
   - `cyble_asm_get_cve_details` for any CVEs affecting the exposed service.
   - `cyble_alerts_get_system_info` if system_id is known.
   - `cyble_cve_get_details` for detailed CVE analysis.
4. **Collect**: Exposed service details, CVEs, CVSS scores, exploit availability (PoC), internet-wide exposure context, first discovered date.
5. **Validate**: Check Wiz for cloud asset context and ownership. Check Jira/CMDB for asset owner. Verify if the exposure is intentional (dev environment, authorized service). Scan for indicators of compromise on the exposed system.
6. **Verdict**: Confirmed exposure if verified vulnerable and unintended. Benign if authorized and properly secured. Severity based on CVSS, exploitability, and data sensitivity.
7. **Recommend**: Restrict access (firewall rule, VPN-only), patch vulnerabilities, rotate any exposed credentials, add to continuous ASM monitoring.

### Example 5: Threat Actor / Campaign CTI

**Case**: New threat actor campaign targeting the organization's industry with a specific malware family.

1. **Classify**: Threat actor / campaign CTI.
2. **Entities**: Threat actor name, malware family, target industry, associated IoCs.
3. **Tool selection**:
   - `cyble_newsfeed_search` with industry and threat_actor filters.
   - `cyble_newsflash_search` for time-sensitive intelligence.
   - `cyble_ransomware_search` if ransomware-related.
   - `cyble_iocs_search_v4` for campaign IoCs.
   - `cyble_advisory_list` for related advisories.
4. **Collect**: Actor TTPs, campaign timeline, targeted sectors/regions, malware capabilities, associated IoCs, MITRE ATT&CK mappings.
5. **Validate**: Check internal telemetry for any matching IoCs (MDE, Elastic, proxy, DNS). Check if the organization's industry peers have reported incidents. Verify IoCs against other CTI sources.
6. **Verdict**: Intelligence assessment. Not a verdict on internal compromise unless internal evidence confirms.
7. **Recommend**: Brief security operations on TTPs, deploy IoCs to detection systems, conduct threat hunting for campaign indicators, update threat profile, share intelligence with peer organizations.

### Example 6: Vulnerability Intelligence

**Case**: Critical CVE with known public exploit affecting software in the organization's tech stack.

1. **Classify**: Vulnerability intelligence.
2. **Entities**: CVE ID, affected software vendor/product, affected version.
3. **Tool selection**:
   - `cyble_cve_get_details` for full CVE analysis.
   - `cyble_cve_list_org` to check org-specific coverage.
   - `cyble_asm_get_cve_details` for ASM-scoped details.
   - `cyble_newsfeed_search` for exploitation news and actor attribution.
4. **Collect**: CVSS score, exploit/PoC availability, affected software/versions, MITRE ATT&CK mappings, exploitation in the wild evidence, patch availability.
5. **Validate**: Check internal asset inventory for affected software. Check Wiz for vulnerable cloud resources. Verify patch status. Check for exploitation attempts in internal telemetry (IDS/IPS, WAF, endpoint).
6. **Verdict**: Vulnerability confirmed. Risk level based on exposure, exploitability, and internal asset impact.
7. **Recommend**: Patch priority based on risk, deploy compensating controls if patching is delayed, monitor for exploitation attempts, add to vulnerability management tracking.
