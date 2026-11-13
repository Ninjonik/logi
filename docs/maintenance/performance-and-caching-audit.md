# Performance, pagination and caching audit

Date: 2026-11-11. Evidence: static caller traces and repository-wide query discovery. No production profiling or load tests have been run. Findings describe work performed by the code; production latency/cost magnitude remains unmeasured.

The later exhaustive bot source/test review is documented separately in [the bot performance audit](discord-bot-performance-audit.md). Its [D00–D12 remediation plan](discord-bot-implementation-plan.md) supersedes the sampled bot recommendations here and includes backend dependency findings, offline reproductions and workload/fault acceptance. Other application areas retain the coverage limits below.

The mechanical inventory in `audit-query-inventory.json` scans 694 non-test TS/TSX files under Convex, infrastructure, lib and bot, finding 269 collect() calls and 52 direct collect chains without withIndex(). An index narrows a scan but does not bound it. Conversely, scanning a small, bounded catalogue is not automatically a defect. Resolve variable-built query chains before relying on these counts.

## P01 — Dashboard context is a large per-viewer aggregate

`convex/serverContext.ts:buildServerContext` collects every clan event, preset, stratmap, group, assignment and calendar item, then filters games in memory, loads a roster per event, and expands shared-match membership/people per applicable event. `src/lib/read-models/server-context.ts` caches it per server/user/game/admin mode for 24 hours. Many write guards call its uncached equivalent to obtain an admin boolean, paying for the same data assembly.

Consequence: history growth increases page/auth-read cost; cold viewer/game combinations repeat almost the same clan payload; invalidating one context tag evicts many viewer combinations. Large stratmap state and old roster content are included even when the screen does not need them.

Change: separate a small live authorization/workspace shell from feature reads. Lists use tenant/game/date indexes with database cursors; detail pages read one resource; calendar uses a bounded date window; editor selectors use compact projections. Cache shared non-secret clan projections separately from live viewer authority. Do not cache authorization or share manager-secret payloads with members. Update every context caller, not just the overview screen.

Acceptance: authorization reads fetch identity/session/access/guild facts only; growing historical events does not grow those reads or a single detail payload; list/calendar read counts and bytes are bounded. Test warm cached access after revocation and game/tenant isolation.

## P02 — Public directory pagination happens after complete collection

`convex/publicProfiles.ts:listClans` reads all guilds, all assignments/events per guild, derives eligibility, sorts, and slices using a numeric offset. Every requested page repeats the work. A new insertion can shift offsets. `searchClans` pages search results first but still collects each candidate clan's events/assignments to establish eligibility.

Change: materialize narrow per-clan/per-game discovery facts (public eligibility, active-member count, result availability and sort key). Maintain changes from authoritative writes with reconciliation for repair; query/paginate the eligible projection. Preserve the deliberate rule that ghost competition teams must not hide real clans. Do not simply paginate guilds before filtering and recreate that bug.

Acceptance: first/deep pages have comparable bounded work; pages traverse eligible rows without duplicate/skip under the declared consistency model; excluded clans do not consume the whole page; sparse search pagination terminates correctly.

## P03 — Public match detail performs global identity/stat scans

`publicProfiles:getMatch` loads all playerStats and users to resolve identities for one match. `src/lib/read-models/public-profiles.ts:getPublicMatch` intentionally bypasses payload caching so post-import account links appear immediately. A cache miss is therefore not the only trigger: normal detail requests repeat scans.

Change: indexed platform-to-account lookup and event-player relation projection; resolve only player IDs belonging to this match. Preserve legacy-format/name fallback through explicit migration/event-scoped lookup with collision rules. Cache immutable match facts separately from mutable identity bindings using a binding revision if needed. Do not reintroduce stale account links by blindly caching the current full response.

Acceptance: adding unrelated users/stats does not increase one-match read work; late linking/unlinking and renamed/duplicate names remain correct and private data stays redacted.

## P04 — Projection-filtered match feeds load all history

`publicProfiles:listMatches` uses database pagination without arbitrary filters, but switches to collecting all events and projecting matches when filters are supplied. Filtering is a performance switch hidden behind the same API/UI operation. The public read-model cache keys include cursor, filters and games with a 24-hour TTL and broad publicDiscovery tag.

Change: enumerate supported filters and provide indexed/materialized searchable fields. For residual computed filters, use bounded scanning with an opaque continuation and explicit possibly-short-page contract, or a dedicated projection index. Never claim total count without bounded/materialized evidence. Preserve existing paths/field semantics; document any pagination contract adjustment.

