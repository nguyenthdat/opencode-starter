---
name: filescan
description: "Look up or submit approved URLs/files to filescan.io and review sandbox behavior, process trees, network activity, IOCs, signatures, and ATT&CK mappings. Use for hash lookup, approved detonation, result refresh, or comparison. Search by hash first; any file/private-URL upload requires explicit disclosure approval."
compatibility: opencode
metadata:
  domain: secops
  audience: senior-secops-analyst
  edition: "2026.07"
---

# filescan.io Analysis

Use filescan.io only after applying a data-disclosure gate.

## Disclosure Gate

1. Compute the file hash locally and search existing analysis first.
2. Classify the target for secrets, credentials, internal URLs, customer data, proprietary content, PII, and regulated data.
3. Require explicit user approval before uploading any file or non-public URL.
4. Record provider visibility, retention, submission ID, and approval basis.
5. Do not use another public sandbox as a fallback unless it passes the same gate.

## Workflow

1. Discover available filescan tools and their current schemas.
2. Reuse an existing analysis by hash or analysis ID when possible.
3. If approved, submit once and poll within a bounded interval.
4. Capture static findings, process tree, filesystem/registry effects, network behavior, signatures, screenshots, and ATT&CK mappings.
5. Extract IOCs, but return enrichment needs as a handoff request rather than calling another agent.
6. Save raw results and derived IOC lists under `_workspace/` and register them with `evidence-collection`.
7. Apply `verdict-scoring`; sandbox classification alone does not prove internal execution or impact.

## Output

Include target hash/defanged URL, approval and disclosure status, provider, analysis ID/permalink, analysis freshness, canonical decision fields, key behaviors, IOCs, ATT&CK mappings, evidence IDs, and gaps.

On rerun, reuse the analysis ID and report changed or newly observed behavior instead of resubmitting.
