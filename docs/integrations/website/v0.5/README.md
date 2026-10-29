# Game data collection

Logi collects configured HLL and Wardogs observations for workspace dashboards and scoped website reads. Connections, credentials, provider identity, and collection health are workspace-scoped. Collected sessions are observations; result confirmation and player identity proof are separate workflows.

## Supported providers

| Provider                   | Implemented reads                                                    | Identity and limits                                                                                                        |
| -------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `hll_crcon`                | `get_public_info`, paged `get_scoreboard_maps`, `get_map_scoreboard` | One configured CRCON origin and explicit server number; private unresolved platform IDs; no automatic player/event linking |
| `wardogs_rcon`             | `/v1/capabilities`, `/v1/status`, optional `/v1/server-id`           | Stable server/join ID; verify it when advertised; arbitrary faction count up to 16; no history, player list or controls    |
| `wardogs_public_directory` | `GET /v1/servers/{serverId}`                                         | Explicit alternative using stable join ID/community UUID, ETag, observation timestamps and attribution; no RCON credential |

For the current single Wardogs server, configure **one** chosen source. The
directory example in the fixtures demonstrates an alternative; Logi never
silently switches between private RCON and public directory data. Warcon is not
a dependency. HLL: Vietnam is not assumed compatible with HLL CRCON.

## Connection setup

Workspace administrators connect servers in **Settings → Game servers**. Provider keys are encrypted with the operator-configured keyring and are not returned to clients. Choose the correct provider and stable server identifier; the Warcon panel UUID differs from the game's join code. Test the connection, enable collection, and inspect its health and observation timestamps. See [game-server credentials](../game-server-credentials.md) for credential modes, encryption, operator sources, and rotation.

## Collection, persistence and recovery

- Snapshots normally poll every 60 seconds. Directory polling also respects
  `meta.refreshSeconds`, capped by the supported 30–3600 second contract and a
  60-second minimum. A 304 retains the original observation time.
- The snapshot scheduler wakes every 30 seconds. Each tick starts at most ten
  source claims, with two collections in flight, and stops starting claims after
  twenty seconds. Claims follow the oldest `nextAttemptAt` across all workspaces;
  no workspace gets priority. A fixed tick-start cutoff prevents a source's newly
  scheduled poll or retry from being collected twice in that tick. The scheduler
  respects the stored poll interval, backoff and `Retry-After`; waking more often
  does not make a source due earlier. Large backlogs still require multiple ticks.
- Each source is claimed transactionally. A 60-second lease and increasing fence
  protect both snapshot and history writes, including overlapping slow ticks.
  HTTP calls retain a 10-second deadline, a shared 30-second source work budget
  and a 2 MiB response bound. In-flight collections finish after the start budget;
  a late result is rejected. With the current snapshot providers, at most three
  HTTP reads per source bound a tick to thirty reads (sixty per minute); healthy
  sources normally use their existing sixty-second or provider-supplied interval.
  A storage failure stops new claims, waits for other in-flight collections and
  fails the action; its uncommitted lease remains for recovery.
- Retry delays are 5 seconds, 10 seconds, then at least 60 seconds before the next
  attempt cycle. `Retry-After` can extend this up to 24 hours. Authorization,
  configuration and unsupported-capability errors pause that collector until
  resumed. Provider errors expose categories, not response bodies or secrets.
- Snapshot and history work have independent leases and health. One failed
  history import cannot erase a successful current snapshot. Collector ticks recover
  expired work; mutations schedule the next attempt atomically. No queue service
  or second bot is introduced.
- HLL discovery reads ten map IDs at a time and commits one normalized session
  per action. Session upsert and its remaining-ID checkpoint share a transaction.
  Keys are `(connectionId, externalId)`, so provider IDs cannot collide across
  connections. A storage failure leaves the lease/checkpoint for recovery.
