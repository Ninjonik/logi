# Logi maintenance implementation plan

Date: 2026-11-11. Companion: [review](codebase-review-2026-11-11.md).

**Implementation status: not started.** This is the master execution plan for the repository-wide static assessment. Read the [scope and evidence limits](maintenance/audit-scope.md), [27 deeper findings](maintenance/audit-progress.md), [23 performance/caching findings](maintenance/performance-and-caching-audit.md), and [operation-family parity register](maintenance/api-parity-audit.md). The earlier review is retained as the original sampled assessment. Mechanical inventories are discovery evidence; they do not certify a manual line-by-line review or a defect-free application. No application code was changed.

The R work packages below are the authoritative implementation order. M00–M13 retain detailed implementation recipes; C00–C05 define whole-program closure. They are not three alternative plans. Each R package must satisfy the applicable M recipes and C criteria. Do not finish only the first named hotspot and close the package.

## Authoritative work packages

For every package, record its reviewed revision, complete affected caller set, concrete changes, data compatibility/migration, tests, operational validation and unresolved decisions in a handoff ledger. A security correction precedes architectural cleanup. A blocked product decision does not block unrelated packages, but it prevents the relevant parent package being marked complete. Do not turn this plan into a rewrite.

### R00 — Preserve and make the baseline reproducible

Depends on: nothing. Recipes: M00/M06/C00. Start with the inventory and baseline already supplied; reconcile changed/hidden files and root tooling instead of redoing the entire discovery from memory.

1. Establish the canonical install/runtime/lockfile policy from package.json, Bun CI and repository docs. Preserve the SDK lifecycle patch and its tests.
2. Separate maintained-code lint/format violations from downloaded `.tmp`, generated assets and vendored JavaScript. Add exact ownership-based ignores, then repair maintained-source errors in coherent feature changes. No blanket suppressions or repository-wide formatting.
3. Make test/coverage bootstrapping consistent, verify offline contract generation in a disposable checkout, and fix the bundle check's Windows path/output handling. The current bundle failure is not evidence of invalid V8 imports.
4. Add the operation/architecture checks from M03/M05 as the affected boundaries stabilize. Add a production build with synthetic/offline dependencies; don't let a build inspect production data.

Done: reproducible test/typecheck/contracts/bundles/style/build jobs for all three runtimes; baseline debt has explicit owner/tasks. Existing passing tests do not waive the defects below.

### R01 — Repair authority and active-content boundaries

Depends on: R00 baseline recorded, not all its cleanup. Findings: A01/A02/A03/A12/A18/A19/A21. Recipes: M01/M04/M05.

1. Replace cached authorization with a narrow live access read and verified actor. Carry actor/tenant/game to Convex and enforce them in the same transaction. Start event conclude/training, group/config/webhook writers, roster deletion/meeting attendance and global merge; inspect every sibling from the route/export inventory. Cached protected reads also need a live gate before returning previously privileged payloads.
2. Separate platform-wide identity merge from clan-local imported-profile repair. Audit all global identity-reference tables, including newer sessions, links and personal league membership. Fix tenant+game merge identity. Require an explicit maintainer decision for the authority model before reopening unsafe merge functionality.
3. Implement webhook destination validation at registration and delivery with IPv4/IPv6/DNS pinning, redirect policy and explicit private-network allowances where configured. Preserve signature bytes, timestamps and retry semantics.
4. Restrict cache invalidation endpoints to trusted runtime or live scoped authority; prefer write-owned effects. Add body/rate/origin controls and derive resource ownership rather than trusting submitted scope.
5. Replace raw-upload serving policy with verified purpose/type/owner/visibility, isolated/sandboxed arbitrary downloads and authorized private access. Migrate existing references without breaking intentionally public assets. Disable or sanitize raw HTML consistently in stored Markdown and editor previews.

Done: cross-clan IDs, revoked cached admins, unrelated invalidation, unsafe URLs, active HTML/SVG/iframe and wrong-owner files are rejected through real adapters; intended public media and authorized workflows still work. No production exploit tests.

### R02 — Make authoritative writes atomic and replay identity precise

Depends on: R01 relevant authority contract. Findings: A06/A13/A20/A22/A24; also config multi-mutation saves. Recipes: M02/M04/M07/M10.

1. Fix the verified event insert-before-fixture-conflict case in publicApi.ts. Audit every catch surrounding writes. Preflight predictable rejection and let post-write/unexpected failures escape so Convex rolls back. Preserve stable HTTP errors in adapters. Do not emulate rollback by deleting guessed rows.
2. Bind receipts to concrete target/action, relevant game/query scope and body digest. Version the fingerprint across the retention window. Update every generic mutation family, local settings and any other receipt-based command; retain credential checks before replay and byte-identical successful responses.
3. Move membership decision assignment/upsert/removal/cross-game transition, role-operation intent and application closure into one fenced shared mutation. Cache/network failure must not reopen a committed decision.
4. Resolve assignment membership versus global platform-ID/note authority and split or transact compatible writes. Consolidate Discord settings/style/message saves and other multi-call settings workflows into one authoritative save when they represent one operation.
5. Define typed post-commit results/effects. A cache/log/delivery failure cannot become an ambiguous business-write failure; expose pending/failed external work truthfully and retry it durably where required.

Done: failure injection after every dependent step leaves either no authoritative change or an explicit documented partial outcome. Different targets cannot replay the same receipt. All equivalent writers pass the same rollback/replay scenarios, including a disposable real-Convex check for critical runtime semantics.

### R03 — Put tenant/game/reference and lifecycle rules in shared commands

Depends on: R02 boundaries. Findings: A04/A08/A09/A15/A16/A25. Recipes: M04/M05/M09.

1. GroupCommands: reject self/ancestry cycles; choose and document child handling on delete; preserve assignment/allowlist cleanup and game isolation.
2. Assignment commands: immutable tenant/user/game identity, game-scoped group/category eligibility, canonical stable/native/Discord identity mapping and role-policy invariants. Migrate every dashboard/API/bot writer.
3. Event commands: shared reference validation for groups, stratmaps, topic/squad presets, assets, fixtures and shared host/guest state. Preserve legitimate game-neutral resources explicitly. Validate catalogue/enabled-game capabilities at the correct boundary instead of assuming every nonempty string is a usable game.
4. Score workflow: propagate event gameId, canonical identities and game-score keys; define migration/reconciliation for existing totals. Test pause/status combinations across games, conclusion replay and legacy HLL fallback before changing totals.
5. Inject one timestamp through roster/projection/score dependent updates. Keep monotonic revision behavior. Consolidate competition business rules incrementally into the existing feature use-cases; retain platform/clan/personal authority differences.

Done: all applicable callers use shared invariants; cross-game references and immutable ownership changes fail before writes. Data migration is resumable and verified on synthetic/authorized disposable records; historical scores are not silently recalculated.

### R04 — Replace history-sized request reads with bounded feature projections

