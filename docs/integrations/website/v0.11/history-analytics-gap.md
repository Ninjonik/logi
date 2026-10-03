# Durable Warcon match history and website analytics

Research date: 2026-10-03. Application revision inspected and exercised:
`1d44a276696eeed400d461b2d4b9726e67f92b81`.

The requested outcome is to retain every observed finished server game and its
player statistics in Logi, then let the website show faction wins, historical
matches and player rankings. This is a follow-up requirement to the existing
Warcon integration, separate from the proposed workspace clan-team directory.
This report records current capability and remaining work, not completed
implementation of the new analytics feature.

## Actual provider check

At **2026-10-03 19:51:57 UTC**, four authenticated, read-only HTTPS requests to
the previously authorized Valkyria Warcon server returned HTTP 200:

| Read | Observed data |
| --- | --- |
| Match list, page 1 | Six records on one page: four ended games with a winner, one ended game without final scores/result, one ongoing game. |
| Analytics, last 30 days | Manticore 2 wins (`#1DD65C`), Lonestar 1 (`#4CB1EF`), Valkyra 1 (`#FA503E`); four decided games, zero draws, one without result. |
| Server leaderboard, last 30 days, minimum 60 minutes | 197 eligible players; first page contains 50 rows; `hasFeed: true`. |
| Finished match 4 | Bakurani, Manticore 100 / Valkyra 40 / Lonestar 21; 101 player rows, 263 score timeline samples; kills/KD/cash awards. |

Match 4 exposes name, Steam ID, faction, time played, kills, deaths, cash delta,
headshots, team kills, suicides, vehicle kills, longest shot, kill/death streaks
and player result. Its player results are 25 wins, 58 losses and 18 unknown.
Unknown attribution remains unknown; it is not evidence that all players on
the final winning faction must receive a win.

These are current provider observations, not a claim that the production Logi
database already contains these records. Raw responses and credentials remain
in the private local probe directory. The public evidence contains aggregate
counts, schema field names and faction scores, without player names or IDs.

Current upstream documentation also describes the same finished-match,
faction-win and player-leaderboard capabilities:
[Warcon leaderboards and match history](https://github.com/warcon-app/warcon#leaderboards-and-careers),
[Warcon API reference](https://github.com/warcon-app/warcon#bots-and-api-keys).
The actual deployed instance was checked independently of upstream main.

## What the current PR already does

- `readWarcon` and the scoped `warcon-data` endpoint expose match lists, finished
  details, analytics and leaderboards, including winner, faction colors and
  player result where supplied.
- The resumable history collector reads completed matches, persists normalized
  `gameSessions` and deduplicates by connection plus external match ID. Ongoing
  matches are skipped. Scheduled collection resumes after a failed lease.
- `readWarconSession` preserves final faction scores, map/time and numeric
  player metrics. Feed-dependent metrics remain null when `hasFeed` is false.
- The connected web backend can already request these provider-backed views
  with an explicit `warcon-data`/Wardogs read grant.

However, on-demand analytics and leaderboards are short-lived provider-backed
caches. They are not independent, long-term Logi analytics over retained rows.

## Confirmed storage gap

The actual match-4 response was passed through the current production adapter
in a local process. It produced a valid completed session with 101 player rows,
but the normalized session does **not** retain:

- explicit match winner or result classification;
- faction colors;
- player display-name snapshot, faction or per-match win/loss/draw;
- an explicit feed-coverage flag (individual unavailable metrics are null);
- the match's richer presentation such as mode/lighting and awards.

The source digest detects differences but cannot reconstruct discarded fields.
Final scores alone should not be promoted into an authoritative winner for
abandoned, tied or otherwise unclassified games. The existing
`player-stat-summaries` projection covers verified Logi members; it is not an
all-public-server-player ranking.

Consequently, existing upstream views can power a provider-backed web page now,
but independent historical faction/player analytics require an additive
persistence/projection change. They must not be described as already finished.

## Proposed follow-up behavior

1. **Retain source facts.** Extend the stored session with explicit outcome,
   winning faction, faction colors, player name/faction/result snapshots and
   source coverage. Keep game, physical source, external match ID, start/end
   instants, map, mode, final scores and observed player metrics. Store UTC
   timestamps and a schema version. Missing source values remain null.
2. **Collect reliably.** Backfill available provider history and poll for newly
   finished games, reusing resumable checkpoints and rate-limit handling. Use
   source identity and external match ID to avoid duplicate counting; a changed
   source digest must replace a contribution, not add another win. Preserve
   retained facts through a temporary provider outage. Changing a credential
   must not silently merge a different server or erase collected history.
3. **Publish scoped local reads.** Provide paginated match history/detail and
   aggregate faction/player views from stored facts, with explicit grants,
   date/server/map filters, last successful collection time and coverage.
   Expose changes through the existing reconciliation mechanism. Never claim
   coverage before Warcon started recording or for records purged before Logi
   collected them.
4. **Define rankings.** Show separate kills, K/D, cash and win-rate rankings,
   with the time/match eligibility threshold visible. Use platform ID for
   continuity across nickname changes. A source player is not automatically a
   verified Discord/Logi member. Missing feed metrics are excluded with coverage
   counts rather than added as zero.
5. **Keep outcomes honest.** Completed-without-result, draws and ongoing games
   have separate counters. The observed sample's faction win share among the
   four decided games is 50% / 25% / 25%; it is not a claim of game balance.
   Player win rate uses explicit known outcomes, not the faction on the last
   live scoreboard. Selecting another time range recalculates its denominator.
6. **Keep faction and clan identity separate.** Valkyra/Manticore/Lonestar are
   game factions. Valkyria or another registered opponent is a clan-team
   identity from the planned directory. Connecting a competitive fixture to
   server history requires an explicit reviewed mapping; ordinary public games
   must not become official clan or League wins automatically.

The website can then render faction-colored charts, match cards with full
scoreboards, player history and category-specific rankings. This document does
not add a website UI or activate production collection. The existing team
directory specification remains a separate pending written-spec review.

## Verification performed and remaining acceptance

All four captured real responses parsed successfully through the current
`readWarcon` adapter: `matches`, `analytics`, `leaderboard`, `match`. The same
real detail parsed through `readWarconSession`, reproducing the storage gap.
Adapter verification used captured HTTP bodies; it performed no database writes
and did not deploy either production or local Convex.

Focused regression command:

```sh
node --import tsx --test src/infrastructure/game-data/warcon.test.ts src/application/game-data/collect-sessions.test.ts
```

Result: **14 passed, 0 failed, 0 skipped**. These existing tests exercise import
and checkpoint behavior, not the proposed aggregate feature. The initial private
probe passed an unsupported caller `scope` parameter to the leaderboard adapter;
removing it respected the existing adapter's enforced server scope. No product
change was made to obtain the successful result.

Public aggregate proof: [provider and adapter observations](history-analytics-proof.json).
Before the follow-up can be called complete, it still needs schema/API changes,
bounded aggregation, correction/idempotency regressions, authorization tests,
actual isolated database persistence, website consumer acceptance and the
requested final code/security review. No new runtime feature or production
activation is claimed by this research-only increment.
