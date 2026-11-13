# Logi maintainability and API parity review

Date: 2026-11-11

**Status correction:** this is the initial sampled review, not an exhaustive application audit. Subsequent deeper traces found higher-priority issues omitted here. See [audit progress](maintenance/audit-progress.md). The master implementation plan now includes the deeper findings and performance work; its evidence limits are explicit.

## Executive assessment

Logi has a sound architectural direction. Shared domain policies, application commands, Convex repository adapters, scoped integration authentication, colocated tests, and explicit integration documentation already exist. A rewrite or a new framework would add risk without addressing the main weaknesses.

The most useful next investment is making those architectural intentions consistently enforceable: safer request parsing, smaller feature modules, executable API parity checks, and a few high-value checks across real runtime boundaries.

The strongest concern is concentration of responsibilities. Some UI modules combine large amounts of rendering, editing state, persistence coordination, and navigation. Some Convex modules still own business workflows directly. The generic clan route repeats transport plumbing. These concentrations increase the number of places a maintainer must understand before safely changing a feature.

## Scope and confidence

This is a static, evidence-based architectural review, not an exhaustive security audit or a certification of every feature. I read the repository guidance, README, architecture and contribution documentation, bot documentation, CI configuration, package scripts, TypeScript and ESLint configuration, integration coverage documentation, and selected implementations and tests across the main layers. I inventoried source files and inspected representative high-risk modules and write paths.

No application code, configuration, dependencies, generated bindings, data, or deployment was changed. This report is the only intended addition. The working tree was clean at the initial check. Tests, builds, live browser workflows, and external services were not exercised; findings below distinguish observed implementation details from risks requiring runtime confirmation.

The source inventory found 702 `*.test.ts` files among 2,484 files under `src` and `discord-bot/src`. This demonstrates substantial investment, but is not a coverage percentage and excludes Convex files from that count.

## What should be preserved

- Shared commands and repositories for articles, groups, calendar items, rosters, presets, and stratmaps. See `CONTRIBUTING.md`, `src/application`, and `src/infrastructure/convex/shared-management.test.ts`.
- Separation of authentication, tenant scope, actor authority, and business invariants. Do not make clan service keys impersonate dashboard users to achieve parity.
- Transaction-scoped shared match updates and explicit projection/redaction contracts described in `ARCHITECTURE.md`.
- Existing idempotency semantics and byte-for-byte replay responses in `src/lib/api/clan-mutation-response.ts`.
- The decision to avoid per-request writes to hot Convex documents. See `src/lib/api/public-api-memory.ts`.
- Tests using explicit fakes and shared adapter scenarios rather than requiring live Discord access.
- CI regeneration checks for OpenAPI schemas and Convex function bindings in `.github/workflows/verify.yml`.

## Prioritized findings

### 1. Validate JSON structure before accessing fields

**Priority: high. Confidence: high for the unsafe access; HTTP behavior needs an execution test.**

Evidence: `src/app/api/v1/clan/[[...path]]/route.ts`, especially `mutateEventSignup` around lines 127–139, parses JSON using an assertion to `Record<string, unknown>` and immediately accesses `body.userId`. JSON parsing successfully returns `null` for the body `null`; the TypeScript assertion does not transform or validate it. Accessing that property then throws. `mutateArticle` follows a similar asserted-object pattern.

This can turn a malformed client request into an unexpected exception instead of a stable validation response. Other handlers in the same route use schema parsing, so the boundary is inconsistent.

Recommended change: parse into `unknown`, then validate with the operation's object schema. Define omission, null, unknown-key, and invalid-type behavior explicitly. Article fields currently supplied with the wrong type can be omitted by conditional field mapping; decide whether that is intentional rather than silently changing the contract.

Acceptance: table-driven route tests for `null`, arrays, strings, numbers, empty bodies, invalid JSON, invalid field types, and valid objects. Each must yield a documented response without unintended persistence.

### 2. Bound generic API request bodies

**Priority: high. Confidence: high that local bounds are absent in the inspected handlers.**

Evidence: the generic clan route repeatedly calls `request.text()`. `src/lib/api/request-json.ts` and `request-bytes.ts` already provide bounded streaming readers, but those generic handlers do not use them.

