---
name: browser-investigation
description: "Capture browser evidence for suspicious websites using CloakBrowser or an approved isolated browser: snapshots, screenshots, DOM/forms, redirects, network requests, and console output. Use for passive phishing-page inspection, rerun capture, or compare page behavior. Not for generic pentesting; interaction, form submission, login, or download requires explicit approval."
compatibility: opencode
metadata:
  domain: secops
  audience: senior-secops-analyst
  edition: "2026.07"
---

# Browser Evidence Capture

Use an isolated, ephemeral browser to capture reproducible webpage evidence. This skill is a capture primitive; `phishing-url-analysis` owns phishing interpretation and scoring.

## Safety Gate

1. Confirm an isolated context with no real profile, cookies, credentials, extensions, or corporate session.
2. Disable automatic downloads and browser persistence.
3. Start with passive navigation, accessibility snapshot, screenshot, DOM inspection, network capture, and console capture.
4. Require explicit user approval before clicking a state-changing control, submitting a form, logging in, uploading data, or downloading a file.
5. Never use real credentials or PII. Never execute downloaded or decoded content.
6. Defang URLs in user-facing output; preserve originals only in access-controlled raw evidence.

## Workflow

1. Record target URL, UTC time, isolation mode, browser/tool version, and approved interaction level.
2. Navigate and wait only as needed for deterministic rendering.
3. Capture accessibility snapshot before a screenshot because it preserves inspectable structure.
4. Extract forms, scripts, iframes, links, redirects, and external resource domains without submitting data.
5. Capture network requests and console messages.
6. If approved interaction is necessary, perform the minimum action and record every click, submission, or download.
7. Save raw captures under `_workspace/raw/browser/` or `_workspace/raw/screenshots/` and register permanent artifacts with `evidence-collection`.

## Output

```yaml
target_url_defanged: string
tool: string
isolation: string
interaction_level: passive | approved-interactive
actions_performed: []
artifacts: []
evidence_ids: []
observations: []
limitations: []
```

If a browser tool is unavailable or isolation cannot be confirmed, return `BLOCKED` for active browsing and recommend passive headers/DNS/CT analysis only.
