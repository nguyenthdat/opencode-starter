---
name: context-first-investigation
description: "Mandatory first step for every SecOps investigation. Extract company context (domains, assets, security stack, known benign) before any analysis begins. Reduces false positives and improves verdict quality."
compatibility: opencode
metadata:
  domain: secops
  audience: senior-secops-analyst
  edition: "2026.07"
---

# Context-First Investigation Workflow

Ensure every investigation starts with company context. Reduces false positives and improves verdict quality.

## Workflow

### 1. Locate Context File
- Ask user for path to company/project context file.
- Supported formats: DOCX, PDF, Markdown, JSON, YAML, plain text.

### 2. Extract Context
- Use Xberg for DOCX/PDF.
- Use direct read for Markdown/JSON/YAML/text.
- Parse structured fields: domains, IP ranges, security stack, assets, known benign.

### 3. Supplement from Web
- If context is sparse, search company name via Exa.
- Gather public info: domains, industry, tech stack, regulatory posture.

### 4. Produce Structured Context
- Output JSON with: company, environment, domains, ip_ranges, cloud_tenants, security_stack, logging_sources, known_benign, critical_assets, regulatory, context_gaps.

### 5. Mark Gaps
- Any field not populated is a gap.
- Output starts with `CONTEXT GAP:` if no file was provided.

## Output to Downstream Agents
Pass the structured context JSON to all agents. Each agent should reference the context in its output.

## Fallback
If no context file and no web results, continue with `CONTEXT GAP: No context available. All findings should be treated with lower confidence.`