Depends on: R01 narrow live authorization; schema/index changes coordinated with R03. Findings: A05 and P01–P07/P10/P13/P21/P22. Recipes: M10/M13.

1. Split serverContext into live viewer access, shared workspace shell, paginated lists, bounded calendar range, compact editor selectors and single-resource details. Migrate **all** page/layout/route guard consumers; the dashboard home also loads contexts per visible clan. Don't cache the whole manager snapshot as the new shell.
2. Add indexed public discovery eligibility/count projections and database pagination. Replace global public match identity/stat scans with exact mapping/event-player relations. Normalize long-lived player match history so page work doesn't deserialize the player's entire lifetime record.
3. Replace recent dashboard summary scans with indexed recent-result/event-player projections. Refresh performance facts only for affected players/revisions, coalesced in bounded jobs; keep explicit repair paths separate.
4. Replace assignment-thread lookup, global counts and event-stat repair scans with point indexes/counters/relations. Make genuinely global directory operations explicitly paginated. Rebuild privacy export from the 118-table personal-data/identity map with subject-scoped bounded collection and alias completeness.
5. Budget rows and bytes for sparse filters. Keep createdAt/cursor compatibility or version cursor semantics explicitly; empty pages with continuation must remain traversable. Prefer change feeds to repeated updatedSince sweeps.
6. Remove silent hard-prefix completeness assumptions in competition lists, League activation/settings and join-slug uniqueness. Add real capacity/eviction semantics for process rate-limit maps without reintroducing per-request Convex hot-document writes.

Done: point reads/auth/detail/page work remains bounded as unrelated history grows; deep/sparse pages complete correctly; counters/revisions remain accurate; exports are complete/redacted. Record rows/bytes/writes/payload and p50/p95 in a disposable runtime; no invented production gains.

### R05 — Bound recurring/background work and make progress durable

Depends on: R02 durable intent, R03 policies. Findings: A11/A26 and P08/P09/P14/P16/P17/P19/P20/P23. Recipes: M13/M04.

1. Replace global bot snapshots/signature rebuilds with compact scoped revision indexes and affected-resource fetches; map by guild once rather than filtering full arrays repeatedly. Retain effective coalescing and unchanged-message hashing.
2. Make startup scheduler recovery/backfill and recurrence generation bounded with checkpoints and fair progress. Apply the same rule to retention: no permanent first-500 ceiling or retained-prefix starvation.
3. Consume scheduled reminder jobs into durable delivery intent, then lease/fence and record recipient progress/uncertainty. Preserve deadlines, current eligibility, cooldown and user opt-outs. No promise of exactly-once external delivery.
4. Turn meeting-attendance's long web poll into queued request/status; bound imports/training/OAuth/Discord fan-out and apply timeouts/Retry-After. Deduplicate callback-local bot checks.
5. Budget hidden shared/people/integration wrapper work. Index eligible shared events, coalesce host projection work and skip unchanged relevant facts. Keep atomic feed and shared-roster effects.
6. Bound deletion children and unchanged history kill-event replacement; use tombstones/resumable cleanup only with all readers/writers honoring lifecycle state. Preserve deliberately unlimited statistic/recap retention.
7. Checkpoint GitHub marker recovery and comment/history walks; retain uncertain-create reconciliation. Add owned worker/service shutdown, drain/stop controls and restart behavior across every starter in bot index.ts.

Done: every repeated job has claim identity, scope, deadline/read/write/concurrency budget, progress and recovery; one bad/retained tenant cannot starve others. Crash tests cover each handoff. Queue latency/read amplification are measured at realistic synthetic volume.

### R06 — Make caching coherent, scoped and measurable

Depends on: R02 effect contract and R04 read shapes. Findings: A17/A18 and P11/P12/P15/P18/P22. Recipes: M10/M11.

1. Enumerate every cached read and all its authoritative writers, aliases and shared guests. Define key dependencies, safe data class, tags, TTL, invalidation owner and outage/replay recovery. Don't narrow broad tags until missing invalidations are covered.
2. Replace response-body ID guessing with typed mutation effects. Apply the same effects to dashboard/API/bot and replay paths. Keep live authority outside reusable data caches.
3. Separate current image URLs from genuine immutable artifacts. Bound version parameters, byte/pixel/entry usage and global render concurrency; coalesce concurrent misses. Define unpublish/revocation limitations explicitly and test multi-process/eviction behavior.
4. Use a small shared serial polling helper for affected components; abort/ignore old scope, pause hidden tabs, back off and stop at terminal states. Deduplicate Discord metadata per intended freshness window. Preserve better existing Warcon/invitation implementations.
5. Make logs bounded/redacted/failure-safe so post-commit logging cannot replace business results; define SQLite contention/retention behavior.

Done: warm-cache revocation, cold/warm correctness, all write/replay invalidations, shared guest updates, deletion and outage recovery tests pass. Report hit rate, invalidation fan-out and render/backend calls before/after.

### R07 — Repair UI state/effects and simplify feature ownership

Depends on: R02/R03 revision/result contracts. Findings: A07/A10/A23 and original review large-module findings. Recipes: M05/M07/M08.

1. Draft editor: queue latest edits after a slow save; track submitted generation and base revision. Roster: retain the board's actual base revision, do not take a newer live token for an older dirty board, and don't clear newer edits after acknowledgement. Stratmap: implement explicit concurrent-editor conflict/lease policy and validate bounded state server-side.
2. Extract persistence coordination and pure derivations before splitting presentation. Start new-match flow, roster board/squad card, stratmap hook, panel editor, settings forms and competition manager; apply the same criterion across maintained components, not an arbitrary line-count target.
3. Consolidate sidebar hook, scope theme variable ownership, handle storage denial/invalid saved themes, and release transition locks on failure. Preserve focus/keyboard behavior, responsive layouts and all five locales.
4. Move the five documented local outward layer edges and Node-dependent domain webhook signing to proper inward pure models or infrastructure ports. Check runtime imports separately from type-only schema/model cycles; don't refactor legitimate type-only cycles as runtime defects.
5. Keep browser state in focused hooks/components and business decisions in existing domain/application modules. Remove obsolete shims only after every import/caller migrates. Do not replace straightforward adapters with a generic CRUD/effects framework.

Done: controlled-promise/timer regression tests prove save races and recovery; browser acceptance covers drag/manual save, keyboard alternatives, navigation, conflict handling, locale/theme/mobile/error states. Typecheck/build enforce client/server boundaries.

### R08 — Complete API capability coverage with appropriate authority

Depends on: R01–R03 for writes; R04/R06 for reads/effects. Recipes: M03/M12. Follow the [operation-family work register](maintenance/api-parity-audit.md) for concrete supported surfaces, gaps and exclusions.

