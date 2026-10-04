# Workspace team directory handoff

A Logi workspace administrator adds an opponent once, with its name, short code
and logo, then selects that team when preparing a native match. This handoff
describes what the connected website can read about those teams and how it
assigns them to native matches: the explicit `teams` read grant, the
collection/detail endpoints, the change-feed protocol, the immutable
`matchTeams` snapshots inside event/match summaries and the actor-backed event
command fields. The design is the
[workspace team directory specification](../../../superpowers/specs/2026-10-03-team-directory-design.md);
the authoritative closed schemas are
[`team.ts`](../../../../src/domain/teams/team.ts) and
[`match-teams.ts`](../../../../src/domain/teams/match-teams.ts).

The [fixtures](fixtures/) are synthetic consumer examples, not real teams,
workspaces, assets or proof of hosted acceptance.

## Scope and identity

- The directory is **workspace-owned**: it belongs to one Logi community
  workspace, identified to the website by the Discord guild of the API key. An
  opponent needs no Logi account or registered Discord community.
- Entries are **separated by game**: `hell_let_loose` and `wardogs`. Hell Let
  Loose: Vietnam is deliberately not a directory game; requests for it are
  invalid rather than empty.
- `id` is the **stable directory record ID**. It is never a Discord guild ID, a
  competition team ID or a League code. Persist it; it is the identity anchor
  that a later league adapter can map `(workspace, game, provider,
providerTeamId)` onto by explicit administrator decision.
- **No league inference.** Existing Wardogs League cards, watched-team filters
  and ECL competition teams keep working independently. A similar name or
  short code never links a directory team to an external identity, and no
  external codes are converted into directory teams automatically.
- Archiving preserves history: archived teams leave the collection and detail
  reads, but every native match that selected them keeps its captured labels
  and logo.

## Authorization

Issue an explicitly restricted API key with the `teams` resource and the games
the website may read. `teams` is **not implied** by `event-summaries`,
`match-summaries`, `league-fixtures` or any other grant, and **legacy
unrestricted keys never acquire it** (`allowsApiKeyRead(undefined, "teams", …)`
is false).

Authorization is enforced twice:

1. The HTTP gateway (`authenticated-clan-route.ts`) refuses a restricted key
   that lacks `teams`, or, on the collection, lacks the requested game, with
   `403 insufficient_scope`. A collection request without an explicit `game`,
   with `game=all` or with an unknown game value is refused the same way. The
   gateway cannot know a detail record's game, and its generic branch only
   evaluates restricted keys, so a legacy key reaches the route handler.
2. `teamReads:list` and `teamReads:get` **recheck inside Convex** that the key
   exists, is not revoked, belongs to the same guild, carries a restricted
   `readAccess` policy and grants `teams` for the requested game. Any refusal,
   including every legacy key, is the same generic `403 insufficient_scope`.

The key supplies the workspace boundary; no request parameter selects another
guild. Reading teams does not grant the directory audit, asset management or
any write.

## Endpoints

Both reads are in the [generated OpenAPI document](/api/v1/openapi.json) under
the tag **Clan API — Teams** with
`x-logi-read-access: { resource: "teams", games: ["hell_let_loose", "wardogs"], explicitGrantRequired: true }`.
All responses are `Cache-Control: no-store` and carry the usual `RateLimit-*`
headers.

### Collection

```http
GET /api/v1/clan/teams?game=hell_let_loose&limit=50
Authorization: Bearer <restricted service key>
```

Exactly one `game` is required; `limit` is 1–100 (default 50); `cursor` is the
non-empty opaque `nextCursor` from the previous page, at most 4,096 characters.
Logi signs it for the workspace and game it was issued for, so a forged cursor
or one reused with another game is `400 invalid_query` before any read. The gateway checks the requested games against
the key first: a missing or empty `game`, `game=all`, an unknown game value, or
any game (alone or in a combination) the key does not grant is
`403 insufficient_scope`. A request the grant allows is then validated by the
route, so a combination of granted games, a repeated `game`, a granted game
without a directory (Hell Let Loose: Vietnam), any other or repeated parameter
and bad pagination are `400 invalid_query`. Items are the active entries
ordered by normalized name; follow `nextCursor` until it is `null`.
Unlike the summary collections, the page is an object inside `data`:

```json
{
    "data": {
        "items": [
            {
                "id": "kh7synthetic0hll0team00000000a1",
                "gameId": "hell_let_loose",
                "name": "Synthetic Armoured Division",
                "shortCode": "SAD",
                "logoUrl": "https://logi.example/api/image-assets/0123456789abcdef0123456789abcdef.png",
                "revision": 3,
                "updatedAt": "2026-10-03T10:00:00.000Z"
            }
        ],
        "nextCursor": null
    }
}
```

### Detail

```http
GET /api/v1/clan/teams/kh7synthetic0hll0team00000000a1?game=hell_let_loose
Authorization: Bearer <restricted service key>
```

The detail read returns `{ "data": ClanTeam }` and accepts no parameter other
than one `game`. The ID path segment must be an opaque identifier of 1–64
letters, digits, `_` or `-`; traversal, separator, encoded or whitespace
characters are `400 invalid_query`. The gateway cannot know a record's game,
so here the route validates `game`: a missing or empty value, `game=all`, a
combination or a game without a directory is `400 invalid_query`, and a single
directory game the key does not grant is refused by Convex with
`403 insufficient_scope`. An unknown, archived, other-workspace or other-game ID
is a generic `404 not_found` without labels.

`ClanTeam` is a closed object: `id`, `gameId`, `name`, `shortCode` (nullable),
`logoUrl` (nullable public URL), `revision` (integer ≥ 1) and `updatedAt`.
Actor identifiers, asset IDs, archive state and audit data are never included.

### Errors

| Status | Code                                 | Meaning                                                                                                                                                                                                                             |
| ------ | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400    | `invalid_query`                      | A request the grant allows but the route rejects: combined or repeated `game`, a game without a directory, unknown or repeated parameters, bad pagination or a malformed ID; on the detail read also a missing `game` or `game=all` |
| 401    | `missing_api_key`, `invalid_api_key` | No bearer key, or the key is invalid or revoked                                                                                                                                                                                     |
| 403    | `insufficient_scope`                 | No explicit `teams` grant for the requested game(s), or a legacy broad key; on the collection also a missing or empty `game`, `game=all` or an unknown game value (gateway)                                                         |
| 404    | `not_found`                          | Detail only: unknown, archived, other-workspace or other-game ID                                                                                                                                                                    |
| 429    | `rate_limited`                       | Shared key rate limit; respect `Retry-After`                                                                                                                                                                                        |
| 503    | `unavailable`                        | Convex read failed or returned an unexpected shape                                                                                                                                                                                  |

## Change feed for `teams`

`teams` is a registered `SYNC_RESOURCES` entry, so the existing
[synchronization protocol](../v0.6/README.md) applies with the same grants as
the collection. As on the collection, a game without a directory (Hell Let
Loose: Vietnam) is `400 invalid_query` for `resources` that include `teams` and
for `sync-records/teams/…`, never an empty page:

```http
GET /api/v1/clan/changes?game=hell_let_loose&resources=teams&start=now
GET /api/v1/clan/sync-records/teams/<team-id>?game=hell_let_loose
```

Create, update and **restore** emit `upsert`; **archive** emits `remove`.
Change records are written in the same transaction as the directory mutation.
The sync record for an upsert carries the same `ClanTeam` DTO as the detail
read; a removal is a retained tombstone with `data: null`, and an expired
tombstone or an unknown ID is `404`. Bootstrap the cursor with `start=now`
before paging the collection, then replay changes and hydrate upserts from sync
records.

Directory changes do **not** emit invented match changes. A native match whose
team is later renamed or archived keeps its snapshot; only an explicit
`refresh_match_team` or an assignment change advances that event's own
`event-summaries`/`match-summaries` revision.

## Match snapshots in summaries

