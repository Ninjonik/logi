# Discord redesign: acceptance checklists (index)

There are 21 checklists, one per design board. Each one lists every visible element and every behaviour rule under a stable ID, such as `L1-23` or `P2-B04`. Each item is then checked against the current code.

- **Design source.** The boards are in `discord-design/project/<Stem>.dc.html`, with screenshots at `shots/<Stem>-1440.png` and `shots/<Stem>-390.png`. The owner decisions come from `discord-design/DECISIONS.md` and from the approved spec at `docs/superpowers/specs/2026-10-05-discord-redesign-design.md` in the repo (commit `5fd71b3`).
- **Code baseline.** The code is `/home/user/logi` at `d659d51`. `HEAD` is now `5fd71b3`, which only adds the spec and one line in AGENTS.md, so the code is the same. In the checklists, `bot/` means `discord-bot/src/`.
- **Item format.** Each checklist has four parts:
  1. Elements: a numbered list grouped by board section, quoting the Czech UI copy exactly.
  2. Behaviour and data: the `-Bnn` rules.
  3. Owner decisions applied.
  4. Today in code: a status for every ID.
- **Statuses.**
  - **EXISTS**: the item is implemented as designed, with `file:line` evidence.
  - **PARTIAL**: something exists, and the gap is named.
  - **MISSING**: nothing exists for it.
- **Variants.** A variant that was not chosen is marked "varianta, nevybráno" and stays listed. An item that a later board replaces is marked **SUPERSEDED** and points to that board.

## Counts per board

| Code | Board | Checklist | Elements | Rules | Total | EXISTS | PARTIAL | MISSING | Workstream |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| L1 | DcEventMessages: announcement, roster, forum | [L1.md](L1.md) | 152 | 20 | 172 | 24 | 84 | 64 | W6 (L1-B15 in W0) |
| L2 | DcDirectMessages: DMs | [L2.md](L2.md) | 64 | 14 | 78 | 8 | 56 | 14 | W6 (L2-54..56, 59, B13 in W7; L2-57..58 in W9) |
| L3 | DcPanels: panels and results in channels | [L3.md](L3.md) | 68 | 11 | 79 | 5 | 51 | 23 | W0 (01..11, B01..B03), W1, W5 (50..57) |
| L4 | DcMembershipTickets: membership, tickets, /link | [L4.md](L4.md) | 60 | 10 | 70 | 9 | 54 | 7 | W7 |
| L5 | DcSystemMessages: errors, service status, team requests | [L5.md](L5.md) | 46 | 9 | 55 | 3 | 25 | 27 | W9 |
| L6 | DcApplicationFlow: application in Discord windows | [L6.md](L6.md) | 59 | 12 | 71 | 3 | 39 | 29 | W7 |
| M1 | DcCommandList: commands and permissions | [M1.md](M1.md) | 45 | 11 | 56 | 4 | 38 | 14 | W8 |
| M2 | DcCommandReplies: /help, /stats, /player | [M2.md](M2.md) | 46 | 7 | 53 | 1 | 36 | 16 | W8 |
| M3 | DcCommandUtility: /link, /notice, /server-status, close commands | [M3.md](M3.md) | 43 | 8 | 51 | 3 | 38 | 10 | W0 (01..08, B01..B02), W8 (14..27, B03..B04), W7 (09..13, 28..43, B05..B08) |
| N1 | DcSettingsMessages: "Zprávy a panely" page | [N1.md](N1.md) | 56 | 10 | 66 | 2 | 21 | 43 | W9 |
| N3 | DcSettingsCommands: "Příkazy" page | [N3.md](N3.md) | 26 | 10 | 36 | 2 | 15 | 19 | W8 |
| N4 | DcSettingsApplication: application form builder | [N4.md](N4.md) | 46 | 9 | 55 | 6 | 23 | 26 | W7 |
| D5 | DcRosterPublish: publish dialog | [D5.md](D5.md) | 23 | 8 | 31 | 3 | 11 | 17 | W6 |
| P1 | DcPanelsList: "Panely v Discordu" list | [P1.md](P1.md) | 23 | 10 | 33 | 0 | 15 | 18 | W3 |
| P2 | DcPanelEditor: panel editor with preview | [P2.md](P2.md) | 55 | 16 | 71 | 2 | 18 | 51 | W3 |
| P3 | DcSeedPlan: seed plan and history | [P3.md](P3.md) | 32 | 9 | 41 | 0 | 1 | 40 | W4 |
| P4 | DcLiveServers: live server panels | [P4.md](P4.md) | 46 | 11 | 57 | 5 | 27 | 25 | W1 |
| P5 | DcSeedMessages: seed in Discord | [P5.md](P5.md) | 34 | 7 | 41 | 0 | 1 | 40 | W4 (15..19, B05 in W1) |
| P6 | DcLeagueResults: WD League and results | [P6.md](P6.md) | 38 | 11 | 49 | 2 | 19 | 28 | W5 (32..38, B09..B10 in W1) |
| P7 | DcPanelGraphics: panel graphics in Discord | [P7.md](P7.md) | 31 | 10 | 41 | 0 | 22 | 19 | W2 |
| P8 | DcGraphicsSettings: graphics settings page | [P8.md](P8.md) | 31 | 7 | 38 | 0 | 14 | 24 | W2 |
| **Total** | | | **1024** | **220** | **1244** | **82 (6.6 %)** | **608 (48.9 %)** | **554 (44.5 %)** | |

The counts include three accessibility sub-items (N1-45a, N3-23a, N4-44a). The superseded L3 and L4 items are counted, because they still describe content that has to land somewhere: L3-50..57 is delivered through P6, and L4-05..30 through L6.

## Decisions applied in the checklists

- **Language and colour.**
  - Every message is in the clan language and uses "ty" ("du" in German).
  - There is one clan accent colour, `#E8A33D` by default. State is shown as chips, and categories are chips.
  - System messages use a grey bar.
  - The format is Components V2 only, with no legacy embeds and no "Automatic updates" marker.
- **Panels.**
  - There is one panel per server. Vlci #1 goes to a public channel, Vlci #2 to the private clan channel, and a combined "Naše servery" panel is optional.
  - Panels refresh every 60 s.
  - A server is live from 40 players, and a seed starts under 20.
  - The password is stored encrypted and shown only in a channel that @everyone cannot view.
  - The "Připojit se" button goes through `/join/<server>`.
