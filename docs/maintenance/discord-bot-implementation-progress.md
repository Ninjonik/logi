# Discord bot implementation progress

## Current durable handoff and recipient resume checkpoint (2026-11-12)

Only this checkpoint and its remaining-work list are current; older sections are
historical snapshots and can contain TODOs that have since been implemented.

## Application/ticket recovery continuation (2026-11-13)

Upgraded application-decision workers receive a claim token and must present it
when releasing or closing the application. A stale or legacy attempt cannot
clear a newer fenced lease or close a later decision. Submission workers likewise
carry a claim token through release and application-record creation, so a stale
worker cannot release or consume a later claim's draft. Legacy decision claims
remain releasable for a backend-first rollout.

Membership decisions now use one transaction for assignment changes, cross-game
movement, dependent projections/rosters, managed-role intent, closure and recovery
intent. Submission membership provisioning remembers its assignment transactionally.
Ticket records are idempotent by their accepted thread ID, and concurrent close
losers do not repeat Discord effects.

The membership/ticket journal covers creates, cards, invitations, confirmation and
decision DMs, transcript remembrance and thread changes. Restart workers use
renewable fenced leases, indexed bounded batches and five-attempt backoff. They
reuse confirmed effects, continue untouched steps, and preserve uncertain sends
and creates for evidence-based operator reconciliation. Record-response failures
retain accepted resources rather than deleting a possibly committed thread.
Workflows cannot complete while expected steps are missing. Current invitation
policy and bot ownership are rechecked during repair; later lifecycle transitions
supersede opening work. Legacy bot ticket closers do not create replayable intents.

The operator CLI documented in the bot README exposes pending/review operations,
effect receipts, reconciliation audits, pre-upgrade tickets/applications and
manual/roster/automatic reminder receipts. Resume preserves uncertain receipts;
resolutions require evidence and cannot override an active owner. Unresolved send
evidence is protected from retention cleanup. DM uncertainty has explicit copy in
all five supported bot languages. Scheduled retry-write failures are now logged.

Live test-guild crash testing and host shutdown-grace verification were skipped at
the user's request. Local validation and backend rollout results will be recorded
after the final checks; no bot host restart is performed by a Convex deploy.

Implemented in this focused pass:

- Scheduled completion atomically writes `discordScheduledDispatches` before
  deleting the scheduled job. The main process claims and heartbeats that durable
  inbox, waits for queued score/event/reminder work, then acknowledges with the
  current owner token. Lost worker messages or process restarts do not erase work.
  Surfaced processing failures retry with backoff; shutdown stops new claims and
  drains the active acknowledgment. Legacy job completion remains compatible.
- Durable plans and per-effect receipts cover manual reminders, roster-change DMs,
  roster-request digests/mentions, signup reminders and attendance reminders.
  Confirmed sends are skipped, untouched recipients continue, and an accepted-but-
  unrecorded/ambiguous send remains uncertain rather than being blindly repeated.
  Proven pre-send lookup failures can reset their receipt and retry safely.
- Audience plans are frozen and intersected with fresh eligibility. Game scope,
  local roster scope, responses, acknowledgments and absence checks remain. Signup
  reservations retain a durable resume marker but still recheck current deadline
  and enabled statuses; confirmed attendance receipts rebuild missing logs.
- Resumable request expiry requeues work. Transient manual/roster failures back off
  for one minute, with up to five request attempts; retry polling runs independently
  of subscription changes. Final counts derive from receipts, including earlier
  confirmed sends. Uncertain sends are excluded from confirmed closed-DM lists.
- New resumable rows cannot be claimed by older runtimes. Legacy interrupted runs
  without receipts are not replayed: who received those sends cannot be inferred.
- Bounded retention visits five expired plans and up to 100 receipts per plan per
  minute. Finished scopes are eligible after 30 days; active/retryable owners and
  active/recent automatic events retain their receipts. No whole receipt-table scan.

### Remaining release work

1. Verify and deploy this application/ticket recovery continuation, then replace
   the bot runtime without overlapping old and new workers.
