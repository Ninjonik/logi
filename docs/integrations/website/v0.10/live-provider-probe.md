# Live HLL CRCON and Warcon read probe — 2026-10-02

**Follow-up delivered:** [Warcon 0.11](../v0.11/README.md) now implements the panel
adapter, fifteen gameplay reads and the dashboard scoreboard. This report remains
the original pre-implementation probe; see the newer
[verification record](../v0.11/verification.md) for current acceptance and limits.

Both operator-supplied credentials work against the supplied HTTPS origins.
The unchanged Logi HLL collector can parse actual status, history pagination and
a completed scoreboard. Warcon's panel API is readable with its organisation
key, but Logi does not yet have a Warcon panel adapter.

This is a bounded, read-only production-provider probe against runtime source
`36af5fa018b4e646e0d22f97dc17b6b9cce5568a`. No Convex instance, Discord bot,
website deployment, provider configuration or continuous collector was changed.
The [sanitized evidence](evidence/2026-10-02-providers/results.json) records the
requests and compatibility results. Raw responses and both keys remain in a
restricted local directory outside the checkout; no player names/IDs are exported.

## What was actually read

Values describe the sampled moment on October 2, not a continuously updated view.

| Provider / data | Observed result | Current Logi processing |
| --- | --- | --- |
| HLL authentication | Protected map-rotation read succeeds with the key; the same read without credentials returns 401 | Existing bearer transport works |
| HLL API discovery | CRCON v12.3.0, 303 documented endpoints; two configured HLL servers | Only the supplied origin, serving server 1, was contacted |
| HLL current state | HTTP 200; St. Mere Eglise Warfare, 0/100 players, Allies 2 / Axis 2 | Existing HTTPS transport and snapshot parser pass unchanged |
| HLL history page | HTTP 200; 10,509 records reported for server 1; first ten sampled | Existing page parser passes and advances to page 2 |
| HLL completed scoreboard | HTTP 200; two player rows in the sampled completed session | Existing session parser passes; kills, deaths, combat, offense, defense and support map to private session metrics |
| HLL extra reads | Live match statistics, game state and map rotation return HTTP 200 | Available upstream; these extra routes are not part of the existing Logi collector |
| Warcon server discovery | HTTP 200; one visible server; key includes `server.view` | Panel adapter required |
| Warcon current snapshot | Summary and live routes return HTTP 200; Bakurani, 0/100, three factions at zero; timestamped healthy observation | Map panel DTO to existing Logi snapshot contract |
| Warcon analytics | HTTP 200 for 24 hours; 319 samples, 2.5 hours covered and one observed player | Analytics ingestion/projection not implemented in Logi |
| Warcon match list | HTTP 200; one row with `endedAt: null` | Ongoing match, not an authoritative completed result |
| Warcon match detail | HTTP 404 `not_found` for that ongoing row | Documentation defines detail for ended matches; completed-match detail remains unverified |
| Warcon leaderboard | HTTP 200; one row for the sampled 7-day query | Dedicated ingestion and website projection not implemented |
| Warcon previously seen players | HTTP 200; one player reported | Requires separate identity/privacy mapping; no automatic Discord/account binding |
| Warcon kill feed | HTTP 200 with `configured: false` and no kills | No kill-feed data to ingest on this instance yet |

The four compatibility checks use the actual production HLL responses with the
unchanged Logi parsers; one additionally uses Logi's actual pinned-address HTTPS
transport against the live origin. The parsed scoreboard retained its completed
state, map, times, score and two unresolved player records. The probe does not
claim that every historical record or provider version is compatible.

## Warcon documentation and integration surface

Two different interfaces must stay distinct:

- [Warcon panel API and organisation keys](https://github.com/warcon-app/warcon/blob/600c32b02212c7815dda842f33a3d096fd835fd1/README.md#bots-and-api-keys)
  — the interface tested here. Send the key to the panel origin with bearer auth.
- [Underlying Wardogs game-server protocol](https://github.com/warcon-app/warcon/blob/600c32b02212c7815dda842f33a3d096fd835fd1/docs/wardogs-api.md)
  — direct `/v1/...` RCON, already referenced by the older Logi handoff. A panel
  organisation key is not the raw game-server RCON password.

The documentation is pinned for reproducibility; it is not proof that the live
panel runs that exact upstream commit. Live observations above are authoritative
for this supplied instance.

| Panel GET route | Use / current verification |
| --- | --- |
| `/api/servers` | Discover visible panel UUIDs and capabilities; tested |
| `/api/live` | Read worker-cached snapshots; tested, preferred polling source |
| `/api/servers/{id}/summary` | One server's snapshot and capabilities; tested |
| `/api/servers/{id}/analytics?range=24h` | Population, uptime, maps, factions and activity; tested |
| `/api/servers/{id}/matches?page=1` | Match history including the current row; tested |
| `/api/servers/{id}/matches/{matchId}` | Ended-match detail; requires an ended fixture before acceptance |
| `/api/servers/{id}/leaderboard?range=7d&page=1&minMinutes=0` | Ranked statistics; tested with a small populated dataset |
| `/api/servers/{id}/players/seen?limit=5&offset=0` | Previously seen players; tested without publishing identities |
| `/api/servers/{id}/kills?limit=5` | Stored kill events; endpoint works, feed not configured |

Additional documented surfaces include player careers, CSV export and live SSE.
They were not exercised. No moderation, reserved-slot, ban, broadcast, automation
or configuration operation was invoked, even where the supplied key carries an
additional capability.

## What this enables for the website

The intended path remains **provider → Logi → website backend → website pages**.
The existing restricted Logi API can serve normalized server snapshots, collector
health, events, reviewed results and exact membership summaries. Game credentials
stay with Logi. The website consumes its own restricted Logi key.

HLL can proceed to separate-local-database acceptance and operator configuration
using the existing collector. Its raw scoreboards remain private until explicitly
linked to an event and reviewed; there is no raw player-statistics website feed.

For Warcon, the next bounded implementation is a new provider adapter using the
panel's live snapshot route. Preserve the distinction between panel UUID and game
join identifier, original observation time, source health, nullable score cap/time
and all factions. Extend the catalog, transport allowlist, parsers, tests and
operator docs together. Do not put a panel key into `wardogs_rcon` or silently
fallback between providers.

Analytics, leaderboards, player careers and match imports need subsequent explicit
data contracts and storage/publication rules. Successful reads do not mean those
features are already in Logi or the website. Completed Warcon result import also
needs a finished match sample. Enable/configure the kill feed separately only if
that future scope is approved.

The consuming website still needs its server-side adapter, projections and refresh
workflow. User OAuth is separate from service-to-service server-data reads.
Production deployment, end-to-end hosted acceptance and earlier role/OAuth limits
remain open. The earlier 564-test local proof is retained; no full suite/build was
rerun for this documentation-only update.

For HLL authentication and endpoint discovery, see the
[CRCON API guide](https://github.com/MarechJ/hll_rcon_tool/wiki/Developer-Guides-%E2%80%90-CRCON-API).
The supplied instance's own `get_api_documentation` was read, so its v12.3.0
methods/permissions took precedence over generic examples.
