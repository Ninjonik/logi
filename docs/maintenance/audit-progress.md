# Audit evidence and progress

Date: 2026-11-11. Status: **findings consolidated; exhaustive manual review is not certified**.

The subsequent bot-only audit is complete for its 135 source/support-code files and 98 tests. See [the bot findings](discord-bot-performance-audit.md), [complete remediation plan](discord-bot-implementation-plan.md) and [coverage ledger](discord-bot-review-ledger.json). The whole-application limitation in this file still applies; bot runtime load/heap acceptance has not been performed.

The earlier report sampled implementations. Expanding the implementation plan did not expand the evidence supporting it. This file supersedes any implication that the entire repository has already been manually reviewed.

`audit-file-inventory.json` now records 2,779 files, including 2,002 source files and 702 tests, with root tooling and hidden discovery routes included. Source files received mechanical static analysis; manual semantic depth varies and is not certified for every file. Hashes are from raw bytes. Secrets, dependencies and generated/runtime state are excluded. See audit-scope.md.

## Checks actually run

- `npm run test` and `npm run typecheck -- --incremental false` initially failed because PowerShell selected npm.ps1 and script execution is disabled. Used npm.cmd without changing execution policy.
- `npm.cmd run test`: 4,003 passed, zero failed/skipped; approximately 54 seconds.
- `npm.cmd run typecheck -- --incremental false`: passed; incremental cache disabled to avoid modifying generated build metadata.
- `npm.cmd run lint`: failed with 267 errors and 2,524 warnings. These are existing application/tooling findings; no code was changed to silence them.
- `npm.cmd run format:check`: failed; existing formatting warnings span source, bot, docs and supporting files. This check was read-only. The new planning documents may also be included in its warning set; no repository-wide formatting was applied.
- `npm.cmd run check:convex-bundles`: failed with 189 resolution errors, beginning with `Cannot read directory "../..": Access is denied` and unresolved Convex entrypoints. Environment/path-resolution failure; not proof that the modules contain invalid runtime imports.
- No production build, live browser acceptance, production operations or deployments have been performed in this audit.

## Additional findings from deeper traces

### A01 — Dashboard event actions lose authorized tenant scope

Priority: high. Verified at the handler boundary with a synthetic invocation; no production writes.

Trace: `src/app/api/servers/[serverId]/events/[eventId]/route.ts` → `createServerEventPostHandler` in `src/lib/api/event-route-handlers.ts` → event gateways → `convex/events.ts` conclude/completeTraining → application use-cases.

The handler authorizes serverId but invokes conclude/completeTraining with eventId only. The downstream mutations validate the internal secret, not the authorized tenant/actor. The conclusion use-case checks existence, host status and meeting time, not caller ownership. A synthetic handler call authorizing only `owned-server` accepted `foreign-event`, returned 200 and invoked `{ eventId: "foreign-event" }`.

Remediation: pass verified actor and tenant scope through dashboard gateways, enforce event ownership/current authority in the Convex transaction, preserve separate bot authority, and apply the same ownership command to equivalent API writers. Review all event-action branches and other ID-only management calls. Add wrong-server, revoked actor, own-event and shared-host regression tests before extraction. Validate all dependent scoring and Discord effects remain scoped. Actual live exploitation was not attempted.

### A02 — Webhook destination validation does not enforce its stated network boundary

Priority: high. Verified pure-function behavior, no network requests.

`src/domain/webhooks/url.ts` returned null (accepted) for production URLs `https://169.254.169.254/hook`, `https://[::1]/hook` and `https://[fc00::1]/hook`. `src/infrastructure/webhooks/delivery-runner.ts` sends via injected/global fetch; it does not independently resolve/pin destination addresses. The inspected provider transport already has stronger DNS/address checks and pinning.