2. Broader secondary Discord effect reconciliation outside applications/tickets,
   including legacy nested handlers that
   report some failures without propagating them. The durable acknowledgment proves
   the queued workflow returned; it does not certify every inherited effect family.
3. The operator CLI covers this recovery scope. A dashboard reconciliation UI and
   broader effect-family adoption remain separate work. Exactly-once delivery
   across a lost Discord confirmation is not claimed.
4. Live Discord/backend crash tests, bot host termination grace of at least 130
   seconds, and the bot runtime rollout. Offline tests and a backend deploy do not
   substitute for those operational checks.
5. Calendar cross-consumer closure and remaining D00-D12 performance/maintenance
   packages remain in the comprehensive plan. No D package is declared complete.

**Validation: 4,088 tests passed with zero failures/skips; typecheck, lint, formatting, production build and all Convex/bot runtime bundle checks passed. Final backend deployment to `https://convex.igportals.eu` succeeded, with eight new indexes and generated bindings refreshed by tooling. No bot runtime restart or live Discord acceptance was performed.**
Validation details and the required final backend deployment result are recorded in the
[release report](discord-bot-release-readiness.md). Public API shapes and runtime
permission checks are preserved; this is internal bot delivery infrastructure.

## Previous scheduled-claim recovery checkpoint (2026-11-12)

The maintainer explicitly approved backend deployment to
`https://convex.igportals.eu`. The previous request-lease backend deployment
succeeded, including the two request-lease indexes and generated bindings.
No Discord bot process was restarted by this work.

This continuation fixes scheduler ownership and expiry recovery:

- Upgraded fallback workers opt into attempt fencing. Completion and release
  require the current attempt, so a late worker cannot delete or release a newer
  claim. Old bot claims remain compatible during backend-first rollout.
- Heartbeats renew the admitted batch, including jobs waiting behind a slow job.
  Every reconciliation first verifies ownership; stale completion cannot enqueue
  the old attempt's reminder work. Failure to release one job does not abandon
  the rest of the batch.
- Expired claims are recovered on every minute tick, not just at startup. An
  indexed expiry batch and one 100-row cleanup page replace the full schedule
  table read; a cursor continues cleanup across ticks. Missing legacy claim
  timestamps are included in recovery.
- Local validation: **4,074 tests passed**, zero failures/skips (72.18 seconds).
  Non-incremental typecheck, focused ESLint, formatting and Convex/bot bundles
  passed. The production build passed, and the final scheduler backend deployment
  to `https://convex.igportals.eu` succeeded, including the new
  `eventScheduleJobs.status_claimedAt` index. Bindings were regenerated by tooling.
  No bot restart or live Discord acceptance was performed.

### Remaining crash-recovery release gates

1. **Durable worker-to-main handoff:** scheduled jobs are still completed before
   the parent receives/processes the in-memory notification. An outbox and real
   adapter acknowledgment/restart tests are required. Attempt fencing does not
   close this gap.
2. **Recipient-level delivery recovery:** persist per-effect receipts/reconciliation
   and safely resume recipients never attempted. Manual/roster requests currently
   terminate as failed/uncertain after interruption; scheduled reminder reservations
   still cannot safely resume a partly sent batch.
3. **Applications/tickets:** shared atomic membership decisions and durable thread
   provisioning/closing recovery remain; owned shutdown alone does not solve them.
4. **Secondary Discord effects and acceptance:** remaining provisioning/follow-up/
   cleanup correctness, supervisor termination grace (at least 130 seconds), real
   Discord/backend fault/restart tests and calendar cross-consumer closure remain.

The D00-D12 program and production acceptance remain incomplete. This is a focused
continuation, not a claim that every release blocker is finished. Keep the earlier
checkpoint below as historical context; this section is authoritative.

## Previous crash-recovery and shutdown checkpoint (2026-11-12)

This checkpoint supersedes the older release-blocker status below. This focused
pass implements owned shutdown across runtime producers and conservative recovery
for manual reminder / roster-change requests. It does **not** close the full D04
program or certify production acceptance.

Implemented:

- SIGTERM/SIGINT stop intake, cancel prepared-modal collectors, stop recurring
  workers and registration timers, drain actual active/startup promises, then
  close Discord and permanently close Convex. Partial startup failures are isolated
  and retain registered cleanup. Late startup completion is stopped and drained.
- Sync, request workers, web submissions, League intake, seed/panel/report/managed
  role/deletion workers, migration, emoji, platform status and team-notification
  loops expose owned drains. The fallback thread receives a cooperative stop;
  unexpected exits restart only while the main runtime accepts work.
- Manual reminder / roster-change claims support an opt-in token and renewable
  lease. Each delivery effect verifies ownership; stale completion/failure cannot
  replace another owner's result. Optional schema fields and legacy claim behavior
  permit backend-first deployment without breaking the old bot's completion calls.
- An indexed bounded startup/minute sweep converts expired processing requests to
  failed `delivery_uncertain`. This prevents permanent processing and blind batch
  replay. It does not prove which recipients received messages or resume unsent
  recipients. Unknown outcomes are not added to confirmed closed-DM lists.
- Shutdown has a 120-second unsuccessful-exit deadline. The host must allow at least
  130 seconds of termination grace; otherwise these drain guarantees cannot hold.

### Remaining release gates after this pass

1. **D04 recipient-level recovery and scheduled handoff:** durable per-effect
   receipts/reconciliation, unsent-recipient resume, scheduled job parent/worker
   handoff and automatic-reminder partial-run recovery remain unresolved. The new
   conservative failed/uncertain terminal state is not exactly-once delivery.
2. **D04 applications and tickets:** atomic membership decisions and durable
   submission/thread provisioning/closing recovery still need implementation and
   real-adapter crash tests. Draining their tasks does not make their multi-step
   workflows transactional.
3. **D08 secondary effects:** finish the remaining forum/follow-up/provisioning
   and cleanup failure paths; preserve IDs and avoid falsely completed versions.
4. **Operational acceptance:** verify supervisor termination grace and test real
   Discord/backend permissions, signals, restart and ambiguous-send behavior in a
   test guild. No live Discord calls have been made.
5. Remaining calendar cross-consumer closure and the larger performance packages
   remain as listed in the earlier checkpoint and comprehensive plan.

**Local validation: 4,066 tests passed with no failures/skips; typecheck, lint, formatting, production build, bot bundles and all Convex runtime bundles passed.**

**Historical deployment gate (resolved by explicit approval and successful deployment above):** automatic approval review rejected `bunx convex deploy` to `https://convex.igportals.eu` before execution because explicit approval for modifying the shared backend was absent. Approval is requested; no backend deployment or bot restart occurred. The new bot must wait for that backend deployment. Supervisor termination grace and real Discord acceptance remain unverified.
Validation details and the mandatory Convex deployment result are recorded in the
[release report](discord-bot-release-readiness.md). Do not describe the remaining
release gates above as fixed. The old archived implementation remains an archive,
not part of this active protocol.

## Previous bounded release-blocker checkpoint (2026-11-12)

Historical status at that checkpoint. Older checkpoints below describe earlier or archived work; do not infer current runtime integrations from them. **The full plan is still incomplete, and production release approval is not established by offline tests.**

Completed in this pass:

- Guild sync warns after 20 seconds but retains ownership until the real operation settles. A timeout no longer releases sequencing while Discord mutations continue. A genuinely hung dependency still blocks its lane; cancellation and full shutdown supervision remain below.
- Roles, scheduled-event lookups, squad voice resources and primary forum-channel recovery distinguish explicit missing-resource codes from permission/network/server failures. Failed role/voice cleanup retains bindings for retry. A failed scheduled-event cancellation propagates instead of acknowledging success. Scheduled lifecycle reporting reflects observed state after failed edits.
- Successful attendee-role provisioning is saved before attempting reserve-role provisioning. Existing roles are fetched once each instead of twice. A Discord success followed by a persistence failure remains an uncertain effect; durable reconciliation is not solved.
- Shared logging handles cyclic objects/error causes, bounds context traversal/text, redacts credential fields, isolates storage/console failures, reuses its insert statement and backs off failed storage writes for 30 seconds. Reads of the log administration UI still surface storage errors. Arbitrary credentials embedded in free-text messages are not automatically redacted; callers must not log secrets.
- Calendar refreshes are coalesced once per affected clan per cycle, after event effects. Guild-indexed event lookup replaces repeated scans of all clans' events. Context reads run at concurrency four, and calendar data is read fresh rather than cached across cycles.
- Regression checks cover unreadable calendar policy, late operation failure, transient lookups, failed cleanup, partial role provisioning, calendar coalescing/new work/multi-clan isolation and bounded context reads.

