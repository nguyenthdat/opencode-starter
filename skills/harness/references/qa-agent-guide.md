# QA Agent Design Guide

Use this guide when a harness needs a QA or verification specialist. The emphasis is integration coherence: checking boundaries between components, not only checking that each component exists.

## Table of contents

1. Defect patterns QA often misses
2. Integration coherence verification
3. QA agent design principles
4. Verification checklist template
5. QA agent definition template
6. Real-world bug patterns

## 1. Defect patterns QA often misses

### 1-1. Boundary mismatch

The most common serious defects occur when two components are individually plausible but disagree at their connection point.

| Boundary | Example mismatch | Why weak QA misses it |
|---|---|---|
| API response → frontend hook | API returns `{ projects: [...] }`, hook expects `Project[]` | Each side looks valid alone; nobody compares shapes |
| API field names → type definition | API returns `thumbnailUrl`, type expects `thumbnail_url` | Type assertions can hide runtime mismatch |
| File path → link href | Page lives at `/dashboard/create`, link points to `/create` | File tree and links are not cross-checked |
| State transition map → status updates | Map allows `generating_template → template_approved`, but code never performs it | QA sees the map exists, not whether every transition is exercised |
| API endpoint → frontend hook | Endpoint exists, no hook calls it | Endpoint inventory is not mapped to consumers |
| Immediate response → async result | API returns `{ status }` immediately, UI reads `data.failedIndices` | Immediate and final result shapes are conflated |

### 1-2. Why static review misses these

- Generic casts can make a build pass even when runtime JSON has the wrong shape.
- `build` success does not prove integration correctness when `any`, unchecked casts, or generic fetch helpers are used.
- Existence checks answer "is it present?"; integration checks answer "does the producer contract match the consumer expectation?"

## 2. Integration coherence verification

A QA agent should compare both sides of each boundary.

### 2-1. API response ↔ frontend hook type

Method:

```text
1. Extract the object passed to response helpers in each API route.
2. Find the corresponding frontend fetch/hook type expectation.
3. Compare wrapping, field names, optional/null behavior, arrays vs objects, and status-specific shapes.
4. Verify the consumer unwraps `{ data: ... }`, `{ items: ... }`, or pagination containers correctly.
```

High-risk patterns:

- Paginated response `{ items: [], total, page }` while frontend expects a bare array.
- Database snake_case → API camelCase → frontend type mismatch.
- `202 Accepted` immediate response shape differs from final async result shape.

### 2-2. File route ↔ link/router path

Method:

```text
1. Extract actual routes from app/page files or router definitions.
2. Collect href, router.push, redirect, and navigation target strings.
3. Compare each target to an existing route pattern.
4. Account for route groups, dynamic segments, and base paths.
```

### 2-3. State transition completeness

Method:

```text
1. Extract allowed transitions from the state machine or transition map.
2. Search code for all status updates.
3. Check every update is allowed by the map.
4. Check every important allowed transition is actually reachable.
5. Pay special attention to intermediate → final transitions.
```

### 2-4. API endpoint ↔ consumer mapping

Method:

```text
1. List every route and HTTP method.
2. List every frontend/service fetch call.
3. Map endpoints to consumers.
4. Flag endpoints with no consumers and consumers with no endpoint.
5. Classify unused endpoints as intentional admin/internal APIs or likely integration gaps.
```

## 3. QA agent design principles

### 3-1. Use an agent that can verify, not only read

A read-only exploration agent is useful for reconnaissance, but effective QA often needs to:

- Search patterns across the repo.
- Run targeted scripts.
- Execute tests, typechecks, or builds.
- Produce a structured verification report.

For active QA, use an execution-capable agent such as `general` or a custom QA subagent with explicit permissions.

### 3-2. Prefer cross-comparison over existence checks

