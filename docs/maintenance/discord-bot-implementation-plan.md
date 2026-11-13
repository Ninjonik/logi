# Discord bot: complete remediation plan

Date: 2026-11-11. Scope: the Discord bot and the shared/backend changes necessary to resolve its findings. **This is a plan, not implemented work.** No application code was changed by the audit.

Read [the audit](discord-bot-performance-audit.md) and [233-file review ledger](discord-bot-review-ledger.json) first. The audit's B01–B18 families and detailed source notes are the requirements register for this plan. Every family must close; fixing a representative worker or endpoint is insufficient. This plan supersedes the earlier bot examples in the [application maintenance plan](../maintenance-implementation-plan.md), without claiming that the rest of the application was manually audited.

Current implementation status and the prioritized unresolved release gates are maintained in [the progress/TODO register](discord-bot-implementation-progress.md#current-durable-handoff-and-recipient-resume-checkpoint-2026-11-12). The bounded hardening pass closes specific defects, not entire D packages. Archived implementations are not active runtime code.

## Rules for execution

1. Recheck AGENTS.md, architecture/contribution docs, bot README, tree status and ledger hashes. Preserve unrelated work. Read each affected caller/test before editing; a review disposition is not a substitute for implementation context.
2. Start with regression tests and counters at the actual adapter boundary. Fix demonstrated defects early. Share a small scheduling/download primitive only after the second real consumer establishes the required interface. Do not build a generic workflow engine or rewrite all bot features.
3. Keep pure decisions in `src/domain`, orchestration/ports in `src/application`, persistence in Convex adapters and Discord operations in the bot. Do not move Discord objects, SDK collections, environment access or cache ownership into domain rules.
4. Scope work by guild, game, actor and current resource revision. Never optimize away fresh authority, recipient opt-out, complete audience proof, expiry checks, publication ownership or dependent transactional updates.
5. Preserve dashboard/API/bot behavior parity whenever shared writes change. Update applicable v1 contracts/OpenAPI/tests and matching `content/` workflow pages in that same implementation. Bot-only delivery changes need no invented public endpoint; record the intentional distinction.
6. Use counters and deterministic fault/concurrency tests to establish complexity. Runtime timings and proposed budgets below require measurement; do not claim performance from test-suite duration.
7. No implementation package is complete with an unresolved recovery state, omitted caller, undocumented behavior change or unverified migration. Do not mark this entire plan complete because the highest-priority package passes.

## Execution order

Start **D00**. Then deliver small corrections from **D04, D07, D08, D09 and D11** behind focused tests. Implement **D01 → D03**, and **D02 → D05/D06**. Finish **D10/D12**, migrate every listed consumer, then run the complete acceptance matrix. D04 establishes durable ownership before D03 increases delivery concurrency. D07 establishes memory/download bounds before increasing renderer concurrency.

Maintain a handoff table with package, finding IDs, files/callers touched, tests, measured before/after counts, schema/backfill progress, deployment result where authorized, residual risks and next exact task. All packages below start **not implemented**.

## D00 — Baselines and executable performance evidence

**Findings:** B16 and verification for every other family.

**Where:** `discord-bot/src/log.ts`, `index.ts`, `runtime/sync-service.ts`, panel/seed/league workers, `src/lib/system-logs.ts`; adjacent tests and existing offline gateway fixture.

**Work:**

- Add lightweight counters/histograms around admission, actual start/finish, queue age/depth, active work, coalesced work, retries, expired claims, uncertain delivery and discarded stale revisions. Distinguish timed-out responses from still-active operations.
- Count Discord REST/gateway requests by operation, Convex queries/actions/mutations and returned rows/bytes, HTTP invalidation attempts, image downloads/renders/bytes and retained cache bytes. Use bounded labels; never user ID, event ID or raw error text as a metric label.
- Build a deterministic fake clock/provider/Discord workload harness using existing test ports. Add query instrumentation that counts rows and selected predicates, not just whether an index name appeared. Fixtures simulate multiple guilds and large retained histories.
- Capture event-loop delay, RSS/heap and queue-age trends in a disposable runtime before/after. Establish separate idle, burst, outage and recovery baselines. Do not open production databases or send real Discord traffic merely to run unit tests.

**Done when:** each later package has a repeatable before/after assertion and a failure test. Existing 648 bot tests remain green. Counters themselves have bounded memory and do not synchronously write a log per operation.

## D01 — Runtime ownership, startup and shutdown

**Findings:** B02, B03; foundation for D03.

**Where:** `discord-bot/src/index.ts`, `discord-client.ts`, `convex.ts`, `runtime/fallback-worker.ts`, `runtime/sync-service.ts`, `runtime/application-emoji.ts`, `commands/registration.ts`, `meeting-attendance.ts`, `manual-reminders.ts`, `platform-status.ts`, `interactions/membership-web-submissions.ts`, `public-panels/worker.ts`, `seed/worker.ts`, `league/worker.ts`, `sync/team-request-worker.ts`, `sync/team-request-notifications.ts`, `sync/managed-member-roles.ts`, membership subscription owners.

**Work:**

- Give each service an explicit start result and idempotent asynchronous stop/drain contract. Retain every subscription, timer, child-process and listener handle, including fallback restart timers and emoji refresh. Model essential versus optional startup dependencies explicitly.
- Start independent services with bounded orchestration and isolated failures; add deliberate retry/backoff/readiness. A failed attendance subscription must not silently prevent panels, manual deliveries or fallback scheduling from starting.
- Handle SIGTERM/SIGINT once: stop admission/timers/subscriptions, stop or drain owned child work, await bounded active work, close Convex and Discord. Persist/release unfinished intent according to fenced recovery rules. Log drain timeout without pretending every effect finished.
- Audit `utils.withTimeout`, stats deadlines and every detached promise. Cancellation-capable operations receive a signal/deadline. If cancellation is impossible, retain active capacity/ownership until actual settlement; a rejected race is not completion. Catch errors through a failure-safe reporter.

**Done when:** startup failure at each stage leaves other independent services usable; repeated start/stop leaves zero owned timers/listeners/subscriptions; stop during slow I/O starts no new operations; no unhandled rejection or use-after-close. Retain SDK gateway lifecycle/patch tests and test actual production Node version before dependency upgrades.

## D02 — Compact subscriptions and one-pass guild assembly

**Findings:** B01, B11, B14.

**Where:** `runtime/guild-cache.ts`, `runtime/sync-service.ts`, `convex/discordSync.ts`, `discordCommands.ts`, `membershipApplications.ts:listApplicationDefinitions`, schema and relevant read-model adapters.

**Work:**

- Group global snapshot arrays by guild once. Build lookup maps before signature calculation; preserve removed guild/config detection. Compare semantic feature revisions, not large serializations on every callback.
- Replace full rosters in the bot event index with compact event/roster revisions and scheduling facts. Fetch complete event context only for admitted work. Retain shared-match/local-player projection, game scope and draft redaction.
- Choose watcher topology from measured subscription bytes/invalidation fan-out: compact global discovery plus scoped feature reads is the starting option. Do not replace one global watcher with thousands of unconditional watchers without evidence.
- Reuse a bounded, immutable context per cycle/authority generation. Coalesce calendar refresh once per dirty guild. Resolve one caller's applicable assignments for signup instead of returning every clan assignment; keep any complete audience reads needed for reminders separate.
- Separate application-definition/command fields from counters and publication state so self-generated writes do not needlessly invalidate configuration subscribers. Keep one coherent authoritative config version.

**Done when:** assembling G guilds and N records is O(G+N), excluding output serialization; one changed event does not download all unrelated rosters; K changed events in a guild cause one calendar assembly per completed cycle. Removal, settings change, shared event, draft and stale-version tests pass. No timestamp-only shortcut hides user-visible changes.

## D03 — Fair bounded scheduling everywhere

**Findings:** B02, B03, B06.

**Where:** sync service; `public-panels/worker.ts`; `seed/worker.ts`; `league/worker.ts`; meeting/manual/web/roster workers; `event-roles.ts`; `sync/member-access.ts`; reminders; report recovery; Discord transport call sites.

**Work:**

- Introduce a small keyed dispatcher supporting per-guild/key serialization, bounded global active work, latest-revision coalescing, due times, bounded admission, fair rotation and stop/drain. Keep durable queues authoritative; in-memory queue overflow must not lose authoritative work.
- Separate interactive work, recurring reconciliation, image/provider work and DM delivery budgets. Use one shared Discord admission budget with fair lanes so independently “bounded” workers cannot collectively overwhelm the SDK queue. Preserve ordering where required.
- Replace global guild-at-a-time blocking with bounded fair visits. Cap work per visit; carry cursors forward. A slow guild must not block unrelated guilds or heartbeat. Preserve existing managed-role rotation/fencing rather than replacing it wholesale.
- Replace `refreshSeedGuild`'s forty-wait fallback with one owned promise per guild and one coalesced forced rerun. Never delete another run's ownership marker.
- Guard `platform-status.ts` against overlapping interval passes. Keep its timestamp freshness cadence explicit. Move panel heartbeat off the long serial rendering pass.
- Gate before claiming work, not after consuming the claim lease. Bound role/member updates, combined-panel provider/image fan-out and DM batches. A per-request five-call limit is not an aggregate attendance limit.
- Preserve failed sync intent with typed retry/backoff and latest-version requeue. Classify explicit rejection, transient failure and uncertain create separately; uncertain creates go to reconciliation, never blind retry.

**Done when:** overlapping callbacks and 1,000 queued items never exceed configured active limits; the oldest eligible guild progresses under a hot-guild burst; a hung request cannot release capacity by timing out; one key has at most one actual operation. Assertions cover all workers, not only the dispatcher helper. Backlog age, saturation and dropped advisory work are observable.

## D04 — Recoverable claims and transactional business commands

**Findings:** B04, B18; prerequisite for safe concurrency increases.

**Where:** `convex/scheduledJobs.ts`, `eventReminders.ts`, `rosterChanges.ts`, `meetingAttendance.ts`, `discordRosters.ts`, `membershipApplications.ts`, `discordMembership.ts`, `crons.ts`, relevant schema definitions; bot fallback/manual/roster/attendance/application/decision/ticket adapters; shared application commands/repositories.

**Work:**

- Define each queue's states, ownership token/fence, lease expiry, due time, attempts, terminal state and uncertain outcome. Add compound status/due indexes appropriate to the actual table. Completion, failure, release and renewal must match the claimed attempt.
- Discover expired processing work through bounded indexed queries and an actual wakeup mechanism. `Date.now()` filtering inside a watched query does not schedule an expiry callback. Ensure the first page cannot hide later eligible rows; use due ordering/cursors with fair progress.
- Keep meeting attendance's 45-second authority deadline and mutation-time scope/channel checks. Expired attendance becomes visibly failed; do not reconfirm it after expiry. Bound pending discovery and terminal cleanup.
- Replace startup-wide job/event scans with durable paginated backfill and periodic bounded expiry recovery. Stop `claimDue` maintenance from reading hundreds of later events after admission is full; give cleanup a separate budget.
- Make application decision business changes one transactional shared command, preserving category/game movement and assignment effects. Fence submission/decision release and record external provisioning progress. Old attempts cannot delete a new draft/claim or overwrite a later decision.
- Ticket creation requires operation identity before creating Discord resources and durable resource remembrance/recovery. Closing requires an atomic state transition plus separately recorded external effects, or an explicit documented manual-repair policy. Do not automatically replay confirmation DMs.
- For scheduled reminders and League replies, retain the current reserve-before-send policy until the maintainer deliberately chooses different loss/duplicate semantics. Internal durable handoff can be improved without changing that policy; record which recipients/effects are certain, uncertain or deliberately skipped.

**Done when:** kill/restart at every claim/write/send/mark boundary has a defined result; expired jobs are discovered without restart; old completions/releases cannot affect a newer claim; no late attendance write; failed backfill resumes without rescanning prior pages. Dashboard/API adapters preserve the same business invariants and cache effects. Tests include missing/deleted resources and changed scope, not only happy paths.

## D05 — Incremental results and recap delivery

**Findings:** B05, B17.

**Where:** `src/application/discord-publications/results.ts`, `discord-bot/src/public-panels/panel-runner.ts`, `sync/match-recaps.ts`, `convex/discordPublicPanels.ts`, `matchRecaps.ts`, result write/publication projection owners and schema; existing `src/infrastructure/convex/discord-publications.test.ts` and recap tests.

**Work:**

- First resolve guild identity end to end. Create through the real dashboard/shared/website command, then read/publish with a native workspace ID distinct from Discord ID. The current result test intentionally seeds native IDs while other event paths use Discord IDs. Define the canonical persisted identity and explicit translation at each boundary; provide a bounded migration if mixed records exist. Do not query both indiscriminately or weaken tenant isolation.
- Maintain a compact public-result projection/change feed keyed by guild/game/publication revision. Include deletions, draft withdrawal, visibility change and source/result revision changes. Existing authoritative result writes update it transactionally; shared command callers reuse that path.
- Backfill a new panel's latest five eligible results efficiently, oldest first. Thereafter process dirty results, affected existing bindings and explicit withdrawals. Use a durable cursor and bounded pages/time per visit. Occasional repair sweeps resume; partial/unreadable history is never proof that a message should be deleted.
- Render detailed result cards only after selecting eligible work. Reuse narrow binding maps. Add cursor repetition/no-progress protection to any traversal that remains.
- Query only pending/due recap recipients. Reject terminal rows before panel/source/stat reads. Separate recap work from historical result rendering.
- Replace read/prepare/send/mark with fenced durable admission, fresh opt-out/account/publication checks and outcome state. Define uncertain-send reconciliation/operator handling explicitly. Record closed-DM terminal/backoff policy so the same failed recipient is not retried on every panel minute. Do not claim exactly-once delivery without transport evidence.

**Done when:** growing archive size from 1,000 to 100,000 unchanged results does not increase normal refresh reads/renders; one result edit schedules only affected work; a new panel still backfills correctly; withdrawal/review rollback/shared scope passes; two simultaneous recap paths admit one sender; crash after send does not silently permit duplicate replay. Identity tests exercise real writers rather than conveniently matching fixture IDs.

## D06 — Due panel/seed/League projections

**Findings:** B06, B13 and recurring-read portion of B01.

**Where:** `convex/discordPublicPanels.ts`, `discordSeedBot.ts`, seed store/query helpers, `discordPublications.ts`, League tracking/queue queries; bot panel/seed/League workers and `league/panels.ts`.

**Work:**

- Add compact due/revision summaries; load rendering payloads only after scheduling admission. Memoize repeated connection/source/join/plan/status reads within one query/pass. Never reuse authorization-sensitive secrets across changed revisions.
- Seed reads fetch active/unsettled outbox keys and exact active publication bindings. Avoid loading all historical calls for a minute refresh. Keep existing delivered-terminal-run retention, pending delivery protection and bounded history access; prune orphaned publication metadata only after proving safe ownership/recovery.
- Cache one narrow League binding snapshot per attempt and update it after mutations. Persist migration retirement completion with an explicit repair command instead of querying every clan forever after migration.
- Subscribe to compact human-intake channel settings to reject unrelated messages locally. Revalidate writes server-side and retain cleanup for edits/deletes after intake channel changes.
- Separate intake backlog from active concurrency. Never silently drop an authoritative delete. Coalesce by message revision where safe; persist repair intent if the transient backlog cannot retain it. Expose saturation/age and retain documented mark-before-reply behavior.

**Done when:** no due panel causes no rendering/provider calls; one server shared by several panels has one immutable projection per query; seed refresh reads do not grow with terminal history; completed retirement causes zero normal migration reads; unrelated channel messages make zero intake settings queries; overflow/edit/delete recovery tests pass.

## D07 — Bounded downloads, images and memory

**Findings:** B07, B10.

**Where:** `public-panels/assets.ts`, `score-image.ts`, `worker.ts`, `events/match-image.ts`, `sync/roster-image-attachment.ts`, `sync/publication-files.ts`, `forum.ts`, dynamic worker/config/interaction maps and `discord-client.ts`.

**Work:**

- Share a small streamed download adapter with actual byte counting, deadline/abort, safe status/MIME handling and response cancellation. Apply it to every bot image/forum attachment path; Content-Length is an early rejection hint, never the only cap. Preserve roster download's three attempts/45-second total deadline and avoid replacing media after failed downloads.
- Keep native decoder pixel limits and enforce input/output byte budgets. Bound render concurrency and retained bytes. Reject oversized streams after at most one input chunk beyond the cap; release references promptly.
- Share same-key in-flight render/download promises. Use byte-accounted LRU/TTL for dynamic assets rather than clearing the whole map. A failed evicted promise may remove an entry only if it still owns that entry. Finite catalog caches and the 48-entry match cache are already count-bounded; measure them rather than labeling them infinite.
- Call image `forget` and prune due/paused/seed/language/registration/applicant state when panels/guilds disappear. Set limits/expiry for modal collectors and dynamic user state. Inspect SDK cache consumers before configuring sweepers; maintain required guild/member facts and the client member.
- Recognize actual content-addressed match filenames in attachment reuse. Share one immutable roster image/download per event attempt. Derive skip/migration decisions before media generation; never download an unused announcement/details branch.

**Done when:** missing/lying Content-Length, endless stream, body timeout, invalid MIME and huge dimensions stay within budgets; cancelled responses are disposed; concurrent equal requests render once; changed content renders once anew; mass panel creation/deletion returns owned cache entries/bytes to baseline. Identical match/map/roster images retain existing attachments on edits.

## D08 — Desired-state Discord effects and safe recovery

**Findings:** B08, B09, B10, B18.

**Where:** `sync/publication.ts`, `publication-errors.ts`, `owned-message.ts`, `sync/events.ts`, `events/announcement-sync.ts`, `scheduled-events.ts`, `events/squad-voice.ts`, `signup-thread.ts`, `forum.ts`, ticket/application adapters, shared publication store/use-case.

**Work:**

- Fix the lost Unknown Channel classification at the actual transport boundary. Confirmed old-channel absence is recoverable; unreadable/forbidden channels retain bindings. Preserve bot ownership, pending markers, fences, nonces, uncertain-create handling and explicit forced refresh.
- Reuse freshly fetched channel/bot member/owned message within one publication attempt when that does not bypass a required fresh check. Keep the ten-minute current-render shortcut; distinguish periodic existence repair from every logical refresh.
- Compare desired scheduled metadata, channel names/overwrites, forum starter/topic payloads and invitable state before PATCH. Preserve active/terminal scheduled-event lifecycle restrictions and reschedule replacement behavior.
- Treat 404/missing differently from timeout/403/503. Provision resources with durable remembrance before later operations can fail. Failed deletions retain cleanup IDs and due work. An incomplete archive search never authorizes a new create.
- Try stored forum IDs before active/archive enumeration. Paginate recovery with bounded resumable progress. Preserve private debrief remembrance before forum deletion and explicit decline behavior; do not prune unrelated private-thread members.
- Bound signup invitations and explicit removals, use safe gateway/durable deltas where possible, and retain bounded reconciliation. Existing signup tests forbid full thread-member enumeration: do not add it as an optimization.
- Record completion per effect/version. Intermediate forum persistence must not mark announcement, scheduled-event or roster work complete. Retrying an effect must not replay a successful create/DM. Reconcile all topic follow-up blocks and IDs when presets change; optimizing only the starter is incomplete.

**Done when:** two unchanged passes produce only deliberately scheduled freshness/existence checks; no duplicate resources on transient reads; interrupted provisioning/cleanup resumes; failed effects remain due; uncertain creates retain their markers; archived/deleted/foreign-owned resources are exercised through real adapters. Product copy accurately describes manual versus automatic repair.

## D09 — Efficient interaction reads and coherent configuration caches

**Findings:** B11, B14 and interactive portion of B03.

**Where:** `commands/guild-configs.ts`, `registration.ts`, `runtime/clan-language.ts`, `clan-kit.ts`, `application-emoji.ts`, `interactions/link.ts`, application cache/store/create/submission handlers, `event-buttons.ts`, `stats.ts`, `stats-runtime.ts`, `stats-live.ts`, panel interactions/player details, `player-reports.ts`, `tickets-report-members.ts`, `tickets.ts`, `match-recap-preference.ts`, `convex/clanPlayerHistory.ts` and matching backend projections.

**Work:**

- Single-flight cold config reads, bounded retry/backoff and coherent live-subscription versions. A late fallback response must not overwrite a newer subscribed config. Read language/style together. Applicant cache needs bounded eviction and independent applicant/definition revisions; eliminate full-map sweep per insertion.
- Registration admits one current run plus newest pending revision per guild. Respect stored signatures for ordinary startup, with explicit forced drift repair. Catch pre-registration config/build failures and release owned state correctly. Bound startup fan-out.
- Reuse application emoji provisioning instead of permanently caching an empty list in `/link`. Preserve its existing failure backoff.
- Open/wait for late signup forms outside the mutation lock; re-read current event and membership when committing. Bound duplicate queued clicks; calculate ranked eligibility once per immutable revision. Keep current ranked-draft caps/claims.
- Add narrow authorized panel-by-ID reads, retaining post-provider revision/privacy revalidation. Add narrow distinct-player search instead of building/scanning history for autocomplete. Empty-query history existence checks should not load all players from 60 sessions.
- Skip full support-member enumeration when the invitation policy/role set does not need it. Otherwise preserve complete enumeration and failure behavior. Coalesce complete report audience inventories only within an explicit fresh proof generation; cheap rejects precede expensive proof, and provider completion still triggers required validation. Never trust partial SDK caches for privacy.
- Validate legacy recap actions before guild discovery. Prefer known context or deterministic language fallback to serial cross-guild member probing. Preserve valid cross-guild semantics where documented.
- Preserve stats requester-scoped keys, current membership checks, four-build/25-second/page/weight/cache budgets. The expensive first build and uncancelled underlying queries still count against D03 budgets. The one-second acknowledgement guard is a response safeguard, not cancellation.

**Done when:** twenty simultaneous cold requests make one backend initialization; stale responses cannot regress cache versions; removed guilds/users do not leak maps; modal waits do not block unrelated committed actions; autocomplete uses bounded narrow work; privacy/permission revocation during provider load still rejects; disabled/no-support paths make zero unnecessary full-member fetches.

## D10 — Cache invalidation without blocking committed work

**Findings:** B12.

**Where:** `cache.ts`, `cache-delivery.ts`, fallback recurrence loop, attendance/notice/signup/self-group handlers, application provisioning and every `revalidateAppData` caller; shared authoritative mutation/outbox adapters and cache receiver where needed.

**Work:**

- Inventory every caller. Record invalidation intent with the authoritative write where freshness requires durable recovery, then dispatch coalesced guild/resource tags through a bounded delivery lane. Do not acknowledge delivery before committing the intent.
- Enqueue Discord reconciliation promptly after business success; do not hold the user's confirmation, signup lock or application lease through three HTTP timeouts. Preserve accurate “saved” versus “visible/processed” semantics.
- Consume/cancel HTTP responses, retain bounded attempt/deadline/backoff and deduplicate affected tags. Keep the receiver idempotent and authenticated. Recurrence creation must not await one multi-second invalidation per created event before processing due jobs.

**Done when:** website outage cannot hold business success or due-job progress hostage; repeated writes coalesce; crash/restart eventually refreshes the affected cached dashboard/public reads; no cross-guild invalidation; a permanently failed delivery is visible and repairable. Successful v1 writes and dashboard/bot writes invalidate the same applicable cached views.

## D11 — Correct bounded calendar recurrence

**Findings:** B15 and calendar portion of B01/B10.

**Where:** `src/lib/calendar-items.ts`, `src/domain/discord-publications/calendar-panel.ts`, bot calendar adapter, `sync/panels.ts`, `sync/work.ts`, shared recurrence consumers/tests.

**Work:**

- Seek directly to the first potentially overlapping occurrence using series frequency/interval and duration. Bound produced work by the requested window/output need, not by how old the series is. Preserve source occurrence identity and termination dates.
- Handle monthly short dates, nth/last weekdays, leap years, invalid date/interval input, multi-day overlap and existing timezone semantics explicitly. Do not silently change fixed UTC versus local-time recurrence behavior during a performance refactor.
- For the ten-row bot view, use a correctness-preserving nearest-occurrence merge/iterator or progressive horizon rather than eagerly expanding a full year. Filter categories before final limiting; manual items remain included. Build category/state lookup maps once.
- Separate unreadable panel policy from legitimate absence; backend failure must not enable legacy fallback. Replace broad timestamp fingerprints only after defining which fields actually change calendar output/freshness; tests currently require updatedAt changes to trigger refresh.

**Done when:** the 2010 weekly-series reproduction shows current occurrences; old series cost is independent of elapsed historical count; monthly/leap/overlap/category/empty/future tests pass for all consumers. Two relevant event changes coalesce into one calendar update and no policy read failure publishes through fallback.

## D12 — Failure-safe logging, errors and final closure

**Findings:** B16; closure for all B families.

**Where:** `log.ts`, `src/lib/system-logs.ts`, `error-reporting.ts`, `sync/role-failure-reports.ts`, all dispatcher failure paths, bot operational docs and CI scripts.

**Work:**

- Make structured normalization cycle-safe, redacted and bounded by depth/bytes. Ensure logging failure never throws out of queue cleanup, response handling or claim release.
- Reduce per-item informational logs to bounded summaries/counters. Reuse prepared statements; measure synchronous write cost. If needed, put database logging behind a bounded buffer/worker with explicit loss/flush policy, contention handling and retention/rotation. Do not introduce unlimited queues to make logs asynchronous.
- Deduplicate actionable Discord error storms by guild/resource/cause with TTL and recovery notices; retain distinct errors and no-DM-failure reporting policy. Bound error reporting itself through D03.
- Run the matrix below, scan all bot callers for remaining unrestricted Promise.all, timers, swallowed lookup errors, collect/history traversals, dynamic maps and timeout races. Classify each instance by actual bound/contract rather than deleting them mechanically.
- Update audit/implementation status with actual evidence. Mark each B family resolved or explicitly accepted with rationale. An unresolved accepted product decision is not a completed technical fix.

**Done when:** the full workload/fault matrix passes; all affected source paths and adapter tests are covered; documentation matches behavior; no abandoned migration or unowned worker remains. Source review completion alone is insufficient to close remediation.

## Workload and fault acceptance matrix

Numbers below are **proposed test workloads**, not claims about current deployment size or performance. Record hardware, runtime, dataset bytes and configured budgets with every measurement.

| Scenario | Workload | Required evidence |
| --- | --- | --- |
| Idle scale | 1/10/100 guilds, 0/10/100 panels each | Reads/bytes/calls per minute; zero unnecessary renders; bounded discovery/projection cost |
| History growth | 1k/10k/100k historical results, unchanged current data | Ordinary refresh work independent of archive size; resumable bounded repair/backfill |
| Membership burst | 100/1k/10k gateway observations; 1k role changes | Bounded active calls/queued bytes, preserved revision ordering, fair tenant progress |
| Simultaneous delivery | Manual reminders, roster changes, attendance and web submissions together | Aggregate limits hold across workers; admission before claims; attendance expires safely |
| Interactive burst | 20 cold config reads; 100 clicks/autocompletes/forms | One initialization per key, bounded collectors/queue; quick private acknowledgement; no duplicate commits |
| One slow tenant | Hold provider/Discord call while other guilds are due | Other guilds/heartbeat progress; no premature ownership release; bounded oldest-work age |
| Transport failure | 403/404/429/503, hanging body, dropped send response, send succeeds/mark fails | Correct missing/unreadable/uncertain classification, Retry-After respected, no blind duplicate create |
| Crash/restart | Before/after claim, reminder handoff, resource creation, remembrance, completion | Fenced recovery and explicit uncertain/manual states; no invisible expired processing rows |
| Memory soak | 10k panel/applicant create/delete cycles; oversized streams; changing images | Cache entries/bytes return to configured bounds; RSS stabilizes after warmup/GC; no retained abandoned collectors |
| Privacy change | Revoke roles/panel revision/audience while provider read is held | No password/report/player leak, fail closed on incomplete proof, scope remains correct |
| Logging outage | Busy/unwritable log store and repeated identical Discord failures | No business-path exception, bounded buffer/report rate, operationally visible degraded logging |

For normal-load acceptance, propose p95 interactive acknowledgement below one second and a ready panel reaching processing within its configured refresh interval plus a measured small allowance. These are starting SLOs to validate on the actual host, not established guarantees. Hard correctness gates are aggregate concurrency bounds, memory/stream caps, explicit authority deadlines, no lost durable work and no blind ambiguous replay. Record p50/p95/p99, max active work and oldest queue age; averages conceal starvation.

## Validation, rollout and handoff

- Iterate with focused `node --import tsx --test <file>` tests and existing fake ports. Use synthetic runtime configuration and disable local dotenv loading in isolated tests. Run `npm run bot:test`, affected shared/backend tests, `npm run test`, `npm run typecheck` and relevant Convex bundle checks before finishing backend work. Existing unrelated baseline failures must be reported precisely; do not silently waive them.
- Run Prettier only on changed TypeScript/TSX. Update relevant docs and wiki pages for changed behavior. Verify generated contracts using repository tooling; never hand-edit generated Convex bindings.
- Add indexes/optional state before switching readers. Backfill through durable bounded cursors. Deploy compatible readers/writers, drain or explicitly reconcile old claims, then enable new scheduling incrementally. Avoid running unfenced old and fenced new workers against the same queue. Never let rollback erase pending/uncertain publication state.
- Use feature-specific rollout flags only where needed, with an owner/removal date. Observe backlog age, resource creation rate, Convex bytes, event-loop delay and retained cache bytes. Revert admission/concurrency settings independently from durable schema/state; retain the ability to inspect/repair uncertain operations.
- Follow AGENTS.md's deployment requirements for an authorized implementation. This audit authorizes no production deployment, data migration or Discord operation. Record target and outcome when such work is subsequently authorized.
- Final handoff must include B01–B18 closure, D00–D12 status, changed callers and contracts, regression evidence, load measurements, migration completion, deployment/rollback evidence and remaining limitations. Do not promise that no unknown defect can exist.

Copyable continuation task:

> Read AGENTS.md, the bot README, discord-bot-performance-audit.md, discord-bot-implementation-plan.md and the review ledger. Verify hashes/tree changes. Execute the assigned D package through every listed consumer, preserving authority and delivery semantics. Add regressions at actual adapters and update the B-family closure register. Do not mark the entire plan complete until every package and workload/fault acceptance gate is satisfied. No unrelated application refactor or unauthorized production operation.
