# QA Agent Design Guide

A reference for including a QA agent in a build harness. Based on bug patterns found in a real project (SatangSlide) and their root-cause analysis, this guide provides a verification methodology for systematically catching defects that QA agents typically miss.

---

## Table of contents

1. Defect patterns QA agents miss
2. Integration coherence verification
3. QA agent design principles
4. Verification checklist template
5. QA agent definition template

---

## 1. Defect patterns QA agents miss

### 1-1. Boundary mismatch

The most common defect. Two components are each implemented "correctly" in isolation, but the contract breaks at the connection point.

| Boundary | Mismatch example | Why it's missed |
|--------|-----------|-----------|
| API response → front-end hook | API returns `{ projects: [...] }`, hook expects `SlideProject[]` | Each side checks out fine individually; nobody cross-compares them |
| API response field name → type definition | API returns `thumbnailUrl` (camelCase), type defines `thumbnail_url` (snake_case) | A TypeScript generic cast lets the compiler miss it |
| File path → link href | Page lives at `/dashboard/create`, but a link points to `/create` | Nobody cross-checks the file structure against href values |
| State-transition map → actual status updates | The map defines `generating_template → template_approved`, but the code never makes that transition | Checking the map exists isn't the same as tracing every update site |
| API endpoint → front-end hook | The API exists but no hook calls it (dead endpoint) | API list and hook list are never mapped 1:1 |
| Immediate response → async result | API immediately returns `{ status }`, front-end accesses `data.failedIndices` | Type checks don't distinguish sync vs. async response shapes |

### 1-2. Why static code review misses these

- **Limits of TypeScript generics**: `fetchJson<SlideProject[]>()` compiles fine even if the runtime response is `{ projects: [...] }`.
- **`npm run build` passing ≠ working correctly**: type casts, `any`, and generics let the build succeed while runtime still fails.
- **Existence check vs. connection check are different things**: "does the API exist?" and "does the API's response match what the caller expects?" are entirely different verifications.

---

## 2. Integration coherence verification

The **cross-boundary comparison** checks a QA agent must include.

### 2-1. API response ↔ front-end hook type cross-check

**Method**: compare the shape passed to each API route's response call against the type parameter used by the corresponding hook.

```
Steps:
1. Extract the shape of the object each API route returns.
2. Check the type parameter T the corresponding hook's typed fetch call expects.
3. Compare the shape against T.
4. Check for wrapping (if the API returns { data: [...] }, does the hook unwrap .data?).
```

**Watch for especially:**
- Pagination APIs: `{ items: [], total, page }` vs. the front-end expecting a bare array
- Mismatches chained across snake_case DB fields → camelCase API response → front-end type definitions
- Shape differences between an immediate response (e.g. 202 Accepted) and the eventual result

### 2-2. File path ↔ link/route path mapping

**Method**: extract URL paths from page files under the app's routing directory, and cross-check them against every `href`, `router.push()`, or `redirect()` value in the code.

```
Steps:
1. Extract URL patterns from page file paths (route groups get stripped from the URL;
   dynamic segments become path parameters).
2. Collect every href=, router.push(, redirect( value in the code.
3. Confirm each link matches an actual existing page path.
4. Watch for URL-prefix effects inside route groups (e.g. paths nested under a dashboard group).
```

### 2-3. State-transition completeness tracing

**Method**: extract every `status:` update in the code and cross-check it against the state-transition map.

```
Steps:
1. Extract the list of allowed transitions from the state-transition map.
2. Search every API route for .update({ status: "..." }) patterns.
3. Confirm each transition found in code is defined in the map.
4. Identify transitions defined in the map that are never executed in code (dead transitions).
5. Specifically check: does every intermediate state (e.g. generating_template) have a
   code path to its final state (e.g. template_approved)?
```

### 2-4. API endpoint ↔ front-end hook 1:1 mapping

**Method**: list every API route and every front-end hook, and confirm they pair up.

```
Steps:
1. Extract the list of endpoints (by HTTP method) from every API route file.
2. Extract the list of fetch call URLs from every front-end hook.
3. Identify API endpoints that no hook calls → flag as "unused."
4. Determine whether "unused" is intentional (e.g. an admin-only API) or a missed wiring.
```

---

## 3. QA agent design principles

### 3-1. Use a general-purpose subagent, not a read-only one

