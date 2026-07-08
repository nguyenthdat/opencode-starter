---
name: phishing-url-analysis
description: "Deep-dive phishing URL analysis: URL decoding, domain intelligence, landing page inspection via CloakBrowser, redirect chain tracing, credential harvest detection, malware delivery check, IOC collection, and takedown guidance."
compatibility: opencode
metadata:
  domain: secops
  audience: senior-secops-analyst
  edition: "2026.07"
---

# Phishing URL Deep Analysis

Deep-dive analysis of phishing URLs: page inspection, credential harvesting detection, redirect chain tracing, and IOC collection.

## Workflow

### 1. URL Defanging and Decoding
- Defang URL: `hxxps://example[.]com/path`
- Decode URL encoding, Base64, obfuscation using CyberChef.
- Extract: root domain, subdomain, path, query parameters.

### 2. Domain Intelligence
- WHOIS: registrar, creation date, expiry, registrant.
- DNS: A, AAAA, MX, NS, CNAME records.
- SSL certificate: issuer, subject, SAN list, validity dates.
- CTI check (Cyble, CommandZero).

### 3. Landing Page Analysis (Browser)
- Navigate via CloakBrowser MCP or Playwright.
- Full-page screenshot.
- Analyze source: `<form>` elements (credential harvesting), `<script>` blocks (obfuscated JS, redirects), `<iframe>` (embedded content).
- Check for brand impersonation: logos, CSS, domain similarity.
- Submit test credentials to form; capture POST request.

### 4. Redirect Chain
- Trace HTTP 301/302 and JS/HTML redirects.
- Document each hop: URL, IP, HTTP response code, page title.
- Identify open redirect abuse.

### 5. Malware Delivery Check
- Inspect for automatic downloads.
- Check for exploit kit signatures (obfuscated JS, Flash/Java payloads).
- Submit downloaded files to filescan.io.

### 6. IOC Collection
Phishing domain, IPs, subdomains, email sender, file hashes, redirect chain URLs, URL pattern for blocking.

### 7. Takedown Guidance
- Hosting provider abuse contact.
- Domain registrar abuse contact.
- Template takedown notification.

## Safety Rules
- Always defang URLs before displaying.
- Never submit real credentials; use fake/test credentials.
- Use isolated browser context (CloakBrowser or sandboxed Playwright).