### Remaining release gates (priority order)

1. **D04 critical workflow fault/restart coverage and recovery:** reminders and first-send effects can remain ambiguous across crashes; membership decisions and ticket provisioning/closing still need the planned transactional commands and durable ownership. Reproduce existing failure paths through actual adapters, implement bounded recovery/claims with migration tests, and explicitly handle uncertain sends. Do not apply the archived patch as a finished solution.
2. **D01/D03 lifecycle and ownership:** drain all workers and membership event tasks on shutdown, isolate startup failures, stop intake/collectors before closing clients, and prevent client recreation. The guild-step timeout fix is not whole-process supervision or aggregate admission. Test restart, stop-during-work and genuine hung dependency behavior.
3. **D08 remaining effect families:** review secondary forum/thread lookups, follow-up messages, cleanup and provisioning effects for swallowed failures, lost IDs, false completion and duplicates. Primary role/voice/scheduled/forum lookup fixes do not prove all Discord writers safe.
4. **Calendar cross-consumer closure:** finish dashboard/API/public/bot parity and recurrence edge-case coverage. The calendar-policy adapter regression is now present; it is no longer a missing test.
5. **Live acceptance:** real backend plus Discord test guild smoke checks for permissions, role changes, signups, publications, reminders, applications, tickets and restart behavior. No real Discord calls or production load certification have been performed.

### Largest remaining performance work

- D05: identity correctness, incremental result/recap feeds, bounded backfill/repair and recap ownership; avoid repeatedly reconstructing historical result state.
- D02/D06: compact subscriptions and caller-specific projections, due-only panel/seed/League reads, separate heartbeat scheduling, reliable bounded League intake. Backend query/schema changes require their own deployment and compatibility checks.
- D07: render/image single-flight, byte-accounted caches, invalidation/deletion cleanup and decoder/output budgets.
- D09/D10: remaining interaction/configuration reads, modal lifecycle limits and durable coalesced website invalidation.
- D00/D12: actual query/byte/queue metrics, workload/fault/soak matrix and broader logging buffering/retention/error aggregation. No measured production speedup is claimed.

**Final validation: 4,044 tests passed with zero failures/skips; non-incremental typecheck, changed-file lint/formatting, production build and both offline bot bundles passed.** Detailed results and limits are recorded in [the release report](discord-bot-release-readiness.md). Preserve all features, runtime authorization checks and API contracts when continuing. No backend function/schema/generated-binding implementation changes were made in this pass.

## Previous candidate checkpoint (superseded by the current status above)

The unfinished delivery/schema protocol, startup supervisor, global I/O interception, worker rewrites, registration rewrite and sync-cycle rewrite have been **removed from the runtime candidate**. Their work is preserved in [the deferred patch](discord-bot-deferred-implementation.patch); `git apply --check` succeeds against this candidate. Do not apply that patch in a production checkout without finishing its migrations, lifecycle integration and tests.

The current candidate contains independently scoped command/config and applicant-cache fixes, one-pass guild snapshot grouping, streamed download bounds, immutable match attachment reuse, deleted-channel publication recovery with attempt-local lookup reuse, bounded role/signup/admin fan-out, unnecessary support-fetch removal, status overlap protection and calendar recurrence/selection corrections. Features and authorization entrypoints remain in place. No Convex function/schema/binding changes remain, so this candidate requires no Convex deployment or claim-protocol migration.