Acceptance: every filter combination has a read/byte budget, malformed cursors fail predictably, sparse matches progress, and filtering does not scale with complete history.

## P05 — Player history loads all matches before returning a small window

`loadPublicPlayerMatches` reads every stat document for the user, expands every matches map, fetches the event for each entry, sorts, and then callers select 30 recent matches or a comparison window. `playerStats.matches` grows within a document; collected-stat updates rewrite that map. Point indexes on userId do not bound per-document size or history processing.

Change: normalize event/player match records behind subject/game/endedAt and event/player indexes, retaining a bounded aggregate for totals. Migrate idempotently in pages, dual-read only during a documented transition, compare totals and retire legacy writers. Keep the older-match detail lifecycle and ten-match comparison, not just a recent-only shortcut.

Acceptance: recent/window reads are bounded; historical detail is addressable; long-lived players do not approach document-size/write amplification problems; replay/revisions/identity merge and retention remain correct.

## P06 — Recent dashboard summary scans unrelated player statistics

`serverDashboard:getRecentMatchSummaryInternal` collects every event in a clan then sorts/slices ten, and collects the global playerStats table. Wardogs loops those docs for each recent event. Cached for 24 hours by server-context/matches tags, it becomes costly on cold reads or frequent invalidation.

Change: indexed recent result projection plus event-scoped player metrics, then resolve only top players. Share pure result/metric rules with public projections, without forcing identical response shapes.

Acceptance: ten-match summary never reads global stats; work depends on ten matches and their participants, not all clans/history.

## P07 — Performance-history refresh repeats the clan event walk per player

`performanceHistory:refreshHistories` refreshes the guild then serially calls refreshPlayerForGuild for each target; each player call invokes performanceEvents again. Wardogs background refresh currently selects every clan member. Stored output is bounded to ten matches per game, but input/rebuild work is not. Changed-output comparison avoids unnecessary writes, not repeated reads/computation.

Change: derive affected participants from the committed result/revision; batch bounded event/player projection work; coalesce duplicate refresh requests by clan/game/source revision. Keep transaction sizes bounded with durable continuation, and ensure changes arriving during a refresh trigger the next revision. A full manual rebuild remains a separate resumable repair action.

Acceptance: one import touches affected player histories; unchanged import does not trigger full-clan rebuild; overlapping refreshes converge; a repair can resume after failure without recomputing every completed batch.

## P08 — Bot global subscriptions amplify unrelated writes

`discordSync:listGuildCacheSnapshot` watches complete guild/config/group/calendar/preset tables. `GuildCache.applySnapshot` repeatedly filters complete arrays per guild and serializes signatures. `discordCommands:listGuildConfigs` watches all configs/registrations and queries panels per clan. Application definitions also watch all configs and look up guilds. Changing one large config can recompute several platform-wide readers. `listEventSyncIndex` is time-relevant, but includes whole roster contents rather than just revision facts.

Change: separate compact revision/config projections from large payloads; fetch affected clans/events by ID. Use maps/grouping once per snapshot before per-guild assembly. Review config write frequency and registration feedback; avoid changing definitions for heartbeat/delivery-only updates. Keep current shared event relevance and historical-window rules. Subscription partitioning needs measured tradeoffs: replacing one subscription with thousands is not automatically better.

Acceptance: a one-clan configuration write does not force full payload reconstruction for every clan; roster index sends only fields needed for change detection; delivery/heartbeat changes do not trigger command re-registration unless definitions change.

## P09 — Startup recovery/backfill still walks full job/event tables

`scheduledJobs:recoverQueue` collects every job and fetches its event. `backfillMissing` collects every event and then jobs/reminder facts per eligible event. The fallback worker runs these at startup, so restarts repeat broad repair work. `eventRecurrence:generateDue` limits created events but reads all weekly series and future occurrences; a write cap is not a read cap.

Change: indexed expired-lease recovery and bounded cursor-based migration/backfill with durable version/checkpoint. Separate periodic repair from ordinary startup readiness. Recurrence needs a due-series cursor/fairness marker and bounded horizon reads so early series cannot monopolize passes. Preserve idempotent scheduling and explicit old-deployment migration behavior.

Acceptance: startup work has a fixed budget; abandoned jobs recover; historical growth does not dominate restarts; all due series progress under load; no duplicated reminders/occurrences.