| Weak check | Strong check |
|---|---|
| Does the API endpoint exist? | Does the endpoint response shape match the consuming hook/type? |
| Is the state map defined? | Do all status updates obey the map and are critical transitions reachable? |
| Does a page file exist? | Do all links point to actual routes? |
| Does the build pass? | Are unchecked casts hiding runtime shape mismatches? |

### 3-3. Read both sides at the same time

Boundary bugs require paired inspection:

- API route **and** frontend hook.
- Transition map **and** status-update code.
- File routes **and** navigation targets.
- Schema fields **and** API response/type definitions.

Write this explicitly into the QA agent definition.

### 3-4. Run QA incrementally

Do not wait until the whole system is complete if modules can be checked earlier. Run QA immediately after a boundary is created or changed:

- New API route → verify route + consumer hook.
- New page → verify links and navigation.
- New state transition → verify map + code path + UI branch.

Incremental QA reduces rework and prevents early mismatches from spreading.

## 4. Verification checklist template

Use or adapt this for web applications.

```markdown
### Integration coherence verification

#### API ↔ frontend
- [ ] Each API response shape matches the corresponding consumer type.
- [ ] Wrapped responses are unwrapped consistently.
- [ ] snake_case ↔ camelCase mapping is intentional and consistent.
- [ ] Immediate async responses are not treated as final results.
- [ ] Important endpoints have consumers, and consumers point to real endpoints.

#### Routing
- [ ] Every href/router/redirect target maps to an actual route.
- [ ] Route groups or hidden path segments are handled correctly.
- [ ] Dynamic segments are filled with valid parameters.

#### State machine
- [ ] All code status updates are allowed transitions.
- [ ] Critical allowed transitions are actually reachable.
- [ ] No dead transitions or unreachable UI states remain.
- [ ] UI conditional states can actually occur.

#### Data flow
- [ ] Database/schema field names map cleanly to API response names.
- [ ] Frontend types match API response field names.
- [ ] null/undefined handling is consistent across producer and consumer.
```

## 5. QA agent definition template

```markdown
---
description: "QA integration inspector. Verifies spec compliance, cross-component contracts, route/link consistency, state-machine completeness, and data-flow coherence."
mode: subagent
permission:
  edit: ask
  bash: ask
---

# QA Inspector

## Core role

Verify implementation quality against the spec, with special focus on integration coherence between modules.

## Verification priorities

1. Integration coherence — boundary mismatches are the highest runtime risk.
2. Functional spec compliance — APIs, state machine, data model, user flows.
3. Test and build evidence — targeted commands, not only visual inspection.
4. Code quality — unused code, naming, maintainability.

## Method: paired boundary reading

For each boundary, read producer and consumer together:

| Boundary | Producer side | Consumer side |
|---|---|---|
| API response shape | route/controller response | hook/service fetch type |
| Routing | route files/router table | href/router.push/redirect calls |
| State transition | transition map | status update code and UI branches |
| Data flow | schema/database fields | API response and frontend type |

## Output protocol

Return a report with:

- Pass/fail/untested status per checklist item.
- File:line evidence when available.
- Concrete fix recommendation for every failure.
- Commands run and results.
- Residual risks.

## Collaboration protocol

- Report boundary issues to the primary orchestrator with both affected sides.
- If asked to propose a fix, identify the smallest safe change and the tests needed afterward.
```

## 6. Real-world bug patterns

These bug patterns motivate the guide:

| Symptom | Boundary | Root cause |
|---|---|---|
| `projects?.filter is not a function` | API → hook | API returned object wrapper; frontend expected array |
| Dashboard links 404 | file path → href | Missing `/dashboard` prefix |
| Theme image missing | API → component | `thumbnailUrl` vs `thumbnail_url` mismatch |
| Theme selection not saved | API → hook | Endpoint existed; consumer hook missing |
| Creation page waits forever | state transition → code | Final transition update missing |
| `data.failedIndices` crash | immediate response → frontend | UI read final async result from immediate status response |
| Completed item view 404 | file path → href | Link pointed outside actual route subtree |
