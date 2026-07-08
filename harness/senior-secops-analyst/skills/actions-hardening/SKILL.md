---
name: actions-hardening
description: "Produce prioritized, assignable recommended actions from investigation findings. Covers immediate containment, investigation extension, remediation, and control hardening. Formats actions with priority, owner, timeline, implementation, and verification."
compatibility: opencode
metadata:
  domain: secops
  audience: senior-secops-analyst
  edition: "2026.07"
---

# Recommended Actions and Control Hardening

Produce specific, prioritized, assignable actions based on investigation findings.

## Action Taxonomy

### Immediate Response (containment)
- Block IP/domain/URL at firewall/proxy/DNS
- Disable compromised user account
- Isolate affected host
- Revoke compromised credentials or API keys
- Take down phishing domain
- Remove malicious email from inboxes

### Investigation Extension
- Expand hunting scope
- Collect additional logs
- Engage DFIR team
- Notify legal/compliance

### Remediation
- Patch vulnerable systems
- Remove persistence mechanisms
- Rebuild compromised hosts
- Reset credentials
- Remediate cloud misconfigurations

### Control Hardening
- New detection rules (SIEM, EDR, NGFW)
- Conditional access policy changes
- MFA enforcement
- Network segmentation improvements
- Email security rule updates
- Service principal permission reduction
- Logging enablement for unmonitored systems

## Action Format

```
[Priority #] [Category] Action Description
- Owner: [Team/Role]
- Timeline: [Hours | Days | Weeks]
- Implementation: [Specific steps]
- Verification: [How to confirm done]
- Reference: [Evidence ID]
```

## Prioritization
- **P1 (Immediate)**: Active threat containment, Critical severity
- **P2 (24-48h)**: High severity fixes, detection rule creation
- **P3 (1-2 weeks)**: Medium severity remediation, control hardening
- **P4 (1-3 months)**: Low severity improvements, hygiene, documentation