Remediation: enforce an explicit destination policy at registration and delivery, covering IP families/special networks and hostname resolution. Reuse well-scoped address policy where appropriate without coupling webhook POSTs to provider GET/path rules. Keep manual redirects/timeouts and signature semantics. Test normalized IPv6, hostname-to-private resolution, changed DNS, redirect attempts, valid public destinations and environments with explicit allowed private integrations. Do not assume deployment egress rules provide the missing guarantee.

### A03 — Several management routes still authorize through cached context

Priority: high where cached authorization is the final user-authority check.

Webhook management, frontend settings, Discord settings, group writes, draft-roster deletion, topic resync and meeting-attendance requests use `getServerContext`, which delegates to the 24-hour cached read model, and their traced writes do not carry a durable dashboard actor. SSO management also uses that cache, but **its mutations independently call `assertGuildAdmin` against current persisted access**; do not report those writes as relying solely on cached permissions. Its list query only checks the gateway secret. Shared-match actions likewise carry an actor and reauthorize in Convex despite their cached preliminary context. Other routes use `getServerContextUncached` plus currentDashboardActor. Proxy excludes general `/api` routes; it does not provide their authorization. The complete route inventory is a discovery source; each delegated guard still requires semantic interpretation.

Remediation: enumerate every management writer, replace cached authorization with the existing live boundary, and enforce actor/resource scope inside the mutation. Same-origin checks must be consistent; current session cookies alone are not a substitute for a documented write-origin policy. Test revoked access while a previously authorized snapshot remains cached. Do not claim a universal CSRF exploit from the absence of one particular check.

### A04 — Group hierarchy permits cycles and deletion leaves child links

Priority: medium. Shared command/repository trace inspected; UI behavior still requires verification.

`GroupCommands.save` validates only parent ownership/game. It does not reject self-parenting or ancestry cycles. `remove` cleans assignment references, and repository deletion cleans self-service allowlist, but neither inspected implementation reparents/refuses existing children. Group schema has no ancestry check. UI parent selection excludes some cases but cannot enforce the API invariant.

Remediation: establish intended hierarchy depth/deletion policy from product behavior; enforce it once in the shared command. Reject self/cyclic links, constrain ancestry to tenant/game, and reparent or reject deletion according to the established policy. Test equivalent dashboard/API writes. Do not arbitrarily choose cascade deletion.

### A05 — Privacy export performs global unbounded scans

Priority: medium. `convex/privacy.ts:exportForUser` collects users, performance history, events and rosters across the database, then filters in memory. Assignments/stats/requests use only args.userId while other sections account for aliases, so alias completeness needs explicit tests.

Remediation: model export as bounded paged collection with canonical identity/aliases and subject-oriented lookups. Review all current personal-data tables for completeness; do not claim existing export is complete without that mapping. Keep authority/privacy protections and avoid returning other users' nested data. Verify large datasets and identity aliases with synthetic fixtures.

### A06 — Membership decision spans separately awaited state changes

Priority: medium; runtime recovery must still be traced.

`src/application/membership/decide-application.ts` writes assignment then closes application through separate ports; on either failure it releases the claim. `submit-application.ts` compensates thread/assignment failures best-effort. Determine the actual transaction/recovery guarantees in bot/Convex adapters before calling these flows atomic or durable.

Remediation: couple authoritative membership/decision state transactionally where possible; keep Discord outside the transaction behind recoverable delivery. Test assignment success followed by close failure, compensation failure, process interruption and competing decisions. Do not replace feature-specific replay handling with generic retries.

### A07 — Shared hook duplication and broad theme effects

Priority: low/medium. `useSidebarConfig` exists in both `src/hooks/use-sidebar-config.ts` and `src/contexts/sidebar-context.tsx`. `use-theme-manager.ts:resetTheme` removes every inline custom property from documentElement, including variables it does not own. `use-circular-transition.ts` has no reset for a synchronously throwing transition/callback and ignores the rejected promise produced by finally.

