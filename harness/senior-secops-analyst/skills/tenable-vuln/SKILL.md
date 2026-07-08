---
name: tenable-vuln
description: "Review and prioritize Tenable vulnerability findings. CVE analysis with CISA KEV, EPSS scoring, public exploit PoC search, asset exposure mapping, and prioritization matrix with remediation deadlines."
compatibility: opencode
metadata:
  domain: secops
  audience: senior-secops-analyst
  edition: "2026.07"
---

# Tenable Vulnerability Review

Review and prioritize Tenable vulnerability findings. Analyze CVEs in context of asset exposure and business impact.

## Investigation Flow

### 1. Retrieve Finding
Query Tenable: CVE, CVSS, VPR, affected assets, plugin output. Group by vulnerability or asset.

### 2. External Intelligence
- CISA KEV: https://www.cisa.gov/known-exploited-vulnerabilities-catalog
- EPSS: https://www.first.org/epss
- Search for public exploit PoCs via Exa / GitHub.
- Check if actively exploited in the wild.

### 3. Environmental Context
- Map affected assets to company context: critical vs non-critical.
- Identify internet-facing affected assets (highest priority).
- Check compensating controls: WAF, segmentation, runtime protection, MFA.

### 4. Prioritization Matrix

| CISA KEV | Internet-Facing | Critical Asset | Priority |
|---|---|---|---|
| Yes | Yes | Yes | Critical (48h) |
| Yes | Yes | No | High (7d) |
| Yes | No | Yes | High (7d) |
| Yes | No | No | Medium (14d) |
| No | Yes | Yes | High (7d) |
| No | Yes | No | Medium (14d) |
| No | No | Yes | Medium (14d) |
| No | No | No | Low (30d) |

### 5. Remediation
- Specific patching guidance. If patch unavailable: mitigations (disable feature, restrict access, WAF rule).
- Include verification steps.

## Output Structure
1. CVE ID, CVSS score, VPR score.
2. CISA KEV status and EPSS.
3. Affected assets count and criticality.
4. Internet exposure status.
5. Public exploit availability.
6. Priority and remediation deadline.
7. Remediation steps or mitigation.
8. Verification command.

## Fallback
If Tenable unavailable: use Wiz (cloud), public CVE/NVD data, manual asset inventory.
