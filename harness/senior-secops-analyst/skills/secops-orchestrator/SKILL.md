---
name: secops-orchestrator
description: "Coordinates the Senior SecOps Analyst harness for alert triage, threat hunting, phishing, brand abuse, SIEM/Defender, cloud, identity, CTI, vulnerability, evidence review, and reporting. Use for multi-source investigations and for rerun, resume, update, reassess, partial rerun, report, audit, or improve-previous-result requests. Not needed for a simple single-source factual question."
compatibility: opencode
metadata:
  domain: secops
  audience: senior-secops-analyst
  workflow: hybrid-supervisor
---

# Senior SecOps Orchestrator

Coordinate a flat, caller-led investigation. The SecOps Lead is the only agent allowed to call `task`; specialists return results and handoff requests to the lead instead of calling one another.

## Execution Mode

Use a hybrid workflow:

1. Sequential intake and context gate.
2. Parallel independent evidence collection, up to three specialists per wave.
3. Sequential dependent analysis and lead synthesis.
4. Independent evidence review.
5. Locked verdict, report generation, and report-fidelity review.

Use a single specialist or work directly when coordination would cost more than it adds. Do not dispatch the full team by default.

## Runtime Names

The harness link script installs agents under `agents/senior-secops-analyst/`. Invoke named agents as:

```text
senior-secops-analyst/<agent-file-name-without-.md>
```

Never use `general` plus an injected team file when the named agent is available. Named dispatch preserves each agent's role and permission policy.

## Topology

```text
User
  -> SecOps Lead
       -> optional System Context refresh
       -> Company Context normalization
       -> independent source specialists
       -> dependent triage/hunt/exposure analysis
       -> lead synthesis
       -> Evidence Reviewer: EVIDENCE_REVIEW
       -> one targeted correction wave if required
       -> lead locks verdict
       -> Report Writer, when requested
       -> Evidence Reviewer: REPORT_FIDELITY_REVIEW
       -> lead delivers
```

Maximum delegation depth is one. A specialist must never call, route to, or message another specialist.

## Workflow

### Phase 0: Run Initialization

1. Inspect `harness/senior-secops-analyst/_workspace/`.
2. Choose one mode:
   - No workspace: new run.
   - Existing workspace plus a revision request: targeted rerun using the current run ID.
   - Existing workspace plus unrelated input: archive it with a UTC timestamp, then start a new run.
3. Create `_workspace/run_manifest.json` and `_workspace/01_task.md` before dispatching context agents.
4. Record the run ID, case ID, objective, scope, time window, allowed actions, expected artifacts, and artifact status.
5. Create a todo list for investigations with three or more phases.

Do not let reviewers or writers glob every historical artifact. The manifest is the allowlist for the current run.

### Phase 1: Context Gate

1. Dispatch `system-context-analyst` only when the technical baseline is missing, stale, explicitly requested, or materially affected by the task.
2. Dispatch `company-context-analyst` for each new investigation to normalize run-specific business, brand, regulatory, ownership, and known-benign context.
3. Save technical baseline evidence to `_workspace/00_system_context.md` and run context to `_workspace/00_context.json`.
4. Continue with weak or missing context only when safe. Record the gap and cap confidence according to `context-first-investigation`.

### Phase 2: Evidence Plan and Fan-Out

Select the smallest independent set of source specialists. Run independent calls in one turn, with at most three calls per wave.

| Need | Specialist |
|---|---|
| Elastic telemetry | `elastic-siem-analyst` |
| Splunk telemetry | `splunk-analyst` |
| Defender XDR telemetry | `microsoft-defender-kql-analyst` |
| Wiz resource graph/exposure | `wiz-cloud-security-analyst` |
| Entra/Azure configuration | `entra-azure-configuration-analyst` |
| Suspicious URL/page | `phishing-url-analyst` |
| Brand/domain abuse | `brand-protection-analyst` |
| IOC/campaign enrichment | `cti-correlation-analyst` |
| CVE and scanner exposure | `vulnerability-exposure-analyst` |

Before every dispatch, read `references/contracts.md`. The call must name exact inputs, allowed outputs, safety constraints, acceptance criteria, and verification.