Remediation: consolidate hook ownership and migrate all imports; scope theme cleanup to owned variables; make transition lock release failure-safe. Test theme changes alongside other root custom properties and callback/transition rejection. Avoid refactoring clean hooks merely for consistency.

## Current evidence boundary

### A08 — Assignment command does not pass game scope to group validation

Priority: medium/high for cross-game data integrity. `UpsertAssignmentUseCase.execute` calls `listGroupNamesByServer(input.serverDiscordId)` without input.gameId, although the port and Convex repository support the game argument. The shared validation therefore receives all clan groups. `convex/userAssignments.ts:upsert` checks existing assignment tenant, but its inspected path does not add group-game validation before calling the command. Other API adapters may add guards; those do not fix the shared invariant.

Remediation: validate groups against the verified assignment game in the shared command, preserving established legacy game defaults. Also move immutable assignment identity/ownership checks into the shared workflow rather than relying on optional managed-role queuing to reject identity changes. Test both direct/dashboard and v1 adapters with same-tenant wrong-game groups and stale/missing assignment IDs. Inspect membership-category game ownership at the same boundary.

### A09 — Direct wall-clock usage remains inside reusable workflows

Priority: medium for determinism/testing. `UpsertRosterUseCase.execute` supplies `new Date()` to roster merging; it does not receive the clock passed into ManageRoster. The assignment repository also calls `new Date()` when touching projections on removal. These paths escape the documented injected-clock convention.

Remediation: pass one command timestamp through dependent updates, avoiding unrelated timestamps/revisions within one operation. Add fixed-clock tests around signup deadlines, removal and projection changes. Inventory sibling clock fallbacks before claiming deterministic workflows everywhere.

### A10 — Concrete inward-layer exceptions exist

A TypeScript import-declaration scan of 423 non-test domain/application files, resolving aliases and relative paths, found five direct outward edges: application stratmap save and domain map import depend on lib/stratmaps; domain preset mutation depends on two lib validation schemas; domain membership application settings depends on clan-language copy. These dependencies were then opened and inspected. The scan does not cover dynamic imports/re-exports/transitive closure.

Remediation: place reusable pure stratmap models/builders and preset schemas in domain-owned modules, keep catalogue loading in a suitable adapter, and pass localization/presentation capabilities into API projection wiring rather than importing the language dictionary into domain. The domain webhook signature module also directly imports node:crypto; move runtime signing into infrastructure while preserving its exact protocol. Update every consumer. Do not classify a pure helper as a security issue merely because its current directory is lib.

### A11 — Reproducible operational versions and shutdown need work

`docker/convex/docker-compose.yml` uses latest tags for backend and dashboard. Pin a tested compatible pair/digests and document an explicit upgrade/rollback/backup verification procedure. No live deployment was inspected.

The bot startup file starts multiple workers/services and a restartable fallback Worker but has no SIGINT/SIGTERM shutdown coordinator in the inspected complete file. The sync service has stop(), so lifecycle ownership can be made explicit. Add graceful stop ordering, cancellation of restart timers, bounded in-flight drain, client/Convex closure, and interruption tests without real Discord. Trace every started worker before implementing shutdown; don't assume syncService.stop() covers them all.

### A12 — Clan-admin user merge invokes an unrestricted global identity rewrite

Priority: high. Static full merge-handler trace, no real merges attempted.

`src/app/api/servers/[serverId]/users/merge/route.ts` authorizes administration of the selected clan using cached context, then forwards two user IDs with no tenant/actor. `mergeManagedUsers` → assignment gateway → `convex/players.ts:mergeUsers` checks only the internal secret and user existence. It revokes identities/sessions, rewrites memberships/events/rosters/ticket/application references globally, and deletes the secondary account. No inspected layer verifies the targets belong to the authorized clan or limits authority over global accounts.

The same implementation indexes primary assignments only by serverId, omitting gameId, while memberships are game-specific. A same-server assignment of another game can therefore be merged and deleted as if it were the same membership. Global scans also make this operation size-sensitive.

