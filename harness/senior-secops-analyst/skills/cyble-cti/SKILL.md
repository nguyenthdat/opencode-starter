---
name: cyble-cti
description: "Correlate IOCs against Cyble threat intelligence. IP/domain/URL/hash/email reputation lookup with threat actor attribution, campaign context, MITRE ATT&CK mapping, and first-seen/last-seen analysis."
compatibility: opencode
metadata:
  domain: secops
  audience: senior-secops-analyst
  edition: "2026.07"
---

# Cyble CTI Correlation

Correlate IOCs against Cyble threat intelligence for reputation, threat actor attribution, and campaign context.

## Lookup Types

| IOC Type | Information Returned |
|---|---|
| IPv4 / IPv6 | Malicious history, malware family, threat actor, first/last seen, geolocation |
| Domain | Malicious history, phishing association, malware C2, registrar info |
| URL | Malicious content, redirect chain, malware delivery |
| File Hash (MD5/SHA1/SHA256) | Malware family, detection names, first seen, associated campaigns |
| Email Address | Phishing association, breach presence, domain info |

## Correlation Steps
1. Submit IOC to Cyble with correct type selector.
2. Review reputation: Malicious, Suspicious, Benign, Unknown.
3. Extract threat actor, campaign, malware family if available.
4. Map TTPs to MITRE ATT&CK.
5. Check first-seen/last-seen dates for recency.
6. Identify related IOCs (same campaign, actor, infrastructure).
7. Cross-reference with CommandZero if available.
8. Check FP risk: CDN IPs, shared hosting, public DNS, SaaS services.

## Output Structure
1. IOC and type.
2. Cyble reputation.
3. Threat actor / campaign attribution.
4. MITRE ATT&CK techniques.
5. First seen / last seen.
6. Related IOCs.
7. FP risk assessment.
8. Confidence score.

## Fallback
If Cyble MCP unavailable: CommandZero MCP, or open-source (AlienVault OTX, VirusTotal API, AbuseIPDB).