When a team is first assigned to a match, Logi captures its name, short code,
logo URL and directory revision into the event. That snapshot is
**immutable**: slot or side edits, directory renames, logo changes and
archival never rewrite it, and an archived team keeps its labels and logo in
every historical match. The only way to update it is the explicit
`refresh_match_team` actor action described below.

The `event-summaries` and `match-summaries` documents carry `matchTeams`: an
array of `ClanMatchTeam` entries sorted by slot, or `null` when no assignment
was ever stored. `null` covers trainings, events saved before team selection
existed and matches created by a client that omitted `matchTeams`: a website
`create` without the field, a bearer-key `POST /api/v1/clan/events` (which
cannot assign teams) or a match created by the Discord bot. A match created in
the dashboard stores `[]` until teams are chosen, and an explicit `[]` clears a
selection. Do not read `null` as "legacy"; treat `null` and `[]` alike as "no
assigned teams".

| Field                          | Meaning                                                                       |
| ------------------------------ | ----------------------------------------------------------------------------- |
| `teamId`                       | Stable directory ID; may refer to a team that is now archived                 |
| `slot`                         | `a`/`b` (Hell Let Loose) or `a`/`b`/`c` (Wardogs)                             |
| `side`                         | `Allies`/`Axis`, `Valkyra`/`Manticore`/`Lonestar` or `null`                   |
| `name`, `shortCode`, `logoUrl` | Presentation captured at first assignment or last refresh                     |
| `teamRevision`                 | Directory revision captured; compare with `ClanTeam.revision` to detect drift |
| `capturedAt`                   | When the snapshot was captured                                                |

Receiving snapshots through an `event-summaries` or `match-summaries` grant does
not grant the `teams` directory. Do not infer teams from event titles or sides.
See [`match-teams-hll.json`](fixtures/match-teams-hll.json) and
[`match-teams-wardogs.json`](fixtures/match-teams-wardogs.json).

### Complete event records versus minimized summaries

The summaries above are the presentation contract. The complete native event
record is different: `GET /api/v1/clan/events` and `GET /api/v1/clan/events/{id}`
(the `events` grant, which legacy unrestricted keys also read), the bearer-key
`POST`/`PATCH /api/v1/clan/events` responses and the `event.created` and
`event.updated` webhook payloads return the stored record, kept complete. When
an assignment was stored, its `matchTeams` is the stored list
`{ teamId, slot, side, snapshot: { name, shortCode, logoAssetId, logoUrl, teamRevision, capturedAt } }`
(OpenAPI `ClanEventsDocument`). `snapshot.logoAssetId` is an internal
image-asset record ID: it is not a URL, grants no access and must not be
persisted, shown or used to build a URL. Present teams from the summaries'
`matchTeams` (`ClanMatchTeam`, which carries only `logoUrl`), or from
`snapshot.logoUrl` when only the complete record is available.

## Actor-backed event commands