Create the executable operation manifest, then implement every justified clan capability gap in small feature batches. Explicitly cover absent generic event deletion, roster creation, preset/stratmap deletion, shared invitation lifecycle and settings field gaps; map actor-backed commands before declaring duplicates/gaps. Reassess documented live-action exceptions individually against safety and user authority. Preserve global/personal exceptions and never expose secrets or arbitrary account merges merely for parity.

Done: no unclassified/pending/gap operation remains; every supported operation has shared-command adapter tests and OpenAPI/wiki/technical docs. Every retained exception has a concrete authority/lifecycle/safety rationale and reconsideration condition. A file/path manifest alone cannot prove semantic parity.

### R09 — Verify operational recoverability and close the whole program

Depends on: all applicable packages. Recipes: M11/M13/C05.

Pin compatible self-hosted image versions and record the supported runtime/CLI/SDK patch combination. Establish validated environment contracts, explicit-target/dry-run maintenance scripts, artifact policy, backup alerts/retention and an authorized isolated restore drill. Preserve existing backup locking and restricted permissions. Complete required authorized deployments, browser checks, real-Convex transaction/index/validator scenarios, API contract checks and synthetic performance acceptance.

Reconcile the final source/operation/table/cache/worker inventories against the delivered revision. All new/moved/changed callers reopen affected closure checks. Every A01–A27, P01–P23 and original finding must map to a fix or a justified non-defect/conditional exception with evidence. Unrun deployment/runtime checks and unresolved defects prevent an unqualified completion claim.

Done: every program completion gate at the end of this plan passes. Report what the evidence proves and its limits; no claim of zero possible future bugs.

## Immediate corrections from the deeper audit

These precede structural refactoring. Use the evidence and exact traces in the audit progress document.

1. **A01: event tenant enforcement.** Update dashboard event-action handlers/gateways to preserve authorized tenant and live actor through conclude/training completion. Enforce both in the Convex transaction and shared command, preserving distinct bot authority. Test an admin of clan A targeting clan B's event, actor revocation, own-event success and shared-host restrictions. Trace all sibling ID-only actions; do not fix only conclude.
2. **A02: webhook destination enforcement.** Correct registration and delivery transport policy for IPv4/IPv6 special networks and hostname resolution/pinning. Preserve signatures, POST payloads, manual redirects and timeouts. Use provider transport address checks as a reference, not as an interchangeable HTTP client. Pure tests already demonstrate invalid destinations accepted today; add transport-level tests without real internal-network requests.
3. **A03: cached management authorization.** Inventory every management caller using cached context; migrate authorization to the established live actor boundary and transaction checks. Start webhook, SSO client and frontend settings routes. Verify existing authorized workflows, revocation while cache is warm, origin denial and tenant mismatch.
4. **A04: hierarchy integrity.** Add shared self/ancestry-cycle checks and establish child behavior on group deletion. Apply dashboard/API parity tests. Do not invent cascade deletion semantics.
5. **A05: privacy export.** Replace global scans with bounded subject-scoped export collection, reconcile identity aliases and enumerate personal-data sources. Test completeness/redaction and large synthetic datasets.
6. **A06: application decision recovery.** Trace actual adapters for assignment write/application close and submission compensation. Add interruption/retry/compensation-failure tests, then couple authoritative state transactionally or through explicit durable recovery.
7. **A07: shared frontend effects.** Consolidate duplicate sidebar hook, limit theme reset to owned variables and make transition lock release failure-safe. Migrate all imports and test sibling consumers.
8. **A08/A09: assignment and roster invariants.** Pass game scope into group validation; centralize immutable assignment ownership/identity checks; propagate one injected timestamp into roster merging and dependent projections. Test wrong-game groups and exact deadline behavior through every adapter.
9. **A10: actual layer edges.** Move pure stratmap models/builders and preset schemas to inward modules, keep catalogue loading in adapters, and remove domain dependence on application-language dictionaries. Migrate all consumers before adding enforcement.
10. **A11: operational lifecycle.** Pin compatible self-hosted image versions; define and test bot shutdown ownership across every started worker/service. Preserve existing recovery semantics.
11. **A12: global user merge.** Treat this as a high-priority authority/data-integrity correction before ordinary refactors. Separate clan-local imported-profile repair from global account merging; enforce verified scope/actor in the transaction; key assignment merges by tenant plus game; enumerate every identity reference and test destructive merge scenarios using synthetic records only. Do not expose the current operation via v1.
12. **A13: assignment partial commits.** Resolve membership/platform-ID/note operation ownership and transactional boundary. Prevent an error response concealing an already committed membership edit. Queue external role effects after authoritative commit.
13. **A14: runtime test fidelity.** Document fake limitations, add duplicate/validator contract coverage and run selected disposable real-Convex checks. Do not interpret the current all-green fake suite as evidence that every runtime invariant holds.

Current baseline: 4,003 tests pass and non-incremental typecheck passes; lint fails with 267 errors/2,524 warnings. Convex bundle check failed on filesystem/path resolution in this environment and remains unverified. Do not label that environmental failure as an application bundle defect.

## Mandate and execution boundaries

This is a handoff for future implementation. No implementation has happened. The current request authorizes planning, not deployment or production operations.

Improve maintainability, shared workflows, API parity, and predictable effects incrementally. Preserve v1 contracts and existing authority boundaries. No rewrite, framework migration, database replacement, microservices, universal CRUD framework, or blanket formatting.

Existing file paths below were inspected during the review. Proposed new paths are labeled **new**; search for equivalent code before creating them. Revalidate findings against the current revision. The review was static, so baseline failures and runtime behavior still need verification.

Before every package:

1. Read AGENTS.md, README, ARCHITECTURE, CONTRIBUTING and subtree instructions. Read installed Next guides for Next changes and the bot README for bot changes.
2. Check git status and preserve unrelated work. Read relevant callers, commands, repositories and nearby tests.
3. Implement one package at a time. Separate structural moves from intentional behavior changes. Do not start overlapping refactors concurrently.
4. Format changed TS/TSX only. Review the diff for authorization changes, generated output, secrets and unrelated edits.
5. Update technical documentation and matching public wiki pages when behavior changes. Record exact validation results and unresolved work.

**Deployment rule:** repository instructions require `bunx convex deploy` for Convex function/schema/persistence changes, and separately require explicit authority and a known target for external side effects. Future agents must establish that authority before deploying. Finish local implementation and validation first. If authority/target is absent, mark `awaiting deployment`, report the blocker, and do not claim completion. Never inspect or print secrets to identify a target.

## Detailed implementation recipes and dependencies

**Repository-wide scope amendment:** M00–M13 below are implementation recipes and initial hotspots, not the complete scope. The mandatory whole-app coverage and closure program below governs completion. Finishing those examples alone does not finish this plan.

