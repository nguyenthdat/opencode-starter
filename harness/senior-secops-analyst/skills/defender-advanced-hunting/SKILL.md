---
name: defender-advanced-hunting
description: "Microsoft Defender XDR Advanced Hunting: KQL query construction, schema-based investigation, detection engineering, alert/incident triage, and evidence-driven SOC workflows across endpoint, identity, email, cloud app, and identity telemetry. Use when writing Defender Advanced Hunting KQL, investigating alerts/incidents in Microsoft Defender XDR, pivoting across Defender schema tables, building custom detection rules, optimizing KQL for Defender XDR performance, or conducting threat hunting against Defender telemetry. Not for generic KQL, non-Defender SIEM (Sentinel-only, Elastic), CTI/IoC enrichment, or external threat exposure."
compatibility: opencode
metadata:
  domain: secops
  audience: senior-secops-analyst
  edition: "2026.07"
---

# Defender Advanced Hunting

Microsoft Defender XDR Advanced Hunting skill for KQL-based investigation, incident triage, threat hunting, and detection engineering across endpoint, identity, email, cloud app, and alert telemetry.

This skill is **docs-first, MCP-aware, schema-safe, and evidence-driven**. It uses Microsoft Docs as the source of truth for table schemas, columns, query language behavior, APIs, limits, and custom detection requirements.

## When to Use

Use this skill when the task involves:

- Writing or optimizing Defender Advanced Hunting KQL queries
- Investigating alerts or incidents in Microsoft Defender XDR
- Pivoting across Defender Advanced Hunting schema tables
- Endpoint, identity, email, or cloud app telemetry investigation
- Building custom detection rules from Advanced Hunting queries
- Entity pivoting (user, device, IP, domain, URL, hash, process, alert)
- Threat hunting with Defender telemetry
- KQL performance optimization for Defender XDR
- Alert-to-evidence timeline construction
- Triage workflow design

## When Not to Use

Do not use as the primary skill when:

- The task is **generic CTI / IoC enrichment** not tied to Defender telemetry
- The task is **external threat exposure, brand monitoring, or credential leak monitoring** (use Cyble or equivalent)
- The task is **deep multi-source case orchestration** spanning non-Defender sources
- The task is **cloud posture / vulnerability management** outside Defender XDR
- The task is **non-Defender SIEM investigation** (Sentinel-only queries, Elastic, Splunk)
- The task is **generic KQL training** without Defender schema context

If the task spans Defender + external sources, use this skill for the Defender portion and route external enrichment to the appropriate tool.

## Microsoft Docs Source-of-Truth Rules

All schema information must be validated against Microsoft Docs or live tenant schema. Never rely on memory.

### Core references

| Topic | URL |
|---|---|
| Advanced Hunting overview | `https://learn.microsoft.com/en-us/defender-xdr/advanced-hunting-overview` |
| Schema tables reference | `https://learn.microsoft.com/en-us/defender-xdr/advanced-hunting-schema-tables` |
| Query language | `https://learn.microsoft.com/en-us/defender-xdr/advanced-hunting-query-language` |
| Query best practices | `https://learn.microsoft.com/en-us/defender-xdr/advanced-hunting-best-practices` |
| Advanced Hunting API | `https://learn.microsoft.com/en-us/defender-xdr/api-advanced-hunting` |
| Limits and quotas | `https://learn.microsoft.com/en-us/defender-xdr/advanced-hunting-limits` |
| Custom detection rules | `https://learn.microsoft.com/en-us/defender-xdr/custom-detection-rules` |
| Custom detections overview | `https://learn.microsoft.com/en-us/defender-xdr/custom-detections-overview` |
| Manage custom detections | `https://learn.microsoft.com/en-us/defender-xdr/custom-detection-manage` |

### Rules

1. **Never invent table names or column names.** Validate against Microsoft Docs or live schema.
2. **Prefer live tenant schema** when it differs from docs; document the difference.
3. **Do not use deprecated table names** unless explicitly required by the target environment.
4. **Do not assume every tenant has every table.** Table availability depends on licensing (Defender for Endpoint, Defender for Identity, Defender for Office 365, Defender for Cloud Apps).
5. **Check table-level caveats**: `CloudAppEvents` is not available for GCC tenants. `BehaviorEntities` and `BehaviorInfo` are Preview. `AADSignInEventsBeta` is the legacy table; prefer `EntraIdSignInEvents`.
6. **Advanced Hunting uses UTC** for all data. Write queries in UTC. Results display in the user's configured timezone.

## MCP Tool Discovery Requirement

Before using any Defender MCP tool, the agent **must** inspect available MCP tools and validate their actual names, parameters, and output schemas. Never assume tool names or capabilities.

### MCP Tool Mapping

All Defender Advanced Hunting workflows currently have **no MCP tool support**. Use the documented fallbacks.

| Workflow | Entity Type | Defender MCP Tool | Status | Fallback |
|---|---|---|---|---|
| Run Advanced Hunting query | Any | Not exposed | **Gap** | Manual portal execution or Advanced Hunting API (`POST https://api.security.microsoft.com/api/advancedhunting/run`) |
| Get schema / table metadata | Any | Not exposed | **Gap** | Microsoft Docs schema reference or in-portal Schema reference tab |
| Get incidents | Incident | Not exposed | **Gap** | Defender portal Incidents queue or Microsoft Graph Security API (`/security/incidents`) |
| Get alerts | Alert | Not exposed | **Gap** | Defender portal Alerts queue or Microsoft Graph Security API (`/security/alerts_v2`) |
| Get alert evidence | Alert | Not exposed | **Gap** | Query `AlertEvidence` table directly in Advanced Hunting |
| Get device details | Device | Not exposed | **Gap** | Query `DeviceInfo` table or Defender portal Device inventory |
| Get user/identity details | Identity | Not exposed | **Gap** | Query `IdentityInfo` table or Entra ID portal |
| Create/update custom detection | Detection | Not exposed | **Gap** | Defender portal Custom detection rules wizard |
| Live response / containment | Device | Not exposed | **Gap** | Defender portal Device page > Initiate live response |
| Run antivirus scan | Device | Not exposed | **Gap** | Defender portal Device page > Run antivirus scan |
| Isolate device | Device | Not exposed | **Gap** | Defender portal Device page > Isolate device |
| Mark user as compromised | Identity | Not exposed | **Gap** | Defender portal or Entra ID Identity Protection |
| Email remediation (delete/move) | Email | Not exposed | **Gap** | Defender portal Explorer or custom detection actions |

### API Fallback

The Defender Advanced Hunting API is available programmatically:

```http
POST https://api.security.microsoft.com/api/advancedhunting/run
Authorization: Bearer {token}
Content-Type: application/json

{"Query": "<KQL query>"}
```

**API quotas**: 45+ calls/min/tenant, 100K row max per query, 3-minute timeout per request, 30-day data window. CPU throttling may apply per 15-minute cycle.

### When MCP Tools Become Available

If a Defender MCP server is added to the environment, re-run discovery before using any tool. Update this mapping table with actual tool names, required inputs, optional inputs, returned fields, limits, best use cases, and cases where tools should not be used.

## Schema Tables Reference

All tables verified against Microsoft Docs (`advanced-hunting-schema-tables`). Include only tables confirmed in the live reference.

### Core investigation tables

