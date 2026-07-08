---
name: commandzero
description: "CommandZero MCP workflow for threat intelligence: IP/domain/hash/URL intelligence, adversary infrastructure analysis, passive DNS, and cross-reference with Cyble."
compatibility: opencode
metadata:
  domain: secops
  audience: senior-secops-analyst
  edition: "2026.07"
---

# CommandZero MCP Workflow

Use CommandZero for threat intelligence queries, IOC enrichment, adversary infrastructure analysis, and passive DNS.

## Query Types

### IP Intelligence
- Geopolitical context, ISP, hosting provider
- Adversary infrastructure: VPN exit, Tor, proxy, bulletproof hosting
- Passive DNS: domains historically resolving to this IP

### Domain Intelligence
- Registration data, DNS records, SSL history
- Passive DNS timeline
- WHOIS history and changes
- Associated malware campaigns

### Hash Intelligence
- Malware family classification
- Detection ratio across engines
- Associated samples, URLs, C2 infrastructure

### URL Intelligence
- URL classification, content analysis
- Redirect chain analysis
- Associated phishing/malware campaigns

## Investigation Flow
1. Query CommandZero with IOC and query type.
2. Cross-reference results with Cyble if both available.
3. Combine passive DNS data with current DNS resolution.
4. Map adversary infrastructure patterns.

## Output Structure
1. IOC queried.
2. CommandZero findings.
3. Passive DNS history.
4. Infrastructure analysis.
5. Cross-reference with Cyble (if available).
6. Overall confidence.

## Fallback
If CommandZero MCP unavailable: Cyble MCP, or open-source (SecurityTrails, PassiveTotal, Shodan).
