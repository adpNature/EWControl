# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

EWControl is a multi-tenant web platform for industrial monitoring of machinery ("Energy Winders") over OPC UA. It is in its foundational phase: a data Simulator + REST API catalog is being built first; every feature after that ships as a **vertical feature** (backend + frontend together, one spec, one delivery). Real OPC UA integration replaces the Simulator later without touching the rest of the system.

Stack: Angular 21 (frontend), NestJS (backend), PostgreSQL via TypeORM (config data), InfluxDB (time-series history), JWT (access+refresh) + bcrypt (auth), Pino (logging), pnpm, Docker Compose. Vitest + Testing Library for unit/component tests on both sides, Playwright for e2e.

## Mandatory workflow: Spec-Driven Development + TDD

**No feature is coded without a spec first.** This is enforced process, not a suggestion:

1. Write/update the spec in `docs/specs/<feature-name>.md` using the template in `docs/specs/README.md`. New features are **vertical**: one spec covers backend and frontend together.
2. Get the spec reviewed before touching code. The spec is the source of truth — if it's wrong or incomplete during implementation, fix the spec first, then the code.
3. Write tests from the spec's acceptance criteria (red).
4. Implement the minimum code to make them pass (green), then refactor.
5. Check the spec against the OWASP Top 10 checklist in `docs/06-seguridad-global.md` for relevant attack surface.

Coverage threshold: **80% lines/branches on Entities and Use Cases**, enforced by `coverage.thresholds` in each project's Vitest config — `pnpm run test` fails the build if it drops below this. Frameworks & Drivers has no forced threshold.

Full methodology: `docs/00-metodologia-y-calidad.md`. Spec index and template: `docs/specs/README.md`.

## Docs as Code — where information belongs

- **`docs/`**: architecture, domain model, API contracts (endpoints/events/DTOs), feature specs, security/deployment/observability decisions — things that don't change on every implementation refactor.
- **Inline TSDoc/JSDoc**: what a specific class/method/function does, params, return types, exceptions, edge cases — every public class/method needs one. If changing the implementation would force a doc update, that doc belongs in code, not in `docs/`.

Read `docs/00-metodologia-y-calidad.md` before assuming which one applies.

## Clean Architecture layers

Both backend and frontend follow Clean Architecture; dependencies always point inward, inner layers never know outer ones.

| Canonical layer      | Backend (`backend/src/`)                                                                                                                                                                                                                                                        | Frontend equivalent                                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Entities             | `entities/` — domain entities (Company, User, Machine, MachineConnection, Signal, AlarmDefinition, AlarmState, Dashboard, DashboardWidget), Signal Engine, Realtime Cache, Alarm Engine. Imports nothing from `use-cases/`, `interface-adapters/`, `frameworks-drivers/`.       | No business logic lives in the frontend — it all comes from the backend.                                                                                                       |
| Use Cases            | `use-cases/` — `auth/`, `history/`, `notification/`, `scheduler/`. Depends only on `entities/`, gets outer dependencies via injection against interfaces.                                                                                                                       | Application-level frontend services (e.g. session/user state in `core/state/`).                                                                                                |
| Interface Adapters   | `interface-adapters/` — `data-providers/` (`IDataProvider` + `simulation/`, future `opc-ua/`), `persistence/postgres/` (TypeORM repos + migrations), `persistence/influxdb/`, `rest/` controllers, `websocket/` gateway, `email/`, `auth-guard/` (sole JWT verification point). | `core/guards`, `core/interceptors`, `core/http` (thin `HttpClient` wrapper, base URL `/api/v1`), `core/websocket` (single channel for `SignalUpdated`, `AlarmTriggered`, etc). |
| Frameworks & Drivers | `frameworks-drivers/` — `app.module.ts`, `database/` (TypeORM DataSource, InfluxDB client), `config/`, `logging/` (Pino). Only layer allowed to depend on all others.                                                                                                           | Angular framework itself, build tooling.                                                                                                                                       |

Subfolders under each layer are created when the spec that needs them is implemented, not ahead of time — an empty placeholder folder with no README addition is a sign of over-building ahead of a spec.

Two hard architectural rules: the Dashboard never talks to the PLC directly, only the Realtime Cache; the frontend never connects directly to a database or Data Provider — everything goes through REST/WebSocket adapters.

Frontend module layout mirrors domain areas: `frontend/src/app/{auth,dashboard,history,alarms,config,core,shared}/`.

## Commands