| Table | Purpose | Data Source | Key Columns |
|---|---|---|---|
| `AlertInfo` | Alert metadata: severity, title, category, MITRE | Defender XDR (all workloads) | `AlertId`, `Timestamp`, `Title`, `Severity`, `Category`, `AttackTechniques`, `ServiceSource` |
| `AlertEvidence` | Entities linked to alerts: files, IPs, URLs, users, devices | Defender XDR (all workloads) | `AlertId`, `Timestamp`, `EntityType`, `EvidenceRole`, `DeviceName`, `AccountName`, `RemoteIP`, `SHA256`, `FileName` |
| `DeviceInfo` | Device inventory: OS, version, groups, exposure, health | Defender for Endpoint | `DeviceId`, `DeviceName`, `OSPlatform`, `OSVersion`, `MachineGroup`, `ExposureLevel`, `OnboardingStatus`, `PublicIP` |
| `DeviceProcessEvents` | Process creation and termination | Defender for Endpoint | `DeviceName`, `FileName`, `ProcessCommandLine`, `InitiatingProcessFileName`, `SHA256`, `ProcessId`, `ProcessUniqueId` |
| `DeviceFileEvents` | File create, modify, delete, rename | Defender for Endpoint | `DeviceName`, `FileName`, `FolderPath`, `SHA256`, `ActionType`, `InitiatingProcessFileName` |
| `DeviceNetworkEvents` | Network connections | Defender for Endpoint | `DeviceName`, `RemoteIP`, `RemotePort`, `RemoteUrl`, `ActionType`, `InitiatingProcessFileName`, `Protocol` |
| `DeviceRegistryEvents` | Registry key create/modify/delete | Defender for Endpoint | `DeviceName`, `RegistryKey`, `RegistryValueName`, `RegistryValueData`, `ActionType` |
| `DeviceLogonEvents` | Sign-ins and auth events on devices | Defender for Endpoint | `DeviceName`, `AccountName`, `AccountDomain`, `LogonType`, `ActionType` |
| `DeviceImageLoadEvents` | DLL/EXE loads into processes | Defender for Endpoint | `DeviceName`, `FileName`, `FolderPath`, `SHA256`, `InitiatingProcessFileName` |
| `DeviceEvents` | Misc events: AV detections, exploit protection, USB mounts, ASR | Defender for Endpoint | `DeviceName`, `ActionType`, `FileName`, `FolderPath`, `AdditionalFields`, `RemoteUrl` |
| `DeviceNetworkInfo` | Device network adapter properties | Defender for Endpoint | `DeviceName`, `IPAddresses`, `MacAddress`, `NetworkAdapterStatus`, `ConnectedNetworks` |

### Email and collaboration tables (Defender for Office 365)

| Table | Purpose | Key Columns |
|---|---|---|
| `EmailEvents` | Email delivery and blocking events | `NetworkMessageId`, `Timestamp`, `SenderFromAddress`, `RecipientEmailAddress`, `Subject`, `ThreatTypes`, `DetectionMethods`, `DeliveryAction`, `DeliveryLocation` |
| `EmailUrlInfo` | URLs found in emails | `NetworkMessageId`, `Url`, `UrlDomain`, `UrlLocation` |
| `EmailAttachmentInfo` | Attachments in emails | `NetworkMessageId`, `FileName`, `FileType`, `SHA256`, `ThreatTypes`, `DetectionMethods` |
| `EmailPostDeliveryEvents` | Post-delivery security events (ZAP, AIR, user-reported) | `NetworkMessageId`, `Timestamp`, `Action`, `ActionType`, `ActionResult`, `ThreatTypes` |
| `UrlClickEvents` | Safe Links clicks from email, Teams, Office apps | `NetworkMessageId`, `Url`, `UrlChain`, `ActionType`, `IsClickedThrough`, `AccountUpn`, `Workload` |
| `CampaignInfo` (Preview) | Email campaigns identified by Defender for Office 365 | `CampaignId`, `CampaignName`, `FirstActivity`, `LastActivity` |

### Identity tables (Defender for Identity / Entra ID)

| Table | Purpose | Key Columns |
|---|---|---|
| `IdentityLogonEvents` | Auth events on AD and Microsoft online services | `AccountName`, `AccountUpn`, `AccountSid`, `DeviceName`, `DestinationDeviceName`, `IPAddress`, `Protocol`, `ActionType`, `LogonType`, `FailureReason` |
| `IdentityDirectoryEvents` | AD object changes on domain controllers | `AccountName`, `TargetAccountUpn`, `ActionType`, `Application`, `DeviceName`, `DestinationDeviceName` |
| `IdentityQueryEvents` | AD queries (SAMR, LDAP) | `AccountName`, `QueryTarget`, `QueryType`, `Query`, `DeviceName` |
| `IdentityInfo` | Account info from Entra ID and other sources | `AccountName`, `AccountUpn`, `AccountObjectId`, `AccountSid`, `AccountDisplayName`, `Department`, `JobTitle`, `EmailAddress`, `City`, `Country` |
| `EntraIdSignInEvents` | Entra ID interactive and non-interactive sign-ins | `AccountUpn`, `AccountObjectId`, `Application`, `ClientAppUsed`, `DeviceName`, `IPAddress`, `Country`, `RiskLevelDuringSignIn`, `IsInteractive`, `ErrorCode` |
| `EntraIdSpnSignInEvents` | Service principal and managed identity sign-ins | `ServicePrincipalName`, `ServicePrincipalId`, `IPAddress`, `Application`, `ResourceDisplayName` |

Note: `AADSignInEventsBeta` and `AADSpnSignInEventsBeta` are legacy tables. Prefer `EntraIdSignInEvents` and `EntraIdSpnSignInEvents`.

### Cloud app tables (Defender for Cloud Apps)

| Table | Purpose | Key Columns |
|---|---|---|
| `CloudAppEvents` | Events from Office 365 and connected cloud apps/services | `AccountObjectId`, `AccountDisplayName`, `Application`, `AppInstanceId`, `ActionType`, `ActivityType`, `IPAddress`, `CountryCode`, `UserAgent`, `ObjectName`, `ObjectType`, `DeviceType`, `RawEventData` |
| `OAuthAppInfo` (Preview) | OAuth applications registered with Entra ID (app governance) | `AppName`, `AppId`, `Publisher`, `PermissionCount`, `ConsentedPermissionCount`, `LastConsentTimestamp` |

Not available for GCC tenants. Verify availability in target tenant.

### Additional tables

| Table | Purpose | Key Columns |
|---|---|---|
| `BehaviorInfo` (Preview) | User/entity behavior analytics | `BehaviorId`, `ActionType`, `Categories`, `EventSource`, `DetectionTime` |
| `BehaviorEntities` (Preview) | Entities involved in behaviors | `BehaviorId`, `EntityType`, `EntityRole`, `AccountName`, `DeviceName` |
| `IdentityEvents` (Preview) | Identity events from cloud identity providers | `AccountName`, `ActionType`, `IPAddress`, `Country`, `EventTimestamp` |
| `GraphApiAuditEvents` | Entra ID API requests to Microsoft Graph | `RequestUri`, `AppId`, `UserAgent`, `ResponseStatusCode`, `RequestMethod` |
| `ExposureGraphNodes` | Exposure management entity nodes | `NodeId`, `NodeName`, `NodeLabel`, `Categories` |
| `ExposureGraphEdges` | Exposure management relationships | `EdgeId`, `SourceNodeId`, `TargetNodeId`, `EdgeLabel` |

### Table Selection Guide

