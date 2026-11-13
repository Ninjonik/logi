# Discord bot release candidate — 2026-11-12

## Event resource creation recovery — 2026-11-13

Signup discussions, native Discord scheduled events and squad voice resources
now persist fenced pre-create boundaries and confirmed receipts. Restart reuses
saved resources; uncertain creates are withheld. Receipts and ordinary sync IDs
commit together; deletion includes receipt-only IDs and late creates. Definite
category rejection retains the configured-category fallback; uncertainty never
triggers it. SDK timeout/5xx retries are disabled for these resource POSTs while
read retries and rate-limit handling remain enabled. Operator evidence resolution
is tenant-scoped and audited, without resetting retry budgets or active leases.

Older sync records with missing resource IDs require evidence; existing IDs remain
usable. Orphans with no legacy sync or receipt cannot be identified retroactively
and require guild inspection/pre-adoption. No live crash tests or host grace checks
were run, as requested. This closes the three identified forward crash windows,
not the entire secondary-effect or performance program.

Validation: 64 focused checks; full suite **4,164 passed, zero failed, four existing
skips** (64.30 seconds). Non-incremental typecheck, changed-file ESLint/Prettier,
production build, Convex bundles (197 V8 / 12 Node), both Node 20 ESM bot bundles
and diff checks passed. Final `bunx convex deploy` succeeded on
`https://convex.igportals.eu` on 2026-11-13, validating schema and generated bindings
without deleting indexes. The bot host has not been restarted: drain the old process
before starting the updated runtime, and retain additive journals on rollback.

## Focused read and idle-poll reduction — 2026-11-13

Six durable workers now wake from indexed Convex queue-head subscriptions and
local retry/lease deadlines: dispatch, event cleanup, recaps, membership workflows,
membership effect repair and team notifications. Idle claim/recovery mutation loops
are removed from those workers. Five-minute read-only safety checks, gateway
ready/resume wakeups, active lease heartbeats and membership retention remain.
Notification coalescing, stale-read fencing and stop/drain behavior are covered.

Event subscriptions opt into compact roster identifiers/change stamps; legacy
responses stay available. Calendar refreshes read only their event/link projection,
without querying people, rosters, assignments or logos. Fresh links, competition
rounds, rendering and tenant/draft checks remain covered. A 1,000-player fixture
checks a compact response smaller than one fifth of its legacy response; no general
load or throughput claim is made.

Validation: **4,138 passed, zero failed, four existing gateway socket skips** in
54.47 seconds; 37 focused tests passed. Typecheck, changed-file lint/format,
production build, Convex bundles (196 V8 / 12 Node) and both Node 20 ESM bot bundles
passed. Final `bunx convex deploy` succeeded on `https://convex.igportals.eu`;
schema/bindings validated and no indexes changed.

No bot runtime restart or live host tests occurred. Drain the old bot before
deploying the new runtime. Provider, panel/seed/League and managed-role timers remain
outside this pass, alongside the larger performance plan and diagnostic durability.

## Match-recap recovery — 2026-11-13

Recaps now use fenced recipient claims, durable send boundaries and confirmed,
refused or uncertain receipts. Unrecorded sends are quarantined; only work proven
not to have started sending retries automatically, with five attempts and bounded
backoff. Recovery uses indexed bounded discovery and a drainable non-overlapping
worker. Binding, opt-out, result/publication and clan configuration are rechecked
before sending; drafts and revoked shared events are withheld. Old pending work
requires operator evidence, and version-2 bots cannot consume upgraded work.
The CLI exposes scoped recap receipts, audits and evidence-based reconciliation.

Validation: **4,127 passed, zero failures, four existing gateway socket tests
skipped**, in 48.64 seconds. Focused recap/CLI and shared-result/reporting batches
passed. Typecheck, changed-file lint/format, production build, Convex bundles
(195 V8 / 12 Node) and both Node 20 ESM bot bundles passed. Old integration fixtures
were updated to protocol 3 and now establish the fenced send boundary before
recording success. Legacy-client rejection remains covered.

