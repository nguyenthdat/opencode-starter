# Harness Team: Senior Fullstack Developer

## Goal

Production-grade JavaScript/TypeScript engineering with multi-agent architecture, implementation, review, testing, security audit, performance optimization, and accessibility verification. Covers frontend, backend, full-stack, CLI, library/SDK, and UI framework development.

## Lead agent

**Fullstack Architect** (`teams/fullstack-architect.md`) — `mode: all`, permission to spawn subagents. Orchestrates the full team, dispatches specialists, integrates outputs, resolves conflicts. Loads `js-ts-orchestrator` skill on every run.

## Specialists

| Agent | File | Mode | Responsibility |
|---|---|---|---|
| Fullstack Architect | `teams/fullstack-architect.md` | `all` | Orchestration, project detection, task classification, dispatch, synthesis, quality gates |
| TypeScript Implementer | `teams/typescript-implementer.md` | `subagent` | Production TypeScript code, applies `typescript-coding` skill |
| TypeScript Reviewer | `teams/typescript-reviewer.md` | `subagent` | Type safety, correctness, anti-patterns, error handling review |
| Frontend Architect | `teams/frontend-architect.md` | `subagent` | Component tree, routing, SSR/CSR strategy, bundle architecture |
| React Specialist | `teams/react-specialist.md` | `subagent` | React components, hooks, Server Components, Suspense, state management |
| Svelte Specialist | `teams/svelte-specialist.md` | `subagent` | Svelte 5 runes, stores, transitions, SSR, SvelteKit patterns |
| Vue Specialist | `teams/vue-specialist.md` | `subagent` | Vue 3 Composition API, Pinia, Vue Router, Nuxt patterns |
| SolidJS Specialist | `teams/solidjs-specialist.md` | `subagent` | SolidJS signals, stores, resources, SSR, SolidStart patterns |
| Next.js Specialist | `teams/nextjs-specialist.md` | `subagent` | App Router, RSC, ISR, middleware, route handlers, data fetching |
| SvelteKit Specialist | `teams/sveltekit-specialist.md` | `subagent` | SvelteKit routing, load functions, form actions, adapters, hooks |
| Backend Node/Bun Engineer | `teams/backend-node-bun-engineer.md` | `subagent` | Hono, Elysia, Express/Fastify, REST, tRPC, WebSocket, auth |
| Full-stack Developer | `teams/fullstack-developer.md` | `subagent` | End-to-end features, API + UI integration, SSR streaming, data flow |
| UI Component Engineer | `teams/ui-component-engineer.md` | `subagent` | Component design, design systems, Storybook, reusability |
| State Management Reviewer | `teams/state-management-reviewer.md` | `subagent` | State architecture, stores, context, caching, sync patterns |
| API Design Reviewer | `teams/api-design-reviewer.md` | `subagent` | REST/RPC/tRPC contracts, validation, error responses, versioning |
| Performance Engineer | `teams/performance-engineer.md` | `subagent` | Bundle analysis, Core Web Vitals, profiling, caching, optimization |
| Security Reviewer | `teams/security-reviewer.md` | `subagent` | OWASP, auth, input validation, CSP, dependency audit, secrets management |
| Accessibility Reviewer | `teams/accessibility-reviewer.md` | `subagent` | WCAG 2.2 AA, ARIA, keyboard nav, screen readers, contrast, semantics |
| Testing Engineer | `teams/testing-engineer.md` | `subagent` | Unit, integration, e2e, component tests, coverage, CI gates |
| Build Tooling Engineer | `teams/build-tooling-engineer.md` | `subagent` | Vite, bundler config, tsconfig, tree-shaking, code splitting, CI/CD |
| Documentation Maintainer | `teams/documentation-maintainer.md` | `subagent` | JSDoc, README, API docs, storybook docs, architecture decisions |

## Strict role boundaries

- **Architect** orchestrates and designs, does not implement.
- **Implementer** implements, does not approve own work.
- **Reviewer** reports findings, does not modify code.
- **Security Reviewer** owns vulnerabilities, auth, supply-chain, and CSP. TypeScript Reviewer owns type safety.
- **API Designer** owns contracts and validation. Implementer implements contracts.
- **Testing Engineer** writes tests, does not modify production code.
- **Performance Engineer** profiles and recommends. Implementer applies optimizations.
- **Frontend Architect** owns component tree and routing. Framework specialists own framework-specific details.
- **State Management Reviewer** owns store architecture. Implementer wires state into components.
- **Accessibility Reviewer** owns a11y findings. Implementer fixes violations.
- **Documentation Maintainer** owns docs. API Designer owns API naming.

## Trigger

For JS/TS work that benefits from multi-agent workflow — new features, refactors, architecture design, framework selection, performance optimization, security audits, accessibility reviews, testing strategy, bundle optimization, or API design — load the `js-ts-orchestrator` skill and dispatch via **Fullstack Architect**. Simple single-line fixes can be answered directly.