A reverse proxy may impose a deployment limit; that was not verified. At the application boundary, these handlers allocate and parse the full submitted body. This creates unnecessary memory exposure and inconsistent behavior across endpoints.

Recommended change: a bounded raw-body reader that preserves exact bytes/text for the existing idempotency hash, followed by schema validation. Reuse existing helpers where their semantics fit. Distinguish oversized bodies from malformed JSON; the current JSON helper returns `null` for several different outcomes, so blindly adopting it would lose useful error information.

Acceptance: tests at, below, and above each documented limit, including chunked bodies without Content-Length. Preserve existing replay hashes and response envelopes.

### 3. Reduce the generic clan route's repeated transport plumbing

**Priority: medium-high. Confidence: high.**

Evidence: `src/app/api/v1/clan/[[...path]]/route.ts` repeats authentication, raw-body parsing, idempotency validation, hashing, mutation invocation, invalid-key responses, and response mapping across feature handlers.

This repetition makes fixes such as findings 1–2 easy to apply incompletely. It also makes a large route the default place to add future behavior.

Recommended change: move feature handlers into focused modules using a small shared request preparation helper. Keep feature schemas and command invocation explicit. Existing `src/lib/api` feature route modules provide a precedent. Avoid inventing a generic CRUD framework with callbacks for every lifecycle stage.

Acceptance: existing HTTP contract tests stay unchanged; common malformed-input and idempotency scenarios run against every migrated handler.

### 4. Break up the largest interactive components along behavior boundaries

**Priority: medium-high. Confidence: high for concentration, medium for the resulting defect risk.**

Evidence from source sizes:

| Module | Approximate size |
| --- | ---: |
| `src/components/app/new-match/new-match-flow.tsx` | 220 KB |
| `src/components/app/roster-board.tsx` | 123 KB |
| `src/components/app/roster-board-squad-card.tsx` | 102 KB |
| `src/components/app/discord-panels/editor-steps.tsx` | 83 KB |
| `src/components/app/match-details.tsx` | 79 KB |
| `src/components/app/settings/match-templates-settings.tsx` | 78 KB |

Size alone is not a defect. However, the match creation module demonstrably coordinates autosave timers, in-flight saves, publishing, fetches, toasts, and navigation. Around lines 800–830 it suppresses an exhaustive-dependencies warning and coordinates autosave and publish through mutable refs. This deserves focused concurrency review; it is not proof of a current race.

Recommended change: extract cohesive editor steps and a persistence coordinator with explicit states such as dirty, saving, saved, publishing, and failed. Keep pure input derivation separate. Share rules with server commands rather than trusting UI validation.

Acceptance: exercise rapid edits during save, publish during autosave, failed save followed by retry, navigation with dirty state, edit mode, and stale responses. Measure bundle/render behavior before claiming a performance improvement.

### 5. Continue moving business workflows out of Convex entrypoints

**Priority: medium. Confidence: high.**

Evidence: `convex/competitions.ts` is approximately 58 KB. Its create/update handlers around lines 660–735 directly coordinate uniqueness checks, domain inputs, timestamps, database writes, and result construction. More division, team, fixture, and import writes follow in the same file.

Runtime validation and transaction wiring belong here; feature decisions become harder to reuse and test when mixed into a broad persistence module. This is an incomplete application of an existing architecture, not a reason to redesign all Convex functions.

Recommended change: start with one cohesive competition workflow. Put deterministic policies in the domain and reusable orchestration behind narrow ports. Preserve Convex's transaction and current authorization checks. Do not extract every single database patch into a ceremonial use-case.

Acceptance: equivalent adapter paths enforce the same ownership, game, uniqueness, lifecycle, and publication rules; tests cover failed dependent operations and atomicity where applicable.

### 6. Make API parity an executable inventory

**Priority: medium-high. Confidence: high that documentation is extensive; full endpoint parity is not established by this review.**

Evidence: `docs/integrations/website/configuration-coverage.md`, the broad `src/lib/api` inventory, shared write tests, and OpenAPI generation checks show that API parity is already a deliberate goal. Counting Next route files would underestimate coverage because the clan catch-all dispatches many operations.

