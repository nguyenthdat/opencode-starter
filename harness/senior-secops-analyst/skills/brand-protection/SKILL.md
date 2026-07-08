---
name: brand-protection
description: "Investigate brand impersonation, typosquatting, and domain abuse. Generate typosquat permutations, triage live domains, screenshot phishing pages, analyze SSL/WHOIS, assess threat, and provide takedown guidance."
compatibility: opencode
metadata:
  domain: secops
  audience: senior-secops-analyst
  edition: "2026.07"
---

# Brand Protection / Typosquat Investigation

Investigate brand impersonation, typosquatting, and domain abuse.

## Workflow

### 1. Typosquat Generation
- Use `dnstwist` or manual permutation for each company domain.
- Techniques: omission, repetition, replacement, transposition, homoglyph, bitsquatting, TLD variation.
- For each permutation, resolve DNS.

### 2. Live Domain Triage
For each resolving domain:
- WHOIS: registrar, creation date, registrant.
- SSL certificate (crt.sh).
- Navigate via CloakBrowser: screenshot, check forms/login/brand logos.
- Classify: active phishing, parked, redirect, for sale, benign, not responding.

### 3. Threat Assessment
- Active phishing: document credential harvesting mechanism.
- Malware delivery: document payload delivery method.
- Brand confusion: domain similarity score.
- Executive impersonation: domain matches executive names.

### 4. CTI Correlation
Check domains against Cyble, CommandZero, VirusTotal. Look for campaign associations, SSL certificate reuse.

### 5. Takedown
- Hosting provider and registrar abuse contacts.
- Draft takedown request with evidence.
- For urgent active phishing: recommend immediate internal DNS block + takedown.

### 6. Proactive Monitoring
Suggest: weekly typosquat sweep, preemptive domain registrations, certificate transparency log monitoring.

## Output Structure
1. Base domains analyzed.
2. Typosquat domains discovered and status.
3. Active phishing pages: screenshots and details.
4. Takedown contacts.
5. IOCs for blocking.
6. Monitoring recommendations.

## Fallback
If DNS tooling limited: Exa web search, crt.sh certificate transparency search, manual generation.