Remediation: first determine and enforce authority for global identity consolidation. A clan-admin check is insufficient for arbitrary global merges; separate safe local imported-profile repair from platform/account identity administration. Supply verified actor and explicit scope to the transaction. Model assignment identity with server+game, define merge conflict rules, enumerate all identity references including newer personal-league/session tables, and use a bounded recovery-safe migration strategy where a single transaction cannot scale. Test cross-clan targets, two established Discord accounts, same-server/different-game memberships, same logical identity through aliases, stale actor, and complete dependent rewrites. Do not expose this existing unsafe lifecycle through v1 for parity.

### A13 — Assignment editing is a sequence of independently committed writes

The dashboard assignment PATCH route saves membership, then global platform IDs, then global note, then roles/cache. A later platform-link conflict can produce an error after membership committed. Submitted platformIds/note may also carry global account consequences beyond clan-local assignment authority. The route does use an uncached context, so this is distinct from cached authorization.

Remediation: define the authorized operation boundary. Put compatible authoritative writes in one shared Convex transaction, or split global account editing into separately authorized commands with explicit partial-success semantics. Queue external effects after commit using existing role infrastructure. Test membership success followed by platform conflict, ambiguous retry, global-account target restrictions and equivalent API capability differences.

### A14 — Database fake can conceal runtime invariants

`src/infrastructure/convex/testing/database.ts` deliberately simulates a database. Its unique() returns the first row rather than rejecting duplicates; index fields are inferred from names; invoke() calls raw _handler without argument-validator enforcement. It does simulate database/scheduler rollback on thrown errors, but not storage rollback or Convex concurrency. Passing fake tests is not proof of validator/index/uniqueness/transaction-runtime behavior.

Remediation: add focused tests for the fake's intended guarantees and make unsupported behavior explicit. For critical validator/index/duplicate/transaction cases, run disposable real-Convex checks. Do not expand the fake into an entire database engine. Audit tests currently depending on silently accepted duplicate rows or malformed arguments.

### A15 — Event score application still uses clan-only score semantics

Priority: medium/high data consistency. `ApplyEventScoreUseCase` has no event gameId, loads assignments by clan only and writes scores under `[event.guildId]` plus the legacy top-level score. `ConvexEventScoreRepository` drops event.gameId and returns all clan assignments. Elsewhere `players:updateScore` and `domain/players/game-score` use game-aware keys. Multi-game members and game-specific manual scores therefore need regression coverage before score parity can be claimed. Imported stable IDs also differ from the repository's Discord-only user lookup.

Remediation: propagate canonical event game/identity scope into score policies/repositories and readers, use the established game-score key helper, preserve legacy HLL fallback deliberately, and apply only eligible assignments for that game. Test multiple games in one clan, users with one paused and one active membership, imported user aliases, replayed conclusion and existing legacy score records. Define any necessary data migration before modifying stored totals.

### A16 — Custom game support and API schemas disagree

`src/domain/games/game.ts` explicitly supports opaque catalogue game IDs and includes four built-ins. `src/domain/api/preset-mutation.ts` fixes stratmap mutation games to three names. This is a concrete contract mismatch; whether particular stratmap games are deliberately unsupported needs verification against game capabilities and UI. Audit every hardcoded game enum against the catalogue/capability model rather than blindly widening them.

Remediation: use catalogue/capability validation at the verified tenant boundary for supported operations; retain explicit provider restrictions where real capabilities differ. Test a supported custom game and an unsupported capability through dashboard and API; document deliberate restrictions.

### A17 — Logging is synchronous and can change operation outcomes

`src/lib/system-logs.ts` synchronously creates/writes SQLite for each log; non-ERR_SQLITE_ERROR failures are rethrown. Both web and bot use it, including post-commit success logs and error paths. The sanitizer recursively serializes values/errors but has no key-based secret redaction, depth/cycle bounds, or field-size bounds in the inspected implementation. This is a missing protective guarantee, not evidence that actual secrets were logged.

