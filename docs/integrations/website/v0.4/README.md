# Minimal event and match summaries

The `event-summaries` and `match-summaries` resources expose minimized projections for connected websites. Their grants are independent of full event and match reads. Logi owns the operational records; the consumer controls its public presentation.

## Provision the summary reader

A workspace administrator can use **System → Website API**. The form defaults
to read-only access and the two summary resources; select the required games
explicitly. Empty resource/game selections cannot create a restricted key.
Existing-key rows display their actual resource/game grants or explicit legacy
full access. Create a replacement, switch the consumer, then revoke its old key
to change permissions. The UI supports English, Czech and German.

The existing session-authenticated management endpoint accepts the same policy:

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
revocation use the [existing management contract](../v0.3/README.md#access).
The form creates a legacy full-access key only after that mode is selected.
Its label explains that this permits reads and writes across all games.

The two new grants are independent of each other and of `events`/`matches`.
An event-summary key cannot read match summaries, raw events, raw match stats,
members or settings. Every restricted key denies every write. Existing
restricted policies acquire no new grants automatically. Legacy keys without
`readAccess` retain full access, including these new reads.

## HTTP contract

All paths below are relative to `/api/v1`. Only `GET` is supported.

| Path                                 | Resource grant    | Data                                                                  |
| ------------------------------------ | ----------------- | --------------------------------------------------------------------- |
| `/clan/event-summaries?game=wardogs` | `event-summaries` | Paginated match and training event summaries                          |
| `/clan/event-summaries/{id}`         | `event-summaries` | One summary, identified by its Logi event ID                          |
| `/clan/match-summaries?game=wardogs` | `match-summaries` | Paginated summaries of non-training events, including unknown results |
| `/clan/match-summaries/{eventId}`    | `match-summaries` | One match summary, identified by its Logi event ID                    |

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

| Projection                       | Fields and meaning                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Both                             | `id`, `guildId`, explicit `gameId`, untranslated `title`, nullable `updatedAt`                                                                                                                                                                                                                                                                                                                                                                                |
| Event                            | `kind` (`match` or `training`), nullable stored `status`, nullable `startsAt` from `gameStart`, `endsAt` from `gameEnd`                                                                                                                                                                                                                                                                                                                                       |
| Match                            | `eventId`, `resultState` (`unknown` or `provisional`), nullable `result`                                                                                                                                                                                                                                                                                                                                                                                      |
| Imported result                  | `mapId`, nullable `mapName`, `sideA`, `sideB`, numeric `score.sideA`/`score.sideB`, stored `outcome`, nullable `endedAt`, and `provenance: { type: "event_result_import", importedAt }`                                                                                                                                                                                                                                                                       |
| Team selection (Event and Match) | `matchTeams`: `null` when no assignment was ever stored (trainings, events saved before team selection existed, and matches created by a client that omitted `matchTeams`, such as a bearer-key create, a website command without the field or a bot-created match); otherwise an array sorted by `slot` (possibly empty) of `{ teamId, slot, side, name, shortCode, logoUrl, teamRevision, capturedAt }`. Treat `null` and `[]` alike as "no assigned teams" |

Each `matchTeams` entry names a workspace directory team (`teamId`), its
stable display `slot` (`a`/`b`, plus `c` for Wardogs) and a nullable
match-specific `side` (`Allies`/`Axis` or `Valkyra`/`Manticore`/`Lonestar`).
`name`, nullable `shortCode`, nullable public `logoUrl` and `teamRevision` are
the snapshot Logi captured at `capturedAt` when the team was selected or
explicitly refreshed; later directory renames, logo changes or archival do not
rewrite it. These summaries expose no image asset IDs (only the complete
`events` record keeps the internal `logoAssetId` in its snapshots; see the
[team catalogue reference](../v0.15/README.md#complete-event-records-versus-minimized-summaries)),
and the selection does not change the event-level `side`, scores or result
orientation.

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

Follow the [synchronization contract](../v0.6/README.md). Collections do not provide snapshot isolation or a replay log. Periodic full reconciliation is required. Webhook payloads are operational records; refetch authorized summaries rather than publishing the webhook body.
