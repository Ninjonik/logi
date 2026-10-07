# Discord redesign: audit report

- **Date:** 2026-10-06
- **Branch:** `feat/valkyria-integration`, PR Ninjonik/logi#190
- **Scope:** all 21 design boards and all 1,244 checklist IDs in [`INDEX.md`](INDEX.md)

## Result

| | IDs |
| --- | ---: |
| Implemented as designed (DONE) | **1,220** |
| Accepted deviations: a Discord platform limit, or a recorded owner or lead decision | 22 |
| Blocked by network access, not done | 2 |
| Missing | 0 |
| **Total** | **1,244** |

The two blocked items are **P6-B02** (the WD League results parser) and **P6-28** (the date when the map vote opens). Both need captured pages from `wardogsleague.net`, which the sandbox cannot reach (resolution 7). Everything that would use those results is built and tested with synthetic data:

- the results store;
- the standings with the 3/2/1 rule;
- recent results;
- the panel views.

Until the parser exists, the panels show waiting texts.

## Method

1. **Implementation.** Ten workstreams (W0–W9), and after them six fixers, worked against the per-board checklists. Each closed with a table listing every ID and its `file:line` evidence.
2. **Round 1 audit.** Seven auditors, independent of the implementers, checked every ID against the code. They rendered real evidence:
   - the bot's actual builders through the dashboard Discord preview;
   - dumped bot payloads;
   - dashboard pages in a harness at 1440 and 390 px;
   - the style A score image through its real route;
   - the route-to-bot chain for every panel action, with a fake Discord.

   They found 0 missing items and about 170 deviations or partial items. All of them went to fixers.
3. **Round 2 re-audit.** Three re-auditors checked every round-1 non-DONE ID again, and ran a regression pass over the DONE items of each board. They found 7 remaining items and no regressions. Of those 7, 4 were fixed and 3 recorded as resolutions.
4. **Round 3.** An independent verifier checked the seven IDs fixed after round 2 (L1-B19, L2-B01, L3-54, P6-B05, L3-65, P2-B09, N1-B07) through the real dispatcher, the real panel runner and side-by-side renders. All seven are DONE ([`audit/round-3/round3.md`](audit/round-3/round3.md)).

The audit files are in [`audit/round-1/`](audit/round-1/), [`audit/round-2/`](audit/round-2/) and [`audit/round-3/`](audit/round-3/). They refer to screenshots and harness scripts kept in the session workspace, which are not in the repository.

## Accepted deviations

| IDs | Reason | Resolution |
| --- | --- | --- |
| L1-05, L1-11 | Discord timestamps always show the year; the category chip sits under the heading. | 40 |
| L2-45, M2-13, M2-19, M2-37, M2-B02, N3-14 | Components V2 has no tiles or columns, so the stat numbers sit on one line. | 47, 83 |
| L3-20, L3-26 | Discord text cannot inline team logos, so teams show their short code. | 71 |
| P4-39, P4-B08 | A Discord section holds one accessory, so the combined panel's join buttons sit in one bottom row (P7-20). | 9, 62, 71 |
| P6-22 | Fixture times are Discord timestamps. | 35 |
| P7-13, P7-18, P8-07 | The style B banner shows the server's own name, not the board's placeholder "Server #1". | 82 |
| L6-23, L6-31, L6-36, L6-37, L6-53 | A Discord window has no footer counter, and Discord sends no event when a window is closed. | 84 |
| L6-39 | The review lists the clan's own questions as question and answer pairs. | 81 |

The resolutions list in [`INDEX.md`](INDEX.md) has 84 entries. Each records a conflict between boards, or a decision the boards left open, together with what the code does.

## Validation

At the head of the branch:

- **`npm run test`:** 3,169 tests, all passing.
- **Typechecks:** `npm run typecheck` and `tsc -p discord-bot/tsconfig.json` are clean.
- **Generated files:** the OpenAPI schemas and the Convex API inventory match the generators.
- **`npm run build`:** passes, with 238 static pages.

## Not verified here

- **Live Discord acceptance.** Every Discord behaviour was checked with real builders, fakes and rendered previews. None of it was checked in a real Discord server. That includes the Components V2 rendering on desktop and mobile, modals with selects, the application emoji upload, archived forum posts and permission errors.
- **Real game servers.** No real CRCON or Warcon server was contacted.
- **Convex deploy.** The deploy was not run. All schema changes are additive. Deploy Convex first, then the bot and the web together, because the new bot and web call functions that only the new Convex has.

## Owner actions before activation

1. **Deploy.** Run `bunx convex deploy`, then deploy the bot and the web in one window.
2. **Credential keyring.** Set the same `LOGI_CREDENTIAL_KEYRING` in Convex and on the web server. Server passwords and the conversion of the old stats connections need it.
3. **Optional:** set `LOGI_BOT_VERSION` on the bot; it defaults to the package version, 1.1.0. Set `LOGI_LEAGUE_MESSAGE_CONTENT=true` and enable the Message Content intent if League link replies are wanted.
4. **Discord permissions for the bot:**
   - View Channel, Send Messages, Embed Links, Attach Files and Read Message History in panel, announcement and seed channels;
   - Manage Roles, with the bot's role above the managed roles and the Seed role;
   - Create Private Threads, Send Messages in Threads and Manage Threads in the ticket and application channels;
   - Manage Events and Manage Channels for match events and squad voice;
   - Manage Messages to pin the seed intro.
5. **WD League results.** Allow `wardogsleague.net` in the environment's network settings, so the results parser and the vote-opening date can be built against real pages (P6-B02, P6-28).
6. **GitGuardian.** Mark incidents 37899854, 37869155, 37905869, 37905870 and 37907178 as false positives. All are synthetic test values or copy that mentions a password.
