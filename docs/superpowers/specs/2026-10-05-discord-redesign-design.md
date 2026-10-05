# Discord redesign: messages, commands, panels, seed and settings

- Date: 2026-10-05
- Status: approved by the owner. Implementation and verification are in
  progress on `feat/valkyria-integration`.
- Design source: the "Logi settings redesign" design canvas (rows *Discord* and
  *Panely v Discordu*) and its clickable copy *Logi Discord návrh*. The
  per-board acceptance checklists live next to this file in
  [`discord-redesign/`](discord-redesign/).
- Process: each feature went through brainstorm, design boards and this written
  spec, then implementation. **Nothing merges without the owner's explicit
  OK.** After implementation an independent audit checks every checklist item
  against the code before the PR is offered for merge.

## Owner decisions

### Global

| Topic | Decision |
| --- | --- |
| Language | Every bot message and every command reply uses the **clan language** (cs, en or de), never the member's Discord locale. Bot copy addresses players informally ("ty", German "du"); the dashboard keeps the formal form. |
| Message format | One format: a Components V2 container with the clan accent bar. No legacy embeds. |
| Colour | One clan accent, default `#E8A33D`. Status is shown as chips inside the card, never as the bar colour. Event categories become chips; they no longer tint the bar. System messages for admins (error log, service status) use a neutral grey bar. Panels may override the accent. |
| Staff commands | Visible to everyone in Discord's command picker. Permission is checked fresh at use time; `/help` lists only what the person may use. |
| New command | `/help`. |
| `/player` | Private reply with a **Sdílet** button, like `/stats`. |
| Migration | Bot messages of upcoming matches and of matches that ended in the last 14 days are redrawn once into the new format. Older messages stay as they are. |

### Panels in Discord

| Topic | Decision |
| --- | --- |
| Management | New dashboard page **Panely v Discordu**. It replaces the old panel form and has:<br>• a list with live status: bot heartbeat and version, last post, next refresh, last error in plain Czech with a fix<br>• an editor with a rendered preview from real server data<br>• **Načíst data ze serveru** (test fetch, HLL included)<br>• **Odeslat do kanálu**, **Obnovit teď**, **Pozastavit**, **Odstranit zprávu** and **Zkusit znovu** |
| Servers | One panel per server. Vlci #1 · Public goes to a public channel; Vlci #2 · Trénink a zápasy goes to the private clan channel. An optional combined **Naše servery** panel. |
| Refresh | Every 60 s. |
| Password | The private server panel may show the server password, stored encrypted. It is allowed only in a channel that `@everyone` cannot view, re-checked on every refresh, and removed automatically if the channel becomes public. |
| Joining | HLL panels show IP:port; Wardogs panels show the join code. A **Připojit se** link button opens a Logi page (`/join/<server>`) that launches the game. |
| Seed | A server counts as live from **40** players; a seed starts under **20**.<br>• Seeding is controlled only by admins, through an **Ovládání serveru** message in a private admin channel and through the dashboard.<br>• Triggers: manual, schedule, or automatic below a threshold within a time window.<br>• Each seed posts a call in the seed channel, tags the opt-in Seed role and updates the call's progress, then edits it to "Server je živý" at the threshold.<br>• A cooldown and a maximum duration apply, and seed history is kept. |
| WD League | All fixtures of the league. Two large self-updating panels in one channel:<br>• **tabulka**: standings computed by Logi from parsed results with the league's points rule<br>• **nejbližší zápasy**: upcoming fixtures with their preparation progress, plus recent results |
| Results | One results panel per game. A new panel backfills the last 5 confirmed results. |
| Graphics | **Style A** (a generated scoreboard image over the map art) is the default for Hell Let Loose and Wardogs. Styles B (banner + map thumbnail) and C (compact) are selectable per panel. Server banners and map images are configurable in Logi. Faction icons are fixed: Wardogs Valkyra / Manticore / Lonestar, and Hell Let Loose nations drawn by Logi. Status icons and the player bar use application emoji. |

### Matches

| Topic | Decision |
| --- | --- |
| Sign-ups | The announcement gets **Zobrazit přihlášené**. Everyone sees the sign-ups by group, with reserves and who is not coming. Admins additionally see who has not answered, with **Připomenout bez odpovědi** and **Otevřít na webu**. |
| Roster message | The roster photo (PNG) stays, as with the old bot. By default the text roster sits under the photo (variant A). When publishing in Logi the admin chooses between photo + text and photo only; a default is set in the messages settings. Buttons: **Zobrazit zařazení**, **Zobrazit soupisku** (private, per squad, with confirmation ticks) and **Otevřít soupisku**. |
| Roster changes | The change digest and the change DMs are sent by the bot in the shared style. The web route only requests them, and it is authorised (see #189). |
| Late and absent notices | An optional post in the match thread, without the reason. It is off by default. |

### Membership, tickets and accounts

| Topic | Decision |
| --- | --- |
| Application | One form in several Discord windows (modals, at most 5 fields each, selects allowed), with a progress message between windows, a review step and a single submit. The application thread is created only after submit. |
| Decisions | Buttons on the application card in the thread: **Přijmout jako člena / rekruta / žoldáka**, **Zamítnout…** with a reason, and **Ještě nerozhodnuto**. `/close_application` keeps working. |
| Web variant | Filling the same form on the Logi web is available behind a switch that is off by default. |
| Form builder | The dashboard edits windows and questions. Types: short text, long text, select, multi-select, yes/no, number. Each question can be required, limited to a game and limited to a category. A live preview shows each window. The specialization question is an option per category. |

## Architecture

### Layers

| Area | Location | Responsibility |
| --- | --- | --- |
| Pure rules | `src/domain/discord-*` | Channel privacy for passwords, seed state machine, standings computation, sign-up list grouping, roster text layout, command permission matrix, form validation. Unit tested. |
| Workflows | `src/application/*` | Panel actions, seed scheduling, application submission. Tested with fakes. |
| Persistence and authorization | `convex/` | Additive schema changes only. |
| Discord rendering | `discord-bot/src/ui/` | One message kit: container, header, meta lines, chips, footer, ephemeral and error replies. Every builder uses it. |
| Dashboard | `src/components/app/discord-preview/` | One Discord preview component, so the editors show exactly what the bot posts. |

### Data and API parity

Settings added for panels, graphics, seed, commands, messages, the application
form and the roster publish default are exposed in `/api/v1`
`GET/PATCH clan/settings` with OpenAPI.

Deliberate exclusions, recorded in
[`configuration-coverage.md`](../../integrations/website/configuration-coverage.md):

- binary uploads (banners, map images, panel images): the API references existing assets;
- live Discord actions (post now, refresh, re-register commands, seed now);
- application decisions, which are actions in the Discord thread.

### Deploy

All Convex changes are additive. The redesign needs `bunx convex deploy`, then
the bot, then the web, in one window.

The bot registers commands when it starts, when it joins a server and after the
clan language changes. On its first start it also redraws the messages in the
migration window.

## Verification

Each board has an acceptance checklist in [`discord-redesign/`](discord-redesign/),
one line per visible element and behaviour rule, with IDs such as `L1-23`.

1. Implementation agents work against those checklists.
2. Independent auditors then check every ID against the code and against
   rendered previews, marking each one as done or missing.
3. Missing items are fixed before the PR is offered for merge.

The final audit report is attached to the PR.
