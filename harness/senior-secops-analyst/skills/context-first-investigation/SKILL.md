---
name: context-first-investigation
description: "Build, refresh, validate, or summarize SecOps environment context and classify it as strong, usable, weak, or missing. Use when the orchestrator needs a context gate, when the user asks to create/update context, or for partial context refresh and freshness audit. This prepares context; it does not perform the investigation."
compatibility: opencode
metadata:
  domain: secops
  audience: senior-secops-analyst
  edition: "2026.07"
---

# Context-First Investigation

The SecOps orchestrator enforces a context gate because verdicts made without environment context cause false positives, missed detections, and misclassified severity. This skill locates, validates, builds, and prepares structured context for that gate.

This is a context gate, not an investigation skill by itself. After context is loaded, delegate to the correct investigation skill.

## Mandatory First Step Rule

Before any SecOps, CloudSec, threat hunting, phishing, vulnerability, brand protection, identity, endpoint, or incident response task:

1. Locate existing context automatically.
2. Validate context freshness and quality.
3. Update or create context when missing, stale, or weak.
4. Extract only context relevant to the current investigation.
5. Pass structured context to all downstream agents.

Do not begin analysis before context is loaded. Do not make high-confidence verdicts with missing or weak context.

## Context Lookup Order

Search automatically in this order. Do not ask the user for a path unless every location fails and no MCP/internal source can provide context.

1. `_workspace/00_system_context.md`
2. `_workspace/system-context.md`
3. `_workspace/reports/system-context.md`
4. `context.md`
5. `company-context.md`
6. `project-context.md`
7. `docs/` directory
8. `architecture/` directory
9. `README.md`
10. `.opencode/` directory
11. `harness/` directory
12. Uploaded or attached local context files (if present)
13. Jira MCP / Confluence MCP (if available — read-only)
14. Wiz MCP (if available — read-only)
15. Defender MCP / Advanced Hunting (if available — read-only)
16. Elastic SIEM (if available — read-only)
17. Tenable MCP (if available — read-only)
18. Cyble MCP (if available — read-only)
19. GitHub MCP (if available — read-only)
20. Azure CLI / cloud CLIs (if available — read-only)
21. Public web/search — supplement only, never primary internal truth

## When to Use

Use for:
- All SecOps investigations and alert triage
- Phishing, brand, and external risk investigations
- Cloud security and vulnerability investigations
- Identity and endpoint investigations
- Threat hunting
- Incident response
- Report generation

## When Not to Use

This skill prepares context only. After context is loaded, delegate to the correct investigation skill (alert-triage, phishing-url-analysis, wiz-cloud, defender-advanced-hunting, elastic-siem, splunk-siem, tenable-vuln, cyble-cti, brand-protection, azure-entra-review, browser-investigation, etc.).

## Workflow

### Phase 1: Context File Discovery

Search automatically for existing context files using `glob`, then `read` exact matches. Follow the lookup order above. Prefer the active-run technical baseline. If any context file is found, read it fully.

If automatic discovery finds nothing and no MCP/internal source context is available, ask the user briefly: "No context file or internal source found. Do you have a context file path?" Provide the missing-source list.

### Phase 2: Freshness and Quality Check

Evaluate the discovered context against these criteria:

- **Last updated date**: More than 90 days old is potentially stale. More than 180 days is stale.
- **Source coverage**: Which MCP tools, internal docs, and cloud sources contributed?
- **Stale assumptions**: Claims not verified against current tool data.
- **Missing owners**: Assets or services with no assigned team.
- **Missing environment classification**: Entities not mapped to prod/staging/dev/QA/demo/sandbox/malware-lab.
- **Missing telemetry map**: Log sources not documented.
- **Missing cloud/account mapping**: Cloud accounts, subscriptions, or projects not mapped.
- **Missing known benign/noise list**: No documented safe exclusions.
- **Missing data gaps**: No documented gaps or limitations.

### Phase 3: Context Quality Classification

Classify context as exactly one of:

**strong** — Has: asset/service mapping, owners, environments, security tools, telemetry coverage, known benign, critical assets, cloud context, and documented gaps. Supported by tool evidence.

**usable** — Has enough domains, assets, and security stack information to reduce false positives. Some sections may be incomplete but core coverage exists.

**weak** — Partial context only. Missing owners, environments, or telemetry coverage. Confidence must be reduced. Prepend output with `CONTEXT WEAKNESS:`.