| Investigation Goal | Primary Tables | Supporting Tables | Notes |
|---|---|---|---|
| Alert triage | `AlertInfo`, `AlertEvidence` | All entity tables below | Start with AlertId, then pivot to entity tables |
| Device compromise | `DeviceProcessEvents`, `DeviceNetworkEvents`, `DeviceFileEvents`, `DeviceRegistryEvents`, `DeviceLogonEvents` | `DeviceInfo`, `DeviceEvents`, `DeviceImageLoadEvents` | Time-correlate across tables on DeviceName |
| Identity investigation | `IdentityLogonEvents`, `IdentityDirectoryEvents`, `IdentityQueryEvents`, `EntraIdSignInEvents` | `IdentityInfo`, `AlertEvidence` | Pivot on AccountUpn, AccountSid, or AccountObjectId |
| Phishing investigation | `EmailEvents`, `EmailUrlInfo`, `EmailAttachmentInfo`, `EmailPostDeliveryEvents`, `UrlClickEvents` | `AlertInfo`, `AlertEvidence`, `IdentityInfo` | Pivot on NetworkMessageId, SenderFromAddress, Url |
| Malware investigation | `DeviceProcessEvents`, `DeviceFileEvents`, `DeviceEvents` | `EmailAttachmentInfo`, `DeviceNetworkEvents` | Pivot on SHA256, FileName, ProcessCommandLine |
| Lateral movement | `DeviceLogonEvents`, `IdentityLogonEvents`, `DeviceNetworkEvents` | `DeviceProcessEvents`, `IdentityDirectoryEvents` | Look for SMB/RDP/WinRM connections, logon type 3/10 |
| Data exfiltration | `DeviceNetworkEvents`, `CloudAppEvents`, `EmailEvents` | `DeviceFileEvents` | Large uploads, unusual outbound volume, email to external |
| Cloud/SaaS anomaly | `CloudAppEvents`, `OAuthAppInfo`, `EntraIdSignInEvents` | `IdentityInfo`, `EntraIdSpnSignInEvents` | Impossible travel, unusual app access, OAuth consent grants |
| Custom detection | Any | `AlertEvidence`, `AlertInfo` | Must include required columns: `Timestamp`, entity identifier column |
| Entity pivot (device) | `DeviceInfo` | `DeviceProcessEvents`, `DeviceNetworkEvents`, `DeviceLogonEvents`, `DeviceFileEvents`, `DeviceRegistryEvents` | Start with DeviceName/DeviceId, expand time window |
| Entity pivot (user) | `IdentityInfo` | `IdentityLogonEvents`, `EntraIdSignInEvents`, `CloudAppEvents`, `EmailEvents`, `UrlClickEvents`, `DeviceLogonEvents` | Cross-reference AccountUpn across tables |
| Entity pivot (IP) | `DeviceNetworkEvents`, `IdentityLogonEvents`, `CloudAppEvents` | `EntraIdSignInEvents`, `EmailEvents` | Check IP across endpoint, identity, cloud |
| Entity pivot (domain) | `DeviceNetworkEvents`, `EmailUrlInfo` | `EmailEvents`, `CloudAppEvents` | Pivot on domain in RemoteUrl, UrlDomain |
| Entity pivot (hash) | `DeviceProcessEvents`, `DeviceFileEvents`, `EmailAttachmentInfo` | `DeviceImageLoadEvents` | Search SHA256 across process, file, email |

## Advanced Hunting Limits and Quotas

Per `advanced-hunting-overview` and `advanced-hunting-limits`:

| Limit | Value | Applies To |
|---|---|---|
| Data retention | 30 days (longer if streamed via Sentinel) | All Defender data |
| Max result rows | 100,000 per query | Portal and API |
| Query timeout | 10 minutes (portal), 3 minutes (API) | Per query |
| CPU resources | Tenant-based allocation, 15-min cycle | Portal and API |
| Result size | 64 MB max per query | Portal |
| API rate | 45+ calls/min/tenant | API only |
| Custom detection alerts | 150 max per rule per run | Custom detections |
| Custom detection frequency | 24h / 12h / 3h / 1h / Continuous (NRT) | Custom detections |

### Lookback periods for custom detections

| Frequency | Lookback (Defender data) |
|---|---|
| Every 24 hours | 30 days |
| Every 12 hours | 48 hours |
| Every 3 hours | 12 hours |
| Every hour | 4 hours |

## KQL Quality Rules

### Performance rules

1. **Always start with the smallest relevant time window.** Use `Timestamp > ago(1d)` or narrower before any other filter.
2. **Apply selective filters early.** Place `where` clauses that eliminate the most rows as early as possible.
3. **Prefer exact operators:**
   - `==` over `=~` when case-sensitivity is acceptable (faster)
   - `has` over `contains` for tokenized term matching (indexed)
   - `has_any` for multiple tokenized terms
   - `in~` / `in` for value-list matching
4. **Avoid `contains` on large tables** unless necessary. `contains` does a substring scan and is not indexed.
5. **Avoid `matches regex`** unless the pattern genuinely requires it. Regex is expensive.
6. **No three-character terms** in filters. Terms with 3 or fewer characters are not indexed.
7. **Project only needed columns.** Use `project` early to reduce data passed between operators.
8. **Use `join` only when required.** Keep the left side (smaller table) filtered. Use `kind=inner` to preserve all matching rows.
9. **Apply time filters on both sides of a join.**
10. **Use `hint.shufflekey`** for joins on high-cardinality columns.
11. **Use `hint.strategy = broadcast`** when the left table is small (under 100K rows) and the right table is very large.
12. **Prefer `summarize` on columns with repetitive values.** Don't `summarize` on unique columns.
13. **Use `materialize()`** only when a subquery is reused multiple times.
14. **Add `take` / `limit`** for exploration queries.
15. **Never run unbounded `search` or `union`** without table scoping. Use `search in (Table1, Table2)`.
16. **Use `union` only with explicit table names.** Avoid `union *`.

### Entity pivot rules

- Normalize domains/emails to lowercase: `tolower(SenderFromAddress)`
- Normalize hashes to uppercase or lowercase consistently
- Handle missing fields safely: `isnotempty(Field)` or `iff(isempty(Field), "N/A", Field)`
- For time correlation across tables, use `Timestamp between (startTime .. endTime)`
- Use `ProcessUniqueId` and `InitiatingProcessUniqueId` for exact process parent-child relationships on Windows (avoids PID reuse issues)

### Query output rules

- Add `//` comments explaining query intent at the top and at each logical step
- Never return a query without explaining what evidence it is expected to produce
- Include `project` to shape results for readability
- Use `top N by Timestamp desc` for recent-event exploration

## KQL Patterns

### 1. Alert to Evidence Pivot

**Purpose**: Given an AlertId, retrieve all associated evidence entities and their types.

**Required inputs**: `AlertId` (string)

```kusto
// Alert to evidence pivot: retrieve all entities linked to a specific alert
let targetAlertId = "REPLACE_WITH_ALERT_ID";
AlertEvidence
| where Timestamp > ago(30d)
| where AlertId == targetAlertId
| project Timestamp, EntityType, EvidenceRole, DeviceName, AccountName,
    AccountUpn, RemoteIP, SHA256, FileName, FolderPath, RegistryKey,
    Url, Title = AlertTitle
| order by Timestamp desc
```

**Expected evidence**: List of all entities (devices, users, IPs, files, URLs, registry keys) associated with the alert.

**Performance notes**: Single table query, already scoped to AlertId. Use `take 1000` if the alert has extensive evidence.

**Common false positives**: None — this is a lookup, not a detection.

**Next pivots**: For each entity type found, run the corresponding entity-specific query below.

### 2. Device Process Timeline

**Purpose**: Reconstruct the process execution timeline for a device within a time window.

**Required inputs**: `DeviceName` (string), optional `TimeWindowStart` (datetime)

```kusto
// Device process timeline: all process creation events on a device
let targetDevice = "REPLACE_WITH_DEVICE_NAME";
let lookback = 7d;
DeviceProcessEvents
| where Timestamp > ago(lookback)
| where DeviceName == targetDevice
| project Timestamp, ProcessName = FileName, ProcessId, ProcessUniqueId,
    ProcessCommandLine, ParentProcess = InitiatingProcessFileName,
    ParentProcessId = InitiatingProcessId, ParentProcessUniqueId = InitiatingProcessUniqueId,
    ParentCommandLine = InitiatingProcessCommandLine, AccountName = AccountName,
    SHA256, InitiatingProcessSHA256
| order by Timestamp asc
```

**Expected evidence**: Chronological list of all process creation events.

**Performance notes**: Filter DeviceName first, then time. `DeviceProcessEvents` is one of the largest tables — always set a reasonable lookback.

**Common false positives**: None for this lookup. Suspicious processes require additional context.

**Next pivots**: Network connections from suspicious processes (`DeviceNetworkEvents`), file writes (`DeviceFileEvents`), DLL loads (`DeviceImageLoadEvents`).

### 3. Suspicious PowerShell or LOLBin Execution

**Purpose**: Detect PowerShell, wscript, cscript, mshta, rundll32, certutil, regsvr32, or other LOLBin executions that may indicate malicious activity.

**Required inputs**: `lookback` (time window)

