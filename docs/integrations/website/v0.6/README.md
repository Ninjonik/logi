# Synchronization and webhooks

## Resource synchronization

Scoped consumers read bounded collections and follow their opaque cursors until completion. Grants, game, workspace, and filters remain fixed throughout a sweep. Empty collection pages may still have a continuation.

`GET /api/v1/clan/changes?start=now` returns an empty page and a boundary cursor. Replaying that cursor returns `410 reset_required`. Logi retains no replay log or deletion tombstones. Consumers rebuild the authorized scope rather than relying on incremental replay. Preserve website-owned editorial and consent records during rebuilding; incomplete sweeps do not establish deletion.

`GET /api/v1/clan/sync-records/{resource}/{id}?game=...` returns the current scoped resource envelope. Unknown or unavailable records return 404. Revisions are canonical decimal strings and are compared with `BigInt`.

Read live state directly from `/api/v1/clan/server-snapshots` and `/api/v1/clan/integration-health`, respecting the observations' timestamps. These resources do not provide a change-log history. All integration responses use `Cache-Control: no-store`.

## Webhooks

The changes feed does not emit `integration.changed` or `membership.changed` webhooks. The dashboard never offered these
event types. A subscription that lists them is still accepted and keeps its
other event types; it simply receives no delivery for them. The queue below
still serves the other webhook event types.

Enqueues schedule work transactionally. Each worker drains at most 25 deliveries
with four simultaneous HTTP requests, 10-second request deadlines and a 30-second
work budget (no new claims after 20 seconds). Global 35-second worker leases and
30-second delivery leases fence overlapping workers/late responses. Tenant queues
rotate after each claim. Continuations are scheduled transactionally; the minute cron recovers interruption.

Attempts count at claim, including crashed attempts, up to six. Transient errors
retry with exponential delay and honor valid `Retry-After` seconds or HTTP dates.
Redirects fail without forwarding signatures. Storage failures are not rewritten
as HTTP failures. Network errors are sanitized. Delivery is at least once; the
website must durably deduplicate delivery IDs before acknowledgement.
