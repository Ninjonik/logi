# Audit scope and evidence limits

Date: 2026-11-11. No application code was changed. The master handoff is [maintenance-implementation-plan.md](../maintenance-implementation-plan.md).

## What the evidence supports

**Later bot-only completion:** the maintainer narrowed the active request to the Discord bot. Its 135 source/support-code files and 98 tests have now all been fully read, plus README/configuration and selected backend/shared traces. See the [bot audit](discord-bot-performance-audit.md), [execution plan](discord-bot-implementation-plan.md) and [hash ledger](discord-bot-review-ledger.json). This narrower completion does not change the whole-application coverage limitations below. Production performance acceptance remains unperformed.

The review covers the repository's three runtimes and shared layers through source inventory, static import/call analysis, query discovery, route and schema enumeration, focused manual workflow traces, offline reproductions and the existing test suite. It is **not a certified manual line-by-line review of every file**. That distinction is deliberate: inventory and green tests cannot establish that every issue was found, and this plan cannot guarantee zero remaining defects.

The reconciled inventory contains 2,779 files: 2,002 source files, 702 tests and 75 support files. Hidden SSO discovery routes and root tooling are included. The source structure inventory covers those 2,002 source files; the HTTP inventory contains 151 API route files, including 26 v1 files. Registered-export discovery found 582 Convex functions; schema declaration inventory contains 118 tables. Discovery counts are not semantic operation counts, and delegated checks require interpretation.

Generated Convex bindings, installed dependencies, build output, environment files and runtime databases are excluded from manual source review. Public binary art, historical screenshots/output, IDE metadata and local data are supporting assets rather than independently audited application implementations. Third-party dependency internals and production configuration were not security-certified. Generated catalogues are assessed through ownership/producers and consuming contracts, not manually edited.

## Coverage by concern

| Concern | Manual evidence anchors | Findings / execution |
| --- | --- | --- |
| Events, drafts, recurrence, signup | Dashboard handlers, shared commands, repositories, generic API writes, scheduling | A01/A09/A15/A22/A24/A25/A26; R01–R05/R07 |
| Rosters/shared matches/attendance | Save/revision path, shared projections, live board, attendance request and worker | A03/A23/A26; P01/P14/P17/P20; R02–R07 |
| Membership/groups/users | Assignment writes, decision adapters, hierarchy, merge, privacy export, role worker | A04–A06/A08/A12/A13/A20; R01–R05 |
| Identity/SSO/access | Session/grant guards, OAuth, SSO management, platform links, actor-backed operations | A03/A12/A27; P19; R01/R08/R09 |
| Articles/calendar/presets/maps | Commands, route adapters, schemas, Markdown/uploads and stratmap state coordination | A04/A10/A16/A19/A21/A23/A25; R01–R04/R07/R08 |
| Teams/competitions/personal leagues | Catalogue/enrollment/portal authority, commands, route/OpenAPI contracts and bounded lists | P22; R03/R04/R08 |
| Providers/statistics/history | Transport, encrypted credentials, collectors, history/read projections and retention | A05/A15; P03–P07/P14/P16/P21; R03–R06 |
| Discord panels/messages/seed | Settings slices, gateways, publication delivery, worker/startup and synchronization | A11/A26; P08/P09/P19/P20; R05/R06/R08 |
| Public/dashboard read models | Context construction/callers, discovery, public match/player and image generation | A03/A18; P01–P06/P10–P13/P18/P22; R04/R06 |
| Frontend/shared state | Large editor persistence paths, hooks/contexts, theme, polling and selectors | A07/A23; P12; R07 |
| API platform | Catch-all dispatch, dedicated routes, settings registry, authentication, receipts and cache responder | A18/A22/A24; parity register; R01/R02/R08 |
| Support/tooling/operations | GitHub sync, scripts, CI, environment modules, Compose, backup and SDK patch contract | A14/A17/A27; P23; R00/R09 |

These are manual anchors within repository-wide static passes, not a claim that every file in each family received equal semantic depth. Accessibility, translations, responsive behavior and live external-service recovery still require the acceptance checks in the plan.

## Verification actually performed

- Existing suite: 4,003 passing tests, zero failed/skipped.
- Non-incremental TypeScript check: passed.
- Lint: failed, 267 errors and 2,524 warnings across the checked tree, including temporary/vendor code. Do not attribute all of these to maintained application code.
- Formatting check: failed with existing warnings across 2,254 files; no bulk formatting performed.
- Convex bundle check: failed on filesystem/path resolution in this Windows environment; runtime bundle validity remains unverified.
- Offline actual-handler reproductions: lost event tenant at the HTTP factory; rejected duplicate-fixture creation leaving an inserted event; different-target idempotency returning the first deletion response. Repository database fakes have the limitations documented in A14.
- Pure/offline checks: webhook special-network URL acceptance and unsafe raw-Markdown output using installed rendering packages.

No production profiling, browser acceptance, production build, disposable real-Convex transaction/index tests, live Discord/provider calls, restore drill or deployment was performed. Performance findings identify code work/read amplification; latency and cost improvements remain unmeasured.

## How to use this handoff honestly

Start the R packages in the master plan. Revalidate each finding against the current revision and trace every sibling caller before closure. The operation-family matrix identifies supported surfaces, actual gaps and authority-sensitive exclusions; implementation must refine it into operation-level executable coverage. Changed or previously shallowly reviewed code requires semantic review as part of its implementation task.

The plan is comprehensive in intended application scope. The evidence is not exhaustive proof that everything wrong has been discovered. Unresolved defects, authority decisions, unreviewed semantic details and unrun runtime checks must never be hidden behind a “complete” label.