```kusto
// LOLBin execution: suspicious binary usage with network or command-line indicators
let lookback = 1d;
let lolbins = dynamic(["powershell.exe","pwsh.exe","cmd.exe","wscript.exe",
    "cscript.exe","mshta.exe","rundll32.exe","regsvr32.exe","certutil.exe",
    "msbuild.exe","csc.exe","InstallUtil.exe","regasm.exe","regsvcs.exe",
    "msiexec.exe","wmic.exe","cmstp.exe","pcalua.exe","bash.exe",
    "bitsadmin.exe","forfiles.exe","scrobj.dll"]);
DeviceProcessEvents
| where Timestamp > ago(lookback)
| where FileName in~ (lolbins)
| where InitiatingProcessFileName !in~ ("explorer.exe","svchost.exe",
    "services.exe","winlogon.exe","csrss.exe","smss.exe",
    "MsMpEng.exe","SenseIR.exe","SenseNdr.exe","SenseCE.exe")
| where not(ProcessCommandLine has_any ("-Help", "/Help", "-?", "/?"))
| project Timestamp, DeviceName, ProcessName = FileName,
    ProcessCommandLine, ParentProcess = InitiatingProcessFileName,
    ParentCommandLine = InitiatingProcessCommandLine, AccountName,
    ProcessId, ProcessUniqueId, SHA256
| order by Timestamp desc
| take 1000
```

**Expected evidence**: List of LOLBin executions with process details. Review command lines for encoded commands, download operations, network connections, or other suspicious patterns.

**Performance notes**: `in~` on the lolbins list is efficient. Excluding benign parent processes reduces noise.

**Common false positives**: Legitimate admin tasks, software installers, update mechanisms, and configuration management tools. Correlate with `DeviceNetworkEvents` to confirm malicious activity.

**Next pivots**: Check network connections from these processes. Examine `DeviceFileEvents` for dropped files. Check `DeviceRegistryEvents` for persistence.

### 4. File Hash Investigation

**Purpose**: Track all occurrences of a file hash (SHA256) across process execution, file events, and email attachments.

**Required inputs**: `SHA256` hash (string)

```kusto
// File hash investigation: track hash across process, file, and email data
let targetHash = "REPLACE_WITH_SHA256";
let lookback = 30d;
union
    (DeviceProcessEvents
    | where Timestamp > ago(lookback)
    | where SHA256 == targetHash or InitiatingProcessSHA256 == targetHash
    | project Timestamp, Source = "Process", DeviceName, FileName,
        ProcessCommandLine, AccountName, InitiatingProcessFileName),
    (DeviceFileEvents
    | where Timestamp > ago(lookback)
    | where SHA256 == targetHash or InitiatingProcessSHA256 == targetHash
    | project Timestamp, Source = "File", DeviceName, FileName,
        FolderPath, AccountName, InitiatingProcessFileName =
        InitiatingProcessFileName),
    (EmailAttachmentInfo
    | where Timestamp > ago(lookback)
    | where SHA256 == targetHash
    | project Timestamp, Source = "EmailAttachment", DeviceName = "",
        FileName, FolderPath = "", AccountName = RecipientEmailAddress,
        InitiatingProcessFileName = SenderFromAddress)
| order by Timestamp asc
```

**Expected evidence**: All sightings of the hash across endpoint process execution, file operations, and email attachments, with source and timestamps.

**Performance notes**: Three-way union. Each subquery is hash-indexed (SHA256 is indexed). Keep lookback reasonable.

**Common false positives**: None for hash lookup. Hash must be confirmed malicious via threat intelligence.

**Next pivots**: For process events, check network connections. For email, check `EmailUrlInfo` and `UrlClickEvents`.

### 5. Device Network Connections to Domain/IP

**Purpose**: Investigate all network connections from a device to a specific domain or IP.

**Required inputs**: `DeviceName` (string), `RemoteIP` or `RemoteUrl` or `domain` (string)

```kusto
// Device network connections: outbound connections to a specific domain/IP
let targetDevice = "REPLACE_WITH_DEVICE_NAME";
let targetDomain = "REPLACE_WITH_DOMAIN"; // e.g. "evil.com"
let lookback = 7d;
DeviceNetworkEvents
| where Timestamp > ago(lookback)
| where DeviceName == targetDevice
| where RemoteUrl contains targetDomain or RemoteIP == targetDomain
// Use contains for domain matching; exact match for IP
| project Timestamp, LocalIP, RemoteIP, RemotePort, RemoteUrl, Protocol,
    ActionType, InitiatingProcessFileName, InitiatingProcessId,
    InitiatingProcessCommandLine, AccountName = LocalAccountName
| order by Timestamp asc
```

**Expected evidence**: All network connections from the device to the target domain or IP with process context.

**Performance notes**: `contains` on `RemoteUrl` is acceptable when scoped to a single device. If querying across all devices, prefer `has` with a more specific match.

**Common false positives**: Legitimate background connections from browsers, updaters, CDN services. Correlate with process command line.

**Next pivots**: Check what processes made the connections. Pivot to `DeviceProcessEvents` to see parent process chains. Check other devices connecting to the same destination.

### 6. User Sign-In Investigation

**Purpose**: Investigate all sign-in activity for a specific user across device logons, Entra ID sign-ins, and on-premises authentication.

**Required inputs**: `AccountUpn` (string)

```kusto
// User sign-in investigation: all logon/sign-in events for a user
let targetUser = "REPLACE_WITH_UPN";
let lookback = 7d;
union
    (IdentityLogonEvents
    | where Timestamp > ago(lookback)
    | where AccountUpn == targetUser
    | project Timestamp, Source = "IdentityLogon", DeviceName,
        DestinationDeviceName, IPAddress, Protocol, ActionType,
        LogonType, FailureReason, Application, ISP, Country),
    (EntraIdSignInEvents
    | where Timestamp > ago(lookback)
    | where AccountUpn == targetUser
    | project Timestamp, Source = "EntraId", DeviceName, Country = Location,
        IPAddress, ClientAppUsed, Application, IsInteractive,
        RiskLevelDuringSignIn, ErrorCode, ConditionalAccessStatus),
    (DeviceLogonEvents
    | where Timestamp > ago(lookback)
    | where AccountName == targetUser or AccountUpn == targetUser
    | project Timestamp, Source = "DeviceLogon", DeviceName,
        DestinationDeviceName = DeviceName, IPAddress = RemoteIP,
        Protocol = "", ActionType, LogonType, FailureReason = "",
        Application = InitiatingProcessFileName, ISP = "", Country = "")
| order by Timestamp asc
```

**Expected evidence**: Comprehensive sign-in timeline from all identity sources.

**Performance notes**: Three-way union. Each branch filters on the same UPN. Keep lookback reasonable.

**Common false positives**: Normal sign-in activity. Focus on anomalies: unusual locations, off-hours, failed attempts, risky sign-in states, impossible travel patterns.

**Next pivots**: For suspicious sign-ins, check `CloudAppEvents` for activities during the session. Check `DeviceProcessEvents` for any endpoint where the user was active.

### 7. Failed Logon Burst / Password Spray Pattern

**Purpose**: Detect password spray or brute-force patterns by identifying high volumes of failed logons targeting multiple accounts.

**Required inputs**: `lookback` (time window), optional `threshold` (min failed logons)

```kusto
// Failed logon burst: detect potential password spray or brute force
let lookback = 1h;
let failureThreshold = 10;
let targetThreshold = 5;
IdentityLogonEvents
| where Timestamp > ago(lookback)
| where ActionType == "LogonFailed"
| where isnotempty(AccountUpn)
| summarize
    FailureCount = count(),
    TargetAccounts = dcount(AccountUpn),
    SourceIPs = makeset(IPAddress),
    TimestampFirst = min(Timestamp),
    TimestampLast = max(Timestamp)
    by DeviceName, IPAddress
| where FailureCount > failureThreshold and TargetAccounts > targetThreshold
| project TimestampFirst, TimestampLast, DurationMinutes =
    datetime_diff("minute", TimestampLast, TimestampFirst),
    SourceIP = IPAddress, DeviceName, FailureCount, TargetAccounts,
    SourceIPs
| order by FailureCount desc
```

