---
name: js-ts-orchestrator
description: "Reference skill for the Senior Fullstack Engineer harness. Loaded by the Fullstack Architect agent. Documents workflow phases, agent dispatch patterns, task prompt templates, and error handling. Use when orchestrating the senior-fullstack-engineer team."
compatibility: opencode
metadata:
  domain: javascript-typescript
  audience: senior-engineer
---

# Senior Fullstack Engineer Orchestrator

Loaded by the **Fullstack Architect** (`teams/fullstack-architect.md` — `mode: all`, task permitted) to coordinate the senior-fullstack-engineer harness team. This skill documents the workflow; the lead agent executes it.

## Execution mode

Hybrid: parallel discovery → sequential design/implementation → parallel review gates → sequential integration.

## Agent map

| Agent | File | Role | Output |
|---|---|---|---|
| Fullstack Architect | `teams/fullstack-architect.md` | Orchestration, classification, dispatch, synthesis | `_workspace/14_final_summary.md` |
| TypeScript Implementer | `teams/typescript-implementer.md` | Implementation, applies `typescript-coding` | changed files + `_workspace/03_implementation.md` |
| TypeScript Reviewer | `teams/typescript-reviewer.md` | Type safety, correctness, anti-patterns | `_workspace/04_review.md` |
| Frontend Architect | `teams/frontend-architect.md` | Component tree, routing, SSR/CSR | `_workspace/01_architecture.md` |
| React Specialist | `teams/react-specialist.md` | React 19, hooks, Server Components | changed files |
| Svelte Specialist | `teams/svelte-specialist.md` | Svelte 5 runes, stores, SvelteKit | changed files |
| Vue Specialist | `teams/vue-specialist.md` | Vue 3 Composition API, Pinia | changed files |
| SolidJS Specialist | `teams/solidjs-specialist.md` | SolidJS signals, stores, SolidStart | changed files |
| Next.js Specialist | `teams/nextjs-specialist.md` | App Router, RSC, ISR, middleware | changed files |
| SvelteKit Specialist | `teams/sveltekit-specialist.md` | Routing, load functions, form actions | changed files |
| Backend Node/Bun Engineer | `teams/backend-node-bun-engineer.md` | REST, tRPC, WebSocket, auth | changed files |
| Full-stack Engineer | `teams/fullstack-engineer.md` | End-to-end features, API + UI | changed files |
| UI Component Engineer | `teams/ui-component-engineer.md` | Component design, accessibility, Storybook | `_workspace/11_ui_components.md` |
| State Management Reviewer | `teams/state-management-reviewer.md` | Store architecture, caching | `_workspace/09_state_mgmt.md` |
| API Design Reviewer | `teams/api-design-reviewer.md` | REST/tRPC contracts, validation | `_workspace/06_api_review.md` |
| Performance Engineer | `teams/performance-engineer.md` | Bundle analysis, Core Web Vitals | `_workspace/05_performance.md` |
| Security Reviewer | `teams/security-reviewer.md` | OWASP, XSS, CSP, dependency audit | `_workspace/07_security.md` |
| Accessibility Reviewer | `teams/accessibility-reviewer.md` | WCAG 2.2 AA, ARIA, keyboard | `_workspace/08_accessibility.md` |
| Testing Engineer | `teams/testing-engineer.md` | Unit, integration, e2e, coverage | `_workspace/10_tests.md` |
| Build Tooling Engineer | `teams/build-tooling-engineer.md` | Vite, bundler, tsconfig | `_workspace/12_build.md` |
| Documentation Maintainer | `teams/documentation-maintainer.md` | JSDoc, README, ADRs | `_workspace/13_docs.md` |

**HARNESS_ROOT** = `harness/senior-fullstack-engineer`

## Orchestrator responsibility

The Fullstack Architect coordinates the team. It is not a mega-agent and should not personally perform specialist work when a dedicated subagent should own it. The architect owns routing, context handoff, conflict resolution, final decisions, and user-facing synthesis.

Direct handling is reserved for tiny, low-risk questions or one-line edits with no type safety, security, accessibility, or architecture implications.

## Delegation rules

| Task or risk | Required delegation | Context to pass | Expected output |
|---|---|---|---|
| Project type detection | Fullstack Architect (direct) | `package.json`, config files, directory structure | Project type, framework, package manager |
| Architecture/design | Frontend Architect + Backend Engineer (if applicable) | User goal, project type, constraints | Architecture doc, risks, decisions |
| Implementation | TypeScript Implementer | Architecture doc, target files, acceptance criteria | Changed files, verification results |
| Type safety review | TypeScript Reviewer | Implementation files, architecture doc | Findings with severity |
| API design | API Design Reviewer | Route handlers, validation schemas | Contract findings, fix recommendations |
| Security audit | Security Reviewer | All changed files, deps, config | Vulnerability findings, severity |
| Accessibility audit | Accessibility Reviewer | Component files, templates | WCAG violations, fix recommendations |
| Performance review | Performance Engineer | Build output, bundle report | Ranked optimization recommendations |
| State management review | State Management Reviewer | Store files, context usage, data fetching | Architecture findings |
| UI component review | UI Component Engineer | Component files, design tokens | API design, accessibility, states |
| Testing | Testing Engineer | Implementation, edge cases, invariants | Test files, pass/fail, coverage gaps |
| Build configuration | Build Tooling Engineer | Current config, performance targets | Updated config, build metrics |
| Documentation | Documentation Maintainer | Public API, components, decisions | Doc files, gap report |

