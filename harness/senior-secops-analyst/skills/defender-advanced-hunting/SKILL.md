---
name: defender-advanced-hunting
description: "Microsoft Defender XDR Advanced Hunting KQL. Covers all tables (DeviceProcessEvents, DeviceNetworkEvents, EmailEvents, IdentityLogonEvents, CloudAppEvents), process chain analysis, network beacon detection, phishing investigation, identity reconnaissance, and cross-table pivots."
compatibility: opencode
metadata:
  domain: secops
  audience: senior-secops-analyst
  edition: "2026.07"
---

# Microsoft Defender Advanced Hunting KQL

Query Microsoft Defender XDR telemetry using KQL in Advanced Hunting.

## Key Tables

| Table | Purpose |
|---|---|
| DeviceEvents | Misc device events (process, network, file, registry) |
| DeviceProcessEvents | Process creation, termination |
| DeviceNetworkEvents | Network connections on devices |
| DeviceFileEvents | File create, modify, delete, rename |
| DeviceRegistryEvents | Registry key operations |
| DeviceLogonEvents | User logon events |
| DeviceImageLoadEvents | DLL/EXE loads |
| EmailEvents | Inbound/outbound email metadata |
| EmailUrlInfo | URLs found in emails |
| EmailAttachmentInfo | Attachments in emails |
| UrlClickEvents | SafeLinks URL clicks |
| IdentityLogonEvents | On-prem AD logon (Defender for Identity) |
| IdentityQueryEvents | AD queries / LDAP enumeration |
| IdentityDirectoryEvents | AD object changes |
| CloudAppEvents | CASB events (M365, SaaS apps) |
| AlertEvidence | Evidence linked to alerts |
| AlertInfo | Alert metadata |

## KQL Patterns

### Process Chain Investigation
```
let suspicious = datatable(name: string)["powershell.exe","cmd.exe","wscript.exe","cscript.exe","mshta.exe","rundll32.exe"];
DeviceProcessEvents
| where Timestamp > ago(1d)
| where ProcessVersionInfoOriginalFileName in~ (suspicious)
| where InitiatingProcessFileName !in~ ("explorer.exe","svchost.exe","services.exe")
| project Timestamp, DeviceName, AccountName, ProcessCommandLine, InitiatingProcessCommandLine
```

### Network Beacon Detection
```
DeviceNetworkEvents
| where Timestamp > ago(1d)
| where RemotePort in (80, 443, 8080, 8443)
| where RemoteIPType == "Public"
| summarize Interval = count(), ConnectionTimes = make_list(Timestamp) by DeviceName, RemoteIP, RemotePort, InitiatingProcessFileName
| where Interval > 50
```

### Email Phishing Detection
```
EmailEvents
| where Timestamp > ago(1d)
| where EmailDirection == "Inbound"
| where ThreatTypes has "Phish" or DetectionMethods has_any ("URL detonation","Attachment detonation")
| project Timestamp, SenderFromAddress, RecipientEmailAddress, Subject, ThreatTypes, DetectionMethods, UrlCount, AttachmentCount
```

### Identity Reconnaissance
```
IdentityQueryEvents
| where Timestamp > ago(1d)
| where QueryType == "SAMR"
| where QueryTarget has_any ("Domain Admins","Enterprise Admins","Administrators")
| project Timestamp, AccountName, DeviceName, QueryTarget, Query
```

## Pivot Strategy
1. Start from entity: DeviceName, AccountName, RemoteIP, SHA256.
2. Join tables: DeviceProcessEvents + DeviceNetworkEvents on DeviceName + time proximity.
3. IdentityLogonEvents + DeviceLogonEvents for cross-domain pivots.
4. EmailEvents + UrlClickEvents for phishing kill chain.

## Fallback
If Defender XDR unavailable, note gap and suggest alternative EDR/SIEM sources.
