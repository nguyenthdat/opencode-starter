---
name: filescan
description: "Submit URLs and files to filescan.io for sandbox analysis. Review detonation results: network behavior, process tree, IOCs, signature matches, and MITRE ATT&CK mapping."
compatibility: opencode
metadata:
  domain: secops
  audience: senior-secops-analyst
  edition: "2026.07"
---

# filescan.io URL / File Analysis

Submit URLs and files to filescan.io for sandbox analysis. Review detonation results.

## URL Submission
1. Submit URL to filescan.io.
2. Poll for completion.
3. Review: network connections, HTTP transactions, downloaded files, JS execution, screenshots, signature matches.

## File Submission
1. Submit file or search by hash.
2. Review: static analysis (file type, strings, imports), dynamic analysis (process tree, network, file system, registry), signatures, MITRE ATT&CK mapping.

## IOC Extraction
Extract from report: contacted IPs/domains, dropped file hashes, mutex names, registry keys, HTTP user agents/URLs.

## Correlation
1. Submit extracted IOCs to CTI Correlation Analyst.
2. Check against known benign in company context.
3. Assess malware family and campaign if identifiable.

## Output Structure
1. Submission type and target.
2. Analysis ID and permalink.
3. Verdict: Malicious, Suspicious, Benign, Inconclusive.
4. Key behavioral findings.
5. Extracted IOCs.
6. MITRE ATT&CK mapping.
7. Screenshots (if relevant).
8. CTI correlation.

## Fallback
If filescan.io unavailable: VirusTotal, urlscan.io, ANY.RUN, Joe Sandbox. For URLs: browser investigation with caution.