### Phase 3: Dependent Analysis

Run these only after their required evidence exists:

- Alert triage consumes caller-supplied source telemetry and CTI artifacts. It recommends a disposition; it does not own the final verdict.
- Threat hunting uses `PLAN` mode before platform queries and `ASSESS_RESULTS` mode after source specialists return results.
- Vulnerability exposure consumes scanner/Wiz context when available and separates confirmed exposure from exploitation.
- Automation design runs only when requested, consumes accepted findings, and remains design-only.

When a specialist returns `handoff_requests`, the lead decides whether the added call is necessary. Do not dispatch automatically.

### Phase 4: Lead Synthesis

1. Read manifest-listed artifacts and validate their statuses.
2. Correlate by time, identity, host, IP, domain, URL, hash, message ID, resource ID, and tenant/subscription.
3. Prefer direct internal telemetry over reputation-only evidence.
4. Preserve contradictions and explain whether they arise from scope, freshness, latency, environment, or interpretation.
5. Write `_workspace/80_synthesis.md` with evidence references, gaps, preliminary scoring, and proposed actions.

### Phase 5: Evidence Review

Dispatch `evidence-reviewer` in `EVIDENCE_REVIEW` mode with the manifest, task, context, synthesis, and accepted specialist artifacts.

- `PASS`: proceed.
- `MINOR`: record non-blocking issues and proceed if they cannot alter verdict, severity, or action safety.
- `MAJOR` or `FAIL`: block delivery and run one targeted correction wave.

Retry a failed or incomplete specialist once using the same task ID and narrower instructions. Do not repeat the whole fan-out. If the retry still fails, continue only when safe and mark the affected conclusion incomplete.

### Phase 6: Lock Verdict

The lead applies `verdict-scoring` and writes `_workspace/89_verdict.json`. This artifact is authoritative and immutable for the report phase unless the lead reopens synthesis after new evidence.

The report writer must reproduce the locked verdict without changing severity, confidence, disposition, or evidence references.

### Phase 7: Report and Fidelity Review

1. Dispatch `report-writer` only when a report or formatted deliverable is requested.
2. Give it only manifest-accepted artifacts plus `_workspace/89_verdict.json`.
3. Write `_workspace/91_report.md` and optional `_workspace/report.docx`.
4. Dispatch `evidence-reviewer` in `REPORT_FIDELITY_REVIEW` mode.
5. Write `_workspace/92_final_review.md`; delivery requires `PASS` or non-material `MINOR`.

For a concise chat answer with no report request, the lead may deliver directly after the evidence review and locked verdict.

## Safety Gates

- Default all investigation actions to read-only.
- Require explicit user approval before upload to a third party, form submission, file download, ticket/comment creation, account or policy change, containment, blocking, takedown, scan scheduling, or any other persistent mutation.
- Never submit credentials, private URLs, internal files, customer data, or regulated data to a public service without approved handling.
- Label unexecuted queries and commands as `PROPOSED`, never as evidence.
- Never clone, compile, adapt, or execute exploit proof-of-concept code or downloaded malware.
- Ask the user before continuing when a majority of critical tasks fail or when proceeding could mutate systems or disclose sensitive data.

## Completion Gate

Deliver only when:

- Current-run inputs and artifacts are listed in `run_manifest.json`.
- Every required specialist status is `COMPLETE`, or an accepted `PARTIAL` is documented.
- Material claims cite evidence IDs or exact artifact references.
- Context, false-positive considerations, tool gaps, and contradictions are addressed.
- Evidence review is `PASS` or non-material `MINOR`.
- `_workspace/89_verdict.json` exists and follows `verdict-scoring`.
- A generated report passed `REPORT_FIDELITY_REVIEW`.

## Failure Dry Run

For a tool-unavailable scenario, verify that the specialist records the attempted operation and error, retries once only when the action is read-only, returns `PARTIAL` or `BLOCKED`, and does not claim an unexecuted query produced results. The lead must either route to an approved alternate source or lower confidence and state the gap.

## References

- `references/contracts.md` - read before dispatching any specialist or creating run artifacts.