- **Panel style.** The default is **A (generated image)** for HLL and Wardogs. Styles B and C are "varianta, nevybráno" as the default, but the spec makes them selectable per panel.
- **Seed.**
  - Only admins can run a seed: through "Ovládání serveru" in a private channel, and on the web.
  - The public panel has no Seed button. The seed question's variant B was chosen; A and C are "varianta, nevybráno".
- **WD League and results.**
  - WD League covers all fixtures, in **two** self-updating panels: tabulka, and nejbližší zápasy including recent results.
  - There is one results panel per game, which backfills the last 5 results when it is created.
- **"Zobrazit přihlášené".** Everyone can see and use it. Admins also see the reasons, "Bez odpovědi", "Připomenout bez odpovědi" and "Otevřít na webu".
- **Roster message.**
  - The default is **variant A (photo + text)**, and "Jen fotka" can be chosen at publish time.
  - It has three buttons: "Zobrazit zařazení", "Zobrazit soupisku" and "Otevřít soupisku".
- **Application.**
  - The default is **Discord windows**. The web form (Varianta B) sits behind a switch that is off by default.
  - The thread card has five decision buttons: člen, rekrut, žoldák, "Zamítnout…" and "Ještě nerozhodnuto".
  - `/close_application` stays.
- **Commands.**
  - `/help` is new.
  - `/player` replies privately and has "Sdílet".
  - Staff commands are visible to everyone, and permission is checked when they are used.
  - Commands are registered on start, when the bot joins a server, and when the clan language changes.
- **Migration.** Messages of upcoming matches and of matches that ended in the last 14 days are redrawn once.
- **API parity.**
  - The new settings go into `/api/v1` `GET/PATCH clan/settings` with OpenAPI.
  - These are excluded and recorded in `docs/integrations/website/configuration-coverage.md`:
    - binary uploads
    - live Discord actions: post now, refresh, re-register commands, seed now
    - application decisions

## Superseded or not-chosen items

These items are still listed, but they must be implemented as shown here:

| Items | Replaced by |
| --- | --- |
| L3-50..57 (WD League card per fixture) | P6 panels |
| L3-25 "no backfill" | P6-B09: backfill the last 5 |
| L3 footers showing 30 s / 5 min | A fixed 60 s (L3-B04) |
| L4-05..30 (old application wizard and decision card) | L6 |
| P8 "Styl B · Výchozí" | Styl A as the default |
| P7 style B/C items | Marked "[varianta, nevybráno]" for the default; still built as per-panel options |
| D5 "Jen fotka" | Not the default, but selectable |
| L6/N4 web form | Behind the N4-42 switch, off by default |
| P6 board's third "recent results" message | Shown inside "nejbližší zápasy" (spec) |
| D5 preview with two buttons | Three buttons (L1-102, spec) |
| N4-39..41 three decision buttons | Five buttons (L6, spec) |
| N4-25 window title "Přihláška · 3/3 · Otázky klanu" | The bot's real title "Přihláška · 3 ze 3 · Otázky klanu" (L6-32); the preview renders the real window |
| N4-26 review card ("PŘIHLÁŠKA · KONTROLA", "Zkontroluj přihlášku", "Upravit: …", "Zrušit přihlášku") | The L6-38..40 review the bot posts; the preview renders it |
| N4-39 footer "Rozhodnout smí podpora kategorie a Správci Logi" | The card's real footer (L6-46); the N4-41 note keeps the board sentence |
| P1-19 sub-line "posílá jen potvrzené od 1. 10." | A backfill of the last 5 |

## Open conflicts and questions (owner input needed)

1. **Seed: P3 and P5 disagree.** The spec says only that "a cooldown and a maximum duration apply". The boards differ on:
   - **Rate limit:** P5-04, P5-31 and P5-B02 say "Mezi seedy jsou aspoň 2 hodiny" (a cooldown on starts). P3-15 and P3-30 say "Nejvýš 1 označení role za 4 h" (ping protection: the seed still runs, without the ping). Both may be wanted; this needs confirmation.
   - **Role button label:** P5-09 and P5-21 say "Zvát mě na seed". P3-14 and P3-19 say "Odebírat výzvy".
   - **Control message:** P5-26..29 has one message per server, with "Spustit seed"/"Ukončit seed", "Obnovit panel" and "Pozastavit panel". P3-24 has one message for all servers, with "Seed: Vlci #1", "Obnovit panely" and "Pozastavit panely".
   - **Call copy:** P3-19 and P3-20 use the title "Seedujeme Vlci #1 · Public", the chip "Seed běží", and at the end "Vlci #1 · Public je živý" with the chip "Server je živý". P5-07 and P5-13 use "Seedujeme Vlci #1", the chip "Seedujeme", and at the end "Server je živý" with the chip "Živě".
2. **Recruitment panel button.** N1-37 says "Přihlásit se do klanu", while L4-03 and L6 say "Podat přihlášku".
3. **`/link`.** Verification and the other platforms are still undecided (L4-46..60, L4-B07, M3-09..13, M3-B08). The checklist items describe the board, and their implementation waits for the owner.
4. **Manual reminder cooldown.** The board says "at most once per hour" (L1-B11), but the code allows one every 30 min (`src/domain/events/manual-reminders.ts:20`). The checklist follows the board.
5. **Per-publish roster options in `/api/v1`** (D5-B08). The spec covers the default but names no exclusion for the per-publish options (variant, mentions, DM, changes post).
6. **Provider data gaps.** These block or limit design items:
   - **HLL queue, next map and day/night.** "fronta 3", "další mapa", "Den/Noc" appear in P4-08, P4-09, P4-12, P4-15, P7-07, P7-08, P7-27 and P4-44. They are not in `hllLiveSchema` (`src/domain/game-data/hll-live.ts:14-30`). P4-02 says to show only what the server provides, so the CRCON fields need to be confirmed first.
   - **wardogsleague.net results.** The parser returns `results: null`, which blocks the P6 table and recent results (P6-B02).
   - **Seed.** No data model exists for it.

## Proposed workstreams

Each workstream (W) owns the files listed for it. Other workstreams touch them only through the hand-off points named here; shared hot spots are in the next section. The item counts come from mapping every checklist ID to exactly one workstream.

