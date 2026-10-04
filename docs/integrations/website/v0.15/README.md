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
   `403 insufficient_scope`. A collection request without an explicit `game` is
   refused the same way. The gateway cannot know a detail record's game, and
   its generic branch only evaluates restricted keys, so a legacy key reaches
   the route handler.
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
non-empty opaque value from the previous page, at most 4,096 characters, and is
valid only for the same game. Any other parameter, a repeated parameter,
`game=all` or a game combination is `400 invalid_query`. Items are the active
entries ordered by normalized name; follow `nextCursor` until it is `null`.
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
characters are `400 invalid_query`. An unknown, archived, other-workspace or
other-game ID is a generic `404 not_found` without labels.

`ClanTeam` is a closed object: `id`, `gameId`, `name`, `shortCode` (nullable),
`logoUrl` (nullable public URL), `revision` (integer ≥ 1) and `updatedAt`.
Actor identifiers, asset IDs, archive state and audit data are never included.

### Errors

| Status | Code                                 | Meaning                                                          |
| ------ | ------------------------------------ | ---------------------------------------------------------------- |
| 400    | `invalid_query`                      | Not exactly one directory game, bad pagination or malformed ID   |
| 401    | `missing_api_key`, `invalid_api_key` | No bearer key, or the key is invalid or revoked                  |
| 403    | `insufficient_scope`                 | No explicit `teams` grant for this game, or a legacy broad key   |
| 404    | `not_found`                          | Detail only: unknown, archived, other-workspace or other-game ID |
| 429    | `rate_limited`                       | Shared key rate limit; respect `Retry-After`                     |
| 503    | `unavailable`                        | Convex read failed or returned an unexpected shape               |

## Change feed for `teams`

`teams` is a registered `SYNC_RESOURCES` entry, so the existing
[synchronization protocol](../v0.6/README.md) applies with the same grants as
the collection:

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
array of `ClanMatchTeam` entries sorted by slot, or `null` for trainings and
legacy events without stored assignments. Treat `null` and `[]` alike as "no
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
3. Any team-assignment rule violation is `400 invalid_match_teams`: an
   unknown, foreign-workspace, archived or cross-game team; a bad slot or side;
   a duplicate team, slot or non-null side; a concluded match; or a training
   event.
4. The editor read returns `data.matchTeams` (an array of
   `{teamId, slot, side, name, shortCode, logoUrl, teamRevision, capturedAt}`,
   or `null` for trainings and legacy events) and `data.event.matchTeams` with
   the current inputs, so a consumer can round-trip them in an update.
5. Event and match summaries gain `matchTeams` with the same summary array or
   `null`.

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
- Do not derive asset identifiers from the URL; `logoAssetId` is internal and
  absent from every website DTO.

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
node --import tsx --test src/lib/api/teams-route.test.ts src/lib/api/team-fixtures.test.ts src/lib/api/authenticated-clan-route.test.ts src/app/api/v1/openapi.json/route.test.ts
npm run generate:openapi && node scripts/generate-convex-api-offline.mjs
npx tsc --noEmit -p tsconfig.json
npm run test
```

Covered: query and ID parsing; gateway grant decisions for scoped,
other-resource and legacy keys; HTTP mapping of Convex grant refusal, absent
record and failure to `403`/`404`/`503`; generic error envelopes with
`no-store` and rate-limit headers; the OpenAPI paths, schemas, tag and the
`teams` entries in the `changes`/`sync-records` enumerations; and fixture
conformance to the Zod contracts. The route tests mock Convex over HTTP; the
`teamReads:list` and `teamReads:get` handlers themselves are exercised by
[`teams.test.ts`](../../../../src/infrastructure/convex/teams.test.ts).

The event command fields, `refresh_match_team`, `invalid_match_teams` and the
summary/editor `matchTeams` fields are specified here as the website contract;
they ship and are tested with the native match-assignment change, not by the
commands above. No Convex deployment, hosted SSO acceptance, connected-website
(www) deployment, public logo serving or live Discord rendering is claimed by
this document.

## Remaining owner tasks

| Work                                                                                    | Owner                        |
| --------------------------------------------------------------------------------------- | ---------------------------- |
| Directory picker, team rendering and snapshot display in the connected website          | Website frontend/backend     |
| Consume `teams` changes and sync records alongside the existing summary resources       | Website backend              |
| Issue a restricted key with `teams` and the required games; keep it server-side         | Workspace administrator      |
| Deploy the compatible Convex backend and dashboard together before relying on the reads | Operators                    |
| Runtime acceptance on the authorized isolated Convex instance and Discord test channel  | Maintainers                  |
| Public wiki page for the dashboard directory, team picker and logo upload               | Dashboard/wiki maintainers   |
| Explicit league identity mapping and import UI                                          | Later provider-contract work |