**Expected evidence**: IP addresses or devices with excessive failed logons across multiple accounts within a short window.

**Performance notes**: `summarize` on IPAddress and DeviceName groups. The thresholds filter the output. Adjust `failureThreshold` and `targetThreshold` for the environment.

**Common false positives**: Expired service accounts, misconfigured applications, scheduled tasks with stale credentials. Investigate the source IP and the specific accounts targeted.

**Next pivots**: Check successful logons from the same IP within the same window. Check `EntraIdSignInEvents` for related Entra ID activity.

### 8. Phishing Email Recipient Impact

**Purpose**: Given a suspicious sender or subject, identify all recipients and any follow-up actions (clicks, post-delivery events).

**Required inputs**: `SenderFromAddress` or `Subject` keyword (string)

```kusto
// Phishing email impact: trace a suspicious email to all recipients and actions
let lookback = 7d;
let suspiciousSender = "REPLACE_WITH_SENDER_ADDRESS";
EmailEvents
| where Timestamp > ago(lookback)
| where SenderFromAddress == suspiciousSender
    or SenderMailFromAddress == suspiciousSender
| project Timestamp, NetworkMessageId, Subject, SenderFromAddress,
    SenderMailFromAddress, RecipientEmailAddress, DeliveryAction,
    DeliveryLocation, ThreatTypes, DetectionMethods, UrlCount,
    AttachmentCount
| join kind=leftouter (
    EmailPostDeliveryEvents
    | where Timestamp > ago(lookback)
    | project NetworkMessageId, PostDeliveryAction = ActionType,
        PostDeliveryResult = ActionResult, PostDeliveryTimestamp = Timestamp
) on NetworkMessageId
| join kind=leftouter (
    UrlClickEvents
    | where Timestamp > ago(lookback)
    | project NetworkMessageId, ClickedUrl = Url, ClickTimestamp = Timestamp,
        ClickAction = ActionType, IsClickedThrough, ClickingUser = AccountUpn
) on NetworkMessageId
| order by Timestamp desc
```

**Expected evidence**: Delivery status per recipient, post-delivery actions (ZAP, user-reported), and any URL clicks by recipients.

**Performance notes**: Three joins. Keep left side (EmailEvents) small by filtering sender. Time-filter all tables.

**Common false positives**: Marketing emails, newsletters, and bulk mail may be misidentified as suspicious. Verify threat types and detection methods.

**Next pivots**: For clicked URLs, check `DeviceNetworkEvents` for connections to the clicked domains. Check `EmailAttachmentInfo` for malicious attachments.

### 9. URL Click Impact Assessment

**Purpose**: Assess the blast radius of a malicious URL clicked by users.

**Required inputs**: `URL` or `domain` (string)

```kusto
// URL click impact: identify all users who clicked a URL and their devices
let targetUrl = "REPLACE_WITH_URL";
let lookback = 7d;
UrlClickEvents
| where Timestamp > ago(lookback)
| where Url contains targetUrl or UrlChain contains targetUrl
| project Timestamp, AccountUpn, Url, UrlChain, ActionType, IsClickedThrough,
    NetworkMessageId, Workload, ThreatTypes, DetectionMethods
| join kind=leftouter (
    EmailEvents
    | where Timestamp > ago(lookback)
    | project NetworkMessageId, SenderFromAddress, Subject,
        RecipientEmailAddress, DeliveryAction
) on NetworkMessageId
| join kind=leftouter (
    DeviceLogonEvents
    | where Timestamp > ago(lookback)
    | project AccountUpn = tolower(AccountUpn), DeviceName, DeviceLogonTime = Timestamp
) on $left.AccountUpn == $right.AccountUpn
| extend NearClick = abs(datetime_diff("minute", Timestamp, DeviceLogonTime)) < 60
| order by Timestamp desc
```

**Expected evidence**: Users who clicked the URL, the emails that delivered it, which devices those users were active on near the click time, and whether Safe Links allowed or blocked the click.

**Performance notes**: `contains` on Url is necessary for matching. The join to DeviceLogonEvents uses `tolower()` for normalization. The time correlation (`NearClick`) helps identify the most likely device for investigation.

**Common false positives**: URL may appear in `UrlChain` for redirects the user didn't directly click. Check `IsClickedThrough` to confirm.

**Next pivots**: For users who clicked through, check `DeviceProcessEvents` and `DeviceNetworkEvents` on their devices in the hours after the click.

### 10. Email Attachment/Hash Investigation

**Purpose**: Trace a malicious attachment hash through email delivery and endpoint execution.

**Required inputs**: `SHA256` hash (string)

```kusto
// Email attachment investigation: trace attachment from email to endpoint
let targetHash = "REPLACE_WITH_SHA256";
let lookback = 7d;
EmailAttachmentInfo
| where Timestamp > ago(lookback)
| where SHA256 == targetHash
| project Timestamp, NetworkMessageId, FileName, FileType, SHA256,
    ThreatTypes, DetectionMethods, RecipientEmailAddress, SenderFromAddress
| join kind=leftouter (
    EmailEvents
    | where Timestamp > ago(lookback)
    | project NetworkMessageId, Subject, DeliveryAction, DeliveryLocation
) on NetworkMessageId
| join kind=leftouter (
    DeviceFileEvents
    | where Timestamp > ago(lookback)
    | where SHA256 == targetHash
    | project DeviceName, FileEventTime = Timestamp, FolderPath, ActionType,
        FileAccountName = tolower(InitiatingProcessAccountName)
) on $left.RecipientEmailAddress == $right.FileAccountName
| order by Timestamp desc
```

**Expected evidence**: Email delivery details for the attachment and any devices where the file appeared on disk with matching user context.

**Performance notes**: Two joins. Hash matching is indexed. The user correlation between email recipient and file account is approximate.

**Common false positives**: File may exist on device from a different source. Correlate timestamps to confirm the email-to-endpoint delivery chain.

**Next pivots**: For devices where the file appeared, check process execution of the file and network connections.

### 11. Cloud App Activity by User/App/IP

**Purpose**: Investigate cloud application activity for a specific user, application, or source IP.

**Required inputs**: `AccountUpn` or `Application` or `IPAddress` (string)

```kusto
// Cloud app activity investigation
let targetUser = "REPLACE_WITH_UPN"; // use "" to skip
let targetApp = "REPLACE_WITH_APPNAME"; // use "" to skip e.g. "Microsoft Teams"
let targetIP = "REPLACE_WITH_IP"; // use "" to skip
let lookback = 7d;
CloudAppEvents
| where Timestamp > ago(lookback)
| where (isempty(targetUser) or AccountDisplayName == targetUser
    or AccountObjectId == targetUser)
| where (isempty(targetApp) or Application == targetApp
    or ApplicationId == targetApp)
| where (isempty(targetIP) or IPAddress == targetIP)
| project Timestamp, Application, ActionType, ActivityType,
    AccountDisplayName, AccountObjectId, IPAddress, CountryCode,
    UserAgent, DeviceType, ISP, ObjectName, ObjectType,
    IsAdminActivity, IsImpersonated
| order by Timestamp desc
| take 1000
```

**Expected evidence**: Cloud app activities matching the filter criteria, with user, device, and location context.

**Performance notes**: `CloudAppEvents` may not exist in all tenants (not available for GCC). The `isempty()` pattern allows flexible filtering — set unused parameters to `""`.

**Common false positives**: Normal user activity. Focus on anomalous Application, CountryCode, or ActionType combinations.

**Next pivots**: Cross-reference with `EntraIdSignInEvents` for sign-in context. Check `IdentityInfo` for user role and department.

### 12. Lateral Movement Indicators

**Purpose**: Detect potential lateral movement via SMB, RDP, WinRM, PsExec, or WMI.

**Required inputs**: `lookback` (time window)