Remediation: keep logging failures from replacing committed business outcomes, bound/redact structured context and review all logging callers for sensitive input. Define local log retention and multi-process SQLite contention behavior. Test unwritable/full storage, cyclic/oversized context and synthetic credential fields. Avoid introducing an observability platform solely to fix these local guarantees.

### Audit strengths observed in additional traces

Result confirmation rechecks authority after draft refresh and before append. Provider HTTP uses DNS/address policy and pinned HTTPS connections, body bounds and no redirects. Snapshot collection and webhook draining bound concurrency/work starts and await in-flight work. Seed application workflows use explicit ports and supplied time. Team catalogue commands use revision/idempotency policies and explicit logo-reference/audit effects. These patterns are useful consolidation targets, not candidates for blanket rewrites. Their full adapter/feature matrices remain to be reviewed.

### A18 — Cache invalidation accepts unrelated signed-in callers

`src/app/api/cache/revalidate/route.ts` and `cache/roster-image/route.ts` accept either the internal secret **or any logged-in user**. The submitted tenant/resource IDs are not checked against that user's authority. The general gateway can invalidate unrelated tenant data and global discovery/user/image tags; the image endpoint always invalidates the global roster-image tag. This is an availability/cache-churn boundary defect, not evidence of access to cached response contents.

Separate trusted bot invalidation from dashboard requests. Dashboard requests must have live scoped authority, a consistent origin policy, bounded input and rate limits; derive affected scope from the resource. Prefer automatic effects of authorized writes over an arbitrary public invalidation interface. Test an unrelated authenticated user, resource/tenant mismatch, stale actor and trusted bot success. Coordinate with P11 so cache narrowing does not leave stale reads.

### A19 — Raw uploads can become active same-origin content

`client-uploads.ts` passes the file's supplied content type to an unrestricted storage upload URL. `uploads/file/[storageId]/[filename]/route.ts` anonymously resolves a storage ID through the internal-secret gateway, copies the stored content type and returns `Content-Disposition: inline`. No inspected route enforces an image-only type or public/private ownership classification. `next.config.ts` does supply global `nosniff`, but no CSP sandbox; `nosniff` does not stop deliberately served `text/html` from being HTML. This is a concrete unsafe serving policy; a live browser exploit was not attempted.

Inventory every raw-upload consumer, including attachments and legacy assets. Store owner, purpose, verified media type and visibility; authorize private reads and deliberately classify public files. Serve arbitrary files as attachment from an isolated origin or with a restrictive sandbox policy; normalize intended images using the existing image-asset pipeline. Bound bytes, quotas, abandoned upload cleanup and upstream fetch duration. Test HTML/SVG, wrong-owner reads, permitted public images, ranges and download filenames. Do not treat opaque IDs as authorization or break intentionally public images indiscriminately.

### A20 — Membership decisions have a verified multi-transaction interruption window

The actual bot adapter in `discord-bot/src/interactions/membership-decision.ts` confirms A06: assignment upsert/removal, optional cross-game removal, cache HTTP revalidation and application close are separate awaited operations. Cache failure can occur after membership committed but before the application is closed; the use-case then releases the decision claim. A retry or different recruiter can decide the still-open application against changed membership. External card/DM/thread failures are already best effort and should remain separate.

Move assignment transition, cross-game membership change, role-operation enqueue and application close into one shared Convex command with current application/claim fencing and verified actor. Perform cache/publication effects after commit with durable retry where needed. Test failure between every existing boundary, conflicting decisions and cross-game moves. Do not move Discord requests inside a database transaction.

### A21 — Untrusted Markdown admits active HTML

