---
name: phishing-url-analysis
description: "Deep phishing URL investigation: safe, evidence-driven, browser-assisted analysis of suspicious URLs, credential harvesting, malware delivery, brand impersonation, redirect-chain tracing, IOC extraction, internal impact validation, and takedown-ready evidence packages. Use when a user provides a suspicious URL, asks to investigate a phishing link, wants to trace redirects, analyze a credential-harvest page, check for malware delivery, validate internal impact from an email-delivered URL, or produce a takedown package. Do NOT use for generic web pentesting, CTI-only lookup, or general URL safety checks without phishing context."
compatibility: opencode
metadata:
  domain: secops
  audience: senior-secops-analyst
---
# Deep Phishing URL Investigation

Safe, evidence-driven, browser-assisted phishing URL investigation. The goal is to determine whether a URL is malicious, document the threat, extract IOCs, assess internal impact, and produce takedown-ready evidence — without exposing the investigator, the organization, or real user data.

## Scope and Boundaries

This skill investigates **phishing URLs and malicious web infrastructure**. It does not:

- Perform generic web application penetration testing.
- Act as a general-purpose CTI lookup or threat intelligence aggregator.
- Execute destructive actions, exploitation, brute force, or unauthorized scanning.
- Submit real credentials, interact with real user accounts, or use production sessions.

CTI and reputation data are **supporting context only**. The primary verdict must be based on direct observation of the URL, page behavior, infrastructure, and collected evidence.

---

## Safety Model

Every action must be safe by default. These rules are non-negotiable.

### Mandatory Protections

1. **Defang all URLs** in human-readable reports and output. Use `hxxps://example[.]com/path` or `hxxp://192.168[.]1[.]1`.
2. **Never open suspicious URLs** in a normal user browser, on a production machine, or with real user profiles.
3. **Never use real credentials, real sessions, real cookies, real corporate accounts, or production browser profiles.**
4. **Use isolated browser contexts only.** Prefer CloakBrowser for suspicious/cloaked pages. Use Playwright/Firefox DevTools/Chrome DevTools only in sandboxed or ephemeral contexts.
5. **Disable automatic downloads.** Do not download files unless explicitly needed for analysis and confirmed safe to handle.
6. **Do not execute downloaded files.** Store samples in a safe analysis-only location. Hash before any upload.
7. **Do not bypass authentication, paywalls, or access controls.**
8. **Do not attack, exploit, brute force, or scan beyond the target URL/domain scope unless explicitly approved.**
9. **Do not submit real data into forms.** Use fake/test credentials (e.g., `test@example.com` / `FakePass123!`) only when form-submission behavior must be observed and is deemed safe.
10. **Prefer passive observation before interaction.** Inspect the page, DOM, and network behavior before clicking or submitting anything.
11. **Redact sensitive tokens, cookies, API keys, and personal data** from all output.
12. **Keep original URLs in a clearly separated evidence section only.** All display output must use defanged versions.

### Interaction Decision Flow

Before any browser interaction, ask:

1. Is passive inspection sufficient to answer the investigation question? → If yes, do not interact.
2. Would clicking this element submit credentials, trigger a download, or execute code? → If yes, stop and document the risk.
3. Is form submission needed to confirm credential harvesting? → Submit fake/test credentials only if safe.
4. Is downloading a file needed to confirm malware delivery? → Download only to an isolated analysis location, hash first, do not execute.

---

## Tool Discovery and Availability

Before using any browser, MCP, or external tool, inspect what is available and choose the safest option that meets the need.

### Browser/Tool Preference Order

| Priority | Tool | Best For |
|----------|------|----------|
| 1 | CloakBrowser MCP | Suspicious/phishing URL browsing, anti-bot/cloaking investigation, safe rendering |
| 2 | Playwright (isolated context) | Reproducible browser automation, network/DOM capture |
| 3 | Firefox DevTools MCP | DOM/network/source inspection when available |
| 4 | Chrome DevTools MCP | DOM/network/source inspection when available |
| 5 | `curl` / `wget` / `httpie` | Safe header-only checks, redirect tracing, initial non-interactive inspection |
| 6 | CyberChef / local decoding tools | URL decoding, Base64, JavaScript deobfuscation |
| 7 | filescan.io / sandbox | Downloaded file analysis, payload detonation |
| 8 | Cyble | Brand abuse, phishing infrastructure, typosquat domains, credential leak context |
| 9 | CommandZero | Broader incident investigation if URL is part of an active case |
| 10 | Defender / MDO | Email delivery, URL clicks, mailbox impact, alert correlation |
| 11 | Elastic SIEM | DNS/proxy/firewall/NDR logs, internal hit validation |

### Tool Selection Rule

Always pick the **highest-priority available tool** that fits the current step. If a tool is unavailable or fails, fall back to the next available tool and **document the tool used and any limitations introduced**.

---

## Investigation Modes

