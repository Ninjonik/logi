# Warcon read integration · 0.11

Logi can read the Warcon panel's gameplay data, collect its server snapshot and
completed matches, and serve fifteen typed views to the website backend. The
dashboard includes a live scoreboard. This extends PR #158; the website retains
its own backend, authentication, publishing policy and presentation.

Read the [design](warcon-design.md) and [verification record](verification.md).
The earlier [provider probe](../v0.10/live-provider-probe.md) describes the state
before this implementation. Production activation and website adoption are
separate from the local and provider acceptance recorded here.

## What is available

Use `GET /api/v1/clan/warcon-data/{connectionId}?game=wardogs&view=...`.
`connectionId` is the Logi connection ID returned by `server-snapshots`, not the
Warcon panel UUID or the game's join code. Every row below uses the same route.

| View | Data | Optional selectors (defaults) |
| --- | --- | --- |
| `live` | Player names/Steam IDs, factions, kills, deaths, cash, ping; counts, scores, map, experiences, lighting, join code, limits when known, observation timestamps | None |
| `analytics` | Population and cash series, uptime, maps, wins, activity by hour, players, matches, nullable combat summary | `range=24h` (`7d`, `30d`) |
| `cash` | Timestamped total and faction cash, preserving missing samples | `since` ISO timestamp; upstream defaults to one hour, clamps to 24 hours/latest 3,000 samples |
| `matches` | Current and completed match summaries, final scores, winner, counts | `page=1`; 50 rows/page |
| `match` | Completed match, players, timeline, awards, scores and kill-feed availability | **Required** `matchId`; ongoing or absent detail returns `data:null` |
| `leaderboard` | Server-scoped ranks, play/seed time, kills/deaths, cash, match results, feed statistics | `range=30d` (`7d`, `90d`, `all`), `sort=kills`, `dir=desc`, `page=1`, `minMinutes=60` |
| `players` | Players seen on this server, first/last seen, sessions, time, kills/deaths, online state | `q`, `since=0` days, `sort=lastSeen`, `dir=desc`, `offset=0`, `limit=50` (1–100) |
| `career` | Match outcomes, maps/factions, play time, combat aggregates, recent matches | **Required** `steamId`; upstream key must see exactly the configured server |
| `kills` | Event IDs/time, killer/victim, factions, cause, range, headshot/team-kill/suicide flags, tags | `limit=50` (1–200), `before`, `beforeTime`, `match`, `player`, `killer`, `victim`, `cause`, `kind`, `minM` |
| `catalog` | Map, lighting and experience IDs/display labels | None |
| `rotation` | Rotation mode, current/next indices and entries | None |
| `health` | Game API status, uptime, connections and queue counters | None |
| `capabilities` | Available game API routes and feature flags | None; this does not grant command execution |
| `experiences` | Available game-mode IDs/display labels | `map` catalog ID |
| `alternators` | Available zone-alternator tags/display labels | **Required** `map` catalog ID |

Leaderboard sorts: `kills`, `deaths`, `kd`, `perHour`, `playtime`, `seeded`,
`matches`, `wins`, `winRate`, `cash`. Seen-player sorts: `lastSeen`, `firstSeen`,
`minutes`, `sessions`, `kills`, `deaths`, `name`. Both accept `asc`/`desc`.
Kill kinds: `headshot`, `teamKill`, `suicide`, `vehicle`, `environment`.
Use the final kill's `ts` and `eventTime` as `before`/`beforeTime` together for
cursor pagination. The second cursor without the first is rejected.
All pages are bounded; see `WarconQuery` and `WarconEnvelope` in
`/api/v1/openapi.json` for exact types, bounds and discriminated response schemas.
Unknown, duplicate and inapplicable parameters return HTTP 400.

**Map identifiers matter:** the real catalog returned `Kavkazi` while the live
map's display name was `Bakurani`. Pass catalog IDs to map-filtered reads. Do not
infer IDs from display labels. Unknown score limits and match time remain null.

## Website contract and authorization

Create a read-only Logi API key in **System → Website API** with an explicit
**Warcon gameplay data** grant and **Wardogs** selected. Grant `server-snapshots`
and `integration-health` separately if needed. Existing keys, including legacy
full-access keys, do not gain this player-data grant automatically. Create a
replacement scoped key and revoke the old one after switching the consumer.

The website backend holds the Logi key. The browser never receives that key or
the Warcon credential. For example, from the website backend:

```ts
const response = await fetch(
  `${process.env.LOGI_URL}/api/v1/clan/warcon-data/${connectionId}?game=wardogs&view=live`,
  { headers: { Authorization: `Bearer ${process.env.LOGI_API_KEY}` }, cache: "no-store" },
)
if (!response.ok) throw new Error(`Logi read failed: ${response.status}`)
const { data } = await response.json()
// data: { connectionId, gameId, provider, fetchedAt, cacheUntil,
//         result: { view: "live", data: { status, players, statusAt, playersAt, ... } } }
```

All responses use `Cache-Control: no-store`. Missing/invalid/revoked keys return
401; a missing resource/game grant or denied connection returns 403. Query errors
return 400, a busy lease/budget/provider rate limit returns 429 with `Retry-After`,
and other provider failures return 503 with a fixed error category. Consumers
must honor `Retry-After` and display unavailable data honestly.

