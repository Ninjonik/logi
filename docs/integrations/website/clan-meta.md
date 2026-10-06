# Clan meta: counts from a maintained summary

`GET /api/v1/clan/meta` is the website's sync entry point: it is called often,
by every connected website, before and between the resource sweeps. Until
PR #191–#193 landed it counted the clan's `events` (with a roster read per
event), `groups`, `userAssignments`, `calendarItems`, `stratmaps`,
`topicPresets`, `squadPresets`, `matchStats`, `articles`, `apiKeys` and
`guildGames` on **every call**, which cost about 1.1 s at p50 with five
parallel callers and a thousand events on the self-hosted backend. The
request now serves those counts from a per-clan summary document that Logi
maintains off the request path (ARCHITECTURE.md, "Convex hot paths").

## What the endpoint promises

The response shape is unchanged; one field is added.

| Field                                     | Source                                           | Freshness                                                           |
| ----------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------- |
| `guild.id`, `guild.guildId`, `guild.name` | the clan document                                | current on every call                                               |
| `enabledGames`                            | `guildGames`, through the `guildId_gameId` index | current on every call                                               |
| `updatedAt` (sync marker)                 | the clan document's own `updatedAt`              | current on every call; unchanged from before                        |
| `counts`                                  | the clan's `clanMetaSummaries` row               | recomputed at most once a minute; may lag the records by up to 60 s |
| `computedAt` (**new**)                    | the same row                                     | when `counts` were computed (ISO 8601)                              |
| `limits`, `serverTime`                    | the route                                        | current on every call                                               |

`counts` keeps its thirteen keys (`events`, `groups`, `rosters`,
`assignments`, `users`, `calendar-items`, `stratmaps`, `topic-presets`,
`squad-presets`, `matches`, `articles`, `settings`, `api-keys`) with the same
meaning: published events only (drafts are left out with their rosters),
`users` is the number of distinct people with an assignment, `settings` is
always `1`. Use the counts as a hint for sweeps, never as proof that a record
exists or is absent: the resource lists and `/clan/changes` stay
authoritative, and a website that compares counts between two calls should
expect them to move only once a minute.

## How the summary is kept

- `clanMetaSummaries` (one row per clan: `guildId`, the stored tallies,
  `computedAt`, `revision`) is written only by `clanMeta:refreshClanMeta`,
  which runs the old scan once, through the guild indexes, and stores the
  result. It checks the stored `computedAt` again before it writes, so
  concurrent calls write once.
- `publicApiReads:getClanMeta` reads the key (`apiKeys.keyHash`), the clan
  (`guilds.discordId`/`id`), the enabled games (`guildGames.guildId_gameId`)
  and the summary (`clanMetaSummaries.guildId`). It reads no `events`,
  `rosters` or `matchStats` rows; a test over the fake database
  (`src/infrastructure/convex/clan-meta.test.ts`) asserts this.
- The web gateway (`src/lib/public-api.ts` `getClanApiMeta`, through
  `src/lib/api/clan-meta-read.ts`) decides what to do with the stored time
  (`src/domain/api/clan-meta.ts` `clanMetaFreshness`):
    - **missing** (the clan has no summary yet, as after a deployment): the
      refresh runs synchronously and the request answers from its result, so
      the website never sees an empty meta;
    - **stale** (older than `CLAN_META_INTERVAL_MS`, 60 s): the stored counts
      are served as they are and the refresh is fired off the request path,
      at most once per clan and interval in the web process
      (`publicApiMemory.claimClanMetaRefresh`); a failing background refresh
      never fails the request;
    - **fresh**: the stored counts are served and nothing else runs.
- Scoped keys without the `meta` grant, revoked and unknown keys are rejected
  by both the read and the refresh before any further read.

## Operator notes

- Deploy with `bunx convex deploy`: the change adds the `clanMetaSummaries`
  table and the `clanMeta` module. No migration: the first meta call of each
  clan after the deployment computes its summary synchronously (one scan,
  about what a single old call cost) and every later call reads the row.
- Nothing recomputes a clan's summary while no website calls its meta, so an
  idle clan costs nothing; a busy one costs one scan a minute at most.