Run from `/backend` or `/frontend` respectively (or via `docker compose exec backend|frontend <cmd>`):

```bash
# Backend (NestJS)
pnpm run start:dev          # dev server, watch mode
pnpm run test               # Vitest unit/component tests + coverage (enforces 80% threshold)
pnpm run test:watch         # Vitest watch mode
pnpm run test:e2e           # Vitest e2e config (test/vitest.config.ts)
pnpm run lint                # ESLint --fix
pnpm run build               # nest build
pnpm run migration:generate  # TypeORM migration from entity changes
pnpm run migration:run
pnpm run seed                 # seed demo Company/User/Machine + history

# Frontend (Angular)
pnpm start                   # ng serve, http://localhost:4200
pnpm test                    # Vitest + Testing Library
pnpm run test:e2e            # Playwright (config: e2e/playwright.config.ts)
pnpm run lint                # ESLint --fix
pnpm run stylelint            # Stylelint on *.scss
pnpm build                    # ng build
```

Run a single Vitest test file: `pnpm vitest run path/to/file.spec.ts` (or `pnpm vitest path/to/file.spec.ts` to watch it). Run a single Playwright test: `pnpm exec playwright test path/to/file.spec.ts`.

Full local environment: `docker compose up -d` (PostgreSQL, InfluxDB, backend, frontend). On Windows, hot-reload relies on polling — `backend/tsconfig.json` (`watchOptions`) and `frontend/angular.json` (`serve.development.poll: 1000`) intentionally force it because filesystem events don't reliably reach containers over the bind mount; don't remove these as "redundant".

Demo login (after seed): `demo@ewcontrol.local` / `Demo1234!`, role `AdminCliente`.

## Frontend conventions (full detail: `docs/12-convenciones-frontend.md`)

- Naming: camelCase everywhere in TS/SCSS (`$variableName`, `isLoading`); CSS classes are kebab-case (`.title-lg`).
- Every reusable visual property (color, spacing, radius, typography) is an SCSS `$variable` re-exposed as a CSS Custom Property in `:root` (`styles/colors.scss` etc.) — components consume `var(--x)`, never the SCSS variable directly, so runtime theming stays possible. Never hardcode a color/spacing value in a component.
- Reusability decision rule (12.4): no state/behavior → global CSS class on a native element (`.title-lg`, `.box`, `.form-label`); has state or behavior → Angular component (`InputComponent`, `TableComponent`, `ToastComponent`). Layout is always Flexbox, never `float`/absolute positioning except justified overlays/tooltips.
- Icons: Iconsax "Essential" free set only, as manually downloaded SVGs in `frontend/public/icons/` (not an npm package — avoids accidentally using unlicensed paid icons). Decorative icons get `aria-hidden="true"`; icon-only interactive controls get `aria-label`.
- Mobile-first responsive via the `respond()` mixin over `breakpoints.scss` (`sm`/`md`/`lg`/`xl`) — never hand-roll a breakpoint in a component.
- Accessibility target is WCAG 2.1 AA, enforced in three layers: `angular-eslint` `templateAccessibility` ruleset (pre-commit), Testing Library queries by role/accessible-name (tests fail on inaccessible markup), and the manual checklist in `docs/12-convenciones-frontend.md` §12.7.

## Conventions enforced automatically (don't fight these, don't bypass them)

- **Commits**: Conventional Commits (`feat`, `fix`, `docs`, `chore`, `test`, `refactor`), checked by commitlint on the `commit-msg` hook — required for `semantic-release` to compute versions correctly.
- **Branches**: GitHub Flow — short-lived `feature/<spec-name>` branches off `main`, merged via PR (`main` is never pushed to directly and requires a green `ci.yml` run).
- **Pre-commit** (Husky + lint-staged): Prettier + ESLint (`@typescript-eslint/naming-convention`, camelCase/PascalCase) on staged `.ts`, Stylelint on staged `.scss`, Prettier on `.md`. A file violating a convention cannot be committed.
- **PRs** must link the spec they implement and pass the checklist in `.github/PULL_REQUEST_TEMPLATE.md` (tests per acceptance criterion, clean lint, accessibility if UI, docs updated in the same PR).
- pnpm only, three independent installs (root, `/backend`, `/frontend`) — no pnpm workspaces. `frontend/.npmrc` forces `node-linker=hoisted` (Stylelint's plugin loader breaks under pnpm's symlinked `node_modules`); don't remove it or move it to the backend, which doesn't need it.