Final `bunx convex deploy` succeeded on `https://convex.igportals.eu`; three indexes
were added and none deleted, schema validated and generated bindings refreshed.
No bot runtime restart or live Discord operation occurred. The updated bot must
replace the drained old runtime without overlap. Keep additive receipts/audits
on rollback; older workers cannot safely consume upgraded recap work.

Grouped role-report failures and errors-channel lookup failures are now visible
in logs. Their intents remain in memory: transactional intent capture, durable
grouping and send receipts remain required before claiming crash recovery for
diagnostics. This and the broader secondary-effect/D00-D12 program remain open.
Live crash tests and host grace verification remain skipped by user instruction.

## Team-request notification recovery — 2026-11-13

Decision DMs now have fenced, recipient-bound send receipts. Restart can resume
pre-send work, but never blindly resends after an accepted/ambiguous send or lost
outcome write. Expired pre-upgrade attempts are uncertain. Operator inspection and
audited evidence resolution are available through `team-delivery`, `team-audit`
and `team-resolve`; active leases and exhausted attempt budgets remain protected.
Worker pass and recipient lookup failures are reported explicitly.

Validation: **4,120 passed, zero failed, four skipped** in 42.68 seconds. The skips
are the existing gateway socket-abort compatibility tests for this Node runtime.
Focused regressions, typecheck, changed-file lint/format, production build,
Convex bundles (194 V8 / 12 Node) and both Node 20 ESM bot bundles passed.
The full suite initially exposed two tests asserting the obsolete blind-retry
behavior; those now distinguish safe pre-send retries from legacy uncertainty.

Final `bunx convex deploy` succeeded on `https://convex.igportals.eu`, adding the
audit index without deleting indexes; schema and generated bindings validated.
No bot host restart occurred. Drain the old bot before starting the new runtime;
keep additive receipt/audit data on rollback. Live Discord tests and host grace
verification remain skipped by user instruction. Broader secondary effects,
including match recaps and grouped diagnostics, and D00-D12 remain incomplete.

## Application/ticket recovery continuation — 2026-11-13

The current working candidate adds atomic membership decisions and submission
provisioning, durable application/ticket effect receipts, bounded restart repair,
and an evidence-based operator CLI. It preserves accepted resources after lost
record responses and distinguishes uncertain DM delivery from confirmed refusal.
New protocol claims cannot be taken by old bots; legacy ticket close calls do not
create resumable intents that could replay their unrecorded sends.

Final validation passed: the full suite had **4,115 passes, zero failures and four
skips** (57.88 seconds). The four gateway socket tests are explicitly skipped for
the installed Node runtime's socket-abort incompatibility. Ten focused recovery
tests, including the operator CLI entrypoint regression, passed separately.
Non-incremental typecheck, changed-file ESLint/Prettier, production Next build,
Convex bundles (193 V8 / 12 Node modules) and both Node 20 ESM bot bundles passed.
The build used synthetic localhost backend configuration; it does not certify live
backend connectivity. An offline CLI check caught and fixed unsupported top-level
await before rollout. Disabled notifications now get explicit skipped receipts;
an opt-out never rewrites an uncertain send as a confirmed refusal.

Final `bunx convex deploy` succeeded on `https://convex.igportals.eu` on 2026-11-13.
Schema validation and generated bindings succeeded; fourteen indexes were added
and none deleted. Deploy the updated bot only after draining the old process;
do not run old and new workers concurrently. Keep the additive schema and receipts
on rollback, because older bots cannot safely resume upgraded application work.
No bot runtime restart was performed.

Live Discord crash tests and host shutdown-grace verification were skipped
at the user's explicit request. This does not certify the broader D00-D12 audit
program or every secondary effect family. See the current progress register and
the bot README's operator reconciliation procedure.

## Current durable handoff and recipient resume pass (2026-11-12)

The worker-to-main handoff now uses a transactional durable inbox. Schedule removal
and dispatch creation commit together; the current main-process owner acknowledges
only after awaited queued processing. Retry, restart and stop behavior are fenced
and tested, with no dependency on receiving a transient worker message.