- Discovery starts a cycle at page one on the first ten-minute collector tick
  at least five minutes after the previous one ended. A cycle collects only the IDs not yet stored complete for the current
  connection generation and ends at the first page whose IDs are all stored, so
  new games arrive within about fifteen minutes without re-reading the archive.
  One tick runs up to 30 steps of one session each, a second apart.
  At most once a day (and on the first cycle after enabling or reconfiguring a
  source) the cycle is a full sweep that re-reads every session to the last
  page, so provider corrections of older games arrive within a day. Replaying a
  sweep is idempotent. Offset pages are only hints: expired work with no pending
  IDs rewinds one page. New-head records need not appear within fifteen minutes
  during a large initial backfill. This is not a provider-consistent snapshot
  guarantee.
- Previously imported unfinished sessions are revisited independently, oldest
  first after five minutes, alternating with discovery so neither starves.
  An end timestamp marks provider completion, **not human result confirmation**.

Collection storage includes `gameDataConnections`, `gameDataHistoryRuns`
and private `gameSessions`. Collection does not rewrite existing event results. Normalized sessions keep times, map, scores, a source digest and only
selected player metrics/IDs. Raw bodies, player names, encounter logs and provider
configuration are not copied into them. IDs remain unresolved; no nickname
matching, verified account link, public profile or confirmed event result is
created. See [retained history](../hll-retained-history.md) and [reviewed results](../v0.10/README.md) for history reads and review workflows.
Retained history follows the workspace’s per-game retention setting.

## Website API

Issue a new restricted key with only the needed resources and games:

```json
{
    "name": "Website server status",
    "readAccess": {
        "resources": ["server-snapshots", "integration-health"],
        "gameIds": ["hell_let_loose", "wardogs"]
    }
}
```

| Request                                                   | Response                                                 |
| --------------------------------------------------------- | -------------------------------------------------------- |
| `GET /api/v1/clan/server-snapshots?game=wardogs`          | `{data: ServerSnapshot[], page: {nextCursor, limit}}`    |
| `GET /api/v1/clan/server-snapshots/{connectionId}`        | `{data: ServerSnapshot}`                                 |
| `GET /api/v1/clan/integration-health?game=hell_let_loose` | `{data: IntegrationHealth[], page: {nextCursor, limit}}` |
| `GET /api/v1/clan/integration-health/{connectionId}`      | `{data: IntegrationHealth}`                              |

Both are storage reads, with independent grants, tenant/game checks, revocation
checks and `Cache-Control: no-store`. No public GET contacts a provider. Pagination
and inclusive `updatedSince` follow the existing clan API contract. Continue
through an empty page when `nextCursor` is non-null. Connection management is
deliberately session-only: bearer service keys do not carry a human actor.

Runtime schemas and OpenAPI share closed Zod DTOs. Snapshots expose only stable
Logi connection identity, guild/game/provider, name, state, map, counts,
N-participant scores, nullable provider instance ID, capability flags, observation
and provider update times, freshness and optional attribution. Health exposes
enabled state, attempt/success/next timestamps, sanitized snapshot/history errors,
capabilities, session count and last successful history import. Origins, tokens,
secret references, checkpoints, private player identities and source fingerprints
are excluded.

`null` means unknown; zero remains zero. Freshness uses **observation time**, not
the most recent HTTP response: stale at 180 seconds and unavailable at 900 seconds.
Errors or an incomplete observation make data stale immediately; disabled/missing
data is unavailable. Stale/unavailable snapshots have `state: "unknown"`, while
retaining the last observed counts and timestamps. `lastSuccessAt` deliberately
means the retained observation timestamp; `lastAttemptAt` indicates a later check.
For directory data, render the returned Wardog Servers attribution link. A 404
means `not_listed`, never proof the server is offline.

Freshness can change solely with elapsed time. An incremental timestamp query
alone cannot detect that transition: poll the small status collection or expire
your website view from `observedAt`, and preserve an unavailable/unknown display
during Logi outages. Live scores and private historical sessions do not update
`match-summaries`. See [reviewed results](../v0.10/README.md) and [Steam verification](../v0.9/README.md) for those separate workflows.