The connection belongs to the key's guild and must be enabled, use
`wardogs_warcon`, and match the current operator source configuration. Convex
checks these conditions independently of Next.js, before and after network
access. Disable, key revocation, changed configuration and expired leases prevent
an in-flight response from being published. The signed-in guild administrator
route uses the same read service at
`/api/servers/{serverId}/game-data/{connectionId}`.

Player names and Steam IDs are deliberately included under the new grant. They
are observations, not verified Logi identities or public-member consent. The
website must choose what to publish. Existing server snapshots remain free of
player rows. Administrative notes, moderation lists, risk/watch flags, credentials,
private host configuration and account links are removed by explicit projections.

Warcon's career route aggregates every server visible to its upstream key, even
when called under one server URL. Logi first checks `/api/servers` and permits
career only when that list contains exactly this connection's server. A broader
key returns a configuration failure. Use a single-server Warcon key. Leaderboard
requests always force `scope=server`; player searches use the scoped route.

## Freshness, polling and storage

The panel's live feed is available through timestamped HTTP reads. Logi polls
Warcon's worker cache; it does not maintain an SSE connection. Dashboard polling
runs every 15 seconds while the scoreboard is expanded and the tab visible.
Collapsing/unmounting aborts its read; errors clear the displayed player table.
Manual scoreboard refresh can reuse the shared ten-second cache.

Status and players have independent source timestamps. They are **fresh** below
45 seconds, **stale** from 45 to 180 seconds, and **unavailable** at 180 seconds or
when timestamps are absent/future. An unhealthy upstream cannot be fresh. Fetching
an old worker snapshot does not refresh these timestamps. Unavailable player rows
are hidden. The separate durable snapshot cards and Discord command retain the
existing three-minute stale/fifteen-minute unavailable thresholds.

Shared query caches last 10 seconds for live, 15 seconds for kills, five minutes
for catalogs/capabilities/experiences/alternators, and 60 seconds for other views.
Each connection allows 30 cache misses/minute, one 35-second lease per query and
at most 64 retained variants. Query rows are pruned after one inactive hour.
Provider 429 backs off all new queries on that connection; other errors back off
only the failed query. Already valid cached data can still be served with current
authorization. The provider transport is HTTPS GET only, pins validated DNS
addresses, rejects redirects, limits responses to 2 MiB, and only allows fixed
server-scoped paths. Projected cached responses are capped at 512 KiB.

Only snapshots and completed match sessions enter durable collection. Other
views are on-demand cache data and are not additions to the existing change feed
or webhook payload. Poll those views directly. Clients may refresh snapshot and
health views through the established change-feed flow.

Completed matches use the existing resumable history collector and are stored
as `wardogs` sessions. Ongoing matches are skipped; they do not become results.
Final zero scores and negative cash deltas survive mapping. Feed-derived metrics
are null in stored sessions when `hasFeed=false`. Import does not confirm a result
or link a Steam account: the existing manager review and verified-identity workflow
still applies. Read DTOs preserve Warcon's `hasFeed`, `configured` and nullable
combat fields; a zero counter alone is not proof of feed coverage.

## Operator setup and activation

Provision the Warcon key only in the Convex runtime environment. Example source
catalog entry (all values below are placeholders):

```json
{
  "ref": "wardogs-warcon-primary",
  "guildId": "DISCORD_GUILD_ID",
  "gameId": "wardogs",
  "provider": "wardogs_warcon",
  "providerServerId": "11111111-1111-4111-8111-111111111111",
  "origin": "https://warcon.example.org",
  "secretRef": "LOGI_GAME_DATA_WARCON_TOKEN",
  "allowedAddresses": []
}
```

Put the entry in `LOGI_GAME_DATA_SOURCES` and store the token under the referenced
variable. Public origins use normal address validation. Private-network sources
require the existing explicit address allowlist and a valid TLS certificate.
No client receives these settings. Use the panel UUID from `/s/{uuid}`, not the
game join code. A direct game listener belongs to `wardogs_rcon`, not this adapter.

After deploying this revision to the intended Logi runtime, enable the prepared
source in **System → Game server data**. Select one provider per actual server to
avoid duplicate observations. Check snapshot/history health, open **Live Warcon
scoreboard**, and test the scoped website key. Disable the connection to stop
reads/collection and reject old-generation results. No feed, moderation or server
settings are changed by activation. `/server-status game:wardogs` uses the stored
snapshot and now labels the source **Wardogs Warcon**; it has no live player-list
command and does not initiate an upstream request.

## Upstream documentation and deliberate exclusions

Contract inspected at Warcon commit
`600c32b02212c7815dda842f33a3d096fd835fd1`:
[README and API keys](https://github.com/warcon-app/warcon/blob/600c32b02212c7815dda842f33a3d096fd835fd1/README.md#bots-and-api-keys),
[game-server protocol](https://github.com/warcon-app/warcon/blob/600c32b02212c7815dda842f33a3d096fd835fd1/docs/wardogs-api.md),
and the Next.js route implementations/types in that same revision. The gameplay
reads were cross-checked with the supplied instance on October 2, 2026.

“All reads” here means the fifteen gameplay views above. Org/users/keys/roles,
server host configuration, bans/reserves, staff notes, watch/risk enrichment,
audit/outbox/automation and webhook administration are outside the website data
contract. CSV is covered through paginated JSON; SSE through timestamped polling.
The summary route duplicates the live route and its permission metadata is not
forwarded. No POST/PATCH/DELETE or arbitrary RCON proxy is exposed.