**missing** — No meaningful internal context. Prepend output with `CONTEXT GAP:`. Do not make high-confidence environment-specific claims.

### Phase 4: Context Build or Update

If context is missing, stale, or weak:

1. The SecOps Lead dispatches the **system-context-analyst** subagent. Provide the current investigation scope and discovered context files as input.
2. The system-context-analyst maps architecture, assets, owners, environments, security tools, telemetry coverage, cloud accounts, identity systems, known constraints, and data sources.
3. It writes `_workspace/00_system_context.md` for the active run.
4. Use Jira, Confluence, Wiz, Defender, Elastic, Tenable, Cyble, GitHub, and Azure only in read-only mode. Do not create tickets, pages, detections, remediations, or cloud resources.
5. Preserve uncertainty. Mark unverified claims as "needs verification." Document every unavailable source as a gap.

If the system-context-analyst is unavailable, build the best possible context from available files and MCP tools, marking all gaps explicitly.

### Phase 5: Current Investigation Context Extraction

From the loaded or generated context, extract only what is relevant to the current case:

- Company, domain, brand, scope
- Affected service, product, or asset
- Owner and team
- Environment classification (prod/staging/dev/QA/demo/sandbox/malware-lab)
- Criticality of affected assets
- Known benign/noisy systems that could explain the activity
- Security stack coverage for the affected environment
- Relevant log sources and their retention
- Cloud accounts, subscriptions, or projects in scope
- Asset inventory references
- Detection and telemetry gaps that affect this investigation
- Prior related incidents or known exceptions

### Phase 6: Structured Context Output

Produce a compact context object. Every field must be populated from evidence or marked as unavailable.

```json
{
  "context_status": "strong | usable | weak | missing",
  "context_sources": ["list of source paths, tool names, or MCP servers used"],
  "company": "",
  "scope": "",
  "domains": [],
  "brands": [],
  "ip_ranges": [],
  "assets": [],
  "critical_assets": [],
  "owners": [],
  "environments": [],
  "cloud": {
    "aws": [],
    "azure": [],
    "gcp": [],
    "kubernetes": []
  },
  "identity": {
    "providers": [],
    "important_entities": [],
    "gaps": []
  },
  "security_stack": [],
  "logging_sources": [],
  "known_benign": [],
  "known_noisy_systems": [],
  "known_labs_or_sandboxes": [],
  "telemetry_gaps": [],
  "context_gaps": [],
  "confidence_impact": "none | reduced | severely_reduced | cannot_rely",
  "required_next_context_actions": []
}
```

### Phase 7: Context Handoff to Downstream Agents

Every downstream agent must receive:

- **Context summary** — the relevant extracted fields from Phase 5.
- **Context status** — strong, usable, weak, or missing.
- **Known benign/noisy exceptions** — entities that could produce false positives.
- **Relevant data sources** — which security tools and log sources apply.
- **Confidence impact** — how context quality affects verdict confidence.
- **Gaps** — which missing data affects the investigation.

Downstream agents must:
- Read and reference the context summary before producing conclusions.
- Cite or reference context sources where possible.
- Consider known benign, noisy, lab, and sandbox systems.
- Use relevant log and security tools from the context.
- Lower confidence when context gaps exist.

## Confidence Impact Rules

Investigation confidence must be reduced when any of these are true:

- No context file exists.
- Asset owner is unknown.
- Environment classification is unknown.
- Telemetry coverage is unknown.
- Logs are missing, stale, or have unknown retention.
- The entity might belong to demo, sandbox, malware-lab, or QA.
- No known benign/noise list exists.
- Cloud account, subscription, or project cannot be mapped.
- Public-only context is used (no internal verification).

Confidence labels:
- **none**: Context is strong. Use normal evidence-based confidence.
- **reduced**: Context is weak. Lower confidence by one tier (e.g., High → Medium).
- **severely_reduced**: Context is missing key elements. Confidence cannot exceed Low.
- **cannot_rely**: No internal context. All findings are provisional.

## Output Prefix Rules

Prepend these prefixes to the context output based on quality:

**Missing context:**
```
CONTEXT GAP: No reliable internal context available. Findings must be treated with lower confidence until environment context is collected.
```