```kusto
// Lateral movement indicators: logon type 3/10, PsExec, WMI, SMB, RDP
let lookback = 1d;
union
    (DeviceLogonEvents
    | where Timestamp > ago(lookback)
    | where LogonType in ("3", "10")
    | where ActionType in~ ("LogonSuccess", "LogonFailed")
    | where isnotempty(AccountName)
    | project Timestamp, Detection = "LogonType3/10", DeviceName,
        AccountName, SourceIP = RemoteIP, ProcessName = InitiatingProcessFileName,
        LogonType, ActionType),
    (DeviceNetworkEvents
    | where Timestamp > ago(lookback)
    | where RemotePort in (445, 3389, 5985, 5986, 135)
    | project Timestamp, Detection = strcat("Port", tostring(RemotePort)),
        DeviceName, AccountName = LocalAccountName, SourceIP = LocalIP,
        ProcessName = InitiatingProcessFileName, LogonType = "",
        ActionType = ""),
    (DeviceProcessEvents
    | where Timestamp > ago(lookback)
    | where FileName in~ ("psexec.exe","psexesvc.exe","wmic.exe","powershell.exe")
    | where ProcessCommandLine has_any (
        "Invoke-Command", "Enter-PSSession", "New-PSSession",
        "\\\\", "psexec", "wmic /node:", "process call create")
    | project Timestamp, Detection = "SuspiciousRemoteExecution", DeviceName,
        AccountName = AccountName, SourceIP = "", ProcessName = FileName,
        LogonType = "", ActionType = ProcessCommandLine)
| order by Timestamp desc
| take 1000
```

**Expected evidence**: Events suggesting lateral movement: network logons (type 3 for network, type 10 for RDP), connections to admin ports (445/SMB, 3389/RDP, 5985-5986/WinRM, 135/RPC), and remote execution tools.

**Performance notes**: Union of three tables. Each branch is independently filtered. Adjust port list and process list for environment.

**Common false positives**: Legitimate remote administration, SCCM/Intune management, backup operations, vulnerability scanners, and domain controller communication.

**Next pivots**: For source devices, check the full process tree of the initiating process. Check if the source device shows signs of compromise.

### 13. Data Exfiltration Indicators

**Purpose**: Detect potential data exfiltration via large uploads, unusual outbound volume, or email forwarding.

**Required inputs**: `lookback` (time window), optional `volumeThresholdMB` (integer)

```kusto
// Data exfiltration indicators: large outbound transfers and email forwarding
let lookback = 1d;
let volumeThresholdBytes = 100 * 1024 * 1024; // 100 MB
union
    (DeviceNetworkEvents
    | where Timestamp > ago(lookback)
    | where RemoteIPType == "Public"
    | where ActionType == "ConnectionSuccess"
    | summarize TotalBytes = sum(BytesSent), ConnectionCount = count(),
        Destinations = makeset(RemoteIP), FirstSeen = min(Timestamp),
        LastSeen = max(Timestamp),
        ProcessNames = makeset(InitiatingProcessFileName)
        by DeviceName, AccountName = LocalAccountName
    | where TotalBytes > volumeThresholdBytes
    | project Timestamp = FirstSeen, Detection = "LargeOutboundData",
        DeviceName, AccountName, TotalBytesMB = TotalBytes / (1024*1024),
        ConnectionCount, Destinations, ProcessNames, FirstSeen, LastSeen),
    (CloudAppEvents
    | where Timestamp > ago(lookback)
    | where ActionType in~ ("FileDownloaded", "FileUploaded", "FileSyncDownloadedFull")
    | where ActivityType has_any ("Download", "Upload", "Sync", "Export")
    | project Timestamp, Detection = strcat("CloudFileActivity_", ActionType),
        DeviceName = DeviceType, AccountName = AccountDisplayName,
        TotalBytesMB = 0, ConnectionCount = 1,
        Destinations = dynamic_to_json(pack_array(IPAddress)),
        ProcessNames = dynamic_to_json(pack_array(Application)),
        FirstSeen = Timestamp, LastSeen = Timestamp)
| order by FirstSeen desc
| take 500
```

**Expected evidence**: Devices or users with unusually large outbound data transfers, multiple connections to external IPs, or suspicious cloud file activity.

**Performance notes**: `summarize` with `BytesSent` aggregation. Adjust `volumeThresholdBytes` for environment baselines.

**Common false positives**: Legitimate file sync (OneDrive, SharePoint), software updates, backup operations, video conferencing data, and large email attachments.

**Next pivots**: For flagged devices, examine the specific processes making connections. Check for archive creation (`DeviceFileEvents` with `.zip`, `.7z`, `.rar`). Check email forwarding rules.

### 14. Custom Detection Candidate Template

**Purpose**: Convert a hunting query into a production-ready custom detection rule candidate.

**Required inputs**: The hunting KQL and investigation context.

```kusto
// Custom Detection: [Descriptive_Name]
// Description: [What this detection identifies]
// MITRE: [Tactic] / [Technique] / [Sub-technique]
// Required columns for alert: Timestamp, [EntityColumn]

// Query - use ingestion_time() for custom detection time alignment
let detectionWindow = 1d;
DeviceProcessEvents  // Replace with appropriate table
| where ingestion_time() > ago(detectionWindow)
// DO NOT filter on Timestamp for custom detections — use ingestion_time()
// instead. The service pre-filters by detection lookback.
// Add entity-specific filters here:
// | where FileName in~ (...)
// | where ProcessCommandLine has_any (...)
// Add aggregation if needed:
// | summarize (Timestamp, ReportId)=arg_max(Timestamp, ReportId), count() by DeviceId
// | where count_ > 5
// Required output columns:
| project Timestamp, DeviceId, DeviceName, AccountName,
    [AdditionalEntityColumns], [AdditionalEvidenceColumns],
    ReportId  // Include ReportId for alert enrichment
```

**Entity mapping for custom detection wizard**:

| Entity Type | Column | Identifier Type |
|---|---|---|
| Device | `DeviceId` or `DeviceName` | DeviceId or DeviceName |
| Mailbox | `RecipientEmailAddress` | Email |
| Account | `AccountObjectId` or `AccountUpn` or `AccountSid` | AccountObjectId or Upn or Sid |
| IP | `RemoteIP` or `IPAddress` | IP |
| File | `SHA256` or `SHA1` | SHA256 or SHA1 |
| Process | `ProcessCommandLine` + `FileName` | Process |
| URL | `RemoteUrl` or `Url` | URL |

**Custom detection rules**:

- Minimum frequency: 24 hours (default), 12h, 3h, 1h, Continuous (NRT)
- Max 150 alerts per rule per run
- Continuous (NRT) supports single-table queries with no joins/unions and specific operators only
- Required columns for alert enrichment: `Timestamp` (or `TimeGenerated`), `DeviceId`/`DeviceName` (for endpoint tables), `ReportId` (for alert timeline enrichment)
- Avoid filtering on `Timestamp` — use `ingestion_time()` instead. The service pre-filters data based on detection lookback.
- Dynamic alert titles support `{{ColumnName}}` syntax (up to 3 columns per field)
- Custom details support up to 20 key-value pairs, 4 KB total

**Tuning strategy**:

1. Start with a broader detection window and narrow after tuning.
2. Add exclusion lists for known benign processes, IPs, or accounts.
3. Use `count()` aggregations with thresholds to reduce noise.
4. Apply device/account allowlists via `where not()` clauses.
5. Test with historical data before enabling actions.
6. Monitor for false positives in the first week; adjust thresholds.

## Investigation Workflow

### Phase 1: Intake

Identify the investigation parameters:

| Parameter | Options |
|---|---|
| **Objective** | alert triage, user investigation, device investigation, phishing investigation, identity compromise, malware/process investigation, lateral movement, data exfiltration, cloud/SaaS anomaly, custom detection engineering |
| **Primary entity** | user (UPN/SID/ObjectId), device (DeviceName/DeviceId), IP, domain, URL, hash (SHA256/SHA1/MD5), process name, command line, mailbox, AlertId, IncidentId, app/service principal |
| **Time window** | UTC range: e.g., `ago(1d)`, `ago(7d)`, explicit `between(datetime(..) .. datetime(..))` |
| **Expected output** | query only, query + explanation, run query (manual/an API), triage report, detection candidate |

