# Wardogs League public match reader · 0.12

Logi can read a public Wardogs League detail URL and return a typed preview to
the dashboard or another website backend. It uses anonymous server-rendered HTML;
no League account, Team API key, cookies or headless browser is required.

## Use it

An administrator selects **Wardogs → System → Imports → Wardogs League match**,
pastes a detail URL and presses **Load match**. The preview supports English,
Czech and German UI labels. Source labels retain the text published by League.
Dates display in **Europe/Prague**, including daylight saving time.

For the website, create a restricted key in **System → Website API** with:

```json
{"readAccess":{"resources":["league-matches"],"gameIds":["wardogs"]}}
```

Then call from the website backend:

```http
GET /api/v1/clan/league-matches?game=wardogs&url=https%3A%2F%2Fwardogsleague.net%2Fmatches%2Fcmuqt8ep605e1lf018w2nlywu
Authorization: Bearer <Logi read-only API key>
```

The administrator-session equivalent is
`GET /api/servers/{serverId}/league-matches?game=wardogs&url=<encoded-url>`.
Both return the same `{data: LeagueMatchRead}` contract, documented by the served
`/api/v1/openapi.json`. The League source URL is not a Logi event/match record ID.
Only exact HTTPS detail links on `wardogsleague.net` are accepted; queries,
fragments, credentials, request pages and other hosts are rejected. Trailing
slashes normalize to the same ID. Unknown or repeated query parameters fail.

## What the data means

| Field | Public observation |
| --- | --- |
| `snapshot.id`, `fixtureNumber`, `title`, `type`, `status`, `request` | URL ID, fixture number, heading, match type/status and originating request |
| `scheduledAt` | Exact UTC ISO date from header/briefing; conflicting or invalid dates become null |
| `teams` | Profile code/link/name, displayed nations and member count, faction and ready-check text |
| `map` | Name, zone, lighting from briefing definitions |
| `hosting`, `moderator` | Allowlisted public hosting mode/team and moderator state |
| `mapVote` | Public state, separate UTC closing time, choices keyed by team code |
| `rules` | Public summary and choices keyed by team code |
| `readyCheck`, `progress`, `scoringRule` | Preparation state and published scoring rule, not actual awarded points |
| `results` | Always null in parser version 1; no inferred placements or no-show results |
| `sourceUrl`, `fetchedAt`, `parserVersion`, `warnings` | Canonical source, actual observation time and parsing provenance |

All optional missing fields are **null**, including missing collections. Team
membership is not the roster or match player count. The reference fixture has
VLK → Valkyra, ROG → Manticore and BAMC → Lonestar; those are captured observations,
not hard-coded team assignments. Unknown factions remain null with warnings.
No private server password, game join ID, login form or RSC/script data is returned.

## Freshness and errors

The outer response includes `stale`, `ageSeconds`, `lastAttemptAt`, `nextRefreshAt`
and an optional fixed `error` category. Keep these alongside the snapshot.

- Cache keys use the match ID. Public snapshots are deliberately shared across
  authorized clans; each request still checks its own key, guild and game grant.
- Refresh is **on demand**, at most once per five minutes. There is no background
  match discovery or automatic event import. Consumers should poll every 5–10 minutes.
- A failed refresh preserves the last valid snapshot and its original `fetchedAt`.
  HTTP 200 can therefore contain `stale: true`; never treat HTTP 200 alone as fresh.
- With no prior snapshot, upstream/rate errors return 429 or 503 with retry metadata
  when known. 400 rejects input, 401 rejects authentication, 403 rejects grants.
- HTTP 429 respects delta-seconds or HTTP-date `Retry-After` across all match IDs.
  A missing/invalid value defaults to 60 seconds. Delays are bounded to 24 hours;
  legacy out-of-range cooldowns are repaired on access. Other fetch errors retry
  after 60 seconds. Direct HTML text is read without cloning nested subtrees.
- A 25-second fenced lease avoids duplicate concurrent refreshes. A shared budget
  permits 20 origin requests/minute. Cache capacity is 500 IDs with oldest inactive
  eviction and pruning after 14 days without reads.
- The dashboard recalculates displayed age every 30 seconds and marks an aging
  snapshot stale without relabeling its collection time.

All HTTP responses to consumers use `Cache-Control: no-store`. This is independent
of Logi's internal shared cache. Reads are not part of the changes/webhook feed.
Legacy full-access keys need replacement with an explicit League read grant.

## Parser behavior and limits

`parseMatchHtml(html, sourceUrl)` is pure. Cheerio reads semantic sections, scoped
`datetime`, `dt`/`dd`, team profile links and accessible progress states. Detailed
team cards take precedence over the duplicate compact lineup; order and Tailwind
classes are not identifiers. No fetched script is evaluated or executed.

A recognizable fixture with missing sections returns nulls and warnings. An
unrecognizable page fails. On refresh, losing previously available essential
sections, map/hosting/vote/rule fields or team-card fields is treated as HTML drift:
the old valid snapshot stays stale until a later valid read or parser update.
The HTTP client validates every redirect, pins resolved public DNS addresses,
verifies TLS, imposes a 15-second overall timeout and a 2 MiB response limit.

**Verified real state:** Scheduled on the reference fixture. Synthetic tests cover
missing sections, ordering changes, conflicting/invalid dates and a Completed
label to verify the unsupported-state warning only. No real completed, canceled,
live, disputed, no-show, placement or result page has been verified. Results
support requires real public fixtures before extending the contract.

## Reproduce and activate

```sh
node --import tsx scripts/smoke-league-match.ts
node --import tsx --test "src/domain/wardogs-league/*.test.ts" "src/application/wardogs-league/*.test.ts" "src/infrastructure/wardogs-league/*.test.ts" src/infrastructure/convex/league-cache.test.ts src/lib/api/league-match-route.test.ts
npm run test
npm run typecheck
npm run build
```

The smoke command makes one anonymous GET and prints only the public normalized
snapshot. It needs no environment file. Runtime activation needs the new Convex
functions/schema and matching Next build, the existing internal-auth wiring and
outbound HTTPS/DNS to League. No new secret or provider source is required.
No production deployment is performed by this PR. The consuming Valkyria website
still needs its own call, presentation and cache/error policy.

See [design](design.md), [verification](verification.md),
[stored evidence](evidence/2026-10-02-league/README.md) and the
[public wiki](../../../../content/configuration/settings.mdx).