## P10 — Metadata summary refresh still rescans full tenant data

`clanMeta:scanClanMeta` collects ten tenant collections and one roster per event to count them. getClanMeta is a narrow read and refresh is throttled to roughly once a minute, which is good. Nevertheless an actively polled unchanged clan can repeatedly rescan all history and large payloads.

Change: dirty revision/transactionally maintained compact counters or bounded recomputation. Recompute only when relevant cardinalities or membership classifications change; do not invalidate counts for irrelevant heartbeat/content-only edits. Preserve key authorization, per-game semantics and off-request refresh; avoid one shared hot document write per API request.

Acceptance: repeated meta reads on an unchanged clan cause no repeated full scans; create/delete/move/replay updates counts correctly; reconciliation repairs drift in bounded batches.

## P11 — Broad invalidation causes expensive cold-read churn

`clan-write-cache.ts` invalidates nearly every clan feature, the global user/image/discovery families, and several guessed entity tags from a generic id. Public search/profile/list caches share publicDiscovery. User-by-ID aggregate reads use global users tag. Broad correctness-oriented tags are currently intentional, but combined with P01–P07 increase unrelated recomputation.

Change: typed affected-resource/cache descriptors; entity/tenant/game revision tags; immutable facts separate from dynamic identity/access. Preserve all aliases and shared-clan dependencies, deletion identifiers and idempotent replay. Keep successful writes successful when invalidation fails; add bounded recovery and observability before narrowing tags.

Acceptance: a group edit leaves unrelated match/stat/image reads warm; result/identity/delete changes refresh every affected public/dashboard projection; no stale access after revocation; failure recovery does not repeat business writes.

## P12 — Polling discipline is inconsistent

The Warcon scoreboard uses serial timeout scheduling, visibility checks, aborts and Retry-After. Event delivery is bounded to 24 checks. In contrast, web application submission uses async setInterval every 2.5 seconds without abort/in-flight guard/visibility/backoff; league tracking uses a 15-second interval whose load can overlap and update after cleanup. Panel overview pauses while hidden but can retain prior server state and lacks abort-on-unmount/server-change. Several editors independently fetch Discord metadata.

Change: one small polling utility with configurable cadence/visibility, abort/in-flight discipline, scope identity, backoff and Retry-After; do not build a new data framework. Keep finite workflows finite and stop at terminal state. Deduplicate metadata within a clan/page using existing hooks/context, keeping live authority separate from metadata caching.

Acceptance: slow responses never overlap for one scope; hidden tabs pause; unmounted/previous-server responses cannot update current UI; failures back off; terminal states stop; metadata is fetched once per intended freshness window.

## P13 — Narrow lookups and counters still have complete-table implementations

`discordMembership:getMembershipApplicationByAssignment` collects all application threads to find one assignment. `publicStats:overview` reads all users/guilds/events for counts. `users:listUsers` reads all users even when guildId is supplied (that argument changes nickname presentation, not filtering). `playerStats:listUserIdsForEvents` and dedupeMatchesForEvents scan all player stats for a small event set. Several guild visibility/default-workspace paths scan all guilds. One-off migrations also scan globally; they have different urgency from request paths.

Change: assignmentId index for application lookup; compact public counters; explicitly named global versus scoped user directory queries; event-player relations for event lookups/dedupe; indexed membership/admin workspace discovery. Make one-off migrations resumable and bounded instead of moving their scans onto hot paths. Audit all callers before changing listUsers semantics.

Acceptance: unrelated table growth does not increase point lookup/event repair work; exact identity/eligibility rules remain intact; genuine global directory reads are paginated.

## P14 — Lifecycle cleanup fan-out needs explicit volume bounds

Event deletion loads all child records across many tables and recursively deletes shared projections in one transaction; group removal scans all clan assignments. These preserve atomic correctness but can exceed a transaction budget for large histories. Game history completion deletes/reinserts all kill-event rows whenever killEvents is supplied, independently of whether the canonical session changed.

Change: impose justified per-resource bounds or tombstone plus durable bounded cleanup with reads/writes respecting deletion state. Do not split atomic invariants casually. Skip unchanged kill-event replacement using source digest/canonical comparison; use bounded child batches when payload limits warrant it. Test concurrent attach/edit while deletion runs.

Acceptance: high-volume deletes/repairs finish resumably, no new reminders/publication after tombstone, no orphaned private data, unchanged history revisits do not rewrite identical child rows.

## P15 — Cache refresh is an availability-sensitive operation