The remaining weakness is proving completeness over time. A generated schema check proves generated output is current; it does not prove every dashboard operation has a matching API operation or authorized exception.

Recommended inventory fields:

| Field | Purpose |
| --- | --- |
| Stable operation ID | Track a capability independently of screen names |
| Dashboard/bot caller | Locate the user-facing action |
| Shared command | Identify the authoritative workflow |
| API method and path | Identify the external contract |
| Authority and scope | Separate service, actor, personal, and platform permissions |
| Availability | Supported, planned, or deliberately excluded |
| Exception rationale | Explain privacy, authority, or lifecycle restrictions |
| Contract/parity tests | Link executable evidence |
| Cache and delivery effects | Make post-write behavior reviewable |

Seed it from existing documentation and actual callers. Add a CI check that every registered dashboard write operation has an API mapping or an explicit exception. A small checked-in manifest is enough; no service catalogue platform is needed.

### 7. Revisit API exclusions individually

**Priority: product decision, then implementation.**

Observed documented exclusions include ticket settings, game-server credential management, SSO client administration, player display-name rechecks, and certain live Discord actions. Draft handling also has deliberate capability differences described in the engineering guidance.

These are not all missing features and should not be automatically opened to existing keys. Personal league routes under `/api/v1/me/leagues` use first-party sessions; a v1 path does not imply clan bearer access.

Suggested review order:

1. Ticket configuration: assess whether a dedicated administrative grant can safely expose configuration without exposing private ticket contents.
2. Draft workflows: assess whether clans actually need external draft creation/editing and whether actor-backed ownership can match dashboard behavior.
3. Live Discord actions: assess separate command authority, asynchronous operation status, audit records, and replay semantics.
4. Credential and SSO administration: keep explicit restrictions until there is a concrete integration requirement and a separate authority model. Never return stored secrets for parity.

Acceptance: every exclusion has a documented rationale and reconsideration condition. New access uses a suitable grant and shared workflow, rather than broader permissions on existing read keys.

### 8. Make architectural boundaries enforceable

**Priority: medium. Confidence: high.**

Evidence: `eslint.config.mjs` enables Next core web vitals and TypeScript presets but has no project-specific layer restrictions. `ARCHITECTURE.md` relies on conventions to keep dependencies pointing inward.

Recommended change: add targeted import restrictions for domain/application code and client/server boundaries. Include alias, relative, and type-only imports appropriately. Consider a lightweight dependency check if ESLint cannot express the actual boundaries clearly.

Acceptance: a forbidden domain dependency fails locally and in CI; existing allowed dependencies remain valid. Do not introduce multiple overlapping architecture tools.

### 9. Strengthen CI beyond typechecking and adapter tests

**Priority: medium. Confidence: high.**

Evidence: `.github/workflows/verify.yml` installs, verifies generated contracts, typechecks, checks Convex bundles, and runs tests. It does not run the defined lint, formatting, or production build scripts. The inspected workflow has pull-request and manual triggers.

Recommended change: establish the current lint/format baseline, then gate changed code or the repository once clean. Add a production-build job with synthetic configuration. Introduce a small browser smoke suite for sign-in boundary handling, workspace/game switching, match draft/publish, roster saves, and one settings write. These are proposed checks; this review does not establish whether browser infrastructure exists elsewhere.

Keep fakes for fast broad coverage. Add a few disposable real-Convex checks for validators, indexes, transaction behavior, and generated bindings; fakes cannot independently prove those runtime properties.

Acceptance: CI catches broken production compilation and critical browser wiring while remaining practical for routine PRs. Report flaky checks instead of masking them with unconditional retries.

### 10. Narrow cache invalidation without weakening correctness

**Priority: medium-low unless measurements show pressure. Confidence: high.**

Evidence: `src/lib/gateways/clan-write-cache.ts` invalidates many feature collections for each successful generic clan write, then treats a returned `id` as potentially belonging to several entity types. This is deliberately conservative but couples unrelated cache families.

`src/lib/api/clan-mutation-response.ts` correctly preserves committed-write success if invalidation fails, but the inspected responder logs through a callback rather than guaranteeing recovery. With 24-hour context caching documented in `ARCHITECTURE.md`, operational recovery deserves explicit treatment.

