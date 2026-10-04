# Discord follow-up: League cards, player reports and HLL live panels

Status: **League discovery, manual tracking, compact cards, private player reports and the HLL live extension implemented in PR #158**. See [League contract](../league-discovery.md) and [HLL/report contract](../hll-live-and-player-reports.md). Production activation and provider-populated acceptance remain separate gates.
Baseline: `76ae1bcaffde08c3e80eb1fc60d473f75f774450` in PR #158.
This document records the next increment discussed after the feature gallery.
The owner confirmed reports must be private to the reporter and designated staff,
and Discord link intake must consume only human-posted links. A later owner
request adds independent, regular discovery from the public League website and
manual administrator entry. Automatic discovery is restricted to Valkyria by
default, with additional watched teams configurable by an administrator.

## Requested destinations and existing behavior

All destinations remain administrator-selected, by categorized channel picker or
pasted channel ID. Names below describe the supplied screenshots; they are not
hard-coded channel identities or permission to write production messages.

| Surface | Intended destination | Current implementation | Missing work |
| --- | --- | --- | --- |
| Wardogs League matches | Wardogs `wd-league` and website | Safe parser/cache; scheduled discovery, manual registration, human-link ingestion, compact cards, durable persistence/refresh, explicit website collection/change feed | Production activation; website consumer UI for the new collection; verified completed-result extraction |
| Wardogs server | Wardogs `server-info` | Live map/count/faction scores, opt-in leaders, private player pages, durable message recovery, private Report Player | Production activation; additional visual refinements |
| HLL servers | Hell Let Loose `server-info` | CRCON live current-round players, kills leaders, map artwork, team scores, private details/reporting, scoped website API | Live populated-server acceptance and production activation |
| Player reports | Configured private-thread parent and support roles | Source/player context, private modal/thread, durable deduplication/recovery and ticket closure | Production permissions; independent nonstaff account acceptance |

The same channel name occurs under both game categories. Configuration and
publishing must bind exact guild/channel/source IDs, not a name search result.
Production activation is separate; all implementation acceptance should use the
already authorized isolated database and test Discord channel.

## League link cards

Three inputs converge on the same external match: scheduled website discovery,
an administrator adding its URL, and a person posting its URL in the selected
input channel. Logi upserts a card in the configured destination (normally the
input channel). One logical publication per guild, feature and League match ID
prevents repeated links or a restart from producing another card. Persist the
independent tracking reasons: removing one Discord reference must not withdraw
a match still watched automatically, pinned by an admin or referenced by another
message. Handle message edits and deletions explicitly.

Card contents:

- Fixture number, Friendly/other source type, current source status.
- Team codes/names and observed faction assignments with existing faction icons.
- Exact start time, map thumbnail/banner, zone and lighting.
- Compact map-vote/rules/ready status; detail link for longer information.
- Last successful observation time and stale/error state when refresh fails.
- A link to the canonical public League match.

Use the existing pure parser and shared five-minute cache/lease/budget. Refresh
tracked active cards every five minutes; make retention and stopping conditions
explicit so an old Scheduled page does not poll forever. Suggested bound: stop
automatic refresh seven days after the observed start, or fourteen days after
first tracking if no exact start exists; a manager may reactivate it. Preserve
the last valid card on parser drift or transient upstream failure. Do not infer a
result, no-show, winner or cancellation from missing fields.

The current parser accepts only `https://wardogsleague.net/matches/{id}`. The
supplied screenshot also contains **open match requests** and **result submitted**
announcements from the League bot. Request pages and actual completed results
are separate, currently unsupported parser contracts. A source's result-submitted
label is not a Logi-reviewed result. Keep those states distinct.

The owner selected **human-posted URLs only**. Ignore messages from bots and
webhooks, including Logi and the existing Wardogs League bot. Extract supported
canonical links from the person's message text and deduplicate against the same
match publication. Bot-feed ingestion is outside this increment. Do not fabricate
request-card support by interpreting `/matches/requests/{id}` as a match ID.