| Package | Depends on | Result |
| --- | --- | --- |
| M00 | — | Reproducible baseline |
| M01 | M00 | Safe, bounded JSON inputs |
| M02 | M01 | Focused clan mutation adapters |
| M03 | M00 | Executable API parity inventory |
| M04 | M02, M03 | Shared-write invariants and consolidation |
| M05 | M00 | Architecture checks |
| M06 | M00 | CI and command alignment |
| M07 | M00, preferably M06 | Testable match persistence coordination |
| M08 | M07 | Large UI responsibility splits |
| M09 | M03, M04 | Competition workflow extraction |
| M10 | M02, M04 | Explicit cache effects |
| M11 | M06, M07 | Browser and real-backend smoke tests |
| M12 | M03 | API gap delivery and exception decisions |
| M13 | M00 | Operational/scaling assumptions |

Default execution is sequential. This document does not request subagents. Use separate reviewable commits/PRs for packages and subdivide the larger ones.

## M00 — Establish the baseline

**Read:** package.json, both lockfiles, `.github/workflows/verify.yml`, `scripts/test-env.ts`, eslint.config.mjs, tsconfig.json and the review.

**Work:**

- Record revision, runtime versions, installation method and initial git status without environment values.
- Run `npm run typecheck`, `npm run test`, `npm run lint`, `npm run format:check`, and `npm run check:convex-bundles`.
- Inspect build-time reads, then run `npm run build` with synthetic/offline configuration. Do not accidentally build against production services.
- Record failures by command/path/cause. Distinguish environment problems from existing code failures; do not repair unrelated debt here.
- Inventory dashboard/server-action/direct-client-mutation/bot write entrypoints. Search `use server`, HTTP mutation exports, `fetchMutation`, `useMutation` and gateway calls, then inspect actual callers.
- Add **new** `docs/maintenance/baseline.md` with concise results and operation-audit inputs. Avoid committing giant logs.

**Done:** another agent can reproduce the baseline and distinguish regressions. No product behavior changed.

## M01 — Safe JSON roots and bounded request bodies

**Existing files:**

- `src/app/api/v1/clan/[[...path]]/route.ts`
- `src/app/api/v1/clan/events/[eventId]/local-settings/route.ts`
- `src/lib/api/request-json.ts`, `request-bytes.ts`, `request-bytes.test.ts`
- `src/lib/api/clan-route-http.test.ts`, `authenticated-clan-route.ts`
- Existing feature schemas in `src/lib/validation` and `src/domain/api`.

**Implement:**

1. Reproduce signup/article behavior for JSON `null`, arrays, primitives, invalid JSON and invalid fields. Assert rejected input invokes no mutation. Current unchecked object assertions must become runtime checks.
2. Add **new** `src/lib/api/request-body.ts` and `.test.ts`: bounded raw-body reading with distinct success, overflow and read-failure results. Reuse bounded-byte infrastructure where appropriate. Cancel overflowing streams and release locks. Content-Length is an early hint, not the enforcement mechanism.
3. Preserve current decoded-text hash semantics: handlers currently hash the original `request.text()` value. Do not hash reserialized JSON or silently switch to a different byte-decoding contract. Keep empty input distinct from JSON null.
4. Determine limits from supported schemas and fixtures. Proposed starting default: 1 MiB for generic JSON mutations, with documented operation-specific increases when legitimate supported payloads require them. This is a new compatibility-affecting limit, not an existing contract. Image/upload limits stay separate.
5. Authenticate before body reading. Parse to `unknown`, then validate operation shape before property access. Preserve omission/null, unknown-field policy, preset order/IDs/messages, individual calendar semantics, and delete/conclude behavior.
6. Characterize article wrong-type field omission before tightening it. If current contracts intentionally permit omission, preserve it while fixing invalid roots. Do not silently change a product rule during parser cleanup.
7. Preserve error envelopes and auth/rate headers. Document 413 overflow responses and existing 400 parse/validation behavior. Decide read-failure mapping explicitly.
8. Migrate generic mutation body reads and local-settings. Search remaining v1 unbounded reads and record justified follow-up work.

**Tests:** exact/under/over byte limit; UTF-8; chunked body; missing/false Content-Length; reader failure; unauthorized request without body read; invalid roots; valid objects; unchanged hashes for original input; byte-identical replay responses; zero writes on rejection.

**Validate:** focused helper/HTTP tests, full tests, typecheck, route production build, targeted formatting. Update OpenAPI, integration docs and relevant wiki behavior. Parsing alone should not require Convex changes.

**Done:** migrated handlers have no unchecked root accesses or unbounded body reads, with explicit regression coverage.

## M02 — Extract focused clan mutation handlers

**Read:** catch-all route, `src/lib/api/clan-mutation-response.ts`, `src/lib/gateways/clan-write-cache.ts`, `src/lib/public-api.ts`, and existing focused API route modules.

**New proposed directory:** `src/lib/api/clan-mutations/`.

- Extract explicit article, event/signup, group, calendar, preset, roster, assignment and settings handlers one feature at a time.
- Share only bounded request preparation, idempotency validation, hashing and genuinely identical error construction. Keep feature schemas/commands explicit.
- Preserve validation ordering where observable, one boundary authentication pass, and backend authority revalidation. Never replace verified scope with browser inputs.
- Leave method/path dispatch in the Next route. Preserve path lengths, unsupported routes, GET pagination/headers, status/envelopes and replay bytes.
- Avoid a generic CRUD engine, callback-heavy framework, or new compatibility namespaces.

**Tests:** full POST/PATCH/DELETE dispatch matrix; extra path segments; unauthorized/revoked key; missing idempotency; malformed body; success/replay; cache response behavior. Existing GET tests remain green.

**Done:** feature handlers can be understood independently; transport preparation has one implementation. Validate full tests, typecheck and build.

## M03 — Build an executable API parity inventory

**Sources:** configuration-coverage.md and integration docs, content wiki, dashboard routes/actions, gateways, direct client mutations, API dispatch/dedicated routes, bot handlers and OpenAPI modules.

**New artifacts:** `config/operation-parity.json`, `scripts/check-operation-parity.ts` and tests, `docs/maintenance/api-parity.md`. Add `check:api-parity` script and CI step.

Each record contains stable operation ID, caller/surface, authority, tenant/game scope, authoritative command/repository, API method/path, availability, rationale, test references and cache/delivery effects.

**Procedure:**

1. Enumerate operations for events/training/drafts/recurrence/signup/excuses/reminders/results; roster/attendance/stratmaps; assignments/groups/membership; articles/calendar/presets; settings/panels/commands/seeding; competitions/leagues/teams; integrations/assets/identity. Include applicable reads/exports separately.
2. Trace actual callers to commands and persistence. Different response projections do not imply missing write parity.
3. Classify `supported`, `gap`, `excluded`. A gap names an actual missing capability; exclusions include rationale and reconsideration condition. Label personal/platform-only authority separately.
4. Checker verifies unique IDs, file references, required fields, classifications, declared API paths/methods in actual OpenAPI, and exception/gap details. Account for catch-all routes.
5. Use a TypeScript AST scan of known write boundaries plus reviewed registrations for dynamic dispatch/direct mutations to detect unregistered candidates. One manifest row per route is insufficient when the route dispatches multiple operations.
6. Document scanner limitations. File existence is not proof of semantic completeness; require capability inventory review on new features.