`src/components/app/discord-markdown.tsx` enables `rehype-raw` for stored article/topic/stratmap text and editor previews without a sanitizing/allowlist stage. `formatDiscordMarkdown` only normalizes whitespace. A local render using the installed ReactMarkdown/rehype/React packages emitted an iframe with `srcDoc="<script>…</script>"` and an arbitrary form unchanged in substance. React's escaping of the attribute does not sanitize the embedded document. Global headers have no CSP restricting this. Browser execution was not attempted; the emitted unsafe structure was verified offline.

Prefer disabling raw HTML for Discord-style text. If specific HTML is a product requirement, use a narrowly defined sanitizing schema after raw parsing, excluding embedded documents, forms, active attributes and unsafe URL schemes. Apply the same policy to every renderer and preview. Legal Markdown is checked-in trusted content and has a different trust boundary. Add malicious iframe/srcdoc/form/style/URL and allowed-format regressions; audit stored content before rollout.

### A22 — Generic v1 idempotency does not bind the concrete target

The catch-all clan route passes template paths such as `DELETE /clan/groups/{groupId}`, `PATCH /clan/rosters/{rosterId}`, and `POST /clan/events/{eventId}/actions/conclude`. `convex/apiIdempotency.ts` compares only methodPath and raw body hash for a guild/key receipt. It does not compare the separately supplied resource ID. An offline invocation of the actual group mutation deleted groups:a, then returned the same 200/deleted groups:a response when asked to delete groups:b with the same receipt inputs; groups:b remained. Reusing a key for two different targets with the same body (especially empty DELETE/conclude bodies) therefore replays the first target's response instead of reporting a different-request conflict. This is not a duplicate write; it is a false successful acknowledgement of the second operation. Reauthorization of revoked/read-only keys before replay is already present and must remain.

Create one canonical fingerprint containing method, concrete normalized resource/action identity, tenant, relevant game/query scope and body digest. Enforce it at the authoritative mutation boundary for every receipt-based operation, preserving byte-identical replay and existing paths. Version/migrate receipt semantics deliberately across the retention window. Test same key/same target, changed body, different target/same body, different action/game and revoked credentials. Do not fix just one DELETE route.

### A23 — Editor save coordination can lose or overwrite work

`new-match/new-match-flow.tsx` starts a debounce when values change, but the timer does nothing while `saving.current` exists. If that timer fires before a slow save finishes, the completion keeps `dirty=true` yet does not schedule another save; neither the ref nor saveState is an autosave dependency. Those edits wait for another edit/manual action. Queue the newest draft after an in-flight save and distinguish the submitted edit generation.

`roster-board.tsx` deliberately preserves a dirty board when live roster props change, but executeSave sends `expectedUpdatedAt: roster?.updatedAt` from the latest props, rather than the version the board was based on. This can defeat the backend's conflict detection. It also clears dirty after success without checking whether additional edits happened during the request. Retain the board's base revision and submitted edit generation, present a conflict without discarding local work, and adopt the returned canonical revision only for acknowledged state.

Stratmap `updateState` replaces the entire state string without a base revision. The local `preserve-local` echo policy prevents a remote update from replacing dirty state in the UI, but cannot prevent the later local save overwriting that remote update. Establish explicit optimistic conflict semantics or an intentional single-editor lease; do not introduce collaborative CRDT infrastructure without a product need. Apply bounded schema validation to persisted editor state and define undo/ping behavior separately. Test two editors, edits during save, slow response, failed save/retry and navigation while dirty using controlled promises/timers.

### A24 — Caught mutation errors can commit rejected writes

Priority: high; verified offline against the actual exported v1 handler with the repository's transaction fixture. `mutateClanEvent` catches errors inside its transaction and records a 400 response. `ConvexEventCommandRepository.create` inserts the event **before** `bindWardogsFixture` can reject a duplicate fixture. A synthetic duplicate produced status 400 with “already linked” while the newly inserted event remained and a failure receipt was stored. The fixture rolls back thrown errors; this handler returned normally. No production data or network was used.

