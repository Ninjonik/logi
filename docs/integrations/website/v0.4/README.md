# Minimal website summaries handoff 0.4.0

Proposed 2026-09-28, for API 1.2.0. This additive milestone gives the website
backend independently scoped, minimized event and match reads. Logi remains
the authoritative operational data service; the website keeps its own backend,
CMS, translations, publication/consent decisions, sessions and site grants.
The [0.3 ownership and synchronization contract](../v0.3/README.md) still applies.
No consumer implementation or hosted deployment is claimed here.

## Provision the summary reader

A workspace administrator can use the existing session-authenticated endpoint:

```http
POST /api/servers/{serverId}/api-keys
Content-Type: application/json

{
  "name": "Website summary reader",
  "readAccess": {
    "resources": ["event-summaries", "match-summaries"],
    "gameIds": ["hell_let_loose", "wardogs"]
  }
}
```

Grant only the configured games/resources needed by that consumer. Games may
use different guilds and keys. The response reveals the key once; store it only
in the website backend and use `Authorization: Bearer <key>`. Listing and
revocation use the [existing management contract](../v0.3/README.md#issue-a-restricted-key).
The dashboard creation form still issues legacy full-access keys.

The two new grants are independent of each other and of `events`/`matches`.
An event-summary key cannot read match summaries, raw events, raw match stats,
members or settings. Every restricted key denies every write. Existing
restricted policies acquire no new grants automatically. Legacy keys without
`readAccess` retain full access, including these new reads.

## HTTP contract

All paths below are relative to `/api/v1`. Only `GET` is supported.

| Path | Resource grant | Data |
| --- | --- | --- |
| `/clan/event-summaries?game=wardogs` | `event-summaries` | Paginated match and training event summaries |
| `/clan/event-summaries/{id}` | `event-summaries` | One summary, identified by its Logi event ID |
| `/clan/match-summaries?game=wardogs` | `match-summaries` | Paginated summaries of non-training events, including unknown results |
| `/clan/match-summaries/{eventId}` | `match-summaries` | One match summary, identified by its Logi event ID |

Collections return `{ "data": [...], "page": { "nextCursor": null, "limit": 25 } }`.
Details return `{ "data": {...} }`. Pagination accepts `limit` (1–100), opaque
`cursor`, `sort=createdAt` and inclusive `updatedSince`. Restricted collections
require explicit permitted games; omitted games, `all`, ungranted games or
resources return `403 insufficient_scope`. Details check the persisted guild
and game, returning `404 not_found` for missing/out-of-scope records; match
details also return 404 for training events. Invalid/revoked credentials return
401 at HTTP authentication. The backend rechecks the key for every operation.
Successful restricted reads carry `Cache-Control: no-store`.

Both summaries identify the **event**, not a `matchStats` row or external CRCON
session. Match-summary `id` and `eventId` are equal. Never treat that identity as
a provider session ID or join another provider's records by title.

The runtime DTOs and OpenAPI response schemas share
[`src/domain/api/event-summaries.ts`](../../../../src/domain/api/event-summaries.ts).
These are explicit field allowlists, including nested result fields; they do
not spread persisted documents. The [synthetic wire fixtures](./fixtures.json)
show the complete response shapes. The [0.3 TypeScript models](../v0.3/contract.ts)
remain website-owned normalized models, not these wire DTOs.

| Projection | Fields and meaning |
| --- | --- |
| Both | `id`, `guildId`, explicit `gameId`, untranslated `title`, nullable `updatedAt` |
| Event | `kind` (`match` or `training`), nullable stored `status`, nullable `startsAt` from `gameStart`, `endsAt` from `gameEnd` |
| Match | `eventId`, `resultState` (`unknown` or `provisional`), nullable `result` |
| Imported result | `mapId`, nullable `mapName`, `sideA`, `sideB`, numeric `score.sideA`/`score.sideB`, stored `outcome`, nullable `endedAt`, and `provenance: { type: "event_result_import", importedAt }` |

Legacy events without `gameId` resolve to `hell_let_loose`; absent kind means
`match`. Missing start/update/status data remains null. Do not manufacture a
start from a meeting time, a score from absence or a publication decision from
event status. The event end is its stored schedule, not proof of actual match
completion; the result's `endedAt` is separate.

No stored `eventResult` means `resultState: "unknown", result: null`, even if
the event is concluded or a raw `matchStats` row exists. A stored event result
is always `provisional`: import provenance does not establish human confirmation.
Present zero scores are preserved. These endpoints expose no `confirmed` or
`corrected` state and no confirmation timestamp/audit trail. Side labels and
the stored outcome retain Logi's import semantics; they do not establish a
website home/away orientation, opponent club identity or per-round scores.
Leave unmapped normalized scores/opponents unknown rather than guessing.

Passwords, notes, descriptions, signup/attendance/player identities, Discord
channel/role IDs, tactics, source URLs and raw telemetry are excluded. Titles,
maps and side labels are still private operational content requiring website
publication review. A minimized response does not grant public publishing or
member consent. The website adds observation/freshness/publication state and
the configured source instance to its derived records.

## Identity and synchronization

Keep `(source, sourceInstanceId, guildId, gameId, kind, externalId)` in the
website's external reference. `sourceInstanceId` comes from trusted operator
configuration; it is not an API field. Map website `hell-let-loose` / route
`hll` to Logi `hell_let_loose`, and select `wardogs` explicitly. Use distinct
reference kinds for event and match projections, even when their event ID is
equal. Keep website-only publication fields outside the imported record.

Pages are bounded before game/kind filtering, so an empty `data` array may have
a `nextCursor`. Continue it. Keep resource/game/sort/updatedSince unchanged for
the entire sweep, including retries. Timestamp ties are included. Legacy records
without `updatedAt` require a full sweep; incremental absence proves nothing.
Changing an event's kind to training removes it from match summaries, so full
reconciliation must cover that transition as well as missing records.

The [0.3 synchronization acceptance contract](../v0.3/README.md#synchronization-acceptance-contract)
governs resumable cursors, completed watermarks, bounded retry, durable signed
webhook invalidation, reconciliation and consent/authority withdrawal. These
endpoints add no snapshot isolation, tombstones, change feed or durable consumer.
Existing webhook payloads remain operational records; refetch summaries with
the scoped key and never publish the webhook body. Not every producer mutation
path emits a webhook, so periodic reconciliation remains required.

## Compatibility and rollout

Deploy the compatible Convex validators/functions before the web runtime, then
provision a summary-only key, verify tenant/game/resource/write denials, switch
the website backend and revoke its previous broader key. These are separate
operator actions, not actions performed by this contribution. No table/data
migration or dependency/toolchain change is required. Existing endpoints retain
their contracts. Before a backend downgrade, revoke keys using unsupported
policies; follow the [0.3 rollback requirements](../v0.3/README.md#compatibility-and-rollout).

This adds alternate read representations of existing dashboard event/results
data, not a new lifecycle or dashboard/Discord presentation. Key management
remains session-authenticated and deliberately outside `/api/v1`; a bearer key
cannot grant itself broader access.

## Milestone acceptance and remaining work

The [foundation criteria AC1–AC5](../v0.3/README.md#milestone-acceptance-and-evidence)
remain in scope. This extension adds:

- **AC6:** Independent event/match summary grants enforce persisted tenant/game
  ownership and revocation, exclude raw fields, and preserve cursor continuation.
- **AC7:** Missing results remain unknown; imported results stay provisional,
  zero is preserved, training is excluded and legacy HLL identity stays explicit.
- **AC8:** Actual HTTP routes, shared OpenAPI schemas, wiki and synthetic wire
  fixtures agree. Reviewers can reproduce the [validation](./validation.md).

The prior [capability inventory](../v0.3/capabilities.md) remains the source audit;
the new minimized reads are the added capability. [Follow-up drafts](../v0.3/issue-drafts.md)
still cover confirmed/corrected result provenance, member-consent integration,
durable website synchronization, game-server snapshots and restricted-key UI.
SSO remains subject to separate private provider acceptance. Hosted readiness,
website consumer behavior and real provider/Discord behavior are unverified.