**Done:** every discovered candidate is mapped or explained; intentionally adding an unregistered candidate fails CI. No permissions or endpoints change here.

## M04 — Prove shared-write invariants and consolidate verified duplication

**Start:** `src/infrastructure/convex/shared-management.test.ts`, `testing/database.ts`, feature application tests, clan HTTP tests, mutation-response tests, and existing commands/repositories listed in CONTRIBUTING.

- Derive equivalent writer scenarios from M03. Reuse fixtures/scenario functions without creating a test framework.
- Cover normal/invalid writes, tenant/game mismatch, resource ownership, actor/grant freshness, dependent cleanup, publication/lifecycle, replay/conflict and cache effects where applicable. Mark genuinely non-applicable cases explicitly.
- Move duplicated business workflows into the existing feature command and repository. Keep auth, parsing, rate limits, receipts, HTTP and cache concerns in adapters.
- Keep dependent writes inside the caller's Convex transaction. Do not use Logi's own public HTTP API to share dashboard logic.
- Preserve supplied preset order/topic IDs/optional messages and individual calendar commands.
- If equivalent writers disagree on product behavior, record the precise conflict for a maintainer decision; do not pick broader access.

**Validate:** focused scenarios, full tests, typecheck, Convex bundles and authorized deployment for changed Convex behavior.

**Done:** verified equivalent writers share implementation and invariants; unresolved product conflicts remain explicit.

## M05 — Enforce architecture boundaries

**Files:** eslint.config.mjs, package scripts, CI. Add **new** `scripts/check-architecture.ts` only if resolved checks cannot be expressed cleanly through ESLint.

- Inventory violations first. Domain cannot depend on React/Next/Convex/Discord/environment/persistence. Application depends on domain/ports, not concrete web/Convex/bot adapters.
- Resolve aliases, relative imports, re-exports and type-only dependencies. Generated Convex types must not silently become domain dependencies.
- Use supported server-only/build boundaries for transitive client leaks; a direct grep is insufficient. Preserve legitimate server-action imports from clients.
- Fix small violations; baseline larger ones as exact edges with reasons and follow-up IDs. No blanket permanent exemption. New violations fail.
- Prefer one simple mechanism per rule, not overlapping architecture tools.

**Tests:** forbidden/allowed edges, aliases, relative paths, re-exports, exceptions; demonstrate CI failure on an introduced violation.

**Done:** inward dependency direction is executable without blocking legitimate wiring.

## M06 — CI and developer workflow alignment

**Files:** package.json, verify.yml, test-env.ts, README, CONTRIBUTING, AGENTS. Locale authority: `src/i18n/routing.ts`.

- Retain current frozen Bun CI installation temporarily. Do not delete lockfiles or switch package managers in a refactor. Compare installs in disposable workspaces and document a canonical-policy proposal.
- Align coverage bootstrap with the main test command if baseline confirms the fixtures are required. Evaluate domain/bot commands individually; do not inject unrelated globals.
- Add lint and formatting gates. If baseline debt exists, reliably check changed files against PR base and record debt. Do not hide failures or mass-suppress rules. Move to full checks once debt is fixed.
- Add production build with synthetic configuration/offline boundaries; prevent production network reads. Preserve generated-contract and bundle checks.
- Include M03/M05 checks when ready. Measure job duration and set practical timeouts.
- Reconcile locale instructions to en/cs/de/pl/fr. Do not change translation content merely to correct documentation.

**Done:** CI validates production compilation, new-code style, types, tests, contracts and boundaries. Any existing debt has exact scope. Record actual CI evidence when available.

## M07 — Extract match editor persistence coordination

**Existing:** `src/components/app/new-match/new-match-flow.tsx`, flow-values/summary and tests, fixture/preview files, domain new-match-flow, event draft routes/dependencies, application event-drafts use-case.

**New proposed:** `new-match/persistence-coordinator.ts`, `.test.ts`, `use-match-draft.ts`.

1. Characterize create/edit/demo, autosave delay, draft ID allocation, payload mapping, publish, errors, navigation and invitation actions. Reuse flow-values as existing mapping authority.
2. Extract sequencing behind injected save/publish and timer/clock capabilities. React owns lifecycle wiring; coordinator owns persistence ordering. No state-machine library is required.
3. Track requested versus saved revision: resolving save A after edit B cannot mark B clean. Coalesce/serialize saves deliberately and associate each response with its request.
4. Publish waits for required pending work and uses current intended values. Never blindly retry an ambiguously committed publish without supported backend idempotency/status.
5. Cancel timers and ignore obsolete responses on unmount. Do not pretend cancellation rolls back a committed write. Preserve edit mode's explicit save and demo isolation.
6. Remove dependency suppressions after dependencies become explicit. Preserve timezone/recurrence behavior, toasts, routes and accessibility.

**Tests with deferred promises and injected timers:** A-save/B-edit/A-resolve; repeated timers; publish during save; failure/edit/retry; double publish; unmount; existing draft reuse. Retain mapping boundary tests. Avoid real sleeps.

**Browser:** create/edit/demo, publish during autosave, network failure, workspace/game context, mobile and keyboard. Follow the available browser skill.

**Done:** persistence sequencing is isolated and tested; late responses cannot clear newer edits. Run focused tests, typecheck, relevant tests and build.

## M08 — Split large UI modules by responsibility

Deliver each item separately, with a responsibility map before edits and browser verification afterward:

1. Match flow: extract components matching existing NEW_MATCH_STEPS. Reuse tactical plan/opponent/preview/fixture components. Pass narrow typed values/actions rather than one giant controller.
2. Roster board/squad card: separate coordination, squad rendering, drag/drop adapter, selection and persistence requests. Preserve shared roster revisions, locks, allocation and foreign-player redaction.
3. Discord panel editor steps: split panel-type sections and shared presentation fields; reuse schemas and message kit.
4. Match details/template settings: separate display sections and interactive editing; reuse current domain template logic.

Move actual reusable decisions inward, not rendering helpers. Do not add memoization/code splitting without measurement. No arbitrary line-count targets.

**Done:** coherent responsibilities, acyclic imports, unchanged behavior/accessibility, focused validation and browser evidence for each subpackage.

## M09 — Extract competition workflows incrementally

**Read:** convex/competitions.ts; domain competition/enrollment/fixture policies; existing adopt-catalogue-team use-case; infrastructure competition/enrollment/API/migration tests; competition API adapters/gateways.

**New proposed:** application `competitions/manage-competition.ts`, narrow ports, infrastructure `competition-command-repository.ts`, colocated tests.