Recommended change: pass a typed affected-resource descriptor alongside the internal mutation result while preserving the public recorded response. Derive cache tags from that descriptor. If stale reads are operationally significant, add bounded invalidation retries or a repair mechanism; do not report an already committed write as failed.

Acceptance: unrelated feature reads remain warm; affected dashboard/public reads refresh after successful writes and replays; invalidation failures become observable and recoverable.

### 11. Document and test the single-web-instance scaling boundary

**Priority: low today; prerequisite for horizontal scaling. Confidence: high.**

Evidence: `src/lib/api/public-api-memory.ts` explicitly says limits and claims are per process and the owner runs one instance. `external-api-rate-limit.ts` uses that store and trusts forwarded IP headers when the reverse proxy sanitizes them.

Multiple instances would have separate rate budgets and refresh claims. This is an intentional optimization, not an immediate bug in a single-instance deployment.

Recommended change: document deployment assumptions and proxy header requirements. Before adding replicas, use an edge/shared limiter and evaluate which refresh claims need distributed coordination. Preserve the avoidance of one hot Convex write per request.

Acceptance: multi-instance tests demonstrate the intended aggregate rate budget; spoofed forwarding headers cannot bypass the configured public-endpoint limit.

### 12. Remove developer workflow ambiguity

**Priority: low. Confidence: high.**

Evidence: README prescribes npm installation while CI installs with Bun. Both `bun.lock` and `package-lock.json` exist. `test` loads `scripts/test-env.ts`, whereas `test:coverage` does not. README lists four dashboard languages; `src/i18n/routing.ts` includes French as a fifth, matching CONTRIBUTING. The supplied agent guidance still mentions only English and Czech in one translation rule.

Recommended change: select a canonical dependency installation/lockfile policy, align test bootstrapping where appropriate, and reconcile locale documentation. This review did not compare lockfile dependency trees or execute coverage, so divergence and coverage failure are risks rather than established results.

Acceptance: clean installs resolve the intended dependency graph; test and coverage commands initialize equivalent required fixtures; all locale instructions match routing.

## Recommended delivery sequence

### First: boundary reliability

Address JSON object validation and body bounds. Add malformed-input contract tests before reorganizing handlers. Then extract repeated transport preparation in small steps. These changes have clear behavior-based acceptance criteria.

### Second: proof of parity

Build the operation inventory and expand existing shared-management tests into reusable adapter scenarios. Include tenant/game rejection, dependent cleanup, publication effects, idempotent replay, and cache effects. Prioritize operations used by real clan integrations.

### Third: focused maintainability work

Extract match editor persistence coordination and one competition workflow. Add architecture checks and CI lint/build gates. Avoid simultaneous broad file moves and behavior changes; keep reviewable PRs.

### Fourth: operations and scale

Measure invalidation churn, stale-read incidents, queue age, retry exhaustion, and endpoint latency. Introduce narrower invalidation and distributed coordination only where deployment plans or measurements justify them.

## Principles for future extensions

- Share business decisions and write workflows. Keep authentication and transport adapters explicit.
- Do not force dashboard aggregates and paginated external reads into one response model.
- Keep time, persistence, and external delivery explicit inputs or ports where decisions depend on them.
- Use durable queued work for effects that must survive process failure, with feature-specific replay and ambiguity handling. Existing bot delivery mechanisms should be assessed and reused before adding another queue abstraction.
- Prefer small cohesive modules over universal CRUD builders, generic repository frameworks, or a service split.
- Keep client-side validation helpful, and server-side validation authoritative.
- Preserve established v1 contracts during refactoring. Treat scope expansion as an authorization change.

## Definition of progress

Success would mean a new operation has one authoritative workflow, an explicit authority model, dashboard/API adapters or a recorded exception, predictable side effects, focused tests, and CI enforcement. Track operation coverage and concrete failure cases rather than maximizing file counts, abstractions, or test counts.

No rewrite, microservice migration, database replacement, or framework migration is justified by the evidence inspected here. The strongest path is incremental consolidation and enforcement of the architecture Logi already has.