Recipient/effect progress is persisted for manual reminders, roster requests
(DMs/digest/mention), signup reminders and attendance reminders. Resume skips
confirmed sends, continues untouched eligible recipients, and excludes uncertain
sends from confirmed closed-DM counts. Original audiences cannot broaden during
resume. Proven pre-send failures can retry; ambiguous accepted sends cannot be
safely repeated automatically. Legacy runs without receipts are not blindly
migrated or replayed. Signup deadline/preferences remain authoritative on resume.

Retention is bounded and preserves active/retryable scopes. New fields are
optional on existing request tables. Old job completion remains compatible, but
old bot versions cannot claim new resumable rows. Deploy backend first, stop the
old bot normally and wait for exit, then start the upgraded runtime. Bot host
termination grace must remain at least 130 seconds. No bot restart is performed
by these backend deployments.

Final validation: **4,088 tests passed**, zero failures/skips (71.10 seconds).
Non-incremental typecheck, changed-file ESLint, Prettier and diff whitespace checks
passed. Production Next build passed with 269 pages; Convex bundles passed for
191 V8 and 12 Node modules; both Node 20 bot bundles passed without errors/warnings.
Tests use synthetic backend configuration; expected localhost fetch warnings during
a successful build do not certify live backend connectivity. The boundary tests
cover transactional handoff, restart/reclaim, stale acknowledgment, recipient resume,
uncertain/confirmed outcomes, audience narrowing, game/response filtering, resumed
signup deadlines/preferences, attendance log repair, digest/mention deduplication,
retention and shutdown with a pending acknowledgment.

Mandatory final `bunx convex deploy` **succeeded** on the previously approved
`https://convex.igportals.eu` target. Functions and schema validated, generated
bindings refreshed, and all eight new delivery/dispatch/retry indexes were added.
No indexes were deleted. No live Discord calls or bot runtime rollout were performed;
the bot still needs a normal, non-overlapping restart with the updated runtime.

Remaining release work is explicitly listed in the [current TODOs](discord-bot-implementation-progress.md):
application/ticket transactions and recovery, secondary effects, operator handling
of uncertain/legacy deliveries, operational acceptance and other planned closure.
The full D00-D12 program remains incomplete.

## Previous deployment and scheduler recovery continuation (2026-11-12)

The maintainer explicitly approved deployment to `https://convex.igportals.eu`.
The previously blocked `bunx convex deploy` **succeeded**: schema validation,
function push and both request-lease indexes completed. Generated bindings were
refreshed by tooling. No bot process was restarted or deployed.

The follow-up scheduler change adds opt-in attempt fencing, admitted-batch
heartbeats, periodic indexed expiry recovery and paginated obsolete-job cleanup.
Old bot claims remain compatible. Missing/deleted/stale claims cannot complete or
release a newer attempt. The fallback worker checks ownership before reconciliation
and does not enqueue reminder work from a rejected completion.

Validation: **4,074 tests passed**, zero failures/skips; typecheck, changed-file
ESLint and formatting passed. Convex runtime bundle checks passed (189 V8 and
12 Node modules); both Node 20 bot bundles passed with no errors/warnings. Final
production build passed (269 static pages; synthetic backend configuration with
expected localhost fetch failures). The final `bunx convex deploy` **succeeded**
on `https://convex.igportals.eu`: functions/schema validated and pushed, generated
bindings refreshed, and `eventScheduleJobs.status_claimedAt` added. No indexes
were deleted. This deploy does not restart the Discord bot or certify live
Discord behavior.

Remaining release gates are in the [current TODO register](discord-bot-implementation-progress.md).
In particular, durable scheduled handoff, per-recipient resume and application/
ticket recovery are **not finished**. No live Discord acceptance has been run;
termination grace must still be configured and verified on the bot host.

## Previous crash-recovery and shutdown pass (2026-11-12)