If the QA agent is read-only (like OpenCode's built-in `explore`), it can only read. Effective QA needs to:
- `grep` for patterns (extract every response shape across all routes)
- run scripts to automate cross-checks (API shape vs. hook type)
- make fixes directly, when appropriate

**Recommendation**: use the `general` built-in subagent (or a custom agent with equivalent tool access), and specify a "verify → report → request fix" protocol in the agent definition.

### 3-2. Prioritize "cross-comparison" over "existence check" in the checklist

| Weak checklist item | Strong checklist item |
|---------------|---------------|
| Does the API endpoint exist? | Does the API endpoint's response shape match the corresponding hook's type? |
| Is the state-transition map defined? | Does every status-update in the code match a transition in the map? |
| Does the page file exist? | Does every link in the code point to a page that actually exists? |
| Is TypeScript strict mode on? | Is there any type safety being bypassed via a generic cast? |

### 3-3. The "read both sides at once" principle

To catch boundary bugs, a QA agent can't read just one side. It must always:
- Read the API route **and** its corresponding hook **together**
- Read the state-transition map **and** the actual update code **together**
- Read the file structure **and** the link paths **together**

State this principle explicitly in the agent definition.

### 3-4. Run QA incrementally, right after each module — not after the whole build

If QA only runs in "Phase 4: after everything is done":
- Bugs accumulate and become more expensive to fix.
- Early boundary mismatches propagate into later modules.

**Recommended pattern**: as soon as each backend API is finished, immediately cross-verify it against its corresponding hook (incremental QA).

---

## 4. Verification checklist template

An integration-coherence checklist for web applications, meant to go inside a QA agent's definition.

```markdown
### Integration coherence verification (web app)

#### API ↔ front-end wiring
- [ ] Every API route's response shape matches its corresponding hook's generic type
- [ ] Wrapped responses ({ items: [...] }) are unwrapped correctly on the hook side
- [ ] snake_case ↔ camelCase conversion is applied consistently
- [ ] Immediate responses (202) and final results have distinguishable shapes on the front end
- [ ] Every API endpoint has a corresponding front-end hook that actually calls it

#### Routing coherence
- [ ] Every href/router.push value in the code matches an actual page file path
- [ ] Route-group segments ((group)) are accounted for when they're stripped from the URL
- [ ] Dynamic segments ([id]) are filled with correct parameters

#### State-machine coherence
- [ ] Every defined state transition is executed somewhere in the code (no dead transitions)
- [ ] Every status update in the code is defined in the transition map (no unauthorized transitions)
- [ ] No intermediate state is missing its path to a final state
- [ ] Every status-based branch in the front end (if status === "X") has an X that's actually reachable

#### Data-flow coherence
- [ ] DB schema field names map consistently to API response field names
- [ ] Front-end type definitions match API response field names
- [ ] null/undefined handling for optional fields is consistent on both sides
```

---

## 5. QA agent definition template

Core sections to include in a build harness's QA agent.

```markdown
---
description: "QA verification specialist. Checks spec compliance, integration coherence, and design quality."
mode: subagent
model: provider/model-id
permission:
  edit: ask
  bash: allow
---

# QA Inspector

## Core role
Verify implementation quality against spec, and **integration coherence between modules**.

## Verification priority

1. **Integration coherence** (highest) — boundary mismatches are the leading cause of runtime errors
2. **Functional spec compliance** — API/state machine/data model
3. **Design quality** — color/typography/responsiveness
4. **Code quality** — unused code, naming conventions

## Verification method: "read both sides at once"

Boundary verification always means **opening both sides of the code together** to compare:

| What's verified | Left side (producer) | Right side (consumer) |
|----------|-------------|---------------|
| API response shape | The route's response-returning call | The hook's typed fetch call |
| Routing | Page file paths | href, router.push values |
| State transitions | The transition map | .update({ status }) code |
| DB → API → UI | Table column names | API response field → type definition |

## Hand-off protocol

- Receives from: the orchestrator, right after each module is marked complete —
  QA runs incrementally, not just once at the end
- Produces for: the orchestrator, a verification report (pass/fail/unverified per item);
  when a fix is needed, the orchestrator relays a concrete fix request (file:line +
  what to change) to the relevant agent's next dispatch
```

---

## Real-world case: bugs found in SatangSlide

Every lesson in this guide is distilled from the following real bugs:

| Bug | Boundary | Root cause |
|------|--------|------|
| `projects?.filter is not a function` | API→hook | API returned `{projects:[]}`, hook expected a bare array |
| Every dashboard link 404'd | file path→href | Missing `/dashboard/` prefix |
| Theme thumbnails not showing | API→component | `thumbnailUrl` vs. `thumbnail_url` |
| Theme selection not saving | API→hook | select-theme API existed, but no hook called it |
| Creation page stuck forever | state transition→code | Missing code path for the `template_approved` transition |
| `data.failedIndices` crash | immediate response→front-end | Front-end accessed a background result from the immediate response |
| 404 viewing slides after completion | file path→href | `/projects/` should have been `/dashboard/projects/` |