Audit every catch around authoritative writes in `publicApi.ts` and other mutations. Reject predictable invalid commands before writes; let unexpected/post-write failures escape the transaction so all writes and receipt reservations roll back. If preserving error receipts requires a nested mutation/savepoint approach, verify supported runtime semantics on a disposable backend instead of inventing an in-process rollback. Map thrown errors at the HTTP adapter without losing stable envelopes. Test duplicate fixture creation leaves no event, late repository failure leaves no dependent partial writes, no misleading stored success/error receipts, and safe retries through dashboard/API/bot.

### A25 — Cross-resource event validation differs between writers

`convex/events.ts:upsert` verifies the squad preset's tenant but not its game; the traced shared upsert command has no repository-backed reference validation. The generic v1 event writer separately checks referenced group/stratmap/topic/squad tenants, but those checks generally omit the selected game's ownership. `ManageRoster` already validates both tenant and game for its preset. Move event reference invariants into the shared event command/repository, including host/shared constraints and enabled-game/capability policy where applicable. Verify the draft/website/bot writers as well as the generic API; retain deliberately cross-game topics only if their contract explicitly permits it. Test foreign-tenant references, same-tenant wrong-game groups/maps/presets, legacy missing-HLL game values and changing an event's game while references remain.

### A26 — Scheduled reminder handoff is not durable through delivery

`discord-bot/src/runtime/fallback-worker.ts` completes/deletes a scheduled job before posting reminder IDs to the parent process. The parent's due-ID sets are in memory. A crash after completion but before receipt/send loses that occurrence; restart queue recovery cannot restore a deleted job, and normal full sync does not supply reminder due IDs. Signup delivery additionally claims a run before iterating recipients, then records outcomes only after the loop. A crash mid-loop needs an explicit uncertain/partial-delivery policy. This trace does not imply every worker has this defect: publication/player-report workflows already use durable fenced delivery/recovery.

Persist reminder-delivery intent atomically when consuming the schedule job. A separate worker claims delivery with a lease/fence, records recipient progress and terminal/uncertain outcomes, and respects current configuration/eligibility/deadline. Reuse existing queue/publication patterns without claiming exactly-once external DMs. Test crashes before/after schedule completion, parent handoff, partial sends and acknowledgement; test duplicate workers and expiry. Preserve deliberate daily reminder recurrence and cooldown semantics.

### A27 — Environment, tooling and repository hygiene need one maintained contract

Web `getInternalAuthSecret()` falls back to the JWT secret, while the bot and several Convex guards require INTERNAL_AUTH_SECRET explicitly. SITE_URL defaults to localhost in both runtimes. These are inconsistent configuration semantics, not evidence of exposed configured secrets. Validate required production origins/secrets at runtime startup and keep the optional SSO/credential feature gates explicit; use one typed configuration contract with runtime-specific adapters, never import Node environment loaders into Convex V8 or clients.

README describes four locales, whereas routing/dictionaries implement five including French; AGENTS still names en/cs in one update rule. Align supported-locale guidance and translation key coverage. The lint baseline includes downloaded `.tmp` and vendor public JavaScript as well as maintained source; scope exclusions by ownership and then repair actual source errors. Do not blanket-disable rules or call vendor lint noise all application debt. Tests/coverage scripts differ in test-env bootstrapping. CI uses Bun's frozen lockfile, while npm docs and the ignored local package-lock need a single installation policy.

Tracked `output/`, screenshots, IDE metadata and historical logs need a documented artifact policy, with an explicit decision on what belongs in source control. The backup tool has locking, restricted permissions, ZIP checks and three local restore points, but the inspected implementation alone does not establish off-host recovery, monitoring or a successful restore drill. Keep declared unlimited match-statistic/recap retention unless the maintainer changes that policy; do not silently delete history to improve performance. No operational script was executed.

The register documents verified traces and static risks. It does not certify every source line or browser workflow. The master plan covers all feature families and requires all-instance verification during implementation; outstanding runtime checks and review depth are recorded in audit-scope.md.