| WS | Area | Boards / IDs | Items | EXISTS | PARTIAL | MISSING |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| W0 | Foundation kit | L3-01..11, L3-B01..B03, M3-01..08, M3-B01..B02, L1-B15 | 25 | 3 | 10 | 12 |
| W1 | Panels core | L3-12..49, L3-58..68, L3-B04..B11, P4, P5-15..19, P5-B05, P6-32..38, P6-B09..B10 | 129 | 8 | 70 | 51 |
| W2 | Panel graphics | P7, P8 | 79 | 0 | 36 | 43 |
| W3 | Panels web UI | P1, P2 | 104 | 2 | 33 | 69 |
| W4 | Seed | P3, P5 (except 15..19, B05) | 76 | 0 | 2 | 74 |
| W5 | WD League | L3-50..57, P6-01..31, P6-B01..B08, P6-B11 | 48 | 1 | 20 | 27 |
| W6 | Match messages | L1 (except B15), L2 (except 54..59, B13), D5 | 273 | 34 | 146 | 93 |
| W7 | Membership, tickets, /link | L4, L6, N4, M3-09..13, M3-28..43, M3-B05..B08, L2-54..56, L2-59, L2-B13 | 226 | 21 | 139 | 66 |
| W8 | Commands | M1, M2, N3, M3-14..27, M3-B03..B04 | 161 | 8 | 104 | 49 |
| W9 | Messages settings and system | N1, L5, L2-57..58 | 123 | 5 | 48 | 70 |
| | **Total** | | **1244** | **82** | **608** | **554** |