### Phase 2: Schema Selection

1. Choose relevant tables from the Table Selection Guide above based on the objective.
2. Validate tables and columns against Microsoft Docs or live tenant schema.
3. Explain why each table is used.
4. If a table may not exist in the target tenant, provide fallback options (e.g., `IdentityLogonEvents` requires Defender for Identity license).

### Phase 3: Query Construction

Write KQL in stages:
1. **Base filter**: time window + primary entity filter
2. **Entity pivot**: join or where across related tables
3. **Correlation**: time-based or key-based linking
4. **Summarization**: aggregation where needed
5. **Evidence projection**: `project` only needed columns, order by timestamp

Follow all KQL Quality Rules above. Include comments explaining each stage.

### Phase 4: Execution (Manual or API)

**If using Defender portal**: Run the query in Advanced Hunting at `https://security.microsoft.com/hunting`.

**If using API**:
```http
POST https://api.security.microsoft.com/api/advancedhunting/run
Authorization: Bearer {token}
Content-Type: application/json

{"Query": "<KQL>"}
```

- Verify query against schema before execution
- Narrow the query if it would exceed 100K rows or 10 minutes
- Account for API rate limits (45+ calls/min/tenant)
- Do not run destructive response actions through Advanced Hunting

### Phase 5: Result Interpretation

- **Observed facts**: What the query output directly shows (rows, columns, counts).
- **Analyst inference**: What conclusions can be drawn from the patterns.
- **Uncertainty**: What the data cannot confirm (retention gaps, sensor coverage, missing tables).
- **Evidence gaps**: What additional queries or data sources are needed.
- **Recommended pivots**: Next queries to deepen the investigation.

### Phase 6: Detection Conversion (Optional)

If asked to create detection logic:
1. Convert hunting query into scheduled custom detection candidate.
2. Ensure required columns are present: `Timestamp`, entity identifier, `ReportId`.
3. Add severity, title (dynamic if useful), description, MITRE tactic/technique, recommended actions.
4. Include false-positive tuning notes and test strategy.
5. Document expected entity mappings.
6. **Do not create or enable detections through API/automation** unless explicitly requested and supported by approved tool. Currently, no MCP tool supports this.

## Evidence Model

Every finding must be structured with:

| Field | Description |
|---|---|
| Query name | Descriptive name for the query that produced the evidence |
| Table(s) | Advanced Hunting tables queried |
| Time range | UTC time range of the query |
| Entity | Primary entity investigated |
| Observation | Direct output from the query (what was seen) |
| Interpretation | Analyst assessment of what the observation means |
| Confidence | High / Medium / Low / Uncertain with rationale |
| Source reference | Query ID, result snapshot, or API response reference |

## Incident / Investigation Output Schema

### Executive Summary

```
Objective: [What was investigated]
Verdict: [True Positive / False Positive / Inconclusive / Benign Activity]
Confidence: [High / Medium / Low]
Impacted entities: [Devices, users, mailboxes]
Priority: [Critical / High / Medium / Low / Informational]
Recommended next action: [Escalate / Monitor / Close / Investigate further]
```

### Query Plan

| Step | Question | Table(s) | Query/Pivot | Expected Evidence |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |

### KQL

Full KQL with comments, ready for execution.

### Results Interpretation

```
Observed facts:
- [fact 1]
- [fact 2]

Analyst inference:
- [inference 1]
- [inference 2]

Uncertainty:
- [gap 1]
- [gap 2]

Evidence gaps:
- [gap requiring additional data]
```

### Timeline

| Timestamp (UTC) | Entity | Event | Source Table | Notes |
|---|---|---|---|---|
| | | | | |

### Key Evidence

| Source Table | Timestamp | Entity | Observation | Interpretation | Confidence |
|---|---|---|---|---|---|
| | | | | | |

### Verdict Rationale

Explain why the verdict was chosen and what evidence supports it.

### Recommended Actions

- **Immediate**: Actions to take now (isolate device, reset credentials, block sender, etc.)
- **Follow-up hunting**: Additional queries to run
- **Detection improvement**: How to create/modify detection rules to catch this in the future
- **Containment/remediation**: What to change in the environment
- **Owner/team**: Who should handle each action

## Guardrails

1. **Never invent Defender MCP tool names, parameters, or output fields.** If no MCP tool exists, document the gap and provide manual/API fallback.
2. **Never invent Advanced Hunting tables or columns.** Validate against Microsoft Docs or live schema.
3. **Never assume every tenant has every table.** Table availability depends on licensing and configuration.
4. **Never treat query results as full truth.** Data may be incomplete due to retention limits (30 days), licensing gaps, sensor coverage, or ingestion delays.
5. **Never run broad unbounded queries.** Always scope with time filters and entity filters.
6. **Never perform destructive actions or containment automatically.** Isolation, file quarantine, user disable, and email deletion require explicit approval.
7. **Never create/modify custom detections unless explicitly requested.** Creating detection rules in production requires change management.
8. **Never expose secrets, tokens, passwords, or sensitive PII in reports.** Redact sensitive values.
9. **Always state uncertainty and coverage gaps.** A negative result does not equal absence of activity.
10. **Always time-scope queries.** Even exploration queries should use `ago(1d)` or similar.
11. **Never use deprecated table names** (`AADSignInEventsBeta`, `AADSpnSignInEventsBeta`) unless targeting a legacy environment. Prefer `EntraIdSignInEvents` and `EntraIdSpnSignInEvents`.
12. **Entity data refreshes hourly.** `DeviceInfo` and `IdentityInfo` may lag behind real-time events by up to 1 hour.

## Examples

### Example 1: Alert Triage

**Scenario**: An analyst receives AlertId `ALERT-001` and needs to triage it.

**Objective**: Alert triage
**Entity**: AlertId
**Time window**: Alert timestamp +/- 24 hours

**Query Plan**:
1. Retrieve alert metadata from `AlertInfo`
2. Retrieve evidence entities from `AlertEvidence`
3. For devices in evidence, check recent process activity
4. For users in evidence, check recent sign-in activity

**KQL — Step 1: Alert metadata**:
```kusto
let targetAlertId = "ALERT-001";
AlertInfo
| where AlertId == targetAlertId
| project Timestamp, Title, Severity, Category, AttackTechniques,
    ServiceSource, Status
```

**KQL — Step 2: Evidence entities**:
```kusto
let targetAlertId = "ALERT-001";
AlertEvidence
| where AlertId == targetAlertId
| where Timestamp > ago(30d)
| summarize Entities = makeset(strcat(EntityType, ": ", coalesce(DeviceName,
    AccountName, RemoteIP, FileName, ""))), EntityTypes = makeset(EntityType)
    by AlertId
```

**Expected output**: Alert title, severity, category, status, and a list of all associated entities by type.

### Example 2: Device Compromise Investigation

**Scenario**: Device `DESKTOP-001` flagged for suspicious activity.

**Objective**: Device compromise investigation
**Entity**: `DESKTOP-001`
**Time window**: Past 7 days

**Query Plan**:
1. Process timeline (`DeviceProcessEvents`)
2. Network connections (`DeviceNetworkEvents`)
3. Persistence mechanisms (`DeviceRegistryEvents` + `DeviceFileEvents`)
4. User logons (`DeviceLogonEvents`)
5. Device context (`DeviceInfo`)

**See KQL Patterns #2 (Device Process Timeline) and #5 (Network Connections) above.** Combine with:

```kusto
// Persistence check: registry Run keys and scheduled tasks
let targetDevice = "DESKTOP-001";
let lookback = 7d;
union
    (DeviceRegistryEvents
    | where Timestamp > ago(lookback)
    | where DeviceName == targetDevice
    | where RegistryKey has_any (
        @"HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Run",
        @"HKEY_CURRENT_USER\SOFTWARE\Microsoft\Windows\CurrentVersion\Run",
        @"HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services")
    | project Timestamp, Source = "Registry", Key = RegistryKey,
        ValueName = RegistryValueName, ValueData = RegistryValueData,
        ActionType, ProcessName = InitiatingProcessFileName),
    (DeviceFileEvents
    | where Timestamp > ago(lookback)
    | where DeviceName == targetDevice
    | where FolderPath has_any (
        @"Start Menu\Programs\Startup", @"Windows\System32\Tasks",
        @"Windows\Tasks")
    | project Timestamp, Source = "File", Key = FolderPath,
        ValueName = FileName, ValueData = "", ActionType,
        ProcessName = InitiatingProcessFileName)
| order by Timestamp desc
```

