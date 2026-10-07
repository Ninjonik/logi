# Website synchronization handoff 0.6.0

W2 adds API 1.4.0 alongside the unchanged 0.4 summaries and 0.5 collectors.
This is producer code for review, tested offline. No hosted instance, website
worker, credentials or Discord server were changed.

## Bootstrap and replay

1. Use a restricted key with explicit underlying resource/game grants. Legacy
   full-access keys cannot use the sync routes. Exactly one game is required.
2. `GET /api/v1/clan/changes?game=wardogs&resources=event-summaries,match-summaries&start=now`
   returns `{ data: [], page: { nextCursor, hasMore: false, limit: 25 } }`.
3. Save that boundary, finish the baseline collection sweep with fixed filters,
   then replay with `cursor` replacing `start=now`. Keep resources and game fixed.
   Empty pages may have `hasMore: true`: continuation advances a bounded scan.
4. Refetch through `/api/v1/clan/sync-records/{resource}/{id}?game=wardogs`.
   The atomic envelope is `{ data: { guildId, gameId, resource, id, revision,
operation, data } }`. Upserts contain the existing minimal DTO; removals have
   `data: null`. Unknown/foreign IDs and expired tombstones return 404.
5. Commit projections and cursor together in the website database. Compare
   canonical decimal revisions with BigInt, never Number or unpadded lexical
   comparison. Revisions support 128 digits; overflow fails the transaction.
   Existing records start at `"0"`; filtered revisions need not be contiguous.
6. Keep the returned cursor for polling even when `hasMore` is false. Signatures
   bind key, guild, game and resources. Tampering/filter changes return 400;
   missing grants return 403. All sync responses use `Cache-Control: no-store`.
7. History and tombstones retain two days (seven until October 2026). Expired
   cursors or cursors behind the durable retention floor return
   **410 `reset_required`**. Capture a new start boundary and rebuild. Never
   interpret a missing list row as deletion.

Registered resources: `event-summaries`, `match-summaries`. Other resources are
not implicitly registered. Scope moves remove the old projection and upsert the
new scope. No event-delete API was added. Preserve editorial and consent records
during rebuilding. Telemetry never confirms a result.

`server-snapshots` and `integration-health` are no longer carried by the feed.
They are live state: the collector re-observes every server once a minute, and
every poll used to append two changes per server. `/clan/changes` and
`/clan/sync-records` still accept both names, so an existing request keeps
working and simply receives no items; read the current state from
`/api/v1/clan/server-snapshots` and `/api/v1/clan/integration-health`, polling
at the freshness the website needs and checking `observedAt` age.

A clan's feed is written only while the clan has a live restricted key granted
at least one feed resource (or a website event-command key, whose revision check
uses the `event-summaries` revision). A clan without one gets no changes, records
or revisions, and its head stays where it is. Nothing a website could read is
lost: a new key bootstraps with `start=now` and the baseline sweep, as above.

## Webhooks

The feed no longer emits `integration.changed` or `membership.changed` webhooks
(October 2026); poll `/clan/changes` instead. The dashboard never offered these
event types. A subscription that lists them is still accepted and keeps its
other event types; it simply receives no delivery for them. The queue below
still serves the other webhook event types.

Enqueues schedule work transactionally. Each worker drains at most 25 deliveries
with four simultaneous HTTP requests, 10-second request deadlines and a 30-second
work budget (no new claims after 20 seconds). Global 35-second worker leases and
30-second delivery leases fence overlapping workers/late responses. Tenant queues
rotate after each claim. Existing deliveries are backfilled in 200-row pages.
Continuations are scheduled transactionally; the minute cron recovers interruption.

Attempts count at claim, including crashed attempts, up to six. Transient errors
retry with exponential delay and honor valid `Retry-After` seconds or HTTP dates.
Redirects fail without forwarding signatures. Storage failures are not rewritten
as HTTP failures. Network errors are sanitized. Delivery is at least once; the
website must durably deduplicate delivery IDs before acknowledgement.

See [writer coverage](./writer-coverage.md), [validation](./validation.md) and
[synthetic fixtures](./fixtures.json). Transaction assumptions follow the primary
[Convex scheduling](https://docs.convex.dev/scheduling/scheduled-functions) and
[actions](https://docs.convex.dev/functions/actions) documentation: mutation
scheduling is atomic, while network actions require their own durable leases.
