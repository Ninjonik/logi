# AGENTS.md

This file is the repository-wide operating guide for AI coding agents working on Logi. Read it before making changes. More specific `AGENTS.md` files, if added below a subdirectory in the future, override this file for that subtree.

## Start Here

1. Read [README.md](./README.md) for the project summary and common commands.
2. Read [ARCHITECTURE.md](./ARCHITECTURE.md) before changing behavior or moving code between layers.
3. Read [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution and testing expectations.
4. For bot work, also read [discord-bot/README.md](./discord-bot/README.md).
5. Inspect the relevant implementation and nearby tests before editing. Verify documented behavior against the implementation and its tests.

## Project Summary

Logi is a server/community management application with three cooperating runtimes:

- a Next.js 16 App Router dashboard in `src/app`
- Convex functions and persistence in `convex/`
- a Discord.js bot in `discord-bot/`

Shared business behavior lives in framework-independent domain rules and application use-cases. Keep changes focused on the requested feature.

The main stack is TypeScript (strict mode), React 19, Next.js, Convex, Discord.js, Tailwind CSS 4, `next-intl`, Zod, and Node's built-in test runner via `tsx`. The `@/*` import alias maps to `src/*`.

## Documentation Map

### Maintainer and agent documentation

- [README.md](./README.md) — project overview, source layout, setup, and commands
- [ARCHITECTURE.md](./ARCHITECTURE.md) — runtime boundaries, layer responsibilities, persistence, and tests
- [CONTRIBUTING.md](./CONTRIBUTING.md) — contribution workflow, placement rules, and validation
- [discord-bot/README.md](./discord-bot/README.md) — bot configuration, responsibilities, and source layout
- [Technical documentation](./docs/README.md) — current technical reference index
- [Website integrations](./docs/integrations/website/README.md) — API, identity, membership, game data, and Discord contracts
- [Self-hosted Convex](./docs/self-hosting.md) — Compose setup and operating configuration
- [Discord message kit](./docs/superpowers/specs/discord-redesign/KIT.md) — shared message model, rendering, previews, and registry
- [Discord panels API](./docs/superpowers/specs/discord-redesign/PANELS-API.md) — panel lifecycle, routes, worker, and join-page contract
- [Public wiki](./content/index.mdx) — product workflows and configuration

### User-facing and legal Markdown

- [public/docs/privacy-policy.md](./public/docs/privacy-policy.md) — source content for the privacy policy
- [public/docs/tos.md](./public/docs/tos.md) — source content for the terms of service
- [LICENSE.MD](./LICENSE.MD) — repository license

Keep links in this section updated when adding, renaming, or removing important Markdown documentation. Legal documents are content sources, not engineering instructions; change them only when the task explicitly concerns their content.

## Repository Map

```text
src/
  app/                 Next.js pages, layouts, and API route adapters
  components/          React UI; reusable primitives live in components/ui
  domain/              Pure business types, policies, derivations, transitions
  application/         Use-cases and ports that orchestrate domain behavior
  infrastructure/      Convex adapters and test doubles
  lib/                 Focused web gateways, read models, validation, and helpers
  i18n/                Locale routing, dictionaries, and messages
  hooks/, contexts/    Client-side React state and behavior
convex/                 Convex schema, queries, mutations, and runtime adapters
discord-bot/            Discord runtime, interactions, synchronization, and tests
scripts/                One-off maintenance/import/export utilities
config/                 Checked-in application configuration
public/docs/            User-facing Markdown content
```

Do not edit `.next/`, `node_modules/`, `tsconfig.tsbuildinfo`, or `convex/_generated/` by hand. Treat files under `data/` and generated JSON catalogs under `src/data/` as data assets: understand their producer and format before changing them.

## Architectural Rules

Dependencies should point inward:

```text
framework entrypoint -> adapter -> application use-case -> domain rule
```

### Domain: `src/domain`

Put pure, deterministic business behavior here: validation, policies, state transitions, normalization, calculations, and domain-oriented types. Domain code must not import Next.js, Convex, Discord.js, React, cache APIs, environment variables, or persistence clients.

### Application: `src/application`

Put workflows here when behavior coordinates repositories, multiple domain policies, or ordered side effects. Depend on explicit ports/interfaces and inject clocks or external capabilities. Keep use-cases narrow and test them with fakes from `src/infrastructure/testing` where appropriate.

### Infrastructure and runtime adapters

- `src/infrastructure`: implementations of application ports, Convex repository adapters, mapping/normalization, and test doubles
- `convex`: authentication, input validation, transaction-scoped reads/writes, use-case wiring, persistence, and serialization
- `src/app` and focused `src/lib/read-models` or `src/lib/gateways`: HTTP/UI integration and web-specific concerns
- `discord-bot`: Discord event parsing, Convex calls, message/component rendering, and Discord-only behavior

Keep framework entrypoints thin. Do not add shared business rules directly to `convex/*.ts`, `src/app/api/**`, `src/lib/server-*`, or Discord interaction handlers. If existing behavior lives there, extract a pure rule or use-case when practical and let the old entrypoint delegate to it.

Do not introduce grab-bag server modules or compatibility shims solely to preserve an obsolete Convex namespace. Prefer focused, feature-named modules and update callers.

### Shared dashboard, API, and bot operations

Implement each business operation once beneath its runtime entrypoints. The
dashboard's server actions/routes, `/api/v1` integration routes, and bot handlers
may use different authenticated Convex functions, but equivalent writes must
delegate to the same application command and Convex repository adapter. Do not
make SSR or server actions call Logi's own public HTTP API just to share logic.

- Put deterministic policies in `src/domain/<feature>`, workflows and repository
  ports in `src/application/<feature>`, and persistence implementations in
  `src/infrastructure/convex`. Run shared writes inside the caller's Convex
  transaction, including dependent updates and publication state.
- Keep session/grant/API-key authentication, request parsing, rate limits,
  idempotency, HTTP status/envelopes, and cache invalidation in the appropriate
  adapters. Pass verified tenant/game scope to the shared command; enforce
  resource ownership and cross-resource invariants there rather than repeating
  them in each writer. Never substitute an internal secret for user authority.
- Reuse the existing article, group, calendar-item, roster-management, preset,
  and stratmap commands. Add new behavior there first and wire every applicable
  caller to it. Supply clocks and external capabilities through ports.
- Preserve established `/api/v1` paths and input/output contracts during an
  internal consolidation. Do not introduce a new API version to hide duplicated
  logic. If equivalent writers disagree on product behavior and the intended
  rule is unclear, ask the maintainer before choosing one; document deliberate
  capability differences instead of silently broadening access.
- Squad preset saves preserve supplied `order` values. Topic preset saves retain
  supplied IDs and optional messages; they do not generate missing IDs or default
  message blocks. Calendar add/delete commands affect individual records; only
  the explicit collection editor replaces the submitted list.
- Separate dashboard aggregates, paginated API projections, and live Convex
  reads are appropriate when their contracts differ. Share policies and mapping
  where useful; retain each boundary's authorization and data redaction.
- Test equivalent dashboard and v1 writes through their adapters against the
  same invariants, including tenant/game rejection, dependent updates,
  publication effects, and idempotent replay. Verify successful API writes also
  invalidate affected cached dashboard/public reads. See
  [CONTRIBUTING.md](./CONTRIBUTING.md#shared-write-infrastructure) for examples.

## Where New Work Goes

| Change                                   | Primary location                             | Typical validation                                                       |
| ---------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------ |
| Pure business rule or calculation        | `src/domain/<feature>`                       | colocated unit test                                                      |
| Multi-repository workflow                | `src/application/<feature>`                  | colocated use-case test with fakes                                       |
| Convex persistence or transaction wiring | `convex/` and/or `src/infrastructure/convex` | mapping test plus focused integration check                              |
| Next.js page or route                    | `src/app`                                    | typecheck and focused behavioral test                                    |
| Web read/write integration               | `src/lib/read-models` or `src/lib/gateways`  | focused unit/integration test                                            |
| React UI                                 | `src/components` or route-local UI           | typecheck and manual UI verification                                     |
| Discord behavior                         | `discord-bot/src`                            | colocated bot test; use shared rules for cross-runtime behavior          |
| Translation copy                         | `src/i18n/messages` and related dictionaries | update all supported locales (`en`, `cs`) unless fallback is intentional |

Prefer existing feature patterns and naming over inventing a parallel abstraction. Search for a similar implementation before adding a module.

## Working Agreement

Before editing:

- read the relevant docs and trace current callers, persistence boundaries, and nearby tests
- check `git status` and preserve unrelated user changes
- identify whether the task is UI, domain, workflow, or adapter work
- look for generated files and source data before editing derived output

While editing:

- make the smallest coherent change that fully solves the task
- preserve strict TypeScript types; avoid `any`, unsafe assertions, and silent fallbacks
- reuse established helpers, validation schemas, UI primitives, and repository ports
- keep domain logic deterministic; pass time and external state through explicit inputs or ports
- validate untrusted input at runtime boundaries and enforce authorization server-side
- keep server-only secrets and modules out of client components; add `"use client"` only when browser interactivity requires it
- preserve locale-aware routing under `src/app/[locale]`
- add or update tests for normal, invalid, edge, and regression behavior when business logic changes
- update documentation when commands, architecture, environment requirements, or user-visible behavior materially change
- when an application feature, screen, permission, workflow, condition, or user-visible wording changes, update the matching public wiki page under `content/` in the same change; add a page when the feature has no suitable coverage
- keep product features and the authenticated `/api/v1` surface in parity: when a
  feature's behavior, data, or supported action changes, update both the feature
  implementation and its corresponding `/api/v1` endpoint, contract, tests, and
  OpenAPI documentation in the same change. An exception is allowed only when an
  API operation would be unsafe or has no dashboard-equivalent lifecycle; record
  that deliberate exclusion in the relevant API documentation or handoff plan.

Do not opportunistically reformat, rename, or refactor unrelated code. Do not overwrite or discard changes you did not create.

## Commands

Run commands from the repository root. Existing documentation uses npm, and `package.json` is authoritative for available scripts.

```bash
npm run dev             # Next.js development server
npm run dev:all         # dashboard and Discord bot together
npm run bot:dev         # Discord bot only
npm run test            # all src and bot tests
npm run test:domain     # domain tests only
npm run bot:test        # bot tests only
npm run test:coverage   # all tests with Node coverage
npm run typecheck       # TypeScript without emit
npm run check:convex-bundles  # Convex modules bundle for their runtime (no node: imports in V8 modules)
npm run lint            # configured lint script
npm run build           # production Next.js build
npm run convex:deploy   # deploy Convex; external side effect
```

Use the narrowest relevant test during iteration, then broaden validation before finishing. A single test file can be run with:

```bash
node --import tsx --test path/to/file.test.ts
```

Minimum finish criteria:

- documentation-only change: verify links, paths, and commands against the repository
- isolated rule change: focused tests plus `npm run typecheck`
- cross-cutting backend change: focused tests, `npm run test`, and `npm run typecheck`
- UI or routing change: `npm run typecheck`, relevant tests, and manual browser verification when available
- release-sensitive change: also run `npm run build`

For any change that modifies Convex functions, schema, validators, generated
function bindings, or Convex-backed persistence behavior, run `bunx convex
deploy` as the final implementation step. This deploys to the configured
Convex deployment, so report its result and do not treat local tests as a
substitute for the deploy.

If a command fails for an unrelated pre-existing reason, report the exact command and failure; do not conceal it or broaden the task without authorization.

## Testing Conventions

Tests are colocated and named `*.test.ts`. The suite uses `node:test` and `node:assert`, not Jest or Vitest. Follow the style in neighboring tests.

- domain tests exercise pure inputs and outputs
- application tests verify orchestration through ports/fakes
- infrastructure tests focus on mapping and adapter behavior
- integration tests cover only important runtime wiring paths

Do not make production APIs less precise merely to simplify tests. Prefer fakes, dependency injection, and deterministic inputs.

## Data, Convex, and Authentication

Convex is the persistence and transaction boundary. Read `convex/schema.ts` and the relevant feature functions before changing stored shapes. Consider existing records, optional fields, migrations, indexes, and all readers/writers. Do not edit `convex/_generated`; regenerate it through Convex tooling when required.

Treat IDs for Convex records, Discord entities, platform accounts, servers, users, events, and rosters as distinct concepts even when they are represented as strings. Preserve tenant/server scoping in every query and mutation.

Authentication and internal-secret checks belong at runtime boundaries. Every public Convex function must check the internal secret, a dashboard session gateway or a client grant before it reads or writes anything (see ARCHITECTURE.md); never trust a `userId` sent by the browser. Never weaken an authorization check to make a client flow work. Never log tokens, secrets, OAuth codes, raw cookies, or unnecessary personal data.

## Environment and Secrets

Local runtime configuration is stored outside source control. Relevant variables include, depending on the runtime:

- `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_URL`, or `CONVEX_SELF_HOSTED_URL`
- `DISCORD_BOT_TOKEN`
- `DISCORD_REDIRECT_URI`
- `INTERNAL_AUTH_SECRET`
- `SITE_URL`
- `LOGI_LOG_DB_PATH`

Never read secret values merely to document or debug the repository, and never commit `.env*` files or paste their contents into output. When adding a variable, update the appropriate environment validation module and relevant documentation using placeholders only.

## Frontend Conventions

- Prefer server components; use client components only for state, effects, browser APIs, or interactive handlers.
- Reuse primitives from `src/components/ui` and existing app components before adding new variants.
- Keep components focused on rendering and user interaction. Move reusable decisions into domain/application code.
- Maintain accessibility: semantic elements, labels, keyboard operation, focus behavior, and useful loading/error states.
- Preserve responsive behavior and the existing theme system.
- Avoid embedding server credentials or server-only imports in client bundles.

## Discord Bot Conventions

Read [discord-bot/README.md](./discord-bot/README.md) before bot changes. Keep bot modules focused on Discord concerns: parsing events/interactions, synchronization scheduling, invoking Convex/shared logic, and rendering Discord output. Put cross-runtime signup, roster, attendance, event, or membership rules in shared domain/application modules.

Discord and network operations can be retried or delivered more than once. Preserve idempotency, cache consistency, rate-limit awareness, and clear error reporting. Avoid real Discord calls in unit tests.

## Scripts and External Side Effects

Files in `scripts/` may import, export, seed, or transform real data. Inspect a script and its target environment before running it. Commands such as `npm run convex:deploy`, seed scripts, migrations, Discord operations, and production data changes have external side effects: do not run them unless the user explicitly requests that action and the target environment is known.

## Completion Checklist

Before handing work back:

- confirm the change is in the correct architectural layer
- review the diff for accidental files, secrets, generated output, and unrelated edits
- run Prettier on the TypeScript and TSX files changed for the task to keep them formatted without modifying unrelated work
- run proportionate tests and typechecking
- verify all new imports, links, routes, and environment variable names
- update relevant Markdown when behavior or developer workflow changed
- state what changed, what was validated, and any remaining risk or unrun check

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
