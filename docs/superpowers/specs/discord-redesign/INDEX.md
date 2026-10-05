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