Select the mode based on the user's request and available context. State the mode at the top of the report.

| Mode | Trigger | Scope |
|------|---------|-------|
| `quick-triage` | Initial assessment, many URLs, time-sensitive | URL breakdown + redirect chain + landing page screenshot + verdict |
| `full-deep-dive` | Single suspicious URL, confirmed incident | All phases: URL → domain → browser → redirects → malware → internal impact → IOCs → takedown |
| `redirect-chain-only` | Shortener, multi-hop, or open-redirect concern | Trace and document every redirect hop; no browser interaction unless JS redirects are present |
| `landing-page-inspection` | Page content is the primary concern | Browser analysis of page: forms, scripts, branding, behavior |
| `credential-harvest-verification` | Suspected credential phishing | Form analysis, credential field identification, exfiltration endpoint, test submission |
| `malware-delivery-verification` | Suspected malware delivery | Download analysis, file inspection, sandbox submission |
| `brand-impersonation` | Suspected brand abuse, typosquat | Domain similarity, logo/brand analysis, WHOIS comparison, Cyble brand context |
| `email-to-url-investigation` | URL extracted from email/alert | Defender/MDO correlation, recipient analysis, click tracking, internal impact |
| `internal-impact-validation` | Confirm whether internal users were affected | DNS/proxy/firewall/NDR log correlation, user click validation |
| `takedown-evidence-package` | Produce takedown-ready output | Consolidated evidence, screenshots, redirect chain, WHOIS, registrar/hosting contacts, suggested wording |

---

## Workflow

### Phase 1: URL Intake and Decomposition

Every investigation starts with careful URL intake.

1. **Preserve the original input** safely in an evidence section. Do not share or log unexpectedly.
2. **Defang immediately** for all display output.
3. **Normalize carefully:** lowercase the scheme and hostname; do not strip query parameters or fragments unless they pose a safety risk.
4. **Decode URL encoding:** resolve `%XX` sequences but preserve the original encoded form for reference.
5. **Extract structural components:**

| Component | Extraction Rule |
|-----------|----------------|
| Scheme | `https`, `http`, `ftp`, etc. |
| Hostname | Full hostname as-is, then IDN/punycode decode |
| Registrable domain | Public suffix + one label (eTLD+1) |
| Subdomain | Everything left of the registrable domain |
| Port | If non-default |
| Path | Full path with segments |
| Query parameters | Key-value pairs, decoded |
| Fragment | After `#` |

6. **Identify suspicious parameters** in the URL:
   - Email addresses (`?email=`, `?user=`, `?login=`)
   - Usernames or account identifiers
   - Base64-encoded blobs (high-entropy strings, `=` padding)
   - Redirect/target URLs (`?redirect=`, `?url=`, `?next=`, `?return=`, `?goto=`)
   - Tracking/marketing IDs (`?utm_*`, `?clickid=`, `?affid=`)
   - Encoded target domains (Base64, URL-encoded domains in parameters)
   - Tenant/company/brand keywords in subdomain or path
   - OAuth/SSO parameters (`?client_id=`, `?state=`, `?nonce=`)

7. **Detect shorteners and redirectors:** known URL shorteners (`bit.ly`, `t.co`, `tinyurl.com`, `ow.ly`, `buff.ly`, `shorturl.at`, `rb.gy`, etc.), marketing click trackers, and URL wrapping services.

8. **Detect open redirect patterns:** parameters that accept a URL as value and cause the server to redirect (`?redirect=`, `?url=`, `?next=`, `?return=`, `?goto=`, `?target=`, `?continue=`, `?r=`).

9. **Detect IDN/punycode/homoglyph risk:** decode punycode hostnames. Check for mixed-script characters, lookalike substitutions (e.g., `m` → `rn`, `l` → `I`, Cyrillic `а` vs Latin `a`), and brand-relevant homoglyphs.

10. **Detect brand similarity/typosquat/lookalike patterns:**
    - Character addition, omission, substitution, transposition
    - Extra subdomain labels (e.g., `login.example.com.evil.com` → the registrable domain is `evil.com`)
    - TLD variation (e.g., `.com` → `.co`, `.org` → `.net`)
    - Hyphenation tricks (e.g., `micro-soft.com` vs `microsoft.com`)
    - Combo-squatting (e.g., `microsoft-login.com`, `paypal-secure.com`)

---

### Phase 2: Domain and Infrastructure Intelligence

Collect infrastructure data as supporting evidence. **Never use any single indicator as the sole basis for a verdict.**

1. **WHOIS/RDAP:**
   - Creation date, last-updated date, expiry date
   - Registrar and registrar abuse contact
   - Registrant organization (if public; redact PII)
   - Nameservers

2. **DNS records:**
   - A / AAAA records → resolved IPs
   - CNAME records → identify CDN, hosting, or alias chains
   - MX records → email infrastructure
   - NS records → DNS hosting
   - TXT records → SPF, DKIM, DMARC, verification tokens