Routing defaults:
- Always include TypeScript Reviewer before final approval of non-trivial code changes.
- Always include Testing Engineer before claiming complete.
- Include Security Reviewer for: auth, input validation, secrets, dependency changes, data handling.
- Include Accessibility Reviewer for: any UI component, form, user-facing markup change.
- Include Performance Engineer for: bundle changes, data fetching changes, rendering work.
- Include API Design Reviewer for: any endpoint, route handler, or public function signature change.
- Include the relevant Framework Specialist when the project uses a UI framework.
- If a relevant specialist is skipped due to low risk, record the reason in `_workspace/00_task.md`.

## Workflow

### Phase 0: Context check

1. Check whether `_workspace/` exists.
2. Decide:
   - No `_workspace/` → initial run, continue to Phase 1.
   - `_workspace/` exists + revision request → targeted rerun of affected phases.
   - `_workspace/` exists + new task → archive as `_workspace_{YYYYMMDD_HHMMSS}/`, create fresh.
3. For targeted reruns, include prior artifact paths and user feedback in specialist prompts.

### Phase 1: Discover and classify

1. Parse user request. Identify scope: new feature, refactor, bug fix, optimization, audit.
2. Explore the codebase: `package.json`, `tsconfig.json`, framework config, directory structure.
3. Detect: project type, framework, package manager, runtime.
4. Write `_workspace/00_task.md`: task type, project type, framework, required agents, constraints.

### Phase 2: Architecture (if needed)

1. Dispatch Frontend Architect for frontend/UI work.
2. Dispatch relevant Framework Specialist for framework-specific patterns.
3. Dispatch Backend Engineer for API/backend work.
4. Write `_workspace/01_architecture.md`.

### Phase 3: Implementation

1. Dispatch TypeScript Implementer with architecture doc and acceptance criteria.
2. Dispatch Framework Specialist for component-level implementation if needed.
3. Dispatch Full-stack Engineer for features spanning frontend + backend.
4. Write `_workspace/03_implementation.md`.

### Phase 4: Review (parallel where possible)

Launch independent reviewers in parallel:
- TypeScript Reviewer (type safety, anti-patterns)
- Security Reviewer (vulnerabilities, secrets, auth)
- Accessibility Reviewer (WCAG compliance)
- API Design Reviewer (contracts, validation, status codes)
- State Management Reviewer (store architecture, caching)
- Performance Engineer (bundle, Core Web Vitals)
- UI Component Engineer (component API, states, responsive)

### Phase 5: Testing

1. Dispatch Testing Engineer after reviews return.
2. Verify test coverage against review findings.

### Phase 6: Build verification

1. Dispatch Build Tooling Engineer for build config review.
2. Run `bun run build`.

### Phase 7: Documentation

1. Dispatch Documentation Maintainer for docs updates.
2. Generate changelog entries for user-facing changes.

### Phase 8: Integration and synthesis

1. Collect all review findings and resolve conflicts.
2. Prioritize BLOCKER findings. Re-dispatch Implementer for fixes.
3. Rerun affected reviews after fixes.
4. Write `_workspace/14_final_summary.md`.
5. Present summary to user: changed files, quality gate results, risks, next steps.

## Task prompt template

For every `task` subagent call, use this structure:

```markdown
## Task: [one-line objective]

### Context
- Project type: [frontend/backend/full-stack/CLI/library]
- Framework: [React/Svelte/Vue/SolidJS/Next.js/SvelteKit/none]
- Package manager: [bun/npm/yarn/pnpm]
- Relevant files: [paths]
- Prior artifacts: [_workspace/XX_...md]

### Requirements
[concrete acceptance criteria]

### Constraints
- Must pass: bun run typecheck
- Must pass: bun run lint
- Must not: [specific restrictions]

### Expected output
- Write to: [_workspace/XX_...md]
- Changed files list
- Verification results
- Risks and unresolved questions
- Final recommendation
```

## Error handling

- If a subagent returns unclear or conflicting output, re-dispatch with clarified instructions.
- If a subagent hits a blocker, assess whether another specialist can help resolve it.
- If two reviewers disagree, the architect weighs evidence and decides or escalates to user.
- If project type is ambiguous, ask user before routing.
- If Bun is incompatible with the project, fall back to detected package manager and note why.

## Completion gate checklist

- [ ] `_workspace/00_task.md` exists (task classification).
- [ ] `_workspace/01_architecture.md` exists (if architecture work was done).
- [ ] `_workspace/03_implementation.md` exists (changed files documented).
- [ ] `_workspace/04_review.md` exists (type safety review complete).
- [ ] BLOCKER findings resolved.
- [ ] `bun run typecheck` passes.
- [ ] `bun run lint` passes.
- [ ] `bun run build` passes.
- [ ] `bun test` passes.
- [ ] `_workspace/14_final_summary.md` exists.
