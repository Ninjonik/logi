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

The compact embed shows a `WARDOGS LEAGUE · MATCH n` author line, the team codes as title, kickoff, one line per team with its faction emblem, map/zone/lighting and ready-check state, then a small line with match type, status and any stale, paused or archived state, and **View match**. Vote, rules and host stay on the League page. Source text is escaped and mentions suppressed. Scores or finishing places are not invented.

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

## League-wide collection for the WD League panels

The Discord redesign replaces the per-match cards with two self-updating WD League panels in one channel: **tabulka** and **nejbližší zápasy** with the recent results (spec `docs/superpowers/specs/2026-10-05-discord-redesign-design.md`, board P6). They cover every fixture of the League, not only the clan's. Phase 1 builds the data behind them; the Discord rendering, the dashboard and the copy follow in phase 2.

- **Store.** `leagueFixtures` keeps one guild-independent row per League match from both index tabs (`?tab=fixtures`, `?tab=results`; the scan now also stores `resultUrls`). `leagueResults` keeps the placements of finished matches and `leagueCollectionState` the admitted index and the fixture/result revisions. At most 600 fixtures; finished and cancelled fixtures leave 30 days after kickoff unless still listed, results before the previous season are pruned. All tables are additive.
- **Collector.** `leagueDiscoveryFixtureJobs:collectDue` runs every minute while any workspace has Wardogs League enabled (`leagueCollectionWanted`; disabling everywhere stops collection). It admits a new index scan once, prunes, then reads at most six due fixtures through the shared detail cache, fetch budget and cooldown (`sharedLeagueRead`), so a page is never fetched twice for the tracked and the League-wide flows. Claims are fenced (30 s lease); live fixtures go first, then upcoming, then finished ones. Cadence (`nextFixtureRefreshAt`): live fixtures and the ten nearest upcoming ones as often as the five-minute cache allows, other upcoming ones every 30 minutes, finished ones every 30 minutes for two days and then every six hours until placements appear (at most 14 days), confirmed placements every six hours for seven days, cancelled ones for a day. The panels redraw every 60 s from the store. A failed read keeps the last good page and retries after the cooldown; losing previously parsed placements is treated as HTML drift.
- **Phase.** `fixturePhase` uses published placements, then the League status label, then the progress steps (Live, Placements, Confirmed), then the index tab. Only "Scheduled" pages are verified against real HTML.
- **Preparation.** The League's own preparation, not the clan's sign-up: rules ("2 of 3 picked"), map vote (open until it closes), moderator and ready check, each done, running or pending; when none has started a single "not started" chip replaces them.
- **Table.** `computeStandings` counts every result of the season (calendar year in Europe/Prague) with the points rule published on its page ("1st 3 · 2nd 2 · 3rd 1", 3/2/1 when missing): points, matches and 1st/2nd/3rd counts. Order: points, then more 1st, 2nd and 3rd places, then fewer matches; teams equal on all of these share the rank and are listed by code. The table is laid out as a code block (`layoutStandingsTable`), untrusted names cannot close the block or inject terminal escapes, and the clan's row is marked "›" (ANSI bold white on desktop).
- **Recent results.** Podiums (places 1–3) of the last seven days, newest first, shown under the fixtures. They come from the League site and are not verified by Logi; the clan's confirmed results stay in its own results panels.

### Results parser: not available yet

`src/infrastructure/wardogs-league/parse-results.ts` returns `results: null` with the warning `results_not_supported`, because no finished match page has been captured and the League site is blocked in the development sandbox. Until it exists the fixtures panel works and the table shows its waiting state ("Tabulka se zobrazí po prvních výsledcích"). Adding the parser is a change to that one file and its test: read the places from a captured completed page, then change `RESULTS_PARSER_ID`. The collector then re-reads finished pages without placements once, so earlier results of the season are backfilled. The required captures are listed in `src/infrastructure/wardogs-league/fixtures/README.md`.

### Reads

- Bot and dashboard: `leagueDiscoveryPanels:forGuild` (internal secret) returns both panel view-models for a guild; `options` (`table`, `fixtures`, `recentResults`, `fixtureCount` 1–10, default all on and 6) selects the content. The guild's watched team codes mark its own team.
- Website: `GET /api/v1/clan/league-fixtures/overview?game=wardogs&limit=6` with the same explicit `league-fixtures` + `wardogs` grant returns `{ data: { standings, fixtures } }` (`LeagueOverview` in the served OpenAPI). `limit` is 1–10. Responses are no-store. Posting, refreshing or pausing the panels in Discord are live Discord actions and stay outside the API.

## Verification and remaining work

Run `node --import tsx scripts/smoke-league-discovery.ts` for credential-free live source verification. Colocated parser, transport, tracking, snapshot, intake, DTO, API query and renderer tests cover the key boundaries. See [dated acceptance](evidence/2026-10-03-league-discovery/README.md) for live provider/test Discord versus isolated database/HTTP evidence and production limits.

Completed-result extraction (blocked on a captured finished page, see above), no-show/dispute interpretation, private Report Player tickets and HLL-specific live player/map presentation remain follow-up work. Their approved design is not implemented behavior.