3. **Hosting and network:**
   - ASN and ASN organization
   - Hosting provider / cloud platform
   - IP geolocation (as weak context only — do not use for verdict)

4. **TLS certificate** (if HTTPS):
   - Issuer (CA)
   - Subject CN and SAN list
   - Validity dates (not-before / not-after)
   - Certificate fingerprint (SHA-256)
   - Certificate transparency log entries if available
   - Look for: self-signed, wildcard, mismatched CN/SAN, Let's Encrypt with short validity

5. **Passive DNS** (if available via Cyble or other source):
   - Historical A/AAAA records for the domain
   - Co-hosted domains on the same IP
   - Subdomain enumeration

6. **Related domains/subdomains:**
   - Look for sibling domains registered near the same time
   - Check for similar domains with brand keywords
   - Note any known phishing infrastructure patterns

7. **Reputation/CTI context** (Cyble, CommandZero, or other sources if available):
   - Known phishing/malware categorization
   - Blocklist status
   - Historical abuse reports
   - Brand abuse intelligence (Cyble)

**Guardrail:** Domain age, hosting provider, IP geolocation, and reputation alone do not determine the verdict. Use them as supporting evidence alongside direct observation.

---

### Phase 3: Browser Landing Page Analysis

The browser workflow is stepwise: inspect passively first, interact only when necessary and safe.

#### Step 3.1: Non-Interactive Pre-Flight

Before opening a browser, collect:

- HTTP response headers (via `curl -I -L` or equivalent)
- Redirect chain (status codes, Location headers)
- Content-Type header
- Server header
- Set-Cookie headers (redact cookie values)
- Content-Security-Policy, X-Frame-Options, Strict-Transport-Security
- Final URL after following redirects
- TLS certificate info if available

If the URL returns 4xx/5xx, document it. A 404 today does not mean benign — phishing kits may be temporarily offline, geo-blocked, or user-agent-gated.

#### Step 3.2: Open in Isolated Browser

- **Prefer CloakBrowser MCP** for suspicious or potentially cloaked pages. It provides anti-bot/cloaking capabilities.
- Use Playwright / Firefox DevTools / Chrome DevTools only in an isolated, ephemeral context.
- Clear all storage, cookies, and cache before navigation.
- Set a generic, non-corporate User-Agent (or rotate as needed for cloaking checks).

**Capture:**
- Full-page screenshot (viewport and full-page scroll)
- DOM snapshot / accessibility tree
- Network HAR or equivalent request log
- Console messages (errors, warnings, logs)
- Final URL after all redirects (HTTP + JS + meta refresh)

#### Step 3.3: Page Content Inspection

Inspect the rendered page for:

| Category | What to Look For |
|----------|-----------------|
| **Title** | Mismatch with URL/brand, generic titles, login-related titles |
| **Visible brand** | Logo, name, tagline, copyright — compare with legitimate brand |
| **Images/logos** | Hot-linked from legitimate site, locally hosted copies, broken images |
| **Forms** | `<form>` elements: action URL, method |
| **Input fields** | `type=password`, `type=email`, `type=text` — identify credential fields |
| **Hidden fields** | CSRF tokens, redirect targets, encoded data, tracking fields |
| **Iframes** | Embedded content, cross-origin frames, invisible frames |
| **Scripts** | External domains, obfuscated/minified JS, `eval()`, `document.write()`, `window.location` |
| **External resources** | CSS/fonts/images from legitimate CDN vs attacker-hosted |
| **Meta refresh** | `<meta http-equiv="refresh" content="...">` |
| **JS redirects** | `window.location`, `location.href`, `location.replace()`, `history.pushState()` |
| **Anti-analysis** | Bot detection, CAPTCHA, browser fingerprinting, debugger detection (`debugger;` statements) |
| **Cloaking** | Content that differs by User-Agent, referrer, or IP |

#### Step 3.4: Form Analysis (Credential Harvesting)

When a login form is present:

1. **Identify the form action URL and method** (GET/POST).
2. **Identify credential fields:** password inputs, email/username inputs.
3. **Identify the exfiltration endpoint:** the form `action` URL. Is it:
   - The legitimate brand's domain? (unlikely for real phishing)
   - A lookalike domain?
   - A completely unrelated domain?
   - A compromised legitimate site?
   - An IP address directly?
4. **Determine if credentials are posted to attacker-controlled infrastructure.**
5. **If safe and mode allows,** submit fake/test credentials:
   - Use `test@example.com` / `FakePass123!` or similar
   - Capture the POST request (URL, headers, body)
   - Capture the response (status, headers, body, redirect)
   - Document where the user is redirected after submission
   - Check if the fake credentials are accepted (most phishing pages accept anything)
6. **Do not submit real credentials, real email addresses, or any PII.**

#### Step 3.5: Cloaking Analysis

