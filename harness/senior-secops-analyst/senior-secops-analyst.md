# Senior SecOps Analyst Team

## Team Name

Senior SecOps Analyst

## Purpose

Provide senior-level SecOps analysis: alert triage, threat hunting support, phishing/brand investigation, cloud/security telemetry analysis, and executive-quality reporting. This is an **analyst** team, not a DFIR lab or malware reverse engineering team.

## Execution Model

The **SecOps Lead Analyst** is the primary orchestrator agent running in `mode: all`. It classifies tasks, delegates to specialist subagents via `task()`, manages the shared `_workspace/`, resolves conflicting findings, and delivers the final verdict.

**HARNESS_ROOT** = `harness/senior-secops-analyst`

All subagent prompts live at `${HARNESS_ROOT}/teams/<name>.md`. The lead agent reads each subagent file and spawns it as a `task(subagent_type="general")` with the agent prompt + task-specific context.

## Agents

| Agent | File | Mode | Role | Workspace Output |
|---|---|---|---|---|
| **SecOps Lead Analyst** | `teams/secops-lead-analyst.md` | `all` | Orchestrator: classify, delegate, synthesize, verdict | — (writes all to `_workspace/`) |
| Company Context Analyst | `teams/company-context-analyst.md` | `subagent` | Parse company context, reduce FPs | `_workspace/00_context.json` |
| Alert Triage Analyst | `teams/alert-triage-analyst.md` | `subagent` | Rapid alert triage, TP/FP decision | `_workspace/10_triage.md` |
| Threat Hunting Analyst | `teams/threat-hunting-analyst.md` | `subagent` | Hypothesis-driven hunts | `_workspace/11_threat_hunt.md` |
| Elastic SIEM Analyst | `teams/elastic-siem-analyst.md` | `subagent` | Elastic/Kibana KQL/EQL queries | `_workspace/12_elastic.md` |
| Splunk Analyst | `teams/splunk-analyst.md` | `subagent` | Splunk SPL queries | `_workspace/13_splunk.md` |
| Microsoft Defender KQL Analyst | `teams/microsoft-defender-kql-analyst.md` | `subagent` | Defender XDR Advanced Hunting | `_workspace/14_defender_kql.md` |
| Wiz Cloud Security Analyst | `teams/wiz-cloud-security-analyst.md` | `subagent` | Wiz cloud findings | `_workspace/15_wiz.md` |
| Entra / Azure Config Analyst | `teams/entra-azure-configuration-analyst.md` | `subagent` | Entra ID / Azure security review | `_workspace/16_entra.md` |
| Phishing URL Analyst | `teams/phishing-url-analyst.md` | `subagent` | Phishing page/deep URL analysis | `_workspace/17_phishing.md` |
| Brand Protection Analyst | `teams/brand-protection-analyst.md` | `subagent` | Typosquat, brand impersonation | `_workspace/18_brand.md` |
| CTI Correlation Analyst | `teams/cti-correlation-analyst.md` | `subagent` | IOC enrichment, threat intel | `_workspace/19_cti.md` |
| Vulnerability Exposure Analyst | `teams/vulnerability-exposure-analyst.md` | `subagent` | CVE assessment, prioritization | `_workspace/20_vuln.md` |
| Automation Flow Designer | `teams/automation-flow-designer.md` | `subagent` | SOAR playbook design | `_workspace/30_automation.md` |
| Evidence Reviewer | `teams/evidence-reviewer.md` | `subagent` | QA, chain-of-reasoning audit | `_workspace/90_review.md` |
| Report Writer | `teams/report-writer.md` | `subagent` | Report generation, DOCX output | `_workspace/91_report.md` |

## Workspace

All agents share context through `_workspace/` under the harness root.