- Slice 1: create/update metadata, slug uniqueness, immutable game and timestamps. Inject clock; preserve errors and validated input. Auth/parse stay at Convex boundary.
- Slice 2: divisions/reordering and team registration transitions involving dependent state.
- Slice 3: fixture/event linkage and imports. Preserve canonical IDs and transaction atomicity.
- Keep read projections separate. Avoid generic repositories and obsolete namespace shims.
- Distinguish platform/clan/personal writers. Shared behavior never grants clan keys platform administration.

**Tests:** uniqueness, game immutability, authority rejection, missing references, reorder rules, dependent fixture/event updates, rollback on a disposable real backend where relevant. Keep migrations green.

**Done:** runtime handlers authenticate/parse/wire/map; reusable workflows are testable without Convex. Full tests/typecheck/bundles and deployment status recorded.

## M10 — Explicit cache effects and recovery

**Existing:** clan-write-cache, shared-match-cache, cache-revalidation, clan-mutation-response and tests, cache-tags, public mutation results/replay storage.

1. Map actual read tags per operation. Do not narrow invalidation based on intuition.
2. Introduce a typed internal affected-resource descriptor. Prefer adapter operation context when sufficient; return internal metadata only when persistence discovers effects. Preserve public recorded response bytes.
3. Ensure replay can reconstruct or retain required effects. Do not infer entity type from generic data.id. Preserve identifiers for deletions with minimal responses.
4. Cover local aliases, public projections, users, images and shared partner clans. Remove unrelated tags only with tests proving the necessary set.
5. Keep committed-write success independent of invalidation failure. Log structured failures without secrets; measure stale reads.
6. Assess bounded recovery using existing durable mechanisms first. Process-local fire-and-forget retry is not durable recovery. Record the tradeoff before adding new persistence.

**Tests:** required tags per effect, unrelated tags omitted, aliases/shared clans, delete/replay, original status/body on invalidation failure, repair without repeating the write.

**Done:** effects are explicit/tested/observable; public replay and commit semantics remain unchanged. Persistence changes require deployment.

## M11 — Small runtime smoke suite

**New proposed:** tests/e2e, browser runner config, docs/maintenance/runtime-tests.md and dedicated CI jobs. Reuse existing infrastructure if found; otherwise Playwright is a proposed dev dependency, not assumed installed.

- Disposable local web/Convex only, synthetic accounts and two clans. No production seeding, auth bypass, or publicly available test login route.
- Establish sessions through isolated fixture setup unavailable in production. Separately verify expired/revoked session rejection.
- Cover workspace/game switch; draft save/reload/publish; roster revision conflict; settings write reflected through dashboard and API; cross-clan data isolation.
- Real backend checks: validators, indexed scoped reads, dependent-write rollback and generated function bindings.
- Make external Discord/provider calls fail closed. Separate fake-adapter and real-runtime suites.
- Clean up exact disposable resources only; inspect scripts before using them. No broad cleanup commands.

**Done:** documented local command and CI run need no live credentials; demonstrate that deliberately broken runtime wiring is detected.

## M12 — Deliver verified API gaps; retain explicit exceptions

The fixed endpoint list cannot honestly be prescribed before M03 establishes actual gaps.

For each verified gap create a child task naming exact dashboard caller, missing path/method, shared command, authority/grant, schemas, idempotency, cache/delivery, tests, OpenAPI and wiki changes. Implement gaps within existing authority/contracts when execution is authorized.

Create **new** docs/maintenance/api-exceptions.md for decisions:

| Category | Default | Decision needed for expansion |
| --- | --- | --- |
| Ticket configuration | Preserve exclusion | Dedicated administrative grant; private-content separation |
| Draft lifecycle | Preserve current difference | External actor ownership and supported lifecycle |
| Live Discord actions | Preserve exclusions | Actor authority, durable commands, audit, ambiguous sends |
| Game credentials | Preserve exclusion | Write-only secret administration, testing/encryption, operator boundary |
| SSO clients | Preserve dashboard restriction | Sensitive-client administration authority |
| Display-name recheck | Preserve exclusion | Live refresh authority; read grants insufficient |
| Personal league ownership | Preserve first-party session | No clan-key impersonation or ownership substitution |

A grant proposal is not approval to ship it. Mark pending decisions and continue independent packages. Approved expansion requires shared commands, tenant/game/actor tests, docs/generated OpenAPI and authorized deployment.

**Done:** no unexplained gaps; delivered capabilities have equivalent behavior; pending decisions are explicit. Never claim full API parity while unresolved gaps remain.

## M13 — Operational assumptions and scaling prerequisites

**Files:** public-api-memory.ts, external-api-rate-limit.ts and tests, self-hosting and integration limits documentation.

- Document per-process budgets/reset, proxy header sanitization, key/IP buckets and duplicated refresh claims across replicas.
- Trace all limiter layers before reconciling advertised limits. Per-minute and per-second limits may coexist legitimately.
- Provide proxy examples using placeholders, not credentials. Do not assume client-supplied forwarding headers are trusted.
- Keep process-local design for current single-instance use unless requirements change. Before adding replicas, propose measured edge/shared enforcement and distributed refresh coordination, with aggregate-budget/failover tests.
- Do not add Redis merely to close this plan.

**Done:** limits/prerequisites are clear. Distributed enforcement remains a named conditional project, not falsely marked implemented.

## Validation and completion

| Change | Required validation |
| --- | --- |
| Docs/inventory | Verify links/paths/commands; checker tests when added |
| JSON/HTTP boundary | Focused helper/HTTP tests, full tests, typecheck, build |
| Shared backend | Focused policy/use-case/adapter tests, full tests, typecheck, bundles, deployment when applicable |
| Interactive UI | Coordination tests, typecheck, relevant tests, browser verification, build when release-sensitive |
| CI/tooling | Local commands and CI evidence where available; retain real failures |

Use node:test conventions. Focused fixture-backed test invocation: `node --import tsx --import ./scripts/test-env.ts --test path/to/file.test.ts`. Commands run from repository root. Format changed TS/TSX with installed Prettier, never whole-repository write formatting.

Update the ledger during execution. States: not started, in progress, implemented, awaiting decision, awaiting deployment, complete. Implemented does not mean validated/deployed.

| Package | State | Revision/PR | Evidence and remaining work |
| --- | --- | --- | --- |
| M00 | not started | — | Baseline |
| M01 | not started | — | Request boundaries |
| M02 | not started | — | Handler extraction |
| M03 | not started | — | Parity inventory |
| M04 | not started | — | Invariants/consolidation |
| M05 | not started | — | Architecture enforcement |
| M06 | not started | — | CI/commands |
| M07 | not started | — | Persistence coordination |
| M08 | not started | — | UI splits |
| M09 | not started | — | Competition workflows |
| M10 | not started | — | Cache effects |
| M11 | not started | — | Runtime tests |
| M12 | not started | — | API decisions/gaps |
| M13 | not started | — | Operations |

After each package record exact before/after behavior, files changed, command/authority boundary, validation commands/results, baseline failures, API/wiki updates, deployment result when authorized, unresolved decisions, and next starting files. Never include credentials/private data.

