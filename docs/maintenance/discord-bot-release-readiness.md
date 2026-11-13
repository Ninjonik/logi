# Discord bot release candidate — 2026-11-12

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