### Workspace Layout
```
_workspace/
├── 00_context.json           # Company context (mandatory first artifact)
├── 01_task.md                # Task classification and scope
├── 10_triage.md              # Alert triage output
├── 11_threat_hunt.md         # Threat hunting output
├── 12_elastic.md             # Elastic SIEM output
├── 13_splunk.md              # Splunk output
├── 14_defender_kql.md        # Defender KQL output
├── 15_wiz.md                 # Wiz cloud output
├── 16_entra.md               # Entra/Azure output
├── 17_phishing.md            # Phishing URL output
├── 18_brand.md               # Brand protection output
├── 19_cti.md                 # CTI correlation output
├── 20_vuln.md                # Vulnerability output
├── 30_automation.md          # Automation design output
├── 90_review.md              # Evidence review QA
├── 91_report.md              # Final structured report
└── report.docx               # DOCX report (if requested)
```

### Workspace Rules
- Only the Lead Analyst manages workspace lifecycle (create, archive, re-use).
- All subagents read from and write to their assigned workspace paths.
- No agent creates files outside `_workspace/`.
- The Lead Analyst ensures `00_context.json` exists before any other agent runs.

## Skills

| Skill | Location | Purpose |
|---|---|---|
| `context-first-investigation` | `skills/context-first-investigation/SKILL.md` | Mandatory context extraction before any investigation |
| `alert-triage` | `skills/alert-triage/SKILL.md` | Standardized alert triage workflow |
| `elastic-siem` | `skills/elastic-siem/SKILL.md` | Elastic Security KQL/EQL investigation |
| `splunk-siem` | `skills/splunk-siem/SKILL.md` | Splunk SPL investigation |
| `defender-advanced-hunting` | `skills/defender-advanced-hunting/SKILL.md` | Defender XDR Advanced Hunting KQL |
| `wiz-cloud` | `skills/wiz-cloud/SKILL.md` | Wiz cloud security investigation |
| `azure-entra-review` | `skills/azure-entra-review/SKILL.md` | Entra ID / Azure CLI security review |
| `cyble-cti` | `skills/cyble-cti/SKILL.md` | Cyble threat intelligence correlation |
| `commandzero` | `skills/commandzero/SKILL.md` | CommandZero MCP workflow |
| `tenable-vuln` | `skills/tenable-vuln/SKILL.md` | Tenable vulnerability review |
| `filescan` | `skills/filescan/SKILL.md` | filescan.io URL/file sandbox analysis |
| `phishing-url-analysis` | `skills/phishing-url-analysis/SKILL.md` | Phishing URL deep analysis |
| `brand-protection` | `skills/brand-protection/SKILL.md` | Brand protection and typosquat investigation |
| `browser-investigation` | `skills/browser-investigation/SKILL.md` | CloakBrowser/Playwright investigation |
| `ssh-socks-proxy` | `skills/ssh-socks-proxy/SKILL.md` | SSH SOCKS proxy for internal tools |
| `cli-log-json` | `skills/cli-log-json/SKILL.md` | CLI log, JSON, CSV iteration |
| `cyberchef` | `skills/cyberchef/SKILL.md` | CyberChef decoding and deobfuscation |
| `evidence-collection` | `skills/evidence-collection/SKILL.md` | Evidence collection and chain-of-reasoning |
| `verdict-scoring` | `skills/verdict-scoring/SKILL.md` | Verdict, severity, confidence scoring |
| `actions-hardening` | `skills/actions-hardening/SKILL.md` | Recommended actions and control hardening |
| `docx` | `skills/docx/SKILL.md` | DOCX report generation from template |
| `evidence-extraction` | `skills/evidence-extraction/SKILL.md` | PDF/DOCX evidence extraction |

## Scope

- Alert triage and escalation decisions
- Threat hunting (hypothesis-driven)
- Phishing URL and email analysis
- Brand protection and typosquat investigation
- Cloud security telemetry analysis (Wiz, Azure, Entra ID)
- SIEM investigation (Elastic, Splunk, Microsoft Defender)
- CTI correlation and IOC enrichment
- Vulnerability exposure assessment and prioritization
- Executive and operational report writing
- Automation flow design for SecOps workflows
- Evidence collection and chain-of-reasoning documentation

