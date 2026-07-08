---
name: wiz-cloud
description: "Investigate cloud security issues with Wiz. Query findings, analyze toxic combinations (public exposure + privilege + vuln), assess blast radius, correlate with cloud audit logs, map to compliance frameworks, and produce remediation steps."
compatibility: opencode
metadata:
  domain: secops
  audience: senior-secops-analyst
  edition: "2026.07"
---

# Wiz Cloud Investigation

Investigate cloud security issues using Wiz. Query findings, analyze toxic combinations, assess blast radius, produce remediation guidance.

## Investigation Flow

### 1. Retrieve Finding
- Query Wiz Issues: filter by severity, resource type, cloud platform, status.
- Get full details: description, resource, compliance mapping, remediation steps.

### 2. Analyze Toxic Combinations
Check if the affected resource has:
- Public/internet exposure
- High privileges (admin roles, managed identities with broad scope)
- Known vulnerabilities (CVEs)
- Sensitive data classification

The intersection = toxic combination.

### 3. Blast Radius Assessment
- Trace network paths, IAM role chains, data access from the affected resource.
- Identify resources in same VPC/VNet, security group, subscription.
- Check if lateral movement is possible.

### 4. Audit Log Correlation
- Check cloud audit logs (CloudTrail, Azure Activity Log, GCP Audit Logs) for:
  - Recent modifications
  - Suspicious API calls
  - Unusual access patterns

### 5. Compliance Mapping
Map to: SOC 2, PCI DSS, HIPAA, CIS Benchmarks, NIST 800-53.

### 6. Remediation
Provide specific CLI/console steps with verification commands.

## Wiz GraphQL (API)
```graphql
query IssuesQuery {
  issues(filter: {status: [OPEN], severity: [CRITICAL, HIGH]}) {
    nodes {
      id, severity, status, createdAt
      issueType { name, description }
      projects { name }
      vulnerableAsset { type, name, providerUniqueId }
    }
  }
}
```

## Output Structure
1. Finding ID and summary.
2. Resource details (name, type, cloud, region).
3. Severity and compliance impact.
4. Toxic combinations found.
5. Blast radius assessment.
6. Related audit log events.
7. Remediation steps with verification.
8. Recommended detection rules.

## Fallback
If Wiz unavailable: use AWS Security Hub/Config, Azure Security Center, GCP Security Command Center.