The two dashboard cache endpoints accept any signed-in user and caller-selected resource scope (A18). That exposes expensive aggregate/image regeneration to unrelated users. Narrow authorization before optimizing tags. Add scoped rate limits and stop redundant client invalidation when the write gateway already owns it. Test unauthorized churn is rejected without touching cache or querying unrelated resources.

## P16 — Bounded maintenance can starve later records

`gameHistoryRetention:pruneDue` always takes the first 500 settings and has no continuation. Settings beyond that prefix do not receive its daily prune. `housekeeping.ts` scans a fixed prefix of signup activities, roster-change requests and seed runs and keeps rows whose parent/outbox still requires retention. A full prefix of retained rows prevents later eligible rows being reached; rescheduling only when something was deleted avoids a busy loop but does not solve starvation. `leagueDiscoveryQueue:status` returns only 100 enabled settings, while related activation/interval helpers inspect fixed prefixes of settings/panels. Confirm admission limits at writers; where those global caps are not enforced, they are silent coverage ceilings.

Change: use persistent cursors or due indexes with fair scheduling and bounded parent/child work; advance past retained rows, preserve a stable cutoff, and retry a stalled subject without blocking unrelated tenants. Keep actual product caps enforced and explicit. Test 501 retention settings, a fully retained first batch followed by expired rows, a failed oldest subject and more than 100 enabled tracking workspaces.

## P17 — Attendance confirmation amplifies one web request into repeated backend calls

`rosters/[rosterId]/confirm-meeting-attendance/route.ts` waits up to 45 seconds and queries request status every 250 ms: approximately 180 status queries per slow request, apart from authorization and bot work. It does not stop on caller disconnect. The worker already has a durable request and expiry.

Change: return a queued request ID promptly, expose a scoped status read, and use bounded serial polling/subscription with terminal states, aborts and backoff. Keep the backend expiry check that prevents late attendance updates. Deduplicate equivalent concurrent requests as appropriate. Test a missing bot, slow bot, disconnected caller, duplicate clicks and expired work; measure status calls per completed/failed request.

## P18 — Image caches need content identity, limits and miss coalescing

Public OG accepts arbitrary `v`, defaults to `current`, caches by that caller value in a count-limited process LRU and always emits a year-long immutable response. The renderer loads **current** content on a miss rather than a historical snapshot of that version. Roster images similarly accept arbitrary `cb`, return cache hits before checking publication state, and regenerate current content on a miss. Old URLs can therefore have inconsistent pixels across processes/cache eviction; a no-version public OG URL is immutable even as content changes. Unpublishing cannot revoke already-public browser/CDN bytes. Document that public disclosure contract explicitly.

Change: distinguish canonical current URLs (short/revalidated caching) from genuine immutable content-addressed artifacts, validate/bound version parameters, include all content/renderer/locale dependencies, and define publication/removal behavior. Add per-key single-flight and a global render concurrency/queue bound, byte as well as entry limits and reasonable pixel/layout bounds. Existing match/panel image handlers have in-flight coalescing patterns worth reusing. Keep credentials excluded from public render models.

`og/[kind]/[id]:toDataUrl` reads the entire remote body before checking its 1 MB limit and lacks a timeout; `loadRosterImageAsset` limits decoded pixels and has a timeout/host allowlist but no streamed byte bound. Bound before full allocation. Do not replace the stronger roster asset origin/path policy with unrestricted fetch. Test concurrent misses, eviction, no-version freshness, forged/long versions, post-unpublish behavior, oversized/slow images and a maximum-sized roster.

## P19 — OAuth repeats live Discord checks and has unbounded request fan-out

The Discord callback checks bot presence for administrative guilds while building session guilds, then repeats checks while building managedGuilds. `isBotInsideDiscordGuild` performs `no-store` network calls without deduplication (it does have a 10 s timeout). Several other direct Discord helpers have no timeout, and guild-member import walks all 1,000-member pages in one web request. Training completion dispatches per-participant role/DM work through an unrestricted Promise.all after the authoritative mutation.

Change: one callback-local presence map with bounded parallelism; explicit external-call timeouts/retry-after handling and result classification; page/checkpoint large imports as jobs. Queue retryable training effects with stable operation identity, bounded delivery and truthful progress. Do not persistently cache permission decisions just to reduce network calls. Test many guilds/members/attendees, one slow request, Discord 429, partial delivery and retry after the database commit.