Automatic ordinary-message ingestion requires `GuildMessages` and the Message
Content privileged intent; neither is requested by the current client. The
intent must also be enabled for the target application. A message context action
or explicit slash URL input is a useful fallback when automatic ingestion is not
activated; it is not equivalent to automatic link detection. See
[Discord Gateway documentation](https://docs.discord.com/developers/events/gateway#message-content-intent).

## Proposed League discovery system

This section preserves the approved design. The League scanner is implemented;
see [acceptance and documented deviations](../evidence/2026-10-03-league-discovery/README.md).
Production activation is a separate step.

### Approach and inputs

Use a bounded, centrally scheduled public-HTML index scan with the existing
detail parser/cache. Compared with manual-only tracking, this discovers new
fixtures without someone remembering to post a link. Compared with scanning
only a team's profile, the fixtures and results indexes can also discover a
match that appeared and finished between scans. Team profiles are a useful
cross-check, but their current completeness is not an established contract.

- Scan `/matches?tab=fixtures` and `/matches?tab=results` every **10 minutes**.
  Parse semantic main-content anchors into distinct, validated match-detail
  URLs. Do not crawl unrelated links, execute scripts or scrape the entire site.
- Initially watch the canonical League team profile `/teams/VLK`. An admin can
  add further team profiles. Confirm membership from a parsed detail's exact
  team profile/code, never a substring match of the page or title.
- Index candidates are shared across guilds. Queue a detail read for new IDs;
  do not re-fetch every historic result at every scan. Only records matching
  the guild's current watch configuration are automatically published there.
- An admin may paste a supported match URL to track it immediately, including
  matches outside the team filter. Preview the source, then persist that
  deliberate inclusion. A human's link in an enabled Discord intake room can
  create a tracked card; it does not confer event-administration permissions.
- An admin may also create a normal native Logi match without a League URL.
  This uses the existing event workflow and does not create a match on the
  external League website. An explicit later link can connect it to a League
  fixture. Do not automatically merge native matches by title, date or teams.

### Shared records, web and Discord

The external identity is `(provider: wardogs-league, matchId)`. Each guild has
its own tracking/publication configuration and optional native `eventId` binding.
Use an atomic registration receipt to prevent two inputs or workers creating
two bindings. Repeated discovery attaches a tracking reason and refreshes the
same record; it does not create another operational event.

League owns the observed fixture fields (teams, start, map, source status).
Logi owns channel choice, local notes, publication policy, signups, roster and
attendance. A source refresh must not overwrite those local fields. Preserve
the observed source beside any explicit local override, with an audit trail.
Conflicting source changes on a linked native event require review; they must
not silently reschedule its registrations or discard attendance.

Expose the guild's tracked fixture collection, provenance, optional `eventId`,
revision and freshness through an explicitly scoped website read contract and
change feed. The current URL-preview API is not that collection and its reads
are not currently in the change feed. Both the Logi API and website consumer
need implementation and contract tests for this addition. A website projection
uses the binding to display one match when a native event is linked.

An external fixture may appear as a factual match card/calendar entry with its
known start and null unknown fields. Creating a fully operational native event
requires additional schedule values that League does not supply (registration,
meeting and end). An admin supplies them when creating/linking the event; the
scanner must not invent them or enable signups merely by seeing a fixture.

Publish one durable Discord card per tracked match using the existing managed
message lifecycle. Refreshes edit that card. The default sends no mentions and
does not create a new announcement for each edit. On first activation, upcoming
eligible matches may be published; past discoveries go to the archive without
flooding the Discord room. A manual admin action may publish an older fixture.
Room choice always uses the existing channel picker or pasted exact channel ID.

### Scheduling and failure behavior

Refresh active tracked details every **5 minutes**, subject to the shared cache
and origin-wide cooldown. Reuse the existing 20 logical fetches/minute ceiling for
both indexes and details (each may follow up to three validated redirects), spread work through a bounded queue and let
manual requests share the same budget. Persist the queue, next due time, fenced
lease and publication identity; restarting must resume work without duplicating
fixtures or Discord messages.

Unknown states and overdue Scheduled pages retain their last valid data. Stop
their automatic detail refresh at the existing proposed bounds (seven days
after start, or fourteen days after first tracking if start is unknown), expose
the paused/stale state and let an admin reactivate them. If a later source
revision supplies a new start, re-evaluate the bound. A verified terminal-state
parser can later use a short correction window before archival; version 1
currently cannot validate actual result placements.

An index omission, truncated page, parser failure or 404 is not proof that a
match was cancelled. Preserve tracked records and distinguish last successful
observation from last attempt. Respect `Retry-After` for every source read.
Follow pagination only after its public URL/DOM contract has been observed and
allowlisted; a scan with an unsupported pagination control is incomplete, not
an empty or exhaustive result. An admin can still add a missed fixture by URL.

The current detail fetcher deliberately rejects query parameters and its pinned
transport sends only `pathname`. Add a distinct allowlisted index-URL contract
and transport support for the exact approved query before implementing scans;
do not simply weaken detail-URL validation or reuse the current fetcher for
`?tab=fixtures` while silently dropping its query.

The admin screen should expose enabled state, watched teams, intake/output
channels, manual URL preview/add, last successful scan, next scan, partial/error
state, tracked matches, per-match pause/resume and an explicit ignore action.
Ignoring a match persists a guild-scoped suppression so the next scan does not
immediately recreate it. Recheck the current admin and settings revision before
committing settings, bindings, ignores or publication after an in-flight read.

## Player reports

The owner selected **a private ticket shared by reporter and designated admins**.
Reuse the current ticket permission model and closure flow, with report-specific
context and reliable creation semantics rather than a separate public accusation
feed.

1. A server card has **Report player / Nahlásit hráče**. Its source is preselected;
   a standalone report entry can offer configured HLL/Wardogs servers.
2. Privately choose a currently observed player, or supply a name/ID for someone
   who has left. Do not require that a game player have a linked Discord account.
   Manual identity input remains explicitly unverified.
3. Collect a reason, approximate incident time and optional evidence link. Files
   may be attached in the resulting private ticket. Do not fetch arbitrary user
   evidence URLs on the server.
4. Create the private ticket and display a private confirmation/link. Include
   game, exact data source, map and observation time, player-selection provenance,
   reporter, reason and evidence. Provider identifiers belong only in the staff
   workflow when necessary, never the public panel.
5. Designated staff investigate and close the tracked ticket with a reason.
   Reporting itself performs no game-server kick, ban or automated punishment.

Validate the current guild, panel revision, channel visibility, configured source
and reporting policy again on submit. An old panel control must not submit into a
newly configured destination. Bound text lengths, pending selections, per-user
cooldowns and active reports; key duplicate interaction delivery to the original
receipt. Persist creation intent before external thread creation. An uncertain
Discord response requires reconciliation, not an unconditional second thread.
Confirm private-thread permissions and staff access; do not fall back to a public
thread if privacy cannot be provided.

## HLL live panel

Use one persistent card per configured CRCON source, allowing multiple HLL
servers in the selected room. Keep static server rules separate from refreshing
live cards. The target layout is:

1. Server name, current-map artwork and current layer/mode when known.
2. Player count/capacity, Allies/Axis scores and remaining time when available.
3. TOP 3 kills overall and best killer per team, using only connected players
   whose team and metrics are actually provided. Unknown team stays unknown.
4. Private player details and Report player. Public statistics/site links use
   administrator-supplied public URLs; never expose provider administration URLs.
5. Independent status/player observation ages, stale labels and a clear empty
   state. Missing data is not zero.

Keep public player names behind the existing explicit `showLeaders` opt-in and
private details behind their own switch. HLL metrics must not show Wardogs cash.
Use a fixed map alias/catalog mapping to the existing `public/maps/*.webp` assets;
an unknown map falls back to the game image, never a provider-derived file path.

`get_public_info` supplies aggregate status. `get_live_game_stats` supplies a
separate `snapshot_timestamp`, `refresh_interval_sec` and player-stat rows. Its
rows may include disconnected players. Filter by observed status for the live
panel and retain source timestamps. Do not join datasets by player display name
or interpret match-so-far statistics as lifetime records. Preserve aggregate
status if only the statistics request fails. Reject malformed/future timestamps
and prevent old-round player observations from appearing fresh after a map change.

Extend the current typed provider transport/cache and the shared publisher;
respect provider refresh intervals and Discord backoff. Maintain explicit API
scope: aggregate server-read keys must not silently gain player identity data.
Any website player read needs a deliberately scoped DTO/grant and matching
contract/OpenAPI tests. Discord publication settings remain current-admin-only,
as in the existing public-panel API exclusion.

## Read-only investigation on 2026-10-03

No application code, production settings, roles or Discord messages changed in
this investigation. The production CRCON calls were anonymous **GET** requests to
the owner-provided origin. No API secret was needed for these public endpoints.

- `https://admin1.valkyriahll.app/api/get_api_documentation` listed
  `get_live_game_stats` as GET, with no required permissions, describing statistics
  for the currently playing match. `get_detailed_players` and `get_team_view`
  separately require named permissions; their access was not exercised here.
- `get_public_info` returned `Utah Beach Warfare`, 0/100 players, 2–2 score and
  a remaining-time value. Its team counters were 0 and 1 despite total 0; do not
  fabricate a consistent count by overriding the total or claiming a connected
  player from that mismatch.
- `get_live_game_stats` returned `snapshot_timestamp`, refresh interval 15 seconds
  and one row marked `offline`, with kills/deaths and other stat fields. This
  verifies endpoint/shape availability and the need for status filtering. It does
  **not** prove a populated connected-player leaderboard or all three HLL servers.
- Existing CircleBot code calls the same live statistics endpoint. It was
  consulted read-only; its broad fallback parsing and runtime claims are not
  copied into Logi acceptance.
- `node --import tsx scripts/smoke-league-match.ts` passed against the reference
  URL at `2026-10-03T16:38:37.297Z`. The existing parser read fixture 38,
  VLK/Valkyra, ROG/Manticore, BAMC/Lonestar, start
  `2026-10-10T18:30:00.000Z`, Zestafona/SmallFactory/DayLateGrayFog and a ROG Reroll
  ballot. Results remained null with `results_not_supported`.
- A subsequent anonymous direct-HTTP probe read `/matches?tab=fixtures`
  (200 HTML, 20 distinct detail links), `/matches?tab=results` (200 HTML,
  17 distinct detail links) and `/teams/VLK` (200 HTML, one detail link to the
  reference fixture). This verifies discoverable HTML anchors on those pages
  at observation time; it does not prove a complete history, future pagination,
  or working discovery code. A `Show cancelled` link was present on the fixtures
  index; cancelled detail behavior was not exercised. `/robots.txt` returned
  404 HTML, not a parsed robots policy. Result-index markup visibly contained
  placements, but the Logi detail parser still returns `results: null`.

References: [CRCON API guide](https://github.com/MarechJ/hll_rcon_tool/wiki/Developer-Guides-%E2%80%90-CRCON-API),
[current League contract](../v0.12/README.md),
[public panel lifecycle](../discord-public-panels.md),
[feature gallery](../evidence/2026-10-03-discord-gallery/README.md).

## Implementation and acceptance sequence

1. Extend typed HLL reads and rendering, test current-map aliases, connected-only
   rankings, missing/zero values, independent freshness, transition/failure cases,
   public-name opt-in and absence of IDs/secrets in public output.
2. Add League index fixtures/parser, due-work scheduling, settings, manual
   registration, listener/context fallback, tracking and renderer. Test selected
   team filtering, first-run history suppression, manual/native-event binding,
   wrong hosts/redirects/query parameters, edits/deletes, repeated links,
   concurrent delivery, restart recovery, stale retention, incomplete indexes,
   rate limiting, expired tracking, ignored matches, actor/source revocation
   and the human-only Discord-message policy. Extend the scoped website
   collection/change-feed contract and verify its consumer deduplicates linked
   native events without changing roster/attendance ownership.
3. Extend report intake and ticket creation. Test source/player tampering,
   duplicate submissions, uncertain create, cooldowns, stale controls, revoked
   permissions and private-thread membership. Verify actual visibility using the
   authorized test accounts; a screenshot alone cannot establish confidentiality.
4. Update dashboard, public wiki, API contracts/explicit exclusions and operator
   setup together. Verify channel dropdowns and pasted IDs for every new surface.
5. Run focused regressions, full tests, typecheck, build and API/type generation.
   Deploy only to the isolated local Convex. Exercise each real Discord flow and
   restart with recorded message/thread IDs; capture sanitized screenshots.
6. Review the implementation and run the final code-security review. Add proof
   and outstanding production-activation prerequisites to the same PR #158.

The HLL/report portions remain a proposal. League implementation, local runtime
proof, review findings and repairs are linked in the dated acceptance above.