This checkpoint supersedes the prior candidate tables below. Shutdown now owns
and drains worker/startup/gateway work, cooperatively stops the fallback thread,
cancels modal collectors, and prevents client recreation. A 120-second deadline
exits with failure; deployment must allow at least 130 seconds of termination grace.

Manual reminder and roster-change delivery use opt-in fenced renewable leases.
Expired requests are recovered to failed `delivery_uncertain`, without blindly
replaying a possibly accepted send. This is conservative interruption recovery;
per-recipient resume and scheduled/application/ticket recovery remain open.
Existing public API shapes, permissions and recipient rules are preserved.

Final local validation: **4,066 tests passed**, zero failures/skips (67.32 seconds).
Non-incremental typecheck, changed-file ESLint and Prettier, production Next build
(269 pages), and both Node 20 bot bundles passed. `npm.cmd run
check:convex-bundles` passed for 189 V8 and 12 Node modules. The build used synthetic
backend configuration and logged expected localhost fetch failures; it does not
prove live backend connectivity. Tests include late startup, partial startup,
slow worker drain, new-intake rejection, modal cancellation, client resurrection,
real reminder-worker stop behavior, expired/stale ownership, bounded recovery and
legacy/new claim compatibility. No live Discord acceptance or bot process
deployment has been performed. A final focused request-worker run passed six tests
after removing claim tokens from diagnostic contexts; those tests overlap the full
suite and are not an additional unique-test count.

**Historical deployment rejection (resolved by explicit approval and successful deployment above).** The attempted
`bunx convex deploy` command was rejected before execution because it changes the
shared backend and explicit user approval of that external side effect was not
present. Target: `https://convex.igportals.eu`. No functions/schema/indexes were
deployed and generated bindings were not refreshed by this rejected command.
Explicit approval has been requested. Do not start this upgraded bot against the
old backend; deploy the backend first, then stop the old bot and replace it.

Rollout: deploy Convex first, stop the old bot and wait for exit, then start the
new bot with the updated files. Optional fields preserve existing records; legacy
bots may finish unfenced legacy claims during backend-first rollout. Upgraded
bots fail closed against an old claim contract. Recovery reads at most 50 legacy
and 50 expired leased rows per queue per pass through `status_leaseUntil`; it does
not scan the whole request table. No old archived patch needs to be applied.

**Remaining release gates are explicit in the [current TODOs](discord-bot-implementation-progress.md):**
recipient-level/scheduled recovery, application/ticket transactions and provisioning,
secondary Discord effects, supervisor configuration and live acceptance.

## Latest bounded hardening pass (2026-11-12)

The previous candidate below has been extended with concrete reliability fixes and a focused performance improvement. **This is still not unconditional production release approval.** The remaining release gates are listed at the top of [the current TODO register](discord-bot-implementation-progress.md).

New fixes: retain guild-step ownership after a slow-operation warning; distinguish missing resources from temporary failures in role/scheduled-event/squad-voice/primary forum lookups; preserve failed role/voice cleanup IDs; propagate failed scheduled-event cancellation; report observed scheduled lifecycle; save successful attendee-role provisioning before the next provision. These do not replace durable crash recovery or whole-process shutdown supervision.

New performance changes: existing participant roles use two fetches rather than four; calendar updates are batched once per affected clan per cycle, and event contexts load with concurrency four using a clan index. For K changed events and N active events in one clan, calendar context reads fall from up to K*N to N for that cycle, excluding independent full-guild/manual refreshes. Contexts remain fresh across cycles. Logging reuses its insert statement and avoids repeated storage attempts for 30 seconds after a failure; context processing is bounded and cycle-safe, and logging failures cannot throw into bot work.

Final verification for this pass:

| Check | Result |
| --- | --- |
| Complete isolated source + bot suite | **4,044 passed**, zero failures/skips; final run 62.49 seconds |
| Non-incremental TypeScript check | Passed |
| ESLint on this pass's changed/new TypeScript | Passed |
| Prettier check on this pass's changed/new TypeScript | Passed |
| Production Next build | Passed; all 269 static pages generated |
| Offline Node 20 bot entrypoint + fallback-worker bundles | Two bundles, zero errors/warnings, no files emitted |
| Diff whitespace / no Convex implementation diff | Passed |
| Archived patch against Git index base | `git apply --check --cached` passed |

 The build uses synthetic offline backend configuration; expected localhost connection failures do not certify live backend connectivity. No deployment or real Discord calls were performed. No backend function/schema/generated-binding code changed. The archived patch was checked against the unchanged Git index with `git apply --check --cached`; it is an archive against that base, not a patch certified to apply directly over subsequent working-tree changes.

Remaining release gates: critical reminder/application/ticket crash/retry recovery, complete shutdown/drain, secondary Discord effect failure handling, remaining cross-consumer calendar checks, and live test-guild/backend acceptance. Large incremental feeds, due-only projections, media cache/render work and workload measurement remain performance TODOs. Do not treat the historical validation table below as closure of these gates.

## Previous candidate and verification

This release candidate contains the tested, independent hardening changes from the audit. It does **not** claim completion of the comprehensive D00–D12 redesign. Unfinished integrations have been removed from active code and preserved in [a deferred patch](discord-bot-deferred-implementation.patch); remaining implementation tasks are in [the progress/TODO document](discord-bot-implementation-progress.md).

## Included changes

- Single-flight cold command reads with stale-response protection and failure backoff; bounded applicant state that cannot overwrite subscribed definitions.
- One-pass grouping of guild snapshot rows; bounded role, signup invitation and admin-update fan-out; no unnecessary support enumeration when invitations do not require it.
- Actual streamed byte limits, body cancellation and deadlines for images/forum attachments; retained immutable match images; no whole-cache eviction on every remote-image cache overflow.
- Correct deleted-previous-channel publication recovery; permission/server errors retain existing bindings. Channel/message lookup reuse is limited to one owned attempt.
- Non-overlapping service-status checks with drainable stop; application emoji timer cleanup handle.
- Old recurring calendar series remain visible in current windows; invalid monthly dates and non-leap years do not duplicate occurrences; the bot bounds per-source selection before fitting its ten rows. Existing fixed UTC recurrence semantics are retained.

These changes preserve existing public API shapes and authority checks. The shared calendar correction affects computed occurrences, not stored calendar item contracts. The public calendar wiki and bot operational documentation were updated.

## Validation

| Check | Result |
| --- | --- |
| Complete source and bot tests with isolated synthetic configuration | 4,022 passed; no failures/skips; 90.34 seconds |
| `npm.cmd run typecheck -- --incremental false` | Passed |
| ESLint, quiet mode, changed/new TypeScript only | Passed |
| Prettier, changed/new TypeScript | Applied |
| `git diff --check` | Passed |
| Node 20 ESM bundles: bot entrypoint and fallback worker, external packages, no output written | Passed: two bundles, no errors/warnings |
| Deferred patch applicability | `git apply --check` passed |
| Production Next build | Passed with network access and synthetic offline configuration; all 269 static pages generated |

No live Discord calls, production data migration, deployment or production load certification was performed. The initial production-build invocation had a Windows preload-path quoting error; the corrected restricted run then failed fetching Inter from Google Fonts. The network-enabled retry compiled successfully and generated all 269 static pages. It logged expected Convex fetch failures against the synthetic localhost configuration, so this validates compilation and page generation, not connectivity to a live backend. The initial offline esbuild attempt also hit restricted parent-directory access; its unrestricted offline retry passed.

## Rollout boundary

No Convex/schema/generated binding changes remain in this candidate. Deploy the dashboard and bot through the normal release process after the production build gate passes; no special database backfill or mixed-worker claim migration is needed for this subset. Stop the old bot normally before starting its replacement. Existing delivery semantics, including scheduled reminder reservation behavior, remain unchanged.

Do not describe the archived queue protocol, startup rewrite, incremental results/recaps, durable invalidation or broad logging overhaul as part of this release. Those are future work with explicit acceptance criteria in the comprehensive plan. Green unit tests and offline bundles are evidence for this candidate, not a guarantee of zero defects or measured production performance.