Completion requires acceptance criteria, relevant validation, current documentation and required deployment. Whole-program completion must distinguish delivered work from explicitly deferred product/scaling decisions. File splitting and green typechecking alone are insufficient.

## Whole-app coverage and closure program

### C00 — Inventory every maintained file before declaring coverage

Extend M00 with **new** `docs/maintenance/coverage.json`, `docs/maintenance/findings.json` and `scripts/check-maintenance-coverage.ts` with tests. These are execution deliverables, not already completed audits.

Generate the file inventory from tracked files plus intentional new source files. Cover all of `src/`, `convex/`, `discord-bot/`, `scripts/`, `config/`, `content/`, `.github/`, `docker/`, `patches/`, and root tooling/configuration/documentation. Include hooks, contexts, providers, types, utilities, public pages, authentication routes, non-v1 HTTP routes, middleware/proxy code, image rendering and root-level Convex modules. Inspect assets/producers where relevant. Exclude dependencies/build outputs and generated files from hand editing, but assign ownership and validate their producers/contracts. Legal content remains out of editing scope unless explicitly requested.

Every maintained file must belong to a feature or cross-cutting owner. Shared files get one primary owner plus affected features; do not count them as reviewed merely because another task imports them. The checker must fail for missing ownership, stale paths and newly added unclassified source files. Tests and docs are owned alongside implementation. Record exclusions explicitly with concrete reasons; generated does not mean unverified.

Coverage entry fields: file/group, owner, runtime/layer, entrypoints, review revision, checks performed, finding IDs, status and evidence. Findings require stable ID, exact instances/callers, demonstrated problem, severity, remedy, affected contracts, tests and closure revision. Statuses distinguish unreviewed, reviewed-clean, remediation-needed, fixed-verified, and explicit exception. Never use reviewed-clean for a file only searched by grep.

### C01 — Audit every feature vertically

Create an execution task per row below. Expand rows when the inventory reveals another feature; this table is a minimum, not an exclusion list.

| Feature group | Required scope and starting locations |
| --- | --- |
| Events and training | domain/application events; all dashboard editors/details; Convex lifecycle/recurrence; signup/excuses/reminders; bot announcements/forums/scheduled events; API commands and drafts |
| Rosters and attendance | rosters/assignments policies and commands; board/cards; attendance/reserves; shared-match projections, revisions, locks and redaction; bot sync and images |
| Match results and reports | match-results/match-reports/player-reports; review/publication/revision flows; recap delivery, privacy and retention |
| Membership and users | membership/assignments/groups/users/players; applications, categories, self-service and managed roles; dashboard forms, bot tickets and API |
| Identity and access | identity/game-accounts/workspaces; OAuth/session/SSO/platform links; grants/keys; server actions, all auth routes and trusted-runtime access |
| Workspace configuration | all settings slices, templates/presets, enabled games, onboarding and navigation/context selection |
| Content and calendar | articles/calendar/presets; public content, dashboard editors, API and publication |
| Stratmaps | domain/application stratmaps; editor/hooks/realtime; assets, permissions and metadata |
| Competitions and teams | competitions/teams/leagues/wardogs-league; catalogue/import/enrollment/fixtures; platform, clan and personal authority; public tables |
| Game integrations | game-data/player-stats/games; HLL/Warcon/history/providers; credentials, collection, caches, pagination and retention |
| Discord operations | discord-commands/messages/publications/seed/sync/tickets; every bot command/interaction/worker and shared previews |
| Integration platform | api/integrations/webhooks; all v1 and public endpoints, scopes, changes/sync, idempotency, schemas and OpenAPI |
| Support and tooling | bug-reports/GitHub integration; maintenance scripts, fixtures, dependency patches, backups and deployment setup |
| Public web and shared frontend | all public/account/dashboard layouts/pages; ui primitives, hooks/contexts, i18n, themes, uploads/media and image renderers |

For each row produce `docs/maintenance/features/<feature>.md` containing:

1. Full owned-file inventory and actual dashboard/API/bot/public entrypoints.
2. Call graphs from each operation to auth, policy, persistence, cache and external effects.
3. Same-operation duplication versus intentionally different read/transport models.
4. Every violated audit criterion from C02 with exact instances and concrete remediation tasks.
5. Contract/parity matrix, applicable authority levels and justified exclusions.
6. Regression cases, UI/runtime checks and evidence at the reviewed revision.
7. Fixes for every confirmed instance, including less prominent callers, before feature closure.

Use M01–M13 recipes wherever applicable. Do not stop after the first large file, first endpoint, or first adapter is repaired. Already-clean modules receive evidence, not gratuitous refactoring.

### C02 — Apply the same criteria everywhere

| Criterion | Inspect across the whole app | Required remediation/evidence |
| --- | --- | --- |
| Input boundaries | All HTTP/server-action/Convex/bot/provider/file-import inputs, not only clan catch-all | Runtime validation before access; bounded untrusted payloads; stable errors and no writes on rejection |
| Authority | All reads/writes/jobs, including public images/exports and internal-secret entrypoints | Live verified authority, tenant/game ownership, redaction; negative tests; no browser actor trust |
| DRY | Every equivalent operation and repeated policy/normalization/schema | One authoritative decision/workflow; all writers migrated; differing protocols remain explicit |
| KISS and layering | All runtime modules, components, hooks, helpers and repositories | Cohesive responsibilities; deterministic policies inward; no unnecessary abstraction or server dependency in clients |
| Side effects | Every database mutation, network call, notification, cache update, file/blob lifecycle | Explicit transaction/commit boundary, timeout/error semantics, retry safety, effect ownership and recovery |
| Concurrency | Autosave, realtime, optimistic UI, revisions, leases, scheduler overlap | Stale-response protection, correct conflict handling, safe replay and race regression cases |
| Persistence and scale | Every Convex query/mutation/schema/index and collector | Scoped/indexed/bounded reads; justified scans; bounded fan-out; retention/deletion and compatibility; no hot-document regression |
| API parity | Every relevant dashboard capability, including reads/exports/configuration/lifecycle | Tested equivalent API behavior or documented justified exception; contract/OpenAPI/cache parity |
| Frontend quality | Every screen and shared interactive primitive | Loading/error/empty states, labels/focus/keyboard, mobile layout, locale/theme correctness and browser checks |
| Dependency/runtime quality | All shared imports, libraries, patches, env validation and bundling | Enforced boundaries, reviewed dependency overlap/dead code, validated env with placeholders, reproducible build |
| Tests and docs | Every changed invariant and supported workflow | Meaningful regression tests; current wiki/API/technical contracts; no false parity claims |
| Operations | All workers, jobs, webhooks, backups and cleanup | Observable failure, queue/retry/expiry ownership, safe shutdown and inspected restore procedure on disposable data |

