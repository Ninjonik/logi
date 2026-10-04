# Wardogs League discovery and shared fixtures

PR #158 adds a durable guild-scoped external fixture collection alongside the existing on-demand preview. Scheduled discovery, an administrator pin and a human Discord link converge on `(guildId, League match ID)`. Native Logi events retain their own lifecycle and identity.

## Operator workflow

Use **Settings → Wardogs League**. Save the enabled flag, watched codes (default `VLK`), input channel and output channel. Both pickers support category/search and pasted IDs. Saving verifies bot access and requires a current durable dashboard admin session. Blank output collects without publishing. The Czech form is localized; other locales intentionally use English copy.

A URL preview does not register a match. **Track match** pins it independently of the filter. **Pause** stops refresh but retains the snapshot/card. **Ignore** withdraws it and persists through scans. **Resume** pins it again. An archived record offers **Refresh once**: attempt a fresh read, then apply the original archive horizon. Removing a human reference preserves a pin or watched-team eligibility. Native binding accepts only a Wardogs match in this workspace, one-to-one; blank unlinks. It never changes registration, meeting/end times, rosters, attendance or confirmed results.

## Fetch and persistence

- Exact index URLs: `https://wardogsleague.net/matches?tab=fixtures` and `...?tab=results`. Detail URLs keep a separate HTTPS host/path contract. Redirects must preserve the same tab or match identity.
- Anonymous HTML, semantic DOM parsing, no script evaluation, cookies or Team API key. Transport retains the 15-second timeout, 2 MiB bound, public DNS pinning and redirect validation.
- Global index lease: 60 seconds; the shared scan runs at the fastest cadence any enabled workspace configured (10, 15, 30 or 60 minutes; default 10), and each workspace enqueues a fresh index only once its own cadence has elapsed since the index it last processed. One-minute Convex cron drains at most eight details/run. Each detail has a 30-second fenced lease and a nominal refresh at the workspace's detail cadence (5, 10, 15 or 30 minutes; default 5). All reads share the existing 20-logical-fetches/minute budget and provider cooldown, capped at 24 hours. A logical fetch permits up to three validated redirects (at most four HTTP requests); the limit is not 20 HTTP hops.
- Settings revisions and work fences are checked before completion; configuration changes invalidate outstanding claims. Full discovery capacity does not stop existing refreshes.
- The tracked last-good snapshot survives cache eviction, failed reads, structural regression and older responses. Source `fetchedAt` determines age, never publication time.
- Index omissions do not cancel/delete tracked fixtures. Unsupported pagination, including buttons, marks coverage incomplete. An empty header/tab shell fails validation: no empty-state contract has been verified. Discovery covers the supported public index pages; missing URLs can be added manually.
- Exact team codes and canonical profile URLs establish eligibility. Historic first discoveries do not announce automatically; explicit additions may publish historic snapshots. Refresh ends seven days after kickoff or fourteen days after first observation when kickoff is unknown.

New tables: `leagueTrackingSettings`, `leagueTrackedMatches`, `leagueIndexCache`, `leagueMessageRefs`. Existing detail cache, `leagueFetchBudget`, integration change log and `discordPublications` are reused.

Limits: 100 configured guilds, 500 retained candidates/guild (both non-admin inputs stop at 450, reserving 50 slots for staff), 500 index URLs, 20 watched codes, three URLs/message, 20 references/match, 2,000 reference records/guild and 20 link-bearing intake updates/minute/guild. Human intake may reserve at most 50 records without a verified watched-team or staff pin; this also covers attaching references to existing scanner candidates. Editing away a link does not reset its durable reservation. Verified automatic eligibility, a staff pin or staff ignore releases the reservation. Staff may pin a valid URL when human intake is full.

At capacity, scanner/admin admission can reclaim only unmatched, never-tracked candidates with no pin, ignore, pause, automatic reason, event link, human reference, active lease or publication record. It preserves retained history and delivery recovery. Unknown legacy snapshots are retained conservatively. Empty/deleted reference tombstones expire after seven days and are independent of candidate cleanup. A genuinely full set of retained records still requires operator retention work; capacity warnings persist until settings are saved again, and saving never evicts retained records.

## Discord

The one-minute worker uses the existing managed publisher with key `league:<tracked-record-id>`. Stored message identity, revision claims, markers and ambiguous-send recovery prevent restart duplicates. Channel changes reconcile on the next pass. Map thumbnails use bundled assets; faction symbols reuse application emojis, with readable text fallback.

The compact embed shows kickoff, teams/factions, map/zone/lighting, vote/rules/ready state, host, freshness and **View match**. Source text is escaped and mentions suppressed. Scores or finishing places are not invented.

Human intake requires `LOGI_LEAGUE_MESSAGE_CONTENT=true` and the application's Message Content Intent. This enables Guild Messages + Message Content gateway intents. New links are admitted only from the configured room, ignoring bots/webhooks. Received edits/deletes can remove existing references after disabling intake or moving its room; they cannot add new links through an old room. Message versions and deletion tombstones reject replay. Worker stop removes its listeners. Gateway downtime does not backfill arbitrary history: website discovery and admin pins remain the durable fallback; edits missed during a full outage are an operational limitation. Set the same explicit `INTERNAL_AUTH_SECRET` in dashboard, bot and Convex; do not rely on the dashboard's legacy JWT fallback for worker authentication.

## Website contract

Require an explicit `league-fixtures` grant for `wardogs`. Legacy keys or the `league-matches` preview grant alone do not authorize it.

```http
GET /api/v1/clan/league-fixtures?game=wardogs&limit=50
Authorization: Bearer <scoped-key>
```

Response: `{ data: { items: LeagueFixture[], nextCursor: string | null } }`. Limit is 1–100; cursor at most 4,096 characters. Unknown/duplicate parameters fail. Each item contains external `id`, guild/game, optional native `eventId`, revision, tracking state, public snapshot, `stale`, `ageSeconds`, `lastAttemptAt` and `error`. Credentials, Discord references and internal notes are excluded. Convex rechecks key revocation and guild/game scope.

Obtain a changes cursor **before** paging the collection, then replay subsequent changes and hydrate upserts:

```http
GET /api/v1/clan/changes?game=wardogs&resources=league-fixtures&start=now
GET /api/v1/clan/sync-records/league-fixtures/<match-id>?game=wardogs
```

Change-log writes are transactional. Use the sync envelope revision for ordering and source timestamps for freshness. Rebootstrap after cursor expiry. Disabling tracking pauses collection and withdraws cards but keeps snapshots readable; **Ignore** emits a removal. Responses are no-store.

Service-key tracking administration is deliberately excluded: changing rooms/publication policy requires a current dashboard administrator. Actor-backed native event commands remain separate.

**Consumer status:** Logi's collection/feed is implemented. Valkyria's website still needs an explicit consumer and presentation for this new external-fixture resource. Existing native-event sync does not automatically ingest it. No production deployment is claimed by this increment.

## Verification and remaining work

Run `node --import tsx scripts/smoke-league-discovery.ts` for credential-free live source verification. Colocated parser, transport, tracking, snapshot, intake, DTO, API query and renderer tests cover the key boundaries. See [dated acceptance](evidence/2026-10-03-league-discovery/README.md) for live provider/test Discord versus isolated database/HTTP evidence and production limits.

Completed-result extraction, no-show/dispute interpretation, private Report Player tickets and HLL-specific live player/map presentation remain follow-up work. Their approved design is not implemented behavior.
