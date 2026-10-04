# Warcon game-data reads

Implementation scope approved in the PR #158 continuation: Logi reads the existing
Warcon panel, and the website keeps its own backend and consumes Logi. Production
game services are read-only; verification writes go to a local Convex database.

## Contract and boundaries

- Add `wardogs_warcon`, distinct from the game's direct `wardogs_rcon` listener.
  The source identifies one panel server UUID. The game's join code is a separate
  value. Origin and credential references remain operator-owned runtime config.
- Reuse the fenced snapshot collector for Discord `/server-status` and existing
  website server snapshots. Import ended Warcon matches through the existing
  checkpointed session collector; imported results still require review.
- Add a `warcon-data` read grant and a bounded detail endpoint on a Logi connection.
  Live scoreboard, analytics, cash history, match pages/details, leaderboard, seen players,
  career, kills, catalogs, rotation, health and capabilities have typed projections.
  Unknown upstream fields, credentials, host addresses, administrative notes,
  moderation records, watch/risk flags and account links are never forwarded.
- Player rows intentionally include game display names and Steam IDs under the
  new explicit grant. They are game observations, not verified Logi membership or
  account ownership. Existing website keys do not acquire this grant implicitly.
- Requests go through Logi's pinned HTTPS GET transport, a fixed endpoint/query
  allowlist, runtime validation, shared cache and per-connection request budget.
  No arbitrary proxy, RCON command execution or external URL parameter is exposed.
- Warcon's authenticated career endpoint aggregates every server visible to its
  key. Before using it, require the key to see exactly the configured server.
  Otherwise fail closed with a documented configuration error. Leaderboards always
  request server scope; seen players use the server-scoped route.
- Provide the same read in the guild administrator dashboard. Enable/disable and
  credential provisioning remain the existing operator workflow; API keys cannot
  turn on a connection or change its upstream permissions.

## Freshness, availability and retention

The live page reads Warcon's worker cache. Logi uses bounded HTTP polling, with a
short shared live cache, rather than a persistent SSE connection. It reports both
fetch and provider timestamps, including separate player/status freshness. Zero
is a measurement; null means unknown. A disabled kill feed remains explicitly
disabled, and an unfinished match has no completed detail. No feed is enabled by
this change. Only completed matches enter the durable reviewed-result pipeline.

Query caches are bounded per connection, expire, and are fenced by configuration
generation. Authentication and source scope are rechecked after network access.
On a provider failure, return an explicit error instead of relabeling old data as
live. The durable snapshot retains the existing stale/unavailable behavior.

## Implementation and acceptance

1. Add validated request/response contracts and provider transport allowlist.
2. Implement live snapshot, every documented gameplay read, and ended-match import.
3. Add scoped, rate-limited cache/action wiring and website/dashboard routes.
4. Add the dashboard preview, OpenAPI, operator and consumer documentation.
5. Test malformed responses, scope isolation, stale data, disabled feed, paging,
   and collector fencing using deterministic fixtures; run full tests/typecheck/build.
6. Exercise the actual Warcon through the actual adapter and isolated local
   Convex/Next runtime. Capture sanitized results and dashboard screenshots.
7. Review the complete change and publish the documentation and proof in PR #158,
   including a standalone discussion comment and remaining upstream limitations.

Source contract: Warcon commit
`600c32b02212c7815dda842f33a3d096fd835fd1`, its README, route handlers and shared
types, cross-checked against authenticated GET responses on 2026-10-02.

Excluded read surfaces are administrative rather than gameplay: org/user/role/key
management, server host configuration, ban/reserve lists, staff notes, risk and
watch flags, automation, audit logs, outbox and webhook configuration. CSV export
duplicates bounded JSON leaderboard pagination. SSE duplicates the live feed but
requires a long-running connection; this implementation exposes timestamped polling.
