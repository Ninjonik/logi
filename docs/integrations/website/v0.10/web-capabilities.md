# Website capabilities and API map

The [Warcon 0.11 handoff](../v0.11/README.md) adds fifteen typed gameplay views,
live player scoreboards and completed Wardogs match collection. These reads need
the new explicit `warcon-data` + `wardogs` grant; the existing snapshot grant does
not include player rows. See the handoff for queries, freshness and proof.

This is the consumer catalog for [PR #158](pr-handbook.md). Runtime OpenAPI version
is **1.8.0** at `/api/v1/openapi.json`, with interactive `/api/v1/docs`. These are
source contracts; the hosted instance must be checked during authorized deployment
acceptance before relying on that version there.

The [live CRCON/Warcon read probe](live-provider-probe.md) distinguishes data
available from the actual providers from the resources currently exported by Logi.
The subsequent Warcon handoff implements those gameplay reads. The
[League 0.12 handoff](../v0.12/README.md) adds public match URL previews through
the explicit `league-matches` + `wardogs` grant, with nullable fields and stale
snapshot metadata. Only Scheduled League fixtures have real-page acceptance.

## What the website can build from Logi

| Website capability | Logi data / flow | Website responsibility and limits |
| --- | --- | --- |
| HLL/Wardogs calendar and event listings | `event-summaries` | Map routes/locales, editorial visibility, own public cache; operational event edits remain in Logi |
| Match schedule and imported scores | `match-summaries` | Preserve `unknown`/`provisional`, no inferred final result or home/away identity |
| Reviewed result pages and corrections | `result-summaries` | Show explicit state/version and N participants; retain 0 versus null; publication still needs website approval |
| Game-server cards | `server-snapshots` | Show observation age and source attribution, unknown/stale rather than guessed offline/zero |
| Warcon scoreboard, analytics and gameplay statistics | `warcon-data` + `wardogs` | Fifteen typed views, including player names/Steam IDs; keep keys server-side and apply website publication policy |
| Wardogs League fixture preview from a pasted URL | `league-matches` + `wardogs` | Public teams/factions, schedule, map and preparation; poll every 5–10 minutes, retain stale metadata, no inferred results or automatic event creation |
| Integration administration / stale-data notices | `integration-health` | Restrict to appropriate website operators; do not expose provider secrets or raw errors |
| Member-only/game-specific sections | Exact `membership-summaries` lookup | Authenticate the user, bind their Discord subject, check freshness and your game/role policy on each decision |
| Recovery after missed notifications or restarts | Changes feed, atomic refetch, signed webhooks | Durable inbox, projections and checkpoint transactions; periodic reconciliation and reset handling |
| Private staff roster/group tools | Explicitly granted legacy operational reads | Extra review of sensitive fields and audience; these are not minimized public profiles |
| Link to operational actions | Existing Logi dashboard and bot | Keep one operational writer; no delegated website actor-command protocol is supplied |
| Verified result attribution | I5 proof used internally by D4 | Public summaries expose counts, not raw Steam/Discord identities or an account-proof directory |

The initial website integration is read-only. Existing legacy write endpoints do
not authorize this consumer to mutate operational data. A service bearer key must
not stand in for a human reviewer, account owner or Discord administrator.

## IDs, games and authorization

| Concept | Contract |
| --- | --- |
| HLL API game | `hell_let_loose`; map to website game `hell-let-loose` and route `/{locale}/hll` |
| Wardogs API game | `wardogs`; map explicitly to `/{locale}/wardogs` |
| Source instance | Keep a website-owned stable ID for the configured Logi origin |
| Guild | Comes from the key; do not trust a browser-supplied guild to select authority |
| Event/match/result summary ID | Logi event ID; not a CRCON session or raw match-statistics ID |
| Snapshot/health ID | Logi connection ID; not a provider endpoint or password |
| Membership subject | One verified 17–20 digit Discord ID, not nickname or imported player ID |
| Stored projection key | `(sourceInstance, guildId, gameId, resource, externalId)` |

Use a fixed HTTPS origin, bounded requests and server-side secret storage. Give
each consumer a revocable restricted key with only required resources/games. The
UI initially selects `event-summaries` and `match-summaries`; all other grants need
explicit selection. A present malformed restriction fails closed. Legacy keys
remain powerful and are not a substitute for scoped keys.

Supported restricted resource names are `event-summaries`, `match-summaries`,
`result-summaries`, `server-snapshots`, `integration-health`, `membership-summaries`, `warcon-data`,
`events`, `groups`, `rosters`, `assignments`, `stratmaps`, and `matches`.
The last six are operational resources and can contain data inappropriate for a
public site. Raw `users` is not an allowed restricted resource. Resource names and
backend policy are defined in [`key-access.ts`](../../../../src/domain/api/key-access.ts).

## Minimized HTTP read surface

Every route below uses `Authorization: Bearer <restricted server-side key>`.
Paths are relative to `/api/v1/clan`. See the linked versioned contract for field
schemas and full errors; examples use synthetic IDs only.

| GET path | Grant / additional gate | Shape and use |
| --- | --- | --- |
| `/event-summaries?game=wardogs` and `/event-summaries/{eventId}` | `event-summaries` and stored game | Scheduled match/training summaries; [0.4](../v0.4/README.md#http-contract) |
| `/match-summaries?game=hell_let_loose` and `/match-summaries/{eventId}` | `match-summaries` and stored game | Non-training event, unknown/provisional import; [0.4](../v0.4/README.md#http-contract) |
| `/result-summaries?game=wardogs` and `/result-summaries/{eventId}` | Independent `result-summaries` grant | Unknown/provisional/confirmed/corrected revision; [0.10](README.md#website-read-contract--openapi-160) |
| `/server-snapshots?game=wardogs` and `/server-snapshots/{connectionId}` | `server-snapshots` | Safe current observation and freshness; [0.5](../v0.5/README.md#website-api-130) |
| `/integration-health?game=hell_let_loose` and `/integration-health/{connectionId}` | `integration-health` | Collector health/freshness without secrets; [0.5](../v0.5/README.md#website-api-130) |
| `/warcon-data/{connectionId}?game=wardogs&view=live` | Explicit `warcon-data` + `wardogs`; legacy keys denied | Timestamped gameplay projection; fifteen views in [0.11](../v0.11/README.md), including deliberately granted player names/IDs |
| `/membership-summaries/{discordUserId}?game=wardogs&maxAgeMs=60000` | `membership-summaries` **and enabled per-key/game policy** | Exact subject observation; no collection endpoint; [0.7](../v0.7/README.md) |
| `/changes?game=wardogs&resources=event-summaries,result-summaries&start=now` | Restricted key with all requested resource/game grants | Initial signed cursor, then paged changes; [0.6](../v0.6/README.md) |
| `/sync-records/{resource}/{id}?game=wardogs` | Same restricted grants; membership also needs its policy | Atomic projection/revision or tombstone; [0.6](../v0.6/README.md) |

Regular summary collections return `{data: [...], page: {nextCursor, limit}}`;
details return `{data: ...}`. Collections support `limit` 1–100, opaque `cursor`,
`sort=createdAt` and inclusive `updatedSince`. Restricted collections require
explicit permitted games; details enforce the persisted guild/game. Keep filters
fixed throughout a sweep and continue empty pages when `nextCursor` is non-null.

Changes/refetch deliberately support only the six projection resources in the
table, not every legacy operational resource. They require one explicit game;
membership change requests additionally require one `subject` and bind the cursor
to it. Legacy unrestricted keys cannot use synchronization or membership lookup.
`maxAgeMs` accepts 1,000–300,000; membership defaults to 60,000. These resources
return `Cache-Control: no-store`.

Example requests for a configured backend client (not browser JavaScript):

```http
GET /api/v1/clan/event-summaries?game=hell_let_loose&limit=25
Authorization: Bearer <restricted service key>

GET /api/v1/clan/result-summaries?game=wardogs&limit=25
Authorization: Bearer <restricted service key>

GET /api/v1/clan/changes?game=wardogs&resources=membership-summaries&subject=222222222222222222&start=now
Authorization: Bearer <restricted service key>
```

## Synchronization and errors

1. Capture a `start=now` boundary, save it, then perform the full baseline sweep.
   Do not advance the completed watermark when any page fails.
2. Replay from the saved cursor with identical scope. Process pages even when
   their data is empty; `hasMore` means continue the bounded scan.
3. Refetch each changed identity with `sync-records`. Compare canonical decimal
   revisions as `BigInt`, and commit the projection and checkpoint together.
   Reviewed-result versions and synchronization revisions are different counters.
4. Apply explicit removals/tombstones. Missing list rows are not deletion proof.
   History/tombstone retention is seven days; `410 reset_required` requires a new
   boundary and rebuild that preserves website editorial/consent data.
5. Authenticate webhook raw bytes with the separate HMAC secret and timestamp.
   Durably deduplicate by signed envelope ID plus source/guild, reject mismatch
   with the unsigned delivery header, enqueue refetch, then acknowledge. See the
   [signature/consumer contract](../v0.3/README.md#synchronization-acceptance-contract).
6. Subscribe explicitly to `integration.changed`; membership uses the separate
   opt-in `membership.changed`. Notifications carry invalidations, not publishing
   payloads or website privileges. Keep periodic feed reconciliation.

| Condition | Consumer behavior |
| --- | --- |
| 401 / revoked or invalid key | Stop privileged use; fix credentials, do not delete records |
| 403 / insufficient scope or disabled policy | Fail closed and correct grants/policy; no automatic widening |
| 400 / invalid or altered scope/cursor | Fix the request; do not retry it unchanged forever |
| 404 / missing or foreign detail | Respect resource semantics; use durable removal evidence for reconciliation |
| 410 / retention, membership policy or epoch reset | Re-bootstrap the relevant scope/subject |
| Timeout / 408 / 429 / 5xx | Bounded backoff/jitter and Retry-After; retain checkpoint and mark stale |
| Stale/unknown membership | Deny access requiring fresh evidence; never infer roles from an old success |

Use at most 60-second evidence for privileged website writes and five minutes for
protected reads, or a stricter website policy. Age is checked at decision time,
not from receipt time. These are maximum stale windows, not instantaneous logout
or revocation during an outage. A departure observation and a role change must
invalidate website access independently of content synchronization.

## Deliberate boundaries

- Service keys cannot confirm/correct results, verify/unlink Steam accounts,
  change membership sharing policy or request managed-role grants. Those are
  authenticated Logi account/staff/bot workflows. Link users to Logi until a
  delegated actor contract is designed and accepted.
- No website raw-session history, private player-stat feed, verified-account
  directory, Wardogs historical scores, RCON moderation or public role editor is
  supplied. HLL: Vietnam support elsewhere in Logi does not prove this CRCON adapter
  works for it.
- `member`/`guest`, operational assignments and Steam proof do not automatically
  grant website administrator access, publication consent or game ownership.
- Existing website Discord OAuth remains a website responsibility. Optional Logi
  OIDC is not qualified for activation; Steam OpenID linking is a different flow.
- Website W1/W3/W4/I2 code is not delivered by this producer PR. Use the versioned
  [fixtures](README.md#consumer-fixtures-and-mapping) and the
  [proof map](verification-evidence.md) as consumer acceptance inputs.