### Example 3: Identity Compromise Investigation

**Scenario**: User `user@domain.com` shows anomalous sign-in activity.

**Objective**: Identity compromise investigation
**Entity**: `user@domain.com` (UPN)
**Time window**: Past 7 days

**See KQL Patterns #6 (User Sign-In Investigation) above.** Extend with directory change check:

```kusto
let targetUser = "user@domain.com";
let lookback = 7d;
IdentityDirectoryEvents
| where Timestamp > ago(lookback)
| where TargetAccountUpn == targetUser or AccountUpn == targetUser
| project Timestamp, ActionType, Application, AccountName,
    TargetAccountUpn, DeviceName, DestinationDeviceName,
    AdditionalFields
| order by Timestamp desc
```

**Key questions for identity investigation**:
1. Were there failed logon bursts before a successful logon?
2. Is the sign-in from an unusual country or ISP?
3. Was MFA satisfied or bypassed?
4. Are there signs of token replay (same IP, different device/app)?
5. Did the user's group memberships or roles change recently?
6. Are there any OAuth app consent grants from this user?

### Example 4: Phishing Investigation

**Scenario**: Multiple users reported a suspicious email from `phish@evil.com`.

**Objective**: Phishing investigation
**Entity**: `phish@evil.com`
**Time window**: Past 7 days

**See KQL Patterns #8 (Phishing Email Recipient Impact) above.** Extend with sender reputation:

```kusto
let suspiciousSender = "phish@evil.com";
let lookback = 7d;
EmailEvents
| where Timestamp > ago(lookback)
| where SenderFromAddress == suspiciousSender
| summarize
    EmailCount = count(),
    RecipientCount = dcount(RecipientEmailAddress),
    Recipients = makeset(RecipientEmailAddress),
    Subjects = makeset(Subject),
    FirstSeen = min(Timestamp),
    LastSeen = max(Timestamp),
    DeliveryActions = makeset(DeliveryAction),
    ThreatTypesList = makeset(ThreatTypes),
    DetectionMethodsList = makeset(DetectionMethods)
    by SenderFromAddress
```

### Example 5: URL Click Impact Assessment

**Scenario**: A URL `https://evil.com/payload` was delivered via email. Determine impact.

**Objective**: URL click impact
**Entity**: `evil.com`
**Time window**: Past 7 days

**See KQL Patterns #9 (URL Click Impact Assessment) above.**

### Example 6: Malware Hash Investigation

**Scenario**: Threat intelligence reports SHA256 `abc123...` as malicious. Find it in the environment.

**Objective**: Malware hash investigation
**Entity**: SHA256 `abc123...`
**Time window**: Past 30 days

**See KQL Patterns #4 (File Hash Investigation) above.**

### Example 7: Lateral Movement Hunt

**Scenario**: Proactive hunt for lateral movement indicators across the environment.

**Objective**: Threat hunting - lateral movement
**Entity**: N/A (environment-wide)
**Time window**: Past 24 hours

**See KQL Patterns #12 (Lateral Movement Indicators) above.**

### Example 8: Data Exfiltration Suspicion

**Scenario**: A device shows unusual outbound data volume to an external IP.

**Objective**: Data exfiltration investigation
**Entity**: Device `SERVER-001`
**Time window**: Past 24 hours

**See KQL Patterns #13 (Data Exfiltration Indicators) above.** Narrow to the specific device and extend with file activity:

```kusto
let targetDevice = "SERVER-001";
let lookback = 24h;
DeviceFileEvents
| where Timestamp > ago(lookback)
| where DeviceName == targetDevice
| where ActionType in~ ("FileCreated", "FileRenamed")
| where FileName endswith ".zip" or FileName endswith ".7z"
    or FileName endswith ".rar" or FileName endswith ".tar"
    or FileName endswith ".gz"
| project Timestamp, FileName, FolderPath, FileSize, ActionType,
    ProcessName = InitiatingProcessFileName
| order by Timestamp desc
```

### Example 9: Custom Detection Engineering

**Scenario**: Convert the LOLBin hunting query into a custom detection rule.

**Objective**: Custom detection engineering
**Input**: LOLBin execution hunting query (KQL Pattern #3)
**Output**: Detection candidate with metadata

```
Detection Name: Suspicious LOLBin Execution with Network Activity
Description: Detects LOLBin execution from non-system parent processes
    with network connection activity. Covers PowerShell, wscript,
    cscript, mshta, rundll32, regsvr32, certutil, and other binaries
    commonly abused for code execution.
Severity: Medium
Category: Execution
MITRE Tactic: Execution (TA0002), Defense Evasion (TA0005)
MITRE Technique: T1059.001 (PowerShell), T1218 (System Binary Proxy Execution)
Frequency: Every 3 hours
Lookback: 12 hours

Required columns in output:
    Timestamp, DeviceId, DeviceName, AccountName, FileName,
    ProcessCommandLine, InitiatingProcessFileName,
    InitiatingProcessCommandLine, ReportId

Entity mappings:
    Device: DeviceId (DeviceId)
    Account: AccountName (AccountUpn)
    Process: ProcessCommandLine (Process)
    File: FileName (FileName)

False-positive tuning:
    - Exclude known admin workstations by DeviceName pattern
    - Exclude known software deployment accounts
    - Exclude processes from SCCM/Intune folders
    - Monitor for first 7 days without response actions
    - Adjust frequency if alert volume exceeds 50/day

Test strategy:
    - Run against 7 days of historical data
    - Review all results manually
    - Add exclusions before enabling
    - Enable without response actions first
    - Add response actions (initiate investigation) after 2 weeks of validated results
```

### Example 10: Query Optimization / Debugging

**Scenario**: A custom detection query is timing out or consuming high CPU.

**Debugging steps**:

1. Check query resource usage in the portal (`Hunting > Query resources report`).
2. Verify time filters are applied early in each branch.
3. Replace `contains` with `has` where token matching works.
4. Check for unbounded `join` without time filters on both sides.
5. Reduce the cardinality of `summarize` groups.
6. Use `hint.shufflekey` for high-cardinality joins.
7. Verify `materialize()` is used only for repeated subqueries (not as a default).
8. Check for `search *` or `union *` and replace with explicit table names.
9. Reduce the lookback window.
10. Project only required columns before joins.

**Resource usage interpretation**:
- **Low**: Query is efficient; no action needed.
- **Medium**: Query could be optimized; review filters and joins.
- **High**: Query is consuming excessive CPU; optimization required to avoid throttling.

## Verification

Before delivering any query or analysis:

1. Verify all table names against Microsoft Docs or live schema.
2. Verify all column names exist on the referenced tables.
3. Confirm time filters are present and reasonable.
4. Confirm no unbounded `search *`, `union *`, or `find` without table scoping.
5. Check that `project` columns are sufficient for the investigation objective.
6. If the query will be used as a custom detection, verify `Timestamp` and `ReportId` (or equivalent) are projected.
7. For detection candidates, verify entity mapping columns are present.
8. State confidence level and any evidence gaps.
9. Include the Microsoft Docs reference URL for any schema claim.

## References

This skill is self-contained but references these external standards:

- Microsoft Defender XDR Advanced Hunting documentation (see Source-of-Truth Rules section)
- Kusto Query Language (KQL) documentation: `https://learn.microsoft.com/en-us/azure/kusto/query/`
- MITRE ATT&CK framework: `https://attack.mitre.org/`
- Microsoft Graph Security API: `https://learn.microsoft.com/en-us/graph/api/resources/security-api-overview`
