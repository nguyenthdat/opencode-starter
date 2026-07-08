---
name: azure-entra-review
description: "Review Microsoft Entra ID (Azure AD) and Azure security configuration using Azure CLI and Microsoft Graph API. Covers conditional access, MFA coverage, PIM, service principals, guest users, sign-in audit, legacy auth, and CIS benchmarking."
compatibility: opencode
metadata:
  domain: secops
  audience: senior-secops-analyst
  edition: "2026.07"
---

# Azure CLI / Entra ID Configuration Review

Review Entra ID and Azure security configurations using Azure CLI and Microsoft Graph API.

## Review Checklist

### Conditional Access
```bash
az rest --method GET --url "https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies"
```
Check: MFA for all users, named locations, minimal exclusions, block legacy auth, compliant device requirement.

### MFA Coverage
```bash
az rest --method GET --url "https://graph.microsoft.com/v1.0/reports/authenticationMethods/userRegistrationDetails"
```
Check: MFA registration %, break-glass exclusions, FIDO2/Passwordless coverage.

### Privileged Identity Management (PIM)
```bash
az rest --method GET --url "https://graph.microsoft.com/v1.0/roleManagement/directory/roleDefinitions"
az rest --method GET --url "https://graph.microsoft.com/v1.0/roleManagement/directory/roleAssignmentSchedules"
```
Check: Zero permanent admin for high-privilege roles, PIM requires MFA + justification.

### Service Principals & App Registrations
```bash
az ad app list --all
az ad sp list --all
```
Check: Expired credentials, overly broad permissions (Application.ReadWrite.All), unused apps, owner count.

### External / Guest Users
```bash
az rest --method GET --url "https://graph.microsoft.com/v1.0/users?$filter=userType eq 'Guest'"
```
Check: Guest invitation settings, guests with admin roles, stale guests.

### Sign-In & Audit Logs
```bash
az monitor activity-log list --start-time <ISO8601>
az rest --method GET --url "https://graph.microsoft.com/v1.0/auditLogs/signIns?$top=100"
```
Check: Risky sign-ins, SP sign-ins from unusual locations, legacy protocol usage.

### Legacy Auth
```bash
az rest --method GET --url "https://graph.microsoft.com/v1.0/policies/authenticationMethodsPolicy"
```
Legacy authentication should be blocked tenant-wide.

## Output Structure
1. Tenant ID and review scope.
2. Findings by category (severity, resource, description, recommendation, remediation command).
3. Compliance benchmark reference (CIS Azure AD, Microsoft baseline).
4. Prioritized action list.

## Fallback
If Azure CLI unavailable, note gap. Manual checks possible via Azure Portal screenshots.