**Order.** W0 comes first. Panels come next, as the spec requires: W1, then W2 and W3 in parallel, then W4 and W5. After that come the public-facing items (W8's `/help`, `/player` and `/stats`, and W6), then the admin items (W7 and W9). W6, W7 and W8 can start in parallel once W0 lands, because their file sets do not overlap.

### W0 · Foundation kit (lands first)

- **How to use it:** [KIT.md](KIT.md), the developer note for the message model, the bot kit, the preview, the copy modules, the interaction registry and the `/api/v1` settings slices.
- **Delivers:**
  - The single message kit from the spec, in the new `discord-bot/src/ui/`. It includes:
    - a container with the clan accent (grey for system messages)
    - the "DRUH · HRA" header label, title, chips with the state vocabulary, and meta lines
    - a footer with relative "Aktualizováno …" and "Spravováno v Logi"
    - button-row rules: at most one primary, link buttons marked ↗
    - ephemeral replies, and the shared error card "Tohle se nepovedlo"
  - One Discord preview component for the dashboard, in the new `src/components/app/discord-preview/`.
- **Owns:**
  - `src/domain/discord-messages/{format,message-style,faction-emblem,signup-counts,calendar-day}.ts`: accent resolver, Discord timestamps with weekday, emblems without coloured squares.
  - `discord-bot/src/sync/publication.ts`: remove the "Automatic updates" marker (L1-B15) and the English delivery error.
  - `discord-bot/src/index.ts:245-257`: the generic error.
  - `discord-bot/src/interactions/shared.ts`.
- **Shared-file setup:**
  - Split `src/lib/clan-language.ts` (2,116 lines) into feature-named copy modules (events/DM, panels, membership/tickets, commands, system) and update its callers. Every later workstream then edits only its own copy file.
  - Create the extensible `/api/v1` clan settings slice, in `src/domain/api/settings-patch.ts`, `src/app/api/v1/clan/[[...path]]/route.ts` and `src/lib/api/*-openapi.ts`.

### W1 · Panels core

- **Bot:** `discord-bot/src/public-panels/{worker,render,hll-render,copy,player-details,private-reply}.ts`, `discord-bot/src/player-reports.ts`, and `discord-bot/src/sync/panels.ts` (calendar panel).
  - The calendar builder moves out of `message-builders.ts:1590-1732` into W1's own module.
- **Convex:** `convex/discordPublicPanels.ts`, `convex/discordPublications.ts`, `convex/discordPublicationTable.ts`, `convex/hllLiveData.ts` and `convex/warconData.ts`.
- **Domain and application:**
  - `src/domain/discord-publications/{settings,destinations,channel-permissions,channel-types,result-card}.ts`
  - `src/domain/game-data/hll-live.ts`
  - `src/application/discord-publications/{publish,results}.ts`, plus new panel action use-cases: post now, refresh, pause, delete, retry, test fetch, and the bot heartbeat with version.
- **New:**
  - The `/join/<server>` page under `src/app/[locale]/`.
  - Encrypted password storage, re-checked against channel privacy on every refresh.
  - The results backfill, and one results panel per game.
  - The panel seed mode (P5-15..19), which reads seed state through a port provided by W4.
- **Hands off:**
  - The panel view-model to W2, so it can render the image.
  - The action use-cases to W3 and W4.
- **Wiki:** `content/configuration/public-panels.mdx`.

### W2 · Panel graphics

- **Style A renderer:** an image of 1200×400 at most, re-uploaded at most once every 60 s. It can reuse the `next/og` + `sharp` pattern in `src/app/api/discord/roster-image/[eventId]/route.tsx` and `src/app/api/og/[kind]/[id]/route.tsx`, or be rendered by the bot.
- **Emoji and assets:**
  - `src/application/discord-publications/provision-emoji.ts`: status icons and the player gauge as application emoji.
  - `discord-bot/src/public-panels/assets.ts`, with built-in map art and the fixed faction icons.
  - `convex/imageAssets.ts`: server banners and map overrides.
- **Presentation and settings:** `src/domain/discord-publications/panel-presentation.ts`, `src/components/app/discord-panel-appearance.tsx`, and the new graphics settings page and storage (P8).
- **Depends on:** W1's view-model, and W3's editor step "Vzhled" (P2-21..24 are counted in W3).

### W3 · Panels web UI

- **Settings section:** the new "Panely v Discordu" section in `src/domain/workspaces/settings-sections.ts`, routed through `src/app/[locale]/(dashboard)/dashboard/servers/[serverId]/settings/[section]/page.tsx`.
- **Components:** a new `src/components/app/discord-panels/` with the list, heartbeat strip, data sources, editor steps 1–6 and sticky action bar. It replaces `src/components/app/discord-public-panels-form.tsx` and its embedding in `src/components/app/settings/discord-messages-settings.tsx`.
- **API:** `src/app/api/servers/[serverId]/discord-public-panels/route.ts` for actions, plus the panel slice of `/api/v1` clan settings.
- **Copy:** the `panelsForm` keys in `src/i18n/messages/{cs,en,de}.ts`.
- **Depends on:** W1's use-cases, W0's preview component, and W2 for appearance.

### W4 · Seed (new feature)

- **Domain and application:**
  - New `src/domain/discord-seed/`: the state machine, thresholds (40/20), cooldown and ping protection, max duration, and the 10-segment progress bar.
  - New `src/application/discord-seed/`: manual, schedule and automatic triggers, plus history.
- **Convex:** new `convex/discordSeed*.ts` with additive tables, and an entry in `convex/crons.ts`.
- **Bot:** new `discord-bot/src/seed/`. It covers the call message, pinned intro, Seed-role toggle (following the `discord-bot/src/sync/managed-member-roles.ts` pattern), "Ovládání serveru" control message, worker and private replies.
- **Dashboard:** the P3 page in the new `src/components/app/discord-seed/`.
- **Depends on:** W1 (seed state port, and the pause/refresh use-cases), and W3 (navigation).

### W5 · WD League

- **Parser:**
  - `src/infrastructure/wardogs-league/{parse-match,parse-index,fetch-match}.ts`: a results parser, and all fixtures.
  - `src/domain/wardogs-league/`: the contracts, and standings computed with the 3/2/1 rule.
  - `src/application/wardogs-league/tracking.ts`.
- **Convex:** `convex/leagueDiscovery*.ts`, `convex/leagueFixtureReads.ts`, `convex/leagueMatchData.ts`, `convex/leagueMatches.ts` and `convex/leagueTrackingStore.ts`.
- **Bot:** `discord-bot/src/league/{render,worker}.ts`, which renders the two panels and retires the per-fixture cards.
- **Dashboard:** `src/components/app/league-tracking-form.tsx`.
- **Wiki:** `content/configuration/league-tracking.mdx`.
- **Depends on:** W3 for the WD League type in the editor (P2-50..55 are counted in W3).

### W6 · Match messages

- **Bot builders:** the announcement, roster, forum and attendance builders in `discord-bot/src/message-builders.ts` (lines 132–1169 and 1832–1925).
- **Bot sync and interactions:**
  - `discord-bot/src/sync/events.ts`
  - `discord-bot/src/interactions/{event-buttons,roster-assignment,attendance-decline,match-recap-preference}.ts`
  - `discord-bot/src/{forum,scheduled-events,event-roles,manual-reminders}.ts`
  - `discord-bot/src/sync/{signup-reminders,attendance-reminders,manual-reminders,match-recaps}.ts`
- **Roster digest and DMs move to the bot.** The digest uses `src/lib/roster-update-summary.ts` and `src/domain/rosters/roster-update-channel.ts`, and `src/app/api/servers/[serverId]/rosters/[rosterId]/update-notifications/route.ts` only makes the request.
- **Publish dialogs and roster image:** `src/components/app/roster-board.tsx` (D5) and `src/app/api/discord/roster-image/[eventId]/route.tsx`.
- **Migration:** the one-time 14-day migration job.
- **Wiki:** `content/operations/{matches,rosters,events}.mdx`.

### W7 · Membership, tickets and /link

- **Bot interactions:**
  - Extract the ticket, membership, `/link` and close-command sections of `discord-bot/src/interactions.ts` into their own `discord-bot/src/interactions/*` modules. These are the close embeds (481–566), the ticket button (950–1018), `/link` (1354–1392), the ticket modal, membership flow, platform link and ticket/application creation (1393–3862), and `/close_ticket` and `/close_application` (3863–4224).
  - Owns `discord-bot/src/interactions/{membership-flow,membership-welcome,platform-link,report-members}.ts`.
  - Moves the ticket and membership panel builders out of `message-builders.ts:1171-1390`.
- **Bot sync:** `discord-bot/src/sync/{membership-events,membership-ingress,managed-member-roles}.ts`.
- **Convex:** `convex/discordMembership.ts`, plus additive form-schema and draft fields in `convex/schema.ts` (around lines 182–281 and 1309).
- **Dashboard:** the form builder in `src/components/app/membership-settings-form.tsx`, and the web form page behind the switch.
- **Wiki:** `content/configuration/tickets.mdx`.
- **Waiting:** the `/link` part waits for the owner's decision.

### W8 · Commands

- **Registry:** a command registry extracted from `discord-bot/src/interactions.ts:748-947` (definitions and registration inside `createInteractionHandler`, 589–949), registered on ClientReady, GuildCreate and after a clan language change (`discord-bot/src/index.ts:155-177`).
- **New domain module:** `src/domain/discord-commands/`, the permission matrix used by `/help`.
- **Commands:**
  - `/help`: new.
  - `/player`: `interactions.ts:299-479,1111-1184` and `discord-bot/src/interactions/player-search.ts`. It becomes a private reply with "Sdílet".
  - `/stats`: `discord-bot/src/interactions/stats*.ts` and `src/domain/player-stats/{stats-copy,stats-reply,command-settings}.ts`.
  - `/server-status`: `discord-bot/src/interactions/server-status.ts`. It switches to the clan language and a fresh permission check.
  - `/notice`: `interactions.ts:1019-1110,1186-1353`.
- **Dashboard:** the "Příkazy" page, generalised from `src/components/app/settings/stats-command-settings-form.tsx`.

### W9 · Messages settings and system messages

- **Settings pages:** `src/components/app/settings/discord-messages-settings.tsx` (N1) and `src/components/app/settings/discord-channel-settings-form.tsx`.
- **New domain module:** `src/domain/discord-messages/notification-settings.ts`, holding the per-message switches and the roster default.
- **Errors channel:** `discord-bot/src/error-reporting.ts`, with Czech text, a fix step and the grey bar.
- **Service status:** `discord-bot/src/platform-status.ts`, including the "Změny stavu" thread.
- **Team requests:** `discord-bot/src/sync/{team-request-notifications,team-request-worker}.ts` (L2-57..58, L5-38..41).
- **Notice post:** the notice post in the match thread (L5-42..43) is built through W6's forum module.
- **Wiki:** `content/configuration/settings.mdx` and `content/discord-bot-setup.mdx`.

## Shared hot spots

| File | Owner | Others that touch it | Rule |
| --- | --- | --- | --- |
| `src/lib/clan-language.ts` (2,116 lines) | W0 splits it | all | After the split, each workstream edits only its own copy module. |
| `discord-bot/src/interactions.ts` (4,224 lines; dispatch 589–747, registration 748–947, W7 sections 481–566, 950–1018, 1354–4224) | W8 (dispatch, registry, `/player`, `/notice`) | W6, W7 | W0/W8 add a handler registry first. W7 moves its sections out. Nobody else edits the dispatch block. |
| `discord-bot/src/message-builders.ts` (1,925 lines) | W6 | W1 (calendar 1590–1732), W7 (tickets/membership 1171–1390) | Move those blocks into their owners' modules early. |
| `convex/schema.ts` | each workstream adds its own tables | all Convex workstreams | Changes are additive only. Regenerate `convex/_generated` through tooling, and run `bunx convex deploy` once, before the bot and the web (spec). |
| `convex/crons.ts` | W1, W4, W5 | — | Append-only. |
| `src/i18n/messages/{cs,en,de}.ts` | each workstream, under its own namespace | — | Update all locales. |
| `src/domain/workspaces/settings-sections.ts` | W3 ("Panely v Discordu"), W8 ("Příkazy") | — | One small edit each. |
| `/api/v1` clan settings and OpenAPI (`src/domain/api/settings-patch.ts`, `src/lib/api/*`, `scripts/generate-openapi-schemas.ts`) | W0 (frame) | W1–W9 (slices) | Each workstream adds its own slice and its tests. Exclusions go in `docs/integrations/website/configuration-coverage.md`. |

## How to use these checklists

- **Implementation agents.** Work through every ID of the boards in your workstream. Treat the PARTIAL and MISSING evidence as the starting point, and keep the exact Czech copy.
- **Auditors.** Re-check every ID against the code and the rendered previews, and mark each one done or missing. EXISTS items still need a regression check, because the shared kit changes their rendering.

## Resolutions of the open conflicts (lead, 2026-10-05)

These resolve the questions above for implementation. The owner can override any of them.

1. **Seed.** Both limits apply and both are editable in P3:
   - at least **2 h between seed starts** (P5-B02);
   - at most **one Seed role ping per 4 h** (P3-15). A seed started inside the ping window runs without a ping.
   - The opt-in button reads **"Zvát mě na seed"**.
   - The admin control is **one "Ovládání serveru" message per server** (P5-26..29).
   - The call uses the P5 copy, with the server's full name in the title: "Seedujeme Vlci #1 · Public". Its chip "Seedujeme" becomes "Živě" when the server goes live, and the final line reads "Server je živý".
2. **Recruitment panel button:** "Podat přihlášku" everywhere, so N1-37 follows L4 and L6.
3. **`/link`** is implemented as drawn on L4 and M3:
   - Steam, Epic, Xbox and PlayStation;
   - "Hrál jsi u nás?" search;
   - "Ověřit Steam přes web" link.
   - Verification is offered, not required.
4. **Manual reminder cooldown:** once per hour, following the board (L1-B11).
5. **Per-publish roster options** (variant, mentions, change DMs and the change post) are a live publish action. They are recorded as a deliberate `/api/v1` exclusion. The default variant is a setting and is exposed.
6. **HLL queue, next map and day/night** are shown when CRCON provides them and are left out silently when it does not (P4-02).
7. **wardogsleague.net results** need network access to the site to build and verify a results parser. Until then:
   - the fixtures panel ships;
   - the standings panel shows "Tabulka se zobrazí po prvních výsledcích".
8. **Password on the combined "Naše servery" panel.** P2-40 shows "Ukázat heslo serveru" in the combined panel's editor example, but P4-31, P4-39 and P4-B08 say the combined panel shows public data only and never a password. The stricter rule applies: the combined panel never shows a password, and its editor shows a note pointing to the server's own panel.
9. **Join button label on the combined panel.** P2-45 previews "Připojit se: Vlci #1", but P7-20, the Discord rendering board, says "Připojit: Vlci #1". The editor preview renders the bot's real output, so both use the P7-20 label.
10. **Stale rows in `/server-status` (M3-23).** The stored projection reports every row that is not fresh as "unknown", and data 15 minutes old as unavailable. A new, additive field carries the last observed state through `gameData:listConnections` (`lastState`, from `projectLastState`); other readers of the snapshot are unchanged. For up to 24 hours after the last data, the row shows that state with "zastaralé" and the observation time ("Online · zastaralé · před 25 min"). After 24 hours it shows "Bez dat", without the old players or map.
11. **`/close_ticket` failures (M3-07, M3-B02).** A refused close card, rename, lock or archive goes to the errors channel through the W9 reporter, with the new sources `ticketCloseCard` and `ticketCloseThread`. The ticket stays closed in Logi. The private reply says what did not happen and that the admins were told, for example "Vlákno se nepodařilo zamknout ani archivovat. Správci dostali upozornění.", instead of claiming the thread is locked and archived.
12. **Registration after every save (M1-B01, N3-B02).** Every save of the command settings, on the "Příkazy" page or through the `commands` slice of `/api/v1`, asks the bot for a registration, so "Zaregistrováno …" moves and the save note "Po uložení bot příkazy znovu zaregistruje." is true. The bot keeps its "skip if identical" optimisation for the Discord call, but records the registration time and result anyway. "Znovu zaregistrovat" always calls Discord, and a save never weakens a pending "Znovu zaregistrovat".
13. **Save bar on a phone (N3-25).** The phone notes place the save bar at the end of the page. The shared sticky "neuložené změny" bar of the settings pages stays. The overlap of the command name and "zapíná se s Členstvím" at 390 px is fixed: the switch wraps below the name.
14. **Shared `/stats` card time (M2-23, M2-B03).** "Sdílel @Hráč 17 · stav k …" shows the data's time, the same as the private card's "data z", not the share time. The share time is used only when the source gave no time.
15. **Faction order in `/stats` (M2-18).** Factions are sorted by games played, most first, then by name, as the board lists them (Valkyra 12, Manticore 7, Lonestar 4).
16. **`/notice` for a started event (M3-19).** When nothing upcoming matches, `/notice` looks for the person's signed-up event that already started (`events:findStartedNoticeEvent`) and answers with the "VLK vs ROG už začal" card instead of "Nejsi přihlášený".
17. **Clan colour on early error cards (M3-06).** The early refusals carry the clan's message style: the `/close_application` checks, `/close_ticket` outside a ticket thread or in a thread that is not a ticket, and the expired `/stats` card. Before the thread's context is known, the style comes from the live command settings (`clanReplyKit`).
18. **Invalid ID card: M3-11 against L4-56.** M3's rule wins: an error card has at most one button. The card keeps only "Zadat znovu". The platform's guide becomes a link in the card's text: "Má 17 číslic a začíná 7656119. Najdeš ho podle [návodu](…)."
19. **The reminder's "Přijdu později" form: M3-14 against L2-30.** The reminder button keeps the L2 form, because the DM flow board is the more specific one: label "Kdy dorazíš a proč", placeholder "Např. ve 20:15, končím v práci" and the L2 confirmation. `/notice` keeps the M3 window. Both store the same notice.
20. **Option names (M1-B02), kept.** The internal option keys stay English (`game`, `period`, …), because every Discord locale sees the clan-language names through `name_localizations` ("hra", "období"). Descriptions and choices have the clan language as their default.
21. **Minor copy.** The `/help` label uses the Logi workspace name ("PŘÍKAZY LOGI · KLAN VLCI"), and the Discord server name only without one. The "Statistiky … jsou tu vypnuté" card points to the renamed page: "Zapnout je může správce v Logi → Nastavení → Příkazy." (en "Logi → Settings → Commands", de "Logi → Einstellungen → Befehle").
22. **"Přijmout jako žoldáka" (L6-B08, N4-40, N4-B06).** The button grants the roles of the clan's **mercenary category** (a category whose result is Žoldák), never the applicant's chosen member category. The category is the applicant's own when it is a mercenary one, else the mercenary category of the application's game, then of another game the applicant chose, then any; the membership moves to that category and its game. Without a mercenary category the button is disabled with a short reason under the buttons, `/close_application` with the žoldák outcome answers with an error card, and the N4 page says a mercenary category has to be set up.
    - An applicant with "Dát roli Rekrut hned po odeslání" waits with the category's recruit role only; the clan role comes with acceptance ("@Klan dostane každý přijatý", N4-32).
    - The N4 decision table shows, as the board does, "+" for every role a decision gives and "−" for every role the waiting applicant loses: "Přijmout jako člena" "+ @Klan, + @Člen, − @Rekrut", "Přijmout jako rekruta" "+ @Klan, + @Rekrut", "Zamítnout…" "− @Rekrut".
23. **Default panel title and text (L6-12, L4-05, L4-06, N4-07, N4-08).** A new clan starts with the board copy in the **clan language**, in "ty": "Přidej se ke klanu {clan}" and "Vyber, jak s námi chceš hrát. Přihláška má tři krátká okna a zabere pár minut." (with "dvě" for a two-window form; en and de alike). The panel button stays "Podat přihlášku" (resolution 2). A clan that never changed the default, including the pre-redesign default seeded in the dashboard language, gets the new default when the panel is drawn and in the settings form; custom text is kept. The default text already says how many windows there are, so the panel leaves out its own windows note then (as on N4).
24. **"Najít ID účtu" stays on the message between windows (L6-26, L6-27).** It is how the `/link` guide is reachable from the application (L4-60).
25. **"Otevřít vlákno" stays on the rejection DM (L4-32).** L2-55 gives the rejected, pending and mercenary DMs the same frame as the accepted DM (L2-54), which has the link.
26. **The card chip while waiting (L6-43, N4-39).** It reads "Čeká na rozhodnutí" also when "Dát roli Rekrut hned po odeslání" is on, a state the boards draw; the former "Rekrut · čeká na rozhodnutí" is gone.
27. **Discord's 3-second rule.** Opening a window never waits on a Convex round trip: the bot keeps every clan's application definition live from a subscription (`membershipApplications:listApplicationDefinitions`, also on settings changes) and each applicant's state from the last read, refreshed in the background. A window opened before the bot knew the applicant still stops an open application or a full membership when it is saved.
28. **An invalid first window is saved (L6-09).** A window filled in for the first time keeps its valid answers in the draft, so "Upravit" reopens it filled in; a window already finished keeps its last valid answers.
29. **One source for "Hrál jsi u nás?" (L4-49, L4-B08, L6-B06).** `/link` and the application search the same retained games of the clan's servers (`serverGameHistory`) with the same rule (in-game name, or the exact ID in `/link`). `/link` asks the question when the clan's servers retained games. The old stats server connections are no longer used by either, and the N3 card about them says so (N3-05 text updated).
30. **Manual seed with the plan switched off (P3-09, P3-B02).** "Seed teď" and "Spustit seed" always work, as the board says ("Jde vždy"). The plan switch governs only the schedule and the automatic trigger. A manual start is limited by the cooldown between seeds ("Mezi seedy aspoň", 2 h by default); it still needs a seed channel, and it is not offered for a server that is offline or already live. This reverses the earlier implementer rule that refused a manual start while the plan was off. The refusal "Plán seedu je vypnutý" no longer exists.
31. **Seed previews are the bot's message (P3-19, P3-20).** The previews for the seed call and for "Server je živý" use the bot's real view. The bot and the dashboard take the map from one shared rule, `seedMapFacts` in `src/domain/discord-seed/map.ts`:
    - the map line, for example "Foy · Warfare · Den";
    - Logi's built-in map picture beside the call.

    Mode and lighting appear when the collected server data names them, as resolution 6 says for day and night. The CRCON public info that Logi collects today names only the map, so both the call and the preview read "Foy" with the picture.

32. **Recent League results before the parser exists (P6-18).** Until Logi has collected any League result, "Poslední výsledky" shows the waiting text "Výsledky se zobrazí po prvních výsledcích ligy" (en "Results appear after the first league results", de "Die Ergebnisse erscheinen nach den ersten Liga-Ergebnissen"). Once results are collected, a week with none says "Za posledních 7 dní nejsou žádné výsledky ligy." The website API exposes this as `fixtures.recentResults.state` (`waiting_for_results` / `ready`).
33. **HLL result score row (P6-33).** The score row is two-sided, as on the board, on one line because Discord text has no columns: the first side left, the score in the middle, the second side mirrored, with the emblems beside the sides, for example "VLK Spojenci ★ 4 : 1 Osa ✚ ROG". Team logos cannot sit inline in Discord text (platform). The compact layout keeps "VLK 4 : 1 ROG". The footer keeps Discord's `<t:…:f>` timestamp, which each reader sees in their own time zone and language (platform format).
34. **Wardogs result label (P6-38).** A League result is labelled "VÝSLEDEK · WARDOGS LEAGUE · #38 FRIENDLY", with the fixture number and the League's match type, as on the board. "ZÁPAS 38" is used only when the League gives no type.
35. **Kept as platform or recorded limits (P6-22, P6-28, P6-B02).**
    - P6-22: fixture times use Discord timestamps, so each reader sees the date and the relative time ("za 23 hodin") in their own time zone and language. This is the "časy v tvém pásmu" the board promises; a fixed "zítra" would be wrong for readers in other zones.
    - P6-28 and P6-B02: no capture of the League site is possible from the sandbox yet (resolution 7). Until a completed match page and a map-vote page are captured and parsed, results stay uncollected, and a vote that has not opened reads "Hlasování o mapě nezačalo" instead of "Hlasování o mapě od so 10. 10." The copy and the view for the opening date are ready.
36. **"Potvrdím účast" on the card and in the DM (L1-B08 vs L2-B07).** Both rules hold, because they are separate surfaces:
    - the announcement card and "Moje zařazení" show "Potvrdím účast" from the meeting start (L1-B08, L1-116);
    - the attendance reminder DM goes out a day before the meeting and may already confirm (L2-B07), so the bot accepts a confirmation from the attendance window, the event's `starting` status, until the game starts.
37. **"Zobrazit zápas" only with a public match page (L1-54, L1-B04).** The played card shows its one link only when the match has a public match page, which exists once match statistics are linked. Without one the played card has no button: the bot never links to a page that is not there.
38. **"Připomenout bez odpovědi" after sign-ups close (L1-84).** The button stays on the leadership's list but is disabled once sign-ups close, because a sign-up reminder after the close is refused. The card says why under the button: "Připomínka přihlášky jde poslat jen do konce přihlášek."
39. **The publish preview's change digest (D5-21).** The re-publish preview shows the real digest the bot posts (L1-120..126): the label "ZMĚNY SOUPISKY", the per-section lists and the footer "Upraveno … · Spravováno v Logi". D5's simplified sketch ("ZMĚNY V SOUPISCE", "↔ 3 hráči přesunuti", "Hráči se změnou dostali DM") is not built, so the preview never differs from the message.
40. **Platform limits, kept as drawn by the kit (L1-05, L1-11).**
    - **L1-05, the timestamp format.** Discord has no day-and-month timestamp style. `<t:…:d>` always carries the year in the reader's format, so the card reads "ne 11.10.2026 · 20:00 · za 6 dní". The weekday is computed in the clan's time zone.
    - **L1-11, chip placement.** A Discord heading cannot carry an inline chip, so the category chip sits on the line under "### VLK vs ROG", as the W0 kit lays out every header.
41. **The baseline of the change digest and DMs (D5-B04).** Every publish stores on the roster the squad places it shows (`publishedPlaces`) and those of the version it replaced (`previousPublishedPlaces`). The change request compares the saved roster with that stored version. The browser no longer sends a previous roster, and one sent by an older dashboard is ignored. A stale tab or another admin's publish can no longer change who is named or messaged. Each publish has at most one change request, so asking twice returns the queued one.
42. **"Označit zařazené hráče" without a roster channel (D5-08).** When the announcement doubles as the roster card (L1-43), the first publish with the switch on makes the bot mention the rostered players once, in a reply to the announcement. Discord never pings on the edited card, and the re-publish mention goes the same way (D5-19). With a roster channel, the roster message's first post carries the mentions as before.
43. **The one-time redraw covers every message of the old bot (L1-147, L1-B20).** Matches whose announcement the old bot had already removed are queued too, when they still have a roster card in the roster channel or a forum post. Their redraw is recorded as a migration marker, not as a card layout, so the bot never posts a new announcement for them. Redraws stay at six matches a minute.
44. **Forum posts are found again, archived or not (L1-137).** Before it creates "Informace o zápasu" or "Debrief", the bot looks the post up by its stored ID, which Discord also uses as the post's thread ID. Archived posts are included, and the bot reopens an archived post before it edits or pins it. Without a stored ID it searches by name among the active and the archived posts. The Debrief's ID is stored in the sync state (`debriefMessageId`).
45. **"Přijdu později" in the reminder DM (L2-32, M3-14).** The reminder's button keeps the L2 window: "Přijdu později · VLK vs ROG", "Kdy dorazíš a proč", "Např. ve 20:15, končím v práci" and the reply "Velení ví, že přijdeš později". `/notice` keeps its M3-16 window. Both save the same notice, so leaders see one result in Docházka.
46. **"Zobrazit zařazení" pressed in a DM (L2-03).** The answer may include the server password. A DM is private to that player, who is entitled to see the password (L1-B07), and Discord cannot make a reply in a DM ephemeral. In a server channel the assignment is only ever an ephemeral reply.
47. **Match recap numbers (L2-45).** Components V2 has no tiles or columns, so kills, deaths and K/D are one line: "Zabití **36** · Úmrtí **15** · K/D **2,40**". This is a platform limit and is kept.
48. **DM dividers (L2-28..34, L2-52, L2-54, L2-56).** L2 is followed: a DM without buttons has a divider above its footer, and the application and ticket decision DMs have it between the quoted reason and "Otevřít vlákno". L4 draws the decision DMs' divider below the button instead. The team request DMs keep the L5 placement, which L2-57..58 follow.
49. **"Otevřít tým v Logi" (L2-57, L5-39, L5-40).** The clan dashboard has no page per team. The button opens the clan's Týmy for the team's game, already searched for the team (`…/teams?game=…&search=<team>`). "Otevřít Týmy v Logi" (rejected, L5-41) opens the game's list.
50. **Errors channel chips (L5-B03).** The board draws three chips. They are used as drawn: "Zkusí se znovu po opravě" when an admin must fix something in Discord or Logi, "Zkusí se znovu sám" only when Discord did not answer, and "Hráč dostal zprávu, ať to zkusí později" when a player's click failed. A later step of something that already worked is not retried and nobody was told: adding support or recruiters, the intro or card, or the new name of an open ticket or application, including an application renamed after a decision. These entries get a fourth chip, "Bot to znovu nezkusí" (en "Won't be retried", de "Wird nicht wiederholt"). Their "Co udělat" says how to finish the step by hand, and the context names the author ("autor @Hráč 17") instead of "zkoušel".
51. **Notices in the errors channel (L5-16, P4-30, P4-B06, P3-22).** The hidden panel password and a public seed control channel are their own entries. The boards draw no card for them, so the copy follows the errors channel's pattern:
    - "CHYBA BOTA · PANELY / Heslo serveru bylo z panelu odstraněno / Panel Vlci #2 · Kanál #klan-server / Zkusí se znovu po opravě", with the reason, how to deny @everyone "Zobrazit kanál", "Heslo se do panelu vrátí samo při dalším obnovení, do minuty." and the button "Panely v Logi".
    - "CHYBA BOTA · SEED / Ovládání serverů se neodeslalo / Kanál #spravci", with "Nastav … jako soukromý, nebo v Logi → Seed serverů vyber jiný kanál pro ovládání." and the button "Seed serverů v Logi".
52. **Scheduled reminders that did not arrive (L2-64).** Failed sign-up and attendance reminder DMs are recorded per run: the sign-up day, or the attendance offset. A later try that reaches the player removes them from the list. The match page shows the newest reminder outcome, manual or scheduled; a scheduled one reads "automaticky podle plánu" instead of "poslal …". Like the manual reminder, the notice is excluded from `/api/v1` (`docs/integrations/website/event-commands.md`).
53. **Attendance post in the match thread (L5-43).** It reads "start 20:00" without "ve", from its own `notice.startAt` key, because other cards keep "start ve 20:00". It has no divider, as drawn.
54. **Style A loses nothing (P4 and P7 together).** Style A is the default. The score image sits on top of the message (the kit's `lead` image), and the text under it keeps every line the P4 board gives the state:
    - the empty sentence, without a score;
    - the seed bar "▰▰▰▱▱▱▱▱▱▱ 12 / 40" with the call link;
    - the running Logi match with its chip;
    - "Z KLANU HRAJE".

    The image follows the panel's switches. **Skóre** off draws a status: "Online", the player count large, no score, time or top three. **Nejlepší hráči** off draws no top three. An empty server draws "Na serveru teď nikdo nehraje.", and a seed draws the progress toward the plan's threshold ("12 / 40 · seed do 40").
55. **Status mode (L3-43).** With **Skóre** off, no "zbývá N min" appears anywhere. On "Naše servery" a row shows the round time only next to a score.
56. **Card order (P7).**
    - Style A: the image first, then the text summary. The next-map part has no mode and no side sign, and a Wardogs map name is not repeated.
    - Style B: the banner on top, then the board's order.
    - Style C is one compact block. It has no separate label line and no extra address line, and it keeps the board's **Připojit** and **Zobrazit hráče** buttons.
57. **Map picture switch.** "Použít obrázek mapy, když banner chybí" is honoured by the bot. With the switch off and no banner, a style B panel has no picture on top.
58. **Clan badge.** One shared domain function (`clanBadgeTag`) makes the badge for the dashboard previews and for the bot. It uses the short code of the clan's team in the global catalogue ("VLK"). Without a team, it uses the initials of the clan name.
59. **Images as attachments.** The bot attaches the clan's map overrides and a panel's own banner as resized files with versioned names (a content digest in the name). It does not link the upload URL, so Discord shows the new image after a change.
60. **Banner file name.** The upload stores the original file name (an optional `fileName` on the image asset). The P8 banner card shows it: "Nahráno vlci-public.png · 1200 × 400 · 380 kB". The API references the asset by ID and URL only.
61. **"Naše servery" (P4-38, P7-19, P2-44).**
    - Each row reads the same live data as that server's own panel, so the queue and the next map appear when the server reports them.
    - Rows show the player gauge and the faction or nation signs next to the score.
    - A seeding row shows "seedujeme 9 / 40" and its seed bar.
    - The panel follows the style: style B puts a banner with the clan badge on top, and style C has no map pictures.
    - Every joinable server gets a "Připojit: name" button (P7-20, resolution 9).
62. **Wardogs join button.** "Připojit: Vlci WD" opens `/join/<server>`, and that page shows the join code. Discord buttons can only open links.
63. **Join page (P4-44).**
    - The page is a bare centred card like the board, without the site header.
    - It shows the server name, the players, "fronta N" and the address or join code.
    - The queue comes from the panel's latest live read, and only while that read is at most 3 minutes old.
64. **Compact results (L3-31, L3-B05).** The results panel's **Obsah** step has a "Kompaktní vzhled" switch. It is stored as the panel's `layout.compact`, which the `discordPanels` slice of `/api/v1` already carries.
65. **Private replies in the clan colour (L3-39, L3-58).** The bot's private replies use the clan's accent colour and icon density. This covers the player list, the report picker and the report answers.
66. **Competition round in the calendar (L3-14).** A competition match names its round: "ECL, 3. kolo" (en "ECL, round 3", de "ECL, Runde 3"). The round comes from the competition fixture linked to the event.
67. **Paused panels (L3-54).** The "Pozastaveno" chip is grey (neutral) on every paused panel, and the panel keeps its colour.
68. **One seed count (P5-16).** While a seed is shown, the server panel takes its player count and seed bar from the seed run's latest reading. The seed call uses the same reading, so the two never disagree.
69. **Seed role (P5-22).** The P3 seed page adds "Vytvořit roli Seed".
    - Logi creates a mentionable role "Seed" through the existing Discord REST gateway, or reuses an existing role with that name.
    - Only a clan admin can use it, and only from the same site.
    - It selects the role in the unsaved plan. Picking an existing role is still possible.
    - It is a live Discord action, so it has no `/api/v1` operation. The exclusion is recorded in `configuration-coverage.md`.
70. **Seeders (P5-B04).** The call's "díky N seederům" counts the distinct players who joined during the seed, when the live CRCON read names the players. Players present in the first 2 minutes count as already there. Only the number is kept when the seed ends. Without named players (Wardogs, or HLL without a fresh live read), the count stays the growth from the start to the highest count.
71. **Kept deviations.** These platform deviations stay as they are:
    - No team logos in Discord text (L3-20, L3-26). Text cannot inline images, so teams use their short codes.
    - The "Naše servery" join row follows P7-20 and P2-39 (P4-39, P4-B08): one "Připojit: name" button per server.
    - Discord timestamps (`<t:…>`) render in each reader's own format and time zone, not the board's fixed strings (L3-23, P4-20).
