# HLL live data and private player reports

Implemented in PR #158. Production activation is separate from local acceptance.
See the [Discord workflow evidence](evidence/2026-10-04-discord-workflows/README.md).

## HLL CRCON live contract

`GET /api/v1/clan/hll-live/{connectionId}` requires an authenticated clan key with
an explicit `hll-live` read resource and `hell_let_loose` game grant. Aggregate or
legacy keys do not inherit player-list access. Do not put this key in browser code;
the Valkyria website backend consumes the endpoint and applies its public projection.
The response is `{ data: { connectionId, gameId, provider, data } }`; OpenAPI defines
the closed `HllLiveEnvelope` shape. Query parameters are rejected.

The inner `data` contains:

- `status`: server/map/layer/mode, round start, player count/capacity, Allies/Axis
  scores and remaining seconds; `null` when no valid status exists.
- `players`: currently **online** CRCON rows only, with name, provider player ID,
  team and nullable kills/deaths/combat/offense/defense/support scores.
- `fetchedAt`, `statusAt`, `playersAt`, separate status/player freshness, warnings,
  and `refreshAfterSeconds`. Unknown metrics remain `null`.

The adapter reads `/api/get_public_info`, `/api/get_live_game_stats`, then public
status again. A layer/round change or unconfirmed round suppresses player data.
It does not turn past-round/offline rows into a current leaderboard. Provider IDs
are observation data, not evidence of a linked Discord identity. Profiles, bans,
administrative data, credentials and raw provider responses are not forwarded.

A connection-scoped Convex cache shares provider budget between API and Discord.
Generation/fingerprint checks and a fenced lease reject stale workers, revoked
keys and changed source/panel configuration. Retry-After is respected. Responses
are `no-store`; 429 includes Retry-After, 403 means insufficient scope, and a safe
503 indicates an unavailable read. Observations age after 60 seconds; stale
status is labelled and failures cannot become fresh by reading the cache again.
This is live CRCON data, independent of HLL Records profile fetching and its 403.

## Discord HLL panels

Choose an HLL connection and destination channel in **Discord → Public panels**.
Map artwork comes from the existing local map catalogue. The card shows count,
remaining time, team scores and observation age. `showLeaders` opts in to TOP 3
kills overall and a leading killer per team; `showPlayers` adds private paginated
player details with current-round combat scores. Both privacy switches default
off. HLL has no Wardogs cash field. Empty and unavailable data are explicit.
The existing durable publication binding edits the same owned message after a
restart; a missing/uncertain create is reconciled conservatively. A report whose
staff lookup or parent fetch fails before any thread create returns to pending
with a short backoff instead of becoming uncertain.

## Configure Report Player

1. Enable support tickets and select a normal text **ticket parent channel** by
   channel picker or ID. Configure a category and its support roles.
2. In each CRCON/Warcon public server or scoreboard panel, select that category
   under **Report Player**. The selector displays the destination parent. Empty
   selection disables reporting; result announcements cannot enable it.
3. Grant the bot View Channel, Read Message History, Send Messages, Embed Links,
   Create Private Threads, Send Messages in Threads and Manage Threads in the
   parent. Reporters need parent/source visibility and message history. At least
   one designated human staff member must have parent access and thread-send
   permission. Staff are configured support roles, dashboard administrators and
   Discord administrators. Discord members with Manage Threads can read private
   threads; configuration with an unrelated such reader fails closed.

The button responds privately, showing fresh observed players (20 per page) and
an **Other player** option for someone who left. Selecting a player opens a modal
for reason, incident time and an optional HTTPS evidence link. Evidence links
are not fetched. Files can be attached in the resulting private thread. Manual
names/IDs are explicitly unverified. No report issues a ban or sanction.

Drafts are bound to reporter, guild, source, panel revision and destination, expire
after 15 minutes, and are limited to five active forms. Submission allows one new
report per minute and at most three active reports per reporter/workspace.
Duplicate submission of the same form returns its existing report. The durable
intent is recorded **before** creating a private, non-invitable thread. Current
permissions and the exact allowed member set are checked before posting content.

Staff use `/close_ticket reason:...`. Closing records the report/ticket state,
locks and archives the thread, posts the close card and attempts a reporter DM.
Report context remains in the private ticket/Logi database under the existing
ticket retention lifecycle; this feature does not add automatic report deletion.

## Restart and failure behavior

The report worker retries every 30 seconds with a fenced lease. A bound thread
ID is reused. An ambiguous create is searched by the unique report marker in
active, bot-owned private threads under the configured parent. It never creates
a second thread merely because the first request timed out. Archived/missing
unknown threads, policy changes or incomplete history require staff review.
Starter messages also use a marker and Discord nonce; history search is bounded
to 100 messages. This is conservative recovery, not an unconditional exactly-once
guarantee across Discord and Convex.

Member enumeration uses fresh REST pages, avoiding repeated gateway full-member
requests. It fails closed at 10 full pages (10,000 members) or over 80 eligible
staff rather than claiming incomplete privacy checks succeeded. These bounds are
operational limits, not a general multi-community ticketing service.

## Deliberate API exclusions

The dashboard panel-settings route supports `reportCategoryId`. Player reports,
private ticket text, reporter identities and Discord ticket side effects are
**not exposed to website bearer keys**: they require live Discord membership,
channel access and private-thread lifecycle checks. `/api/v1` has HLL live read
parity; it does not gain a report export or a key-driven Discord reporting action.

## Legacy workflow fixes in this increment

`/notice` resolves canonical and legacy guild event keys, rejects conflicting
guild aliases and requires bot authentication. Notice and `/link` interactions
acknowledge privately before slow reads. `/close_ticket` rechecks current staff
membership. Application closing cards show both outcome and reason. Platform
link mutations require the exact linked Discord subject; imported numeric IDs
cannot become account authority, and equivalent Steam aliases/verified ownership
are checked before a manual link.