Phishing pages often show benign content to security scanners and phishing content to target users.

Compare behavior across:

| Dimension | How to Test |
|-----------|-------------|
| User-Agent | Compare mobile vs desktop vs crawler UA strings |
| Headless vs headed | If using Playwright, compare `headless: true` vs `headless: false` |
| Geolocation/proxy | If CloakBrowser supports geo-routing, compare different source IPs |
| Referrer | Navigate directly vs via a referrer (e.g., from an email link) |
| Direct URL vs referrer | Test direct navigation vs clicking from a referring page |

Document:
- Conditions that trigger benign/decoy content vs phishing content
- Specific UA strings, IP ranges, or headers that trigger cloaking
- Screenshots of both versions if different

---

### Phase 4: Redirect Chain Analysis

Trace and document every hop from the input URL to the final landing page.

#### Redirect Types to Trace

| Type | Detection Method |
|------|-----------------|
| HTTP 301/302/303/307/308 | `Location` header in HTTP response |
| HTML meta refresh | `<meta http-equiv="refresh" content="SECONDS;url=TARGET">` |
| JavaScript redirects | `window.location`, `location.href`, `location.replace()`, `location.assign()`, `self.location` |
| Iframe redirects | Iframe that loads a different final page |
| Shortener expansion | Follow the shortener service to the destination |
| Open redirect abuse | Legitimate site redirecting to attacker URL |

#### Output Format: Redirect Chain Table

| Hop | URL | Defanged URL | Status | Method | IP/ASN | Page Title | Notes |
|-----|-----|-------------|--------|--------|--------|------------|-------|
| 1 | `https://short.link/abc` | `hxxps://short[.]link/abc` | 301 | HTTP | - | - | URL shortener |
| 2 | `http://legit-site.com/redirect?url=http://evil.com` | `hxxp://legit-site[.]com/redirect?url=...` | 302 | HTTP | 1.2.3.4 / AS16509 | - | Open redirect |
| 3 | `http://evil.com/login` | `hxxp://evil[.]com/login` | 200 | HTTP | 5.6.7.8 / AS13335 | Microsoft Login | Landing page |

For JavaScript redirects, note the technique used and the target URL.
For meta refresh, note the delay (0 seconds = immediate redirect).

---

### Phase 5: Malware Delivery Analysis

Check for malware delivery behavior. This is critical — do not execute anything.

#### Indicators to Check

| Indicator | What to Look For |
|-----------|-----------------|
| Automatic downloads | Files downloaded on page load without user interaction |
| Download buttons/links | Prominently placed download buttons, especially for invoices, documents, DHL/UPS/FedEx notices |
| Drive-by downloads | Hidden iframes, exploit kit patterns, obfuscated JS that triggers downloads |
| Fake CAPTCHA | Page shows a CAPTCHA that, when clicked, initiates a download |
| Fake browser update | "Your browser is out of date" → download `update.exe` or similar |
| Fake invoice/document | "View your invoice", "Open shipping document", "Your voicemail" → download |
| Archive payloads | `.zip`, `.rar`, `.7z` files, often password-protected |
| Office documents | `.docm`, `.xlsm`, `.pptm` with macros |
| Executable payloads | `.exe`, `.msi`, `.vbs`, `.js`, `.ps1`, `.bat`, `.scr`, `.dll` |
| PDF with links/scripts | PDF that prompts to click links or enable content |

#### Response Protocol

When a download is detected:

1. **Hash the file** (SHA-256 minimum). Do not execute.
2. **Record metadata:** filename, MIME type (reported and actual), file size, download URL.
3. **Check for MIME mismatch:** server reports `text/html` but file is a `.exe`.
4. **Submit to filescan.io or sandbox** if analysis is needed and safe.
5. **Store sample only in a safe analysis location.**
6. **Never execute, never open in a document viewer, never extract archives.**
7. **Redact sensitive file paths from reports.**

---

### Phase 6: Internal Impact Validation

If the URL originated from an email, alert, or user report, correlate with internal data sources to assess organizational impact.

#### Defender / MDO Correlation

Query or check these data sources if available:

| Data Source | Key Fields | What to Determine |
|-------------|-----------|-------------------|
| `EmailEvents` | Sender, recipient, subject, delivery status, email actions | Was the email delivered? To whom? |
| `EmailUrlInfo` | URL, domain, URL location in email | What URLs were in the email? |
| `UrlClickEvents` | URL, user, click time, click action (allowed/blocked) | Who clicked? When? Was it blocked? |
| `EmailPostDeliveryEvents` | Remediation action, ZAP status | Was the email auto-remediated post-delivery? |
| `AlertInfo` / `AlertEvidence` | Alert entities, evidence | Is this URL part of a known alert? |

#### Elastic SIEM Correlation

Search for evidence of internal communication with the phishing domain/IP:

| Log Source | Query Focus | What to Determine |
|-----------|-------------|-------------------|
| DNS logs | Domain resolutions, query timestamps | Which internal hosts resolved the domain? |
| Proxy/web gateway logs | URL access, HTTP requests | Which users/browsers requested the URL? |
| Firewall logs | IP connections, ports | Which hosts established connections to the IP? |
| NDR syslog | Network traffic patterns | Was anomalous traffic detected? |

**NDR-specific context:**

- Candidate index pattern: `logs-udp.syslog*`
- Filter: `ndr_host == "NDR-Manager"`
- Useful metadata: `_index`, `_id`, `_version`

#### Impact Questions to Answer

- How many recipients received the email?
- How many users clicked the URL?
- What was the source email sender?
- What was the delivery status? (delivered, junked, blocked, ZAP'd)
- What post-delivery remediation occurred?
- Which internal hosts resolved or connected to the domain/IP?
- Is there evidence that credentials were submitted?
- Was any malware downloaded or executed internally?

---

### Phase 7: IOC Extraction

Extract and normalize indicators of compromise from all collected evidence.

#### IOC Categories

| Category | Items | Normalization |
|----------|-------|---------------|
| URLs | Original URL, final URL, all redirect URLs, form action URLs, script/resource URLs | Defang for display |
| Domains | All unique domains, subdomains | Registrable domain + subdomain |
| IPs | All resolved IPs | IPv4/IPv6 |
| ASNs | All ASNs | AS number + organization |
| URL patterns | Path patterns for blocking (e.g., `*/login/*`, `*/auth/*`) | Regex or wildcard |
| File hashes | SHA-256 of any downloaded files | Uppercase hex |
| Filenames | Any downloaded or referenced filenames | As-is |
| Email indicators | Sender address, subject, reply-to | Defang email if including in report |
| Certificate fingerprints | TLS certificate SHA-256 fingerprint | Uppercase hex |
| Phishing kit indicators | Specific path patterns, filenames, or headers unique to known kits | As identified |
| Impersonated brand | Which brand is being impersonated | Normalized brand name |

#### Output Rule

- **Defanged IOCs** go in the human-readable report.
- **Raw (undefanged) IOCs** go only in a clearly marked, opt-in "Machine-Action IOCs" section. Never include raw IOCs inline in the main report.
- Label each IOC with its type and source.

---

### Phase 8: Verdict and Confidence

Produce an evidence-based verdict. Do not rely on any single indicator.

#### Verdict Categories

| Verdict | Criteria |
|---------|----------|
| **Benign** | URL is legitimate. No suspicious behavior, no impersonation, expected infrastructure. |
| **Suspicious** | Indicators of concern but insufficient evidence to confirm malicious intent. |
| **Phishing** | Page attempts to harvest credentials, impersonates a brand, or deceives users into providing sensitive information. |
| **Malware Delivery** | URL or page delivers malware, triggers downloads, or leads to exploit kits. |
| **Credential Harvesting** | Specific determination that a form collects and exfiltrates credentials to attacker infrastructure. |
| **Brand Impersonation** | Page uses unauthorized brand logos, CSS, domain similarity, or content to impersonate a legitimate brand. |
| **Inconclusive** | Insufficient evidence to reach any determination (e.g., page is down, geo-blocked, requires authentication). |

Multiple verdicts can apply (e.g., Phishing + Credential Harvesting + Brand Impersonation).

#### Confidence

| Level | Criteria |
|-------|----------|
| **Low** | Limited evidence, single data point, or significant gaps. |
| **Medium** | Multiple indicators align, but some gaps or uncertainties remain. |
| **High** | Multiple independent, corroborating indicators from direct observation. |

#### Severity

| Level | Criteria |
|-------|----------|
| **Informational** | Benign URL, no action needed. |
| **Low** | Suspicious but not confirmed; limited exposure. |
| **Medium** | Confirmed phishing/malware; some internal exposure. |
| **High** | Confirmed threat with significant internal exposure (multiple clicks, credential submission). |
| **Critical** | Active credential harvesting with confirmed credential loss, or malware delivery with confirmed execution. |

#### Verdict Rules

- **Do not** classify as phishing solely because the domain is new or has poor reputation.
- **Do not** classify as benign solely because the page returns 404 or is down at analysis time.
- **Do not** classify solely on CTI/reputation/domain age/hosting provider.
- **Require** direct observation of malicious behavior for Phishing, Credential Harvesting, or Malware Delivery verdicts.
- **Document** the specific evidence that supports each component of the verdict.

---

### Phase 9: Takedown Evidence Package

When the verdict is malicious or suspicious, produce a takedown-ready evidence package.

#### Required Evidence

- Defanged URL and original URL (in evidence section)
- Full-page screenshot(s) showing phishing content
- Redirect chain table
- WHOIS/RDAP details (registrar, creation date, nameservers)
- DNS records
- Hosting ASN and provider
- Phishing form screenshot and exfiltration endpoint
- Impersonated brand identification
- File hashes if malware delivery
- Number of affected users/internal hits if known

#### Takedown Recipients

Determine the appropriate abuse contacts:

| Recipient | When to Contact |
|-----------|----------------|
| **Registrar abuse** | Domain is registered through a registrar with an abuse policy |
| **Hosting provider abuse** | Malicious content is hosted on a specific provider |
| **CDN abuse** | Content is served through a CDN (Cloudflare, Akamai, etc.) |
| **Platform abuse** | Phishing page is hosted on a platform (Google, Microsoft, Shopify, etc.) |
| **Brand protection vendor** | If the organization uses a takedown service |

#### Suggested Takedown Wording Template

Provide a concise, factual, evidence-backed takedown notification including:
- Defanged URL
- Description of malicious activity
- Evidence summary (screenshots, redirect chain, form analysis)
- Specific violation (phishing, credential harvesting, malware delivery, brand impersonation)
- Requested action (suspend domain, remove content, disable hosting)
- Contact information for follow-up

---

## Output Format

Use this report structure. Adapt sections based on the investigation mode.

```markdown
# Phishing URL Analysis Report
**Analysis Date:** [ISO 8601]
**Analyst:** [Analyst identifier if appropriate]
**Mode:** [investigation mode]

## Executive Summary
- **Verdict:** [verdict(s)]
- **Confidence:** [Low / Medium / High]
- **Severity:** [Informational / Low / Medium / High / Critical]
- **URL:** [defanged]
- **Final URL:** [defanged]
- **Impersonated Brand:** [brand or N/A]
- **Primary Risk:** [one-line summary]
- **Recommended Action:** [one-line recommendation]

## Scope and Safety
- **Analysis Mode:** [mode]
- **Browser/Tool Used:** [specific tool and version]
- **Isolation Notes:** [how isolation was achieved]
- **Interaction Performed:** [what was clicked, submitted, or downloaded]
- **Data Submitted:** [fake credentials used or none]
- **Limitations:** [any gaps or blockers]

## URL Breakdown
| Component | Value |
|-----------|-------|
| Original URL | [defanged] |
| Scheme | |
| Hostname | |
| Registrable Domain | |
| Subdomain | |
| Port | |
| Path | |
| Query Parameters | |
| Fragment | |
| Suspicious Parameters | [list] |
| Shortener Detected | [yes/no — service] |
| Open Redirect Detected | [yes/no — parameter] |
| IDN/Homoglyph Risk | [yes/no — details] |
| Brand Similarity | [similarity to brand, typosquat pattern] |

## Redirect Chain
| Hop | Defanged URL | Status | Method | IP/ASN | Page Title | Notes |
|-----|-------------|--------|--------|--------|------------|-------|
| | | | | | | |

## Domain and Infrastructure
| Item | Value | Interpretation |
|------|-------|---------------|
| WHOIS Creation | | |
| Registrar | | |
| Nameservers | | |
| DNS A | | |
| DNS MX | | |
| ASN | | |
| Hosting Provider | | |
| TLS Issuer | | |
| TLS Subject | | |
| TLS SANs | | |
| TLS Fingerprint | | |
| CTI/Reputation | | |

## Browser / Landing Page Findings
| Finding | Evidence | Interpretation | Confidence |
|---------|----------|---------------|------------|
| | | | |

## Credential Harvesting Analysis
- **Form Detected:** [yes/no]
- **Credential Fields:** [list]
- **Form Action:** [defanged URL]
- **Submission Method:** [GET/POST]
- **Exfiltration Endpoint:** [defanged URL — is it attacker-controlled?]
- **Test Submission Performed:** [yes/no]
- **Evidence:** [screenshot, POST capture, response analysis]

## Malware Delivery Analysis
| File / URL | Behavior | Hash (SHA-256) | Sandbox / filescan Result | Notes |
|-----------|----------|----------------|--------------------------|-------|
| | | | | |

## Internal Impact
| Source | Evidence | Affected Entity | Interpretation |
|--------|----------|----------------|---------------|
| | | | |

## IOCs

### Defanged IOCs
- **URLs:** [defanged list]
- **Domains:** [defanged list]
- **IPs:** [list]
- **Hashes:** [list]
- **Email Indicators:** [defanged if applicable]

### Machine-Action IOCs
*(Only include if explicitly needed and approved for automated blocking.)*

## Verdict Rationale

### Observed Facts
[List only directly observed facts — things seen in the browser, in HTTP responses, in certificate data.]

### Tool Results
[Results from tools: WHOIS, DNS, filescan.io, Cyble, Defender, Elastic, etc. Cite the tool and the specific result.]

### Analyst Inference
[Explicitly separate inference from observation. State assumptions clearly.]

### Uncertainty
[What is unknown, what could not be verified, what assumptions could be wrong.]

### Evidence Gaps
[What evidence was missing and why (page down, geo-blocked, requires authentication, etc.).]

## Recommended Actions
- **Block:** [specific blocking recommendations — URLs, domains, IPs, file hashes]
- **Takedown:** [which abuse contacts, suggested wording reference]
- **User/Mailbox Remediation:** [affected users, credential reset, session revocation]
- **Detection Improvement:** [new detection rules, watchlists, hunting queries]
- **Follow-up Hunting:** [what to hunt for, where, over what time period]

## Takedown Evidence Package
[If applicable: consolidated takedown-ready summary with all evidence, contacts, and suggested wording.]
```

---

## Guardrails (Complete Reference)

### Never
- Never browse suspicious URLs in the user's normal browser, on a production machine, or with real profiles.
- Never use real credentials, real cookies, real sessions, or corporate accounts.
- Never submit real user information, email addresses, or PII.
- Never execute downloaded files or open them in document viewers.
- Never perform exploitation, brute force, scanning beyond scope, or unauthorized access.
- Never bypass authentication, paywalls, or access controls.
- Never classify solely on CTI/reputation/domain age/hosting provider.
- Never mark as benign only because the page is down or returns 4xx/5xx.
- Never expose sensitive tokens, cookies, API keys, or personal data in output.

### Always
- Always defang URLs in all human-readable output.
- Always document the specific browser/tool used for each step.
- Always document any interaction performed (clicks, submissions, downloads).
- Always preserve original evidence for reproducibility.
- Always separate observed fact, tool result, analyst inference, and uncertainty in the verdict rationale.
- Always keep raw/original URLs in a clearly separated evidence section.

---

## Example Workflows

### Example 1: Simple Phishing Login Page

**Input:** `https://login-paypal-secure.com/signin`

1. **Intake:** Defang. Extract registrable domain `paypal-secure.com`. Identified as typosquat (extra label + hyphen).
2. **Domain:** WHOIS shows created 3 days ago, privacy-protected, Namecheap. DNS A → Cloudflare IP.
3. **Pre-flight:** `curl -I` → 200, Content-Type text/html. No redirect.
4. **Browser (CloakBrowser):** Navigate. Screenshot shows PayPal login clone. Form detected: `action=POST` to `/auth.php`. Password field present. Hidden field `email_to=hacked@gmail.com`.
5. **Form test:** Submit fake credentials. POST captured to `login-paypal-secure.com/auth.php`. 302 redirect to real `paypal.com`. Credentials accepted (any input works).
6. **Malware:** No downloads detected.
7. **Verdict:** Phishing + Credential Harvesting + Brand Impersonation. High confidence / High severity.
8. **IOCs:** Domain, IPs, form action URL, email indicator.
9. **Takedown:** Registrar abuse contact (Namecheap), hosting provider (Cloudflare).

### Example 2: Cloaked Phishing Page

**Input:** `https://example.com/secure`

1. **Pre-flight:** `curl` with default UA → 200, returns a 404-looking page. Suspicious.
2. **Browser (CloakBrowser, desktop Chrome UA):** Navigate → blank page with "Not Found".
3. **Browser (CloakBrowser, iPhone Safari UA):** Navigate → Microsoft 365 login clone appears.
4. **Cloaking confirmed:** Server checks User-Agent. Mobile UA triggers phishing page.
5. **Phases 2-9 as above.**
6. **Evidence:** Document both views, document the UA condition.
7. **Verdict:** Phishing + Credential Harvesting + Brand Impersonation. Cloaking behavior increases confidence.

### Example 3: Microsoft 365 Credential Harvest

**Input:** `https://login.microsoftonline.com.evil.com/oauth/authorize?client_id=...&redirect_uri=...`

1. **Intake:** Registrable domain is `evil.com` (not `microsoftonline.com`). Subdomain spoofs the legitimate OAuth endpoint. URL contains OAuth-like parameters to appear legitimate.
2. **Domain:** WHOIS → newly registered. Hosted on a VPS provider.
3. **Browser:** Microsoft 365 login page clone. CSS and images hot-linked from legitimate Microsoft CDN. Password field present.
4. **Form analysis:** `action=POST` → `evil.com/submit.php`. Test credentials submitted and accepted. POST response redirects to legitimate `office.com`.
5. **MDO correlation** (if in email-to-url mode): `UrlClickEvents` shows 12 users clicked, 3 submitted credentials.
6. **Verdict:** Phishing + Credential Harvesting + Brand Impersonation. High confidence / Critical severity (confirmed credential loss).

### Example 4: Fake Invoice Malware Download

**Input:** `https://invoice-download.com/view.php?id=abc123`

1. **Browser:** Page displays fake "Your invoice is ready" with a prominent Download button.
2. **Click analysis:** Button triggers download of `Invoice_20260709.zip`.
3. **File analysis:** Hash `ABC123...`. ZIP contains `Invoice_20260709.js`. Magic bytes confirm JavaScript, not an invoice document.
4. **filescan.io:** Submitted. Result: malicious JS downloader, C2 communication detected.
5. **Verdict:** Malware Delivery. High confidence / High severity.

### Example 5: URL Shortener Redirect Chain

**Input:** `https://bit.ly/3xAmPl3`

1. **Shortener expansion:** bit.ly → 301 → `https://tinyurl.com/abc123`.
2. **Second shortener:** tinyurl.com → 301 → `http://compromised-site.com/redirect?url=http://evil.com/phish`.
3. **Open redirect:** `compromised-site.com` 302 → `http://evil.com/phish`.
4. **Landing:** `evil.com/phish` → 200, Office 365 login clone.
5. **Document:** All hops in table. Identify open redirect abuse at `compromised-site.com`.
6. **Verdict:** Phishing + Credential Harvesting + Open Redirect Abuse.

### Example 6: Open Redirect Abuse

**Input:** `https://legitimate-company.com/redirect?url=https://evil.com/login`

1. **Intake:** `legitimate-company.com` is a real, legitimate domain. `url=` parameter allows arbitrary redirect.
2. **Redirect:** 302 → `https://evil.com/login`.
3. **Browser:** `evil.com` hosts a brand login clone.
4. **Verdict:** Phishing + Credential Harvesting + Open Redirect Abuse. The legitimate site has an open redirect vulnerability being actively abused.
5. **Takedown:** Notify both the hosting provider for `evil.com` AND the security team at `legitimate-company.com` about their open redirect.

### Example 7: Brand Impersonation Domain

**Input:** `https://www.linkedln-support.com/verify`

1. **Intake:** `linkedln-support.com` — typo substitution: `i` → `l` (lowercase L → uppercase I). Contains brand keyword.
2. **WHOIS:** New registration, privacy-protected.
3. **Browser:** Full LinkedIn login clone. All links point to the phishing domain or legitimate LinkedIn.
4. **Cyble:** Brand abuse intelligence confirms this domain is in known phishing infrastructure.
5. **Verdict:** Brand Impersonation + Phishing. High confidence.

### Example 8: Email-to-URL Impact Validation

**Input:** URL from a reported phishing email. Full `EmailEvents` data available.

1. **URL intake and decomposition.**
2. **Phases 2-5:** Full domain and browser analysis confirms phishing.
3. **Defender/MDO:**
   - `EmailEvents`: 150 recipients, delivered to 142 (8 blocked).
   - `UrlClickEvents`: 23 unique users clicked. 5 clicked after ZAP started.
   - `EmailPostDeliveryEvents`: ZAP removed from 90 inboxes.
4. **Elastic SIEM:**
   - DNS logs: 15 internal hosts resolved the phishing domain.
   - Proxy logs: 12 hosts made HTTP requests to the URL.
5. **Impact:** 23 clicks, 5 potential credential submissions. 15 hosts communicated with phishing infrastructure.
6. **Verdict:** Phishing + Credential Harvesting. High confidence / Critical severity.
7. **Recommendations:** Credential reset for 5 confirmed clickers. Block domain at proxy/DNS. Hunt for related domains.

### Example 9: Takedown Evidence Package

**Input:** Confirmed phishing URL, all analysis complete.

Output a condensed package:

- Defanged URL and evidence section with original URL
- Screenshot of phishing page (redacted if needed)
- Redirect chain summary
- WHOIS: registrar → Namecheap (abuse@namecheap.com)
- Hosting: AS13335 Cloudflare (abuse@cloudflare.com)
- Phishing form: credential exfiltration to `evil.com/submit.php`
- Impersonated brand: Microsoft (Microsoft brand protection: reportphishing@microsoft.com)
- Affected users: 23 (if internal impact data available)
- Takedown wording: "This domain is hosting a credential harvesting page impersonating Microsoft 365. Evidence attached. Please suspend the domain and disable hosting."
- Recommended recipient: Registrar (first), hosting provider (second), brand protection (third).
```

---

## Investigation Completion Checklist

Before delivering the report, verify:

- [ ] All URLs in the report are defanged (except in a clearly marked Machine-Action IOCs section).
- [ ] Original URLs are preserved only in a separate evidence section.
- [ ] Browser/tool used for each step is documented.
- [ ] All interactions (clicks, submissions, downloads) are documented.
- [ ] No real credentials, sessions, cookies, or PII are present in the output.
- [ ] Downloaded files were hashed and not executed.
- [ ] Verdict is supported by direct observation, not solely by reputation/CTI/domain age.
- [ ] Confidence and severity are stated with justification.
- [ ] IOCs are categorized and defanged appropriately.
- [ ] Takedown contacts are identified if applicable.
- [ ] Evidence gaps and limitations are documented.
- [ ] Verdict rationale separates observed facts, tool results, inference, and uncertainty.
