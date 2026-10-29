# Clan meta: counts from a maintained summary

`GET /api/v1/clan/meta` serves workspace identity, enabled games, limits, and counts from a maintained per-clan summary. Counts refresh off the request path at most once a minute.

## What the endpoint promises

The response includes the following fields.

| Field                                     | Source                                           | Freshness                                                           |
| ----------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------- |
| `guild.id`, `guild.guildId`, `guild.name` | the clan document                                | current on every call                                               |
| `enabledGames`                            | `guildGames`, through the `guildId_gameId` index | current on every call                                               |
| `updatedAt` (sync marker)                 | the clan document's own `updatedAt`              | current on every call; current record value                         |
| `counts`                                  | the clan's `clanMetaSummaries` row               | recomputed at most once a minute; may lag the records by up to 60 s |
| `computedAt`                              | the same row                                     | when `counts` were computed (ISO 8601)                              |
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
  which computes counts, through the guild indexes, and stores the
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

## Summary initialization

A missing summary is computed synchronously on its first request. Stale summaries refresh only when requested, so idle clans do not incur scheduled scans. Unknown or revoked keys and missing grants are rejected before summary access.