The [website event commands](../event-commands.md#team-directory) carry team
assignments with unchanged SSO actor checks, per-game event-write policy,
`Idempotency-Key` and `expectedRevision` semantics. An API key alone remains
unable to write.

1. The `event` object of `create` and `update` accepts an optional
   `matchTeams: [{ "teamId", "slot": "a" | "b" | "c", "side": string | null }]`
   with at most three entries. Hell Let Loose uses slots `a`, `b` with sides
   `Allies`/`Axis`; Wardogs uses slots `a`, `b`, `c` with sides
   `Valkyra`/`Manticore`/`Lonestar`. **Omitting** the field preserves the saved
   assignments; `[]` **clears** them while the event is editable. Clients never
   send snapshots: Logi captures `name`, `shortCode`, the logo, the team
   revision and `capturedAt` when a team is first assigned and keeps them
   through slot/side edits, renames, logo changes and archival.
2. `{ "operation": "refresh_match_team", "eventId", "expectedRevision", "teamId" }`
   re-captures one assigned team's presentation from its active directory entry
   before the match concludes. It is audited and respects revision and
   idempotency semantics like `update`.
3. `400 invalid_match_teams` covers every team-assignment problem: a body
   whose only schema failures lie in `event.matchTeams` (more than three
   entries, a slot other than `a`/`b`/`c`, a side that is empty or longer than
   32 characters, a `teamId` outside 1–64 characters, or extra keys such as a
   snapshot); an unknown, foreign-workspace, archived or cross-game team; a
   slot or side the game does not have; a duplicate team, slot or non-null
   side; teams assigned to a training; and a `refresh_match_team` of a team
   that is not assigned, of a training or of a concluded match. An `update` or
   `cancel` after meeting start or of a concluded event is `409 invalid_state`
   before any team rule is evaluated. A match counts as concluded once it is
   stored as concluded or 15 minutes after its game end, whichever is first.
4. The editor read returns `data.matchTeams` (an array of
   `{teamId, slot, side, name, shortCode, logoUrl, teamRevision, capturedAt}`,
   or `null` for a training or a match that never stored an assignment) and,
   when an assignment is stored, `data.event.matchTeams` with the current
   inputs, so a consumer can round-trip them in an update.
5. Event and match summaries gain `matchTeams` with the same summary array or
   `null`.

Bearer-key `POST`/`PATCH /api/v1/clan/events` writes treat `matchTeams` as
read-only: an API key alone is not a writing actor. A `matchTeams` field in the
body is ignored, so a `GET` → `PATCH` round trip stays valid, and the saved
assignments are kept. When `gameId` or `kind` changes, the kept assignments are
re-validated: a match that becomes a training drops them unless it has
concluded, and a game the saved teams no longer fit is
`400 validation_error` with the message `match_teams:<code>` (for example
`match_teams:team_game_mismatch`). Assign, clear or refresh teams only through
the actor-backed event commands or in the Logi dashboard.

## API-parity exception: catalogue writes and logo uploads

Creating, editing, archiving and restoring directory teams and uploading logos
are **session-bound dashboard administrator operations** in Logi. A bearer-key
`/api/v1` catalogue-write or upload API is deliberately excluded: the approved
website scope is read-only for catalogue management, and the existing
event-write policy does not authorize directory administration. This is the
documented exception to the repository's feature/API parity rule for this
feature; the website links administrators to Logi for directory maintenance.
Assigning existing directory teams to a native match is not part of the
exception: it is available through the actor-backed event commands above.

## Logo URL rules

- `logoUrl` is an **immutable public presentation URL** of the form
  `https://<logi-host>/api/image-assets/<32 hex characters>.png`. Treat it as
  opaque. It points to the server-normalized static logo (PNG, JPEG or WebP
  input of at most 2 MiB and 4096×4096 pixels, published as a PNG of at most
  512×512) with its image content type and `nosniff`.
- Replacing a team's logo produces a new URL; snapshots keep the old one, and
  assets referenced by a directory entry or snapshot are never deleted.
- Logos are public presentation assets; knowing a URL grants no other data.
  Without a logo, `logoUrl` is `null`; render short-code or name initials, as
  Logi does (`teamInitials`).
- Do not derive asset identifiers from the URL. `logoAssetId` is internal: it
  is absent from `ClanTeam`, the summaries' `ClanMatchTeam` and the command
  editor, and appears only inside the snapshots of complete event records (see
  [Complete event records versus minimized summaries](#complete-event-records-versus-minimized-summaries)).

## Fixtures

All fixtures live in [`fixtures/`](fixtures/) and are parsed by
[`team-fixtures.test.ts`](../../../../src/lib/api/team-fixtures.test.ts):

| File                                                            | Schema                                          |
| --------------------------------------------------------------- | ----------------------------------------------- |
| [`team.json`](fixtures/team.json)                               | `ClanTeam` detail envelope with a logo          |
| [`team-without-logo.json`](fixtures/team-without-logo.json)     | `ClanTeam` with `shortCode`/`logoUrl` null      |
| [`teams-page.json`](fixtures/teams-page.json)                   | `ClanTeamPage` collection envelope              |
| [`team-change-upsert.json`](fixtures/team-change-upsert.json)   | `IntegrationChange` page, `teams` upsert        |
| [`team-change-remove.json`](fixtures/team-change-remove.json)   | `IntegrationChange` page, `teams` remove        |
| [`sync-record-team.json`](fixtures/sync-record-team.json)       | `IntegrationSyncRecord` upsert with the DTO     |
| [`match-teams-hll.json`](fixtures/match-teams-hll.json)         | `matchTeams` excerpt: two slots, Allies/Axis    |
| [`match-teams-wardogs.json`](fixtures/match-teams-wardogs.json) | `matchTeams` excerpt: three slots, all factions |

## Verification

This increment was verified locally with synthetic tests and static checks
only:

```shell
node --import tsx --test src/lib/api/teams-route.test.ts src/lib/api/team-fixtures.test.ts src/lib/api/authenticated-clan-route.test.ts src/lib/api/integration-query.test.ts src/app/api/v1/openapi.json/route.test.ts src/application/teams/*.test.ts src/infrastructure/convex/teams.test.ts src/infrastructure/convex/teams-authorization.test.ts
npm run generate:openapi && node scripts/generate-convex-api-offline.mjs
npx tsc --noEmit -p tsconfig.json
npm run test
```

Covered: query and ID parsing; gateway grant decisions for scoped,
other-resource and legacy keys; HTTP mapping of Convex grant refusal, absent
record and failure to `403`/`404`/`503`; generic error envelopes with
`no-store` and rate-limit headers; the OpenAPI paths, schemas, tag and the
`teams` entries in the `changes`/`sync-records` enumerations; and fixture
conformance to the Zod contracts; signed collection cursors; and the Vietnam
refusal on the `teams` change feed. The route tests mock Convex over HTTP; the
`teamReads:list` and `teamReads:get` handlers themselves are exercised by
[`teams.test.ts`](../../../../src/infrastructure/convex/teams.test.ts), and
[`teams-authorization.test.ts`](../../../../src/infrastructure/convex/teams-authorization.test.ts)
refuses revoked, expired and demoted dashboard actors on every directory,
asset and refresh handler, and revoked, legacy and ungranted keys on the
reads and the `teams` sync record. The directory writes and the snapshot
refresh are application use-cases tested with fakes in
[`src/application/teams`](../../../../src/application/teams).

The event command fields, `refresh_match_team`, `invalid_match_teams` and the
summary/editor `matchTeams` fields ship in the same change and are covered by
[`website-event-commands.test.ts`](../../../../src/infrastructure/convex/website-event-commands.test.ts),
[`event-match-teams.test.ts`](../../../../src/infrastructure/convex/event-match-teams.test.ts),
[`website-event-command-route.test.ts`](../../../../src/lib/api/website-event-command-route.test.ts)
and [`website-command.test.ts`](../../../../src/domain/events/website-command.test.ts).
No Convex deployment, hosted SSO acceptance, connected-website (www)
deployment, public logo serving or live Discord rendering is claimed by this
document; runtime acceptance on the isolated Convex instance, in a browser and
in the Discord test channel is still pending (see below).

## Remaining owner tasks

| Work                                                                                    | Owner                        |
| --------------------------------------------------------------------------------------- | ---------------------------- |
| Directory picker, team rendering and snapshot display in the connected website          | Website frontend/backend     |
| Consume `teams` changes and sync records alongside the existing summary resources       | Website backend              |
| Issue a restricted key with `teams` and the required games; keep it server-side         | Workspace administrator      |
| Deploy the compatible Convex backend and dashboard together before relying on the reads | Operators                    |
| Runtime acceptance on the authorized isolated Convex instance and Discord test channel  | Maintainers                  |
| Explicit league identity mapping and import UI                                          | Later provider-contract work |

The public wiki pages for the dashboard directory, team picker and logo upload
are delivered: [Teams](../../../../content/operations/teams.mdx), the Teams
section of [Matches](../../../../content/operations/matches.mdx) and the API
notes in [Settings](../../../../content/configuration/settings.mdx).
