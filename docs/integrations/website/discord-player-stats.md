# Discord player statistics

`/stats` combines retained Wardogs history and public HLL Records profiles in one
guild-only, private-first command. It does not replace `/player` (the existing
clan profile command) or the live `/server-status` and public scoreboard panels.

## Usage

| Input                            | Behavior                                                                                                 |
| -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `/stats game:wardogs`            | Your Steam player in this Discord community's retained Warcon games; default last 30 days                |
| `/stats game:hll member:@player` | A current guild member's linked Steam profile on HLL Records                                             |
| `period:7d`, `30d`, `90d`, `all` | Rolling UTC window for Wardogs; matching public profile period for HLL                                   |
| `player:<autocomplete>`          | Wardogs only: search recorded names or a Steam ID; selection retains exact Steam identity across renames |
| `server:<autocomplete>`          | Wardogs only: narrow history to one recorded source; identical display names retain different source IDs |
| `channel:#room`                  | Optional destination for later explicit sharing; the initial reply stays private                         |

`member` and `player` are mutually exclusive. HLL rejects raw player IDs and server
filters. No nickname-based account linking is performed. Other platforms are not
silently interpreted as Steam.

The overview shows kills, deaths, K/D, wins, cash delta and playtime where the
source provides them. Wardogs includes recent games and faction breakdowns; HLL
includes recent games, maps, weapons, team kills and infantry ELO. Existing map
artwork supplies a compact map thumbnail. Controls and descriptions support CS/EN/DE.

Missing metrics remain unknown. Wardogs sums retain per-metric coverage, and K/D
requires complete kills/deaths coverage; a flawless record divides by one death. Unknown
results are disclosed. HLL's `+` counters remain lower bounds. Its recent-form win
rate is explicitly scoped to the last 100 games with at least 20 minutes played;
it is not relabeled as the requested period's overall win rate.

## Existing and late Steam links

The command reads the exact `users.discordId` binding and existing `platformIds`
used by recruitment. A missing Steam ID offers **Add / change Steam** on the
author's private card. The modal accepts a valid Steam64 ID or numeric
`https://steamcommunity.com/profiles/...` URL. After saving, the same statistics
request runs again. A clan application is not required.

This is a **self-declared public-statistics lookup key**, not verified ownership.
It never creates `platformIdentityLinks`, grants membership, assigns roles or
changes SSO access. Verified linking remains the account-settings Steam OpenID
flow. A verified/legacy ID already claimed by someone else is rejected; imported
ID collisions are never adopted as a Discord identity. Multiple legacy Steam
IDs require the owner to choose explicitly. Other platform IDs remain intact.

The compatibility duplicate scan is bounded at 5,000 users and fails closed above
that size; an operator must resolve the index/migration before allowing new links
there. Existing linked statistics reads are unaffected. Concurrent form changes
use the expected previous Steam IDs, so an older form cannot overwrite a newer
link. Source outage and empty history never remove a link or pretend it is absent.

## Privacy, channels and restart behavior

Only the invoking account in the same guild may use its controls. The gateway
freshly fetches requester and selected member membership before and after source
reads; Convex also checks the internal secret, configured guild and a membership
observation no older than ten seconds. There is no anonymous Convex history path.

**Share** uses the selected slash-command channel, else the default sharing
channel from **Settings → Discord → Commands** (`/stats`), else opens a Discord
channel picker. The same page lets a manager switch the command off for the
server or for one game, choose who may use it (everyone, clan members or Logi
managers, plus extra roles), whether the reply offers Share, and the channels
where it works; the bot checks these with fresh Discord facts and answers a
refusal privately in the clan language, before any source read. Missing
settings keep both games enabled. The requester and bot must currently be able
to view, send messages (in threads: send messages in threads) and embed links
there. Cross-guild destinations, private threads, voice channels and missing
permissions are rejected with "Do #kanál teď sdílet nejde" and a button to pick
another channel. Shared cards have no controls, name who shared them and
suppress mentions. HLL's explicit public profile link contains its Steam ID;
Wardogs cards do not print raw IDs. The card carries no map artwork.

These are on-demand snapshots, not scheduled public panels. The private view
expires after 15 minutes or a bot restart. One view allows one successful share;
concurrent clicks are reserved before acknowledgement, and a refused channel
frees the view for another choice. Ambiguous send outcomes
are not automatically retried. After restart, old controls ask for a new command
instead of recreating messages. Existing durable public panels retain their own
separate restart reconciliation.

## Sources, caching and limitations

Wardogs reads the same `serverGameHistory` facts used by the website. It scans all
pages at one revision, retries a revision reset once, and refuses partial totals.
Limits: 20 rows/page, 200 pages, 25 seconds, 25,000 combined records/player facts,
four concurrent scans, 60-second cache and 100 cached requests with at most 50,000
combined records/player facts. Narrow the period/server if the history exceeds the
budget. Autocomplete has a two-second response budget; its first cold request
may return no suggestions while the bounded cache read completes. Commands have
a three-second per-user/guild cooldown. There are at most 500 private views.

HLL uses a pure semantic HTML parser, no downloaded script execution. Only the
fixed HTTPS HLL Records host is fetched; public DNS is validated/pinned, TLS
verification remains enabled, redirects are not followed, and responses have a
seven-second/2 MiB cap. Success is cached 15 minutes with single-flight requests,
200 cache entries and eight simultaneous reads. HTTP 429 honors `Retry-After`
provider-wide. HTTP 403 backs off for 15 minutes. Other failures back off for a
minute. The last successful profile is kept with its original timestamp and an
explicit stale label. These caches are process-local.

**Provider acceptance remains separate:** on 2026-10-04 the public profile rendered
in the user's browser, but an ordinary server HTTP request was blocked by Bunny
Shield with HTTP 403. The command reports that condition and provides the public
profile link. The parser, controls and cache are implemented; unattended live HLL
success is not claimed. A provider-supported API or permission for automated
access is needed to remove this gate. No browser cookies or challenge bypass are
part of this implementation. HLL coverage is limited to servers tracked by
[HLL Records](https://hllrecords.com/about), not every HLL game.

## Website/API parity and rollout

Wardogs facts and ranking semantics remain available through the existing
`GET /api/v1/clan/server-game-history?game=wardogs` contract and shared
`aggregateHistory`/`buildHistoryReport` consumers. No new website payload or scope
is introduced. The new `discordPlayerStats` functions are a trusted bot gateway;
the website's existing API authorization is unchanged.

Deliberate API exclusions: ephemeral Discord controls, channel publication and
the Discord-author-bound legacy Steam modal have no bearer/dashboard-equivalent
lifecycle and must not become API-key account-linking operations. HLL Records is
not exported as a new stable `/api/v1` resource while provider access is unresolved;
this change does not claim durable HLL history synchronization for the website.

Deploy compatible Convex functions and restart the bot to register `/stats`.
Configure the guild's Discord settings in Logi and enable Server Members Intent.
No new secret is needed for HLL Records. Production deployment requires its own
acceptance; the implementation evidence uses an isolated local database and the
authorized test Discord guild only.

See [test and visual evidence](evidence/2026-10-04-player-stats/README.md).