## P20 — Mutation wrappers hide substantial dependent work

`integrationMutation.ts` intercepts database writes, rebuilds identity-related assignment projections and synchronizes shared matches. Every touched assignment causes all events of each affected clan to be collected, then open shared events are selected in memory. Ordinary membership edits can therefore pay for the clan's full event history, beyond the visible use-case calls. Shared synchronization and people/change-feed effects must stay transactionally consistent.

Change: document the wrapper's effect contract and measure full transaction work. Query only eligible shared events via appropriate indexed state/projection, coalesce affected hosts and skip unchanged relevant fingerprints. Avoid repeated synchronization caused by writes generated during projection. Retain feed sequence/revision correctness and local attendance propagation. Test a tiny edit with large unrelated history, multiple assignments of one clan, shared guests and replay/no-op updates.

## P21 — Cursor pagination can still scan large sparse filters

`publicApiReads:getClanResourcePage` has true cursor pagination, but updatedSince is a `.filter` behind a tenant-only index and options specify numItems without maximumRowsRead/maximumBytesRead. A recent timestamp after a long unchanged history can scan many records to return a small page. Game filtering after a database page can produce empty pages with a continuation; clients must not stop because items is empty. This is distinct from offset-in-memory pagination.

Change: choose compound indexes consistent with the promised order, or introduce a versioned cursor contract/projection that preserves established createdAt ordering and handles changes explicitly. Set read/byte budgets and return continuation for sparse pages. Prefer the existing change feed for continuous synchronization rather than repeatedly sweeping updatedSince. Test sparse tails, zero-match pages, legacy game scope, removals and continuation under concurrent writes.

## P22 — Process memory and hard limits need explicit semantics

`public-api-memory.ts` begins pruning above 10,000 entries, but only expired entries are removed. A stream of distinct live buckets can keep it growing; each subsequent call scans the entire map. Middleware keys arbitrary bearer strings before authentication, so invalid credentials can create distinct buckets too. The single-web-instance assumption is documented and is a valid current deployment choice; a distributed service is not automatically required.

Change: add a genuine capacity/eviction strategy with bounded maintenance cost plus an ingress/IP budget for invalid credentials, while preventing eviction from trivially resetting an attacker's limit. Verify proxy-owned forwarded headers and document multi-instance limits. Do not reintroduce a contended Convex write for every request. Test many live unique buckets and work per call, not only expired-entry pruning.

Other fixed-prefix reads require a completeness contract: `competitions:listPublicSlugs/adminList` take 200 before filtering/sorting; public competition expansion loads full detail per slug; join-slug allocation reads only 5,000 existing slugs rather than checking each proposed candidate through the slug index. Replace silent truncation with enforced product capacity, pagination/hasMore or an exact indexed check. Do not mistake a fail-closed compatibility guard such as Discord legacy linking's explicit 5,000-user rejection for silent truncation.

## P23 — GitHub synchronization repeats repository/history walks

`infrastructure/github/issues.ts:findOrCreate` walks every issue page when establishing a new report link; `commentOnce` loads all comment pages for each status synchronization; refresh loads all comments before retaining the last 100. Individual requests have a timeout and pages of 100, but a whole walk has no page/time budget or checkpoint. A mature repository/long discussion makes one small update expensive; the per-tick report count does not bound upstream requests per report.

Change: persist established issue identities immediately (already done), reserve full marker reconciliation for uncertain creates, and checkpoint/bound recovery walks. Prefer provider-supported incremental reads when their correctness is verified; retain markers and do not blindly recreate an uncertain issue/comment. Enforce aggregate time/page budgets, cooldown and retry-after behavior, and fetch only the required discussion window where the API contract permits it. Test many pages, a lost create response, marker beyond the first page, 429 and interrupted recovery.

## Measurement and rollout requirements

Before implementation, capture synthetic fixtures for many clans, long event histories, multi-game memberships, long-lived players and sparse filters. Measure database rows/bytes read, writes, payload bytes, recomputation frequency, concurrent external calls and p50/p95 where a real disposable runtime is available. Never invent production timings.

For point reads and fixed pages, unrelated historical growth must not increase rows read; for repair jobs, every invocation must have explicit cursor/read/write/time budgets and eventual-progress tests. For caching, measure both hit ratio and invalidation scope, and test correctness first. Retain proven provider leases, unchanged-payload comparisons, bounded history pages, off-request usage telemetry and key reauthorization. Do not replace them with blanket caching or lower polling intervals.