## Non-Goals

- Full DFIR (disk forensics, memory forensics, timeline reconstruction)
- Malware reverse engineering (sandbox analysis only via external tools)
- Exploit development or vulnerability research
- Penetration testing or red team operations
- Incident command or crisis management (escalate, don't run the IR)

## Mandatory Context-First Workflow

**Before any investigation begins, the Lead Analyst MUST:**

1. Spawn Company Context Analyst to read the project/company context file.
2. Extract: company systems, domains, assets, business units, known benign activity, security stack, logging sources, owners, environment classification.
3. Save structured context to `_workspace/00_context.json`.
4. Use that context to reduce false positives and improve verdict quality.
5. If no context file is provided, mark `CONTEXT GAP` in workspace and proceed with lower confidence.

All subagents MUST read `_workspace/00_context.json` before beginning analysis.

## Default Investigation Flow

1. **Context Load** — Lead Analyst spawns Company Context Analyst → `_workspace/00_context.json`
2. **Task Classification** — Lead Analyst classifies task → `_workspace/01_task.md`
3. **Evidence Gathering** — Lead Analyst spawns relevant specialists in parallel; each writes to `_workspace/`
4. **Correlation** — Lead Analyst cross-references findings across all workspace outputs
5. **False Positive Reduction** — Apply `00_context.json` to filter known benign
6. **QA Gate** — Lead Analyst spawns Evidence Reviewer → `_workspace/90_review.md`
7. **Verdict** — Lead Analyst assigns final verdict, severity, confidence
8. **Report** — Lead Analyst spawns Report Writer → `_workspace/91_report.md` (+ DOCX)
9. **Next Steps** — Lead Analyst summarizes clear, actionable analyst next steps

## Completion Gates

- `_workspace/00_context.json` exists and was referenced by all agents.
- All dispatched agents returned output to `_workspace/`.
- Evidence Reviewer returned PASS or MINOR only.
- Verdict is backed by at least two independent sources where possible.
- Tool gaps are explicitly documented in workspace outputs.
- FP considerations are documented in workspace.
- Final verdict, severity, confidence are stated.
- Recommended actions are prioritized, assignable, with timelines.
- Analyst next steps are clear and actionable.

## Verdict Format

```
Verdict: Benign | Suspicious | Malicious | Inconclusive
Severity: Low | Medium | High | Critical
Confidence: Low | Medium | High
```

## Report Format

Every investigation output must include:
1. Executive Summary
2. Scope and Question
3. Context Used
4. Evidence Table
5. Timeline (if relevant)
6. Affected Users / Assets
7. Detection Sources Queried
8. Findings
9. False Positive Considerations
10. Verdict, Severity, Confidence
11. Recommended Actions
12. Control Hardening Recommendations
13. Gaps and Next Steps

## Tool Usage Rules

- Do not assume all tools are available. Each agent degrades gracefully.
- State explicitly which tools were queried and which were unavailable.
- Prefer structured output (`--json`, `--porcelain`, API responses) over free-text parsing.
- Cache and deduplicate queries to the same data source.
- When browser-based investigation is needed, use CloakBrowser MCP or Playwright.
- For internal tools behind a jump host, use the SSH SOCKS Proxy skill.

## When to Ask for User Clarification

- The task is ambiguous or spans multiple unrelated domains.
- Required tools/data sources are unavailable and the user has not acknowledged the gap.
- The context file is missing or incomplete.
- The investigation requires actions beyond analysis (containment, blocking, account disable).
- The verdict confidence is Low and the impact is High or Critical.

## Change History

| Date | Change | Target | Reason |
|---|---|---|---|
| 2026-07-08 | Initial harness | all | — |
| 2026-07-08 | Added workspace protocol, orchestrator pattern | all | Shared context via `_workspace/` |
| 2026-07-09 | Expanded lead orchestration and delegation protocol | `teams/secops-lead-analyst.md` | Ensure lead routes specialist work and synthesizes evidence instead of acting as a standalone analyst |