## Shared context (`_workspace/`)

All agents share context through `_workspace/` artifacts. Each agent reads prior artifacts and writes its output to the designated path.

| Artifact | Path | Producer |
|---|---|---|
| Task brief | `_workspace/00_task.md` | Fullstack Architect |
| Architecture document | `_workspace/01_architecture.md` | Fullstack Architect / Frontend Architect |
| TypeScript type design | `_workspace/02_type_design.md` | TypeScript Implementer |
| Implementation summary | `_workspace/03_implementation.md` | TypeScript Implementer |
| Review findings | `_workspace/04_review.md` | TypeScript Reviewer |
| Performance report | `_workspace/05_performance.md` | Performance Engineer |
| API review | `_workspace/06_api_review.md` | API Design Reviewer |
| Security findings | `_workspace/07_security.md` | Security Reviewer |
| Accessibility findings | `_workspace/08_accessibility.md` | Accessibility Reviewer |
| State management review | `_workspace/09_state_mgmt.md` | State Management Reviewer |
| Test strategy / results | `_workspace/10_tests.md` | Testing Engineer |
| UI component review | `_workspace/11_ui_components.md` | UI Component Engineer |
| Build tooling report | `_workspace/12_build.md` | Build Tooling Engineer |
| Documentation report | `_workspace/13_docs.md` | Documentation Maintainer |
| Final summary | `_workspace/14_final_summary.md` | Fullstack Architect |

## Skills

| Skill | Location | Purpose |
|---|---|---|
| `js-ts-orchestrator` | `skills/js-ts-orchestrator/SKILL.md` | Team coordination, dispatch protocol, synthesis, quality gates |
| `typescript-coding` | `skills/typescript-coding/SKILL.md` | TypeScript best practices, strict config, type safety rules |
| `javascript-coding` | `skills/javascript-coding/SKILL.md` | Modern JS patterns, ESM, async patterns, platform APIs |
| `bun-workflow` | `skills/bun-workflow/SKILL.md` | Bun-first rules, bun install/add/remove/run/test, bunx |
| `frontend-architecture` | `skills/frontend-architecture/SKILL.md` | Component trees, routing, SSR/CSR, bundle splitting, hydration |
| `backend-node-bun` | `skills/backend-node-bun/SKILL.md` | Hono, Elysia, Express, REST, tRPC, WebSocket, SSE, auth |
| `fullstack-development` | `skills/fullstack-development/SKILL.md` | End-to-end patterns, API + UI integration, SSR streaming |
| `react-development` | `skills/react-development/SKILL.md` | React 19, Server Components, hooks, Suspense, Next.js |
| `svelte-development` | `skills/svelte-development/SKILL.md` | Svelte 5 runes, stores, SvelteKit, transitions |
| `vue-development` | `skills/vue-development/SKILL.md` | Vue 3 Composition API, Pinia, Vue Router, Nuxt |
| `solidjs-development` | `skills/solidjs-development/SKILL.md` | SolidJS signals, stores, resources, SolidStart |
| `nextjs-development` | `skills/nextjs-development/SKILL.md` | App Router, RSC, ISR, middleware, route handlers |
| `sveltekit-development` | `skills/sveltekit-development/SKILL.md` | Routing, load functions, form actions, adapters |
| `vite-build-tooling` | `skills/vite-build-tooling/SKILL.md` | Vite config, plugins, tree-shaking, code splitting, env vars |
| `ui-component-design` | `skills/ui-component-design/SKILL.md` | Component API design, accessibility, states, Storybook |
| `state-management` | `skills/state-management/SKILL.md` | Store patterns, context, signals, caching, sync |
| `api-design` | `skills/api-design/SKILL.md` | REST, tRPC, validation, error responses, OpenAPI |
| `testing-js-ts` | `skills/testing-js-ts/SKILL.md` | Vitest, Playwright, Testing Library, coverage |
| `typescript-type-safety` | `skills/typescript-type-safety/SKILL.md` | Strict tsconfig, generics, discriminated unions, validation |
| `lint-and-format` | `skills/lint-and-format/SKILL.md` | ESLint, Biome, Prettier, oxlint configuration |
| `performance-optimization` | `skills/performance-optimization/SKILL.md` | Bundle analysis, Core Web Vitals, caching, lazy loading |
| `web-security` | `skills/web-security/SKILL.md` | OWASP, XSS, CSRF, CSP, auth, dependency audit |
| `accessibility-a11y` | `skills/accessibility-a11y/SKILL.md` | WCAG 2.2 AA, ARIA, keyboard, screen readers, axe-core |
| `browser-debugging` | `skills/browser-debugging/SKILL.md` | DevTools, performance panel, network, memory profiling |
| `cli-tooling-js-ts` | `skills/cli-tooling-js-ts/SKILL.md` | CLI design, argument parsing, terminal UX, distribution |
| `sdk-library-development` | `skills/sdk-library-development/SKILL.md` | Library design, tree-shaking, semver, ESM/CJS dual, publishing |
| `monorepo-workflow` | `skills/monorepo-workflow/SKILL.md` | Turborepo, workspaces, shared configs, versioning |
| `js-ts-documentation` | `skills/js-ts-documentation/SKILL.md` | JSDoc, TSDoc, README, API reference, ADRs |