**Weak context:**
```
CONTEXT WEAKNESS: Internal context is incomplete. Confidence is reduced for environment-specific conclusions.
```

**Stale context:**
```
CONTEXT STALE: Existing context may be outdated. Validate owners, assets, and telemetry before final verdict.
```

## Output Format

Produce output in this structure:

### Context Status
- **Status**: strong / usable / weak / missing
- **Freshness**: last updated date and staleness assessment
- **Sources**: list of files, MCP tools, and internal sources used
- **Confidence impact**: none / reduced / severely_reduced / cannot_rely

### Relevant Context for This Investigation
- **Company / scope**:
- **Assets / entities**:
- **Owners**:
- **Environment**:
- **Criticality**:
- **Known benign / noisy**:
- **Security tools / log sources**:
- **Cloud / identity context**:
- **Gaps**:

### Structured Context JSON
Provide the compact JSON object from Phase 6.

### Required Next Context Actions
For each gap:
- **Missing source**:
- **Impact**:
- **Recommended collection step**:

## Evidence and Workspace Rules

All context evidence and derived context files must live under `_workspace/`:

- Save raw source evidence under `_workspace/raw/`.
- Save extracted context under `_workspace/derived/summaries/`.
- Save or update `_workspace/00_system_context.md` for the active run.
- Record important context evidence using the evidence-collection skill (assign evidence IDs, write manifest entries).
- Reference evidence IDs when available.

Do not store context evidence outside `_workspace/`. Do not expose secrets or sensitive PII.

## Source Priority

Use sources in this priority order. Public web is always the last resort for supplement only:

1. Internal context files (system-context.md, docs/, architecture/, README.md, .opencode/)
2. Jira MCP / Confluence MCP (read-only)
3. Wiz MCP (read-only)
4. Elastic SIEM (read-only)
5. Defender MCP / Advanced Hunting (read-only)
6. Tenable MCP (read-only)
7. Cyble MCP (read-only)
8. GitHub MCP (read-only)
9. Azure CLI / cloud CLIs (read-only)
10. Public web/search — supplement only, never primary internal truth

Public web can help identify public domains, public products, public cloud/service exposure, company industry, public documentation, and public GitHub/org references. It must not override internal sources. Mark public context as lower confidence unless validated internally.

## System Context Integration

If the technical baseline is missing, stale, or insufficient, the SecOps Lead dispatches **system-context-analyst** to create or update it before dependent analysis.

The system-context-analyst is defined at `harness/senior-secops-analyst/teams/system-context-analyst.md`. It writes `_workspace/00_system_context.md`. Other specialists return handoff requests to the lead instead of dispatching it directly.

## MCP and Tool Rules

- Inspect available MCP tools with `list_mcp_resources` and `list_mcp_resource_templates` before claiming context coverage.
- Use only real available tools. Do not assume a tool is connected unless confirmed.
- If a source is unavailable, mark it as a gap. Do not invent its output.
- Use read-only discovery only. Never create or modify Jira tickets, Confluence pages, cloud resources, detections, scan configs, takedowns, blocks, or remediation state.

## Guardrails

- Do not ask the user for a context path before automatic search. Search the lookup order first.
- Do not invent company context, domains, owners, tools, architecture, or cloud accounts. Every claim must be traceable to a source.
- Do not use public web as primary internal truth. It supplements only.
- Do not treat missing context as benign. Absence of context is a gap, not safety.
- Do not ignore demo, sandbox, malware-lab, or QA context. These environments produce different signals than production.
- Do not make high-confidence environment-specific claims with weak or missing context.
- Do not modify Jira, Confluence, cloud resources, security tools, or detection configurations.
- Do not expose secrets, credentials, tokens, private keys, or sensitive PII.
- Always state context gaps.
- Always pass context status and relevant context to downstream agents.
- Always save context evidence under `_workspace/`.
- Always record important context evidence using evidence-collection.

## Fallback

If no context file exists and no internal tools are available, output:

```
CONTEXT GAP: No reliable internal context available. Findings must be treated with lower confidence until environment context is collected.
```

Then provide the minimal public/non-sensitive context if available (company name, public domains, industry from web search) and list exactly what is missing:

- Missing: system-context.md, internal docs, asset inventory, owner mapping
- Missing: environment classification, known benign list, telemetry map
- Missing: cloud account mapping, identity system context, security tool coverage

Mark all public-only context as lower confidence.