Search patterns are discovery aids, not findings: `any`, `v.any`, assertions, hook suppressions, catch blocks, `collect()`, timers and large files all require contextual review. They are not automatically wrong. Do not ban valid transaction reads or duplicate unrelated code just because text resembles another module.

### C03 — Close each issue class across every runtime

The original 12 review findings become repository-wide workstreams:

| Original issue | Whole-app completion requirement |
| --- | --- |
| Unsafe JSON and body bounds | All applicable JSON/binary/import boundaries reviewed and fixed, including non-v1/dashboard routes and provider adapters |
| Transport duplication | All equivalent repeated boundary scaffolding assessed; shared helpers adopted consistently where contracts match |
| Large UI modules | Every maintained interactive module reviewed for responsibility/effects; every confirmed coupling/race defect resolved, not just listed components |
| Backend workflow placement | Every Convex and bot business workflow assessed; all verified shared-rule duplication extracted and callers migrated |
| API parity and exclusions | Every feature operation classified and supported behavior tested; real gaps implemented or explicit product decision remains blocking |
| Architecture enforcement | Entire maintained source graph covered, with no unexplained violating edges |
| CI/runtime validation | Relevant checks cover all runtimes; pre-existing failures are repaired within scoped follow-up tasks, not permanently ignored |
| Cache effects | Every writer/cache family mapped; all confirmed missing/overbroad/error-recovery defects resolved with equivalent caller coverage |
| Single-instance assumptions | All process-local correctness dependencies documented/tested; scaling infrastructure stays conditional until needed |
| Workflow ambiguity | Commands, lockfile policy, locale guidance, generated producers and test bootstrapping reconciled repository-wide |

For each finding, run a sibling-instance search and inspect all matches before closure. Record the search scope, resulting instance list and why non-applicable matches are safe. A patch to one caller cannot close a finding affecting multiple callers.

### C04 — Implement feature batches through the same complete loop

Execution order: C00/M00 inventory; M01 boundary fixes; M03 parity inventory; M05/M06 guardrails; then C01 feature batches in risk order, using M02/M04/M07–M13 as recipes. Start identity/access and shared events/rosters, then membership/results/integrations, then remaining features. Schedule urgent confirmed defects ahead of refactors.

Each feature task is audit → explicit findings → exact change plan → implementation of every confirmed in-scope instance → focused/full checks → browser/runtime checks → documentation/deployment → closure evidence. Discovery is required work within the task, not an excuse to hand back another overview. Agents must add newly found issues to the register and resolve them before closing the feature, or record a precise externally blocked decision. Do not invent exact fixes for code that has not yet been inspected.

Each remediation task must name files/symbols, current failure, intended behavior, all callers, schema/data compatibility, effect ordering, negative tests, deployment needs and acceptance criteria. Split broad features into child tasks when necessary, while retaining a parent completion gate covering all children.

### C05 — Independent closure pass and regression prevention

After implementation, perform a fresh review pass over changed workflows and their unaffected siblings. This is a separate verification pass; it does not require subagents. Trace representative operations from UI/API/bot through persistence and effects, not merely the extracted function in isolation. Exercise authorization failures, rollback, replay, stale revisions and recovery paths.

The coverage checker must compare the current tree with the reviewed inventory: added/moved files and changed relevant entrypoints reopen review. Closure evidence records revision and is refreshed after changes that invalidate it. Structural checks cannot prove business parity; retain contract tests and manual review evidence.

No permanent style/lint/architecture debt baseline may be used to claim program completion. Baselines are migration aids; resolve violations or replace them with narrowly justified design exceptions. Conditional infrastructure and product exceptions are distinct from unresolved defects.

### Program completion gates

All gates must pass before claiming the whole app has been covered:

- Every maintained file has an owner and review disposition; no unreviewed feature or runtime remains.
- Every C02 criterion is assessed per applicable feature, with evidence or specific non-applicability rationale.
- Every confirmed defect/duplication/layer violation from the original review and subsequent audits is fixed at all instances and verified. Externally blocked items prevent an unqualified completion claim.
- Every dashboard capability has working/tested API equivalence or an explicit justified exclusion. Pending permission/product decisions are reported as pending, never silently converted to exclusions.
- All business workflow callers use the intended shared implementation; read models remain contract-appropriate.
- Required tests/typechecks/lint/format/contracts/bundles/build/runtime checks pass, and required authorized deployments are verified. Unrelated baseline failures have concrete resolutions rather than indefinite waivers.
- User workflows pass relevant responsive/accessibility/locale checks; all five locale instructions are consistent.
- Cache/delivery/retention/retry/backup responsibilities are documented and confirmed through appropriate tests or disposable operational exercises.
- Final report lists reviewed scope, fixed findings, evidence, justified exceptions and genuinely conditional future work. Do not promise zero possible bugs; claim only the measured coverage and completed remediation.

Track C00–C05 alongside M00–M13 in the ledger. None are complete at planning time. M-package completion alone is explicitly insufficient.

## Completed bot audit and authoritative bot execution plan

The subsequent review was narrowed by the maintainer to the Discord bot. All 135 bot source/support-code files and 98 test files were fully read, with README/configuration and performance-relevant backend traces. This does not upgrade the rest of the application's sampled review into a complete manual audit.

For Discord work, execute [D00–D12 in the bot remediation plan](maintenance/discord-bot-implementation-plan.md) and close [B01–B18 in its audit](maintenance/discord-bot-performance-audit.md). Those packages supersede earlier bot hotspot examples here and cover subscriptions, lifecycle, fairness, aggregate concurrency, fenced recovery, results/recaps, seed/League reads, media/memory, desired-state effects, interaction caches, invalidation, recurrence and logging. Every detailed bot finding is assigned there; fixing only panel polling is insufficient. [The hash ledger](maintenance/discord-bot-review-ledger.json) records all 233 source/test file dispositions.

Bot baseline: 648 passing tests, no failures/skips; offline reproductions confirmed cold-config amplification, match-image re-upload, old recurrence loss, deleted-channel recovery failure and invisible expired processing claims. Production load/heap measurements were not performed. Apply this plan's shared-write/API parity rules to any shared behavior changed by the bot packages; retain unrelated application work as a separate scope.

## Copyable agent prompts

**First agent:**

> Read AGENTS.md and the entire docs/maintenance-implementation-plan.md, including C00–C05. Start R00 using the supplied inventories and baseline, then execute R01/R02 priority corrections with the applicable M recipes and C closure gates. Preserve unrelated changes. Do not mistake the named hotspots for the complete scope. No production operations without explicit authority.

**Continuation:**

> Read AGENTS.md, the entire maintenance plan, coverage/findings registers and last handoff. Verify the ledger against the current tree. Execute the assigned feature/package through audit, all-instance remediation, validation and closure. Update coverage and every affected caller, not only the first example. Preserve contracts/authority, record blockers honestly, and provide exact next tasks. Never claim whole-app completion until all program gates pass.