Candidate validation: **4,022 tests passed, zero failures/skips**; non-incremental typecheck passed; quiet ESLint on changed/new TypeScript passed; formatting and diff checks passed. The bot entrypoint and fallback worker bundle for Node 20 with zero errors/warnings (offline, no emitted files). Restricted-sandbox esbuild checks failed on parent-directory access; the identical check outside that restriction passed. The production Next build initially failed fetching the existing Inter Google font; its network-enabled retry is recorded in the release report.

The D00–D12 program remains deferred and is not represented as implemented. The TODO list below still describes future work, but references to new protocol/supervision/runtime admission implementations are now **archived work**, not active source. See [the release report](discord-bot-release-readiness.md) for the final release gate results.

## Historical partial implementation checkpoint

Started 2026-11-11. Scope: all D00–D12 packages in [the plan](discord-bot-implementation-plan.md). The audit files predate implementation and remain review evidence; their hashes are not expected to match after intentional fixes.

| Package | Status | Evidence / remaining work |
| --- | --- | --- |
| D00 | In progress | Bounded runtime counters and controlled concurrency/fault tests first |
| D01 | Pending | Service ownership, isolated startup, shutdown/drain |
| D02 | In progress | One-pass guild assembly; compact indexes and context reuse remain |
| D03 | In progress | Fair keyed scheduling and aggregate admission foundation |
| D04 | Pending | Fenced due claims, recovery, transactional membership and ticket operations |
| D05 | Pending | Result identity, incremental projections, recap ownership |
| D06 | Pending | Due panel/seed/League projections and intake |
| D07 | In progress | Streamed download bounds, media and cache lifecycle |
| D08 | In progress | Publication recovery and desired-state effects |
| D09 | In progress | Coherent single-flight configuration; remaining interaction paths |
| D10 | Pending | Durable coalesced invalidation |
| D11 | Pending | Bounded correct recurrence and calendar assembly |
| D12 | Pending | Failure-safe logging, full regression/load/fault closure |

No package is complete merely because its helper passes tests. Completion requires all listed consumers, permissions/features, backend migration and acceptance checks. Production deployment will be the final implementation step after local verification and target identification as required by AGENTS.md.

## Handoff / remaining TODO (2026-11-12)

The maintainer explicitly reduced this run: finish/check the current work and leave the rest here. **This is a partial implementation, not release-ready completion. Do not deploy it as the completed plan.**

Implemented so far: keyed work scheduling and actual I/O admission with bounded queues/counters; cold config single-flight/version protection; grouped guild snapshots; streamed download limits; match attachment reuse; deleted-channel publication recovery and per-attempt lookup reuse; bounded durable request watchers with polling; seed single-flight; status overlap protection; registration coalescing; applicant cache bounds/definition authority; bounded signup/role/admin fan-out; skipped unnecessary support enumeration; manual/roster request fences and recipient receipts; recurrence seeking/short-month/leap corrections; initial startup supervision/shutdown and sync-cycle coalescing.

Focused runs passed 40, 49 and 24 tests respectively before the final admission/startup integrations. These are separate overlapping runs, not 113 distinct tests. Final whole-suite/typecheck results must be read below. No build, Convex bundle check, generated API refresh, deployment, production profiling or live Discord acceptance has been completed.

Prioritized continuation:

1. **Finish/review current integrations before adding features.** Supervision is wired, but several existing workers still return timer-only stop handles without draining active work. Track/drain membership event promises, stop the admission gates, cancel prepared modal collectors, and ensure shutdown cannot recreate a Convex client. Complete actual worker-level fault/concurrency tests, especially seed forced refresh and sync-cycle retries/context reuse. Review the new global admission limits against gateway/interaction deadlines. `WorkQueue` currently bounds its scans by capacity but still scans pending work; improve scheduling complexity if the workload harness shows cost.
2. **D04 durable ownership:** complete scheduler fencing, paginated recovery/backfill and expired-job wakeups; bounded attendance discovery/visible expiry; fenced application submission/decision release; atomic shared membership decision command; durable ticket provisioning/close effects. Manual/roster recipient receipts are implemented, but first-publication mentions and other external effects still need ownership/recovery. Surface uncertain recipient outcomes accurately in status/UI/wiki; never label them confirmed closed DMs. Drain old workers before enabling the new claim protocol. Add migration/compatibility tests and receipt-failure/restart tests through actual bot adapters.
3. **D05:** resolve native workspace versus Discord identity using real event writers; implement incremental result projection/feed, bounded backfill/repair with withdrawal events, and fenced recap admission/uncertain-send handling. This major package is still untouched.
4. **D02/D06:** compact event/roster index and configuration subscriptions; caller-specific assignment projections; due panel/seed/League reads; exact active seed bindings/outbox indexes; per-query connection memoization; durable retirement completion; bounded reliable League message intake with early channel filtering. Panel/League workers remain serial and panel heartbeat still needs independent scheduling.
5. **D07:** image/render single-flight and byte-accounted cache eviction, deletion cleanup, complete media-before-skip optimization, renderer/provider admission and decoder/output budgets. Streamed body limits are implemented; dynamic image cache lifecycle is incomplete.
6. **D08:** distinguish transient resource lookup failures throughout roles/scheduled events/voice/forums; retain failed cleanup IDs; durable provisioning remembrance; desired-state no-op edits; direct-ID-first/resumable forum recovery; reconcile topic follow-up blocks; effect-specific completion versions. Publication recovery is fixed/tested, but the wider effect family is not complete. `sync.ts` still uses a timeout race that can release logical sequencing before actual work settles: fix ownership here.
7. **D09:** finish language/style config sharing/backoff/lifecycle, narrow panel-by-ID reads, indexed autocomplete/history existence reads, safe report audience-proof coalescing, signup modal lock lifetime and prepared-modal limits/cleanup. Preserve fresh permission and post-provider checks. Add registration startup-signature/coalescing/failure tests and applicant-cache version/soak tests.
8. **D10:** durable transactional invalidation intent and bounded coalesced delivery across all callers; HTTP response disposal; decouple committed success from website latency. Not implemented.
9. **D11:** recurrence and bounded bot selection are implemented with focused tests, but finish cross-consumer/API regression checks, calendar policy-failure tests, semantic fingerprint decisions and wiki updates. Fixed UTC semantics remain; do not change recurrence timezone behavior casually.
10. **D00/D12:** instrument actual call/byte/queue metrics at all boundaries, complete workload/fault/soak matrix, cycle-safe/redacted/bounded logging, statement reuse/buffering and error-storm aggregation. Logging remains synchronous and can throw. Current helper tests are not production performance evidence.
11. Run all plan validation and update public wiki/technical docs for every changed lifecycle/condition. Inspect the complete diff and preserve audit documents. Regenerate Convex bindings through tooling, check bundles/build, and only then perform the required authorized final deployment against an identified target. No deployment should be attempted merely to satisfy a checklist while this handoff still lists unfinished correctness work.

Use D00–D12 in the authoritative plan for the full acceptance criteria; the list above identifies exact current gaps rather than replacing those requirements. No D package is claimed fully complete.

Final checkpoint: the full isolated source+bot suite passed **4,026 tests, zero failures/skips**, in 68.98 seconds. `npm.cmd run typecheck -- --incremental false` passed after correcting the backend admission callback's Promise return type. Changed TypeScript files were formatted with Prettier; `git diff --check` passed. Tests used the temporary offline loader described in the audit (dotenv disabled, synthetic credentials). No deploy was performed because the maintainer explicitly ended this implementation run with remaining work; the required final deployment remains outstanding together with the correctness/rollout gates above.
## Historical decision fencing checkpoint (superseded by the continuation above)

The local candidate fences release of upgraded application decision claims, so
an expired attempt or a legacy release cannot clear a newer fenced lease. The
upgraded bot fails closed if the backend does not return a claim token. Existing
legacy claims remain releasable. Deploy the compatible backend before starting
the upgraded bot, and drain old bot processes before starting the new worker.

This is **not** complete decision crash recovery: assignment writes and closure
are still separate and are not fenced by this token, and Discord effects still
need durable receipts and reconciliation. Do not treat this change as a release
gate clearance. Live crash tests and host shutdown-grace verification were skipped
at the user's request. The new backend changes have not yet been deployed.
