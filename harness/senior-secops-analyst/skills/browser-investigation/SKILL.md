---
name: browser-investigation
description: "Browser-based investigation using CloakBrowser MCP, Playwright, Chrome DevTools, and Firefox DevTools. Phishing page analysis, suspicious website reconnaissance, JS deobfuscation, and network traffic capture."
compatibility: opencode
metadata:
  domain: secops
  audience: senior-secops-analyst
  edition: "2026.07"
---

# Browser-Based Investigation

Use CloakBrowser MCP, Chrome DevTools, Firefox DevTools, and Playwright for security investigations.

## Tools

### CloakBrowser MCP
- `browser_navigate` — navigate to URL
- `browser_snapshot` — accessibility snapshot (preferred over screenshot for structural analysis)
- `browser_take_screenshot` — full-page or element screenshot
- `browser_evaluate` — run JS on page (extract forms, links, redirects)
- `browser_network_requests` — capture all network requests
- `browser_console_messages` — capture console logs and errors
- `browser_click`, `browser_type`, `browser_fill_form` — interact with forms
- `browser_wait_for` — wait for text or time

## Investigation Patterns

### Pattern 1: Phishing Page Analysis
1. Navigate, wait for JS execution (3-5s).
2. Full-page screenshot + accessibility snapshot.
3. Extract: `<form>`, `<script>`, `<iframe>` via `browser_evaluate`.
4. Submit test credentials, capture POST request.
5. Check for post-submit redirect.

### Pattern 2: Suspicious Website Reconnaissance
1. Navigate, screenshot.
2. Check network requests: external domains, tracking pixels, hidden iframes.
3. Check console: errors, obfuscated logs, crypto miners.
4. Extract all `<a href>` links.
5. Check SSL certificate validity.

### Pattern 3: JavaScript Deobfuscation
1. Extract all `<script>` content via `browser_evaluate`.
2. Pipe to CyberChef for decoding/deobfuscation.
3. Analyze for: redirects, form exfiltration, keylogging, exploit kit behavior.

### Pattern 4: Network Traffic Capture
1. `browser_network_requests` for all requests.
2. Filter: external domains, large POST bodies, unusual User-Agents.
3. Identify C2 communication (beaconing, periodic POSTs).

## Safety Rules
- Always use isolated/incognito context.
- Never use real credentials.
- Consider SSH SOCKS proxy for additional isolation.
- Do not download and execute files from browser session.
- Screenshot and snapshot before interacting.
