# Harness Team: Senior SecOps Analyst

## Goal

Provide senior-level, evidence-driven SecOps analysis for alert triage, threat hunting, phishing and brand abuse, SIEM/Defender, cloud and identity, CTI, vulnerability exposure, and executive reporting. This is an analyst harness, not a DFIR lab, malware reverse-engineering team, penetration-testing team, or incident commander.

## Activation

`harness/senior-secops-analyst` is the source of truth. Activate it when needed with:

```bash
uv run scripts/harness-opencode.py link senior-secops-analyst
```

The script links agents as `senior-secops-analyst/<file-name>`, links skills, links this instruction file, and merges the team's MCP definitions. Restart OpenCode after linking or changing config-time files.

For multi-source investigations, reruns, reassessment, audit, or reporting, the lead must load `secops-orchestrator`. Simple single-source questions can be answered directly without fan-out.

## Agents

| Layer | Agents | Boundary |
|---|---|---|
| Orchestrator | `secops-lead-analyst` | Sole task caller, workspace owner, integrator, and final decision owner |
| Context | `system-context-analyst`, `company-context-analyst` | Technical baseline vs run-specific business/known-benign context |
| Source evidence | `elastic-siem-analyst`, `splunk-analyst`, `microsoft-defender-kql-analyst`, `wiz-cloud-security-analyst`, `entra-azure-configuration-analyst`, `phishing-url-analyst`, `brand-protection-analyst`, `cti-correlation-analyst` | Read-only collection and source-specific interpretation |
| Dependent analysis | `alert-triage-analyst`, `threat-hunting-analyst`, `vulnerability-exposure-analyst`, `automation-flow-designer` | Consume caller-supplied evidence; do not call source agents |
| Quality and delivery | `evidence-reviewer`, `report-writer` | Independent evidence/fidelity review and evidence-preserving reporting |

## Collaboration Rules

- Use a flat topology: `user -> lead -> specialist -> lead`.
- Only `secops-lead-analyst` may call `task`.
- Specialists never call, route to, or message another specialist. They return `handoff_requests` to the lead.
- The lead invokes named agents, not `general` with copied prompt files.
- Run independent tasks in parallel, with no more than three calls per wave; sequence tasks that consume prior evidence.
- Share durable state through `harness/senior-secops-analyst/_workspace/` and the active `run_manifest.json`.

## Decision Ownership

- Source specialists own query correctness and source-specific observations.
- Alert Triage recommends disposition; Threat Hunting owns hypotheses and coverage; Vulnerability Exposure owns exploitability and exposure assessment.
- The lead alone owns final verdict, disposition, severity, confidence, conflict resolution, and whether a handoff is dispatched.
- Report Writer reproduces the locked decision and must not create findings or change certainty.
- Evidence Reviewer performs both pre-verdict evidence review and post-report fidelity review.

## Safety Baseline

- Default to read-only investigation.
- Require explicit approval for persistent mutations, third-party uploads of private data, form submission, downloads, containment, blocking, account or policy changes, scan scheduling, tickets/comments, and takedowns.
- Never use real credentials or production browser sessions, execute downloaded files, or execute/compile exploit proof-of-concept code.
- Record unavailable tools, failed queries, telemetry gaps, redactions, and confidence impact.

## Completion Gate

- Active-run artifacts are allowlisted in `run_manifest.json`.
- Required specialist outputs are complete or explicitly accepted as partial.
- Material claims reference evidence or exact artifact paths.
- Context, false-positive considerations, conflicting evidence, and tool gaps are addressed.
- Evidence review is `PASS` or non-material `MINOR`.
- `_workspace/89_verdict.json` follows `verdict-scoring`.
- Any generated report passes `REPORT_FIDELITY_REVIEW`.

## Change History

| Date | Change | Target | Reason |
|---|---|---|---|
| 2026-07-08 | Initial harness | all | Establish the SecOps specialist team |
| 2026-07-09 | Added workspace and delegation protocol | lead and specialists | Support shared evidence and specialist routing |
| 2026-07-13 | Adopted flat named-agent orchestration, run manifest, locked verdict, and two-stage QA | lead, orchestrator, all specialists | Prevent unsupported nested calls, stale artifact mixing, permission bypass, and report drift |