## JS/TS Standards

### TypeScript-first
- Always prefer `.ts` / `.tsx` over `.js` for new code.
- Use strict tsconfig: `"strict": true`, `"noUncheckedIndexedAccess": true`, `"noImplicitOverride": true`.
- No unnecessary `any`. Use `unknown` for untrusted input.
- Discriminated unions for state and domain modeling.
- Runtime validation with Zod, Valibot, or TypeBox for all external inputs.
- Explicit public API types. Exported functions/classes require explicit return types.

### Modern JavaScript
- ESM (`import`/`export`) everywhere. Avoid CJS in new code.
- `async/await` over raw promises. No callback pyramids.
- Prefer `for...of`, `.map()`, `.filter()` over indexed loops.
- Use `URL`, `URLSearchParams`, `FormData`, `AbortController` platform APIs.
- Optional chaining and nullish coalescing where appropriate.

### Bun-first rules
- `bun install` over `npm install`.
- `bun add <pkg>` over `npm install <pkg>`.
- `bun remove <pkg>` over `npm uninstall <pkg>`.
- `bun run <script>` over `npm run <script>`.
- `bun test` over `npm test`.
- `bunx <tool>` over `npx <tool>`.
- Only use npm/npx/yarn/pnpm when Bun is incompatible or project explicitly requires it.
- Explain why when falling back.

### Framework guidance
- For new React projects: prefer Vite + React, or Next.js App Router for SSR needs.
- For new Svelte projects: prefer SvelteKit with Svelte 5 runes.
- For new Vue projects: prefer Vite + Vue 3 Composition API, or Nuxt for SSR.
- For new SolidJS projects: SolidStart or Vite + SolidJS.
- Prefer framework-native patterns over abstraction layers unless the abstraction pays off.
- Do not add a UI framework unless the project requires it.

### Code quality
- Small, single-purpose modules with clear boundaries.
- Explicit error handling. No swallowed errors.
- Structured validation at boundaries (API handlers, form submissions, CLI args).
- Production-grade error handling with user-friendly messages.
- Secure defaults. No secrets in code. Environment variables for config.
- Accessibility by default for all UI work (WCAG 2.2 AA minimum).

## Default workflow

1. Inspect the existing codebase. Understand the project structure.
2. Detect project type: frontend, backend, full-stack, CLI, library, SDK, monorepo, UI framework app.
3. Detect package manager and runtime. Prefer Bun unless project constraints require otherwise.
4. Select the right agents and skills from the tables above.
5. Produce a concise implementation plan with phases and agent assignments.
6. Implement production-grade JS/TS. Apply `typescript-coding` skill. Run `bun run typecheck` and `bun run lint`.
7. Review type safety, architecture, security, performance, accessibility, tests, and maintainability via specialist agents.
8. Add or update tests. Run `bun test`.
9. Run final checks: typecheck, lint, build, and framework-specific checks.
10. Produce final summary with changes, risks, tradeoffs, and next steps.

## Quality gates

Every implementation must verify:
- TypeScript strict type safety — `bun run typecheck` passes.
- Runtime input validation — all external inputs validated.
- Error handling — no swallowed errors.
- Lint/format — `bun run lint` passes.
- Build — `bun run build` succeeds.
- Tests — `bun test` passes with adequate coverage.
- Bundle/performance — no unexpected size regressions.
- Accessibility — WCAG 2.2 AA baseline for UI work.
- Security — no OWASP Top 10 violations, no secrets exposed.
- API compatibility — no breaking changes without justification.
- Framework best practices — follows framework-native patterns.
- Maintainability — small modules, clear names, minimal coupling.

## Completion gate

- `bun run typecheck` passes.
- `bun run lint` passes.
- `bun run build` passes.
- `bun test` passes.
- No unresolved BLOCKER review findings.
- All public API types documented.
- Architecture, implementation notes, review findings, and test results preserved in `_workspace/`.

## When to ask for clarification

- Project type cannot be determined from codebase inspection.
- Framework choice is ambiguous or the user asks for guidance between options.
- A breaking change is unavoidable and needs approval.
- Architecture decision has significant long-term impact.
- Performance/security tradeoff needs business input.
- Dependency choice has licensing implications.

## Non-goals

- Non-JS/TS languages (Python, Rust, Go, etc.).
- Mobile native development (React Native, Expo).
- GraphQL schema design (defer to dedicated harness if available).
- Infrastructure/DevOps beyond build and deploy scripts.
- Database schema design beyond integration patterns.

## Change history

| Date | Change | Target | Reason |
|---|---|---|---|
| 2026-07-09 | Initial harness | all | - |
