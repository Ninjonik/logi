# Round 3: verification of the round-2 fixes

Independent verifier. Worktree reset to `feat/valkyria-integration` at `1750896` ("Merge round-2 audit fixes (League paused fit, report card colour, previews)"). No product code changed. The temporary page `src/app/[locale]/audit-r3p2/` was removed afterwards; the dev server (`next dev --webpack -p 3293`, PID 30405) was killed by PID; `git status` is clean.

Harnesses and evidence are in `scratchpad/audit/round3/`. Bot scripts ran with dummy env values (`NEXT_PUBLIC_CONVEX_URL`, `INTERNAL_AUTH_SECRET`, `DISCORD_BOT_TOKEN` set to placeholders; no secrets read) and with Convex stubbed.

## Verdicts

| ID | Verdict |
| --- | --- |
| L1-B19 | **DONE** |
| L2-B01 | **DONE** |
| L3-54 | **DONE** |
| P6-B05 | **DONE** |
| L3-65 | **DONE** |
| P2-B09 | **DONE** |
| N1-B07 | **DONE** |

Counts: 7 DONE, 0 NOT DONE.

## L1-B19 / L2-B01: deleted match answers in the clan language

**DONE.**

Code (commit `bc5389a`):
- `discord-bot/src/runtime/clan-kit.ts:33` `matchReplyKit`: the match's clan language while the context exists, else `interaction.guildId`, else the guild named in the custom ID.
- `src/domain/discord-messages/roster-message.ts:390` `eventCustomId` / `:404` `parseEventButtonId` (the guild part is accepted only as a 17-20 digit snowflake); `attendanceButtonIds` (`:790`) and `rosterButtonIds.assignment` (`:415`) take an optional guild.
- Replies: `attendance-replies.ts:92` (`replyUnavailable`, used by "Potvrdím" and "Přijdu později"), `:300` (late form); `attendance-decline.ts:196` ("Nemůžu"), `:240` (decline form); `roster-assignment.ts:224` (`contextFor`, used by "Zobrazit zařazení" and "Zobrazit soupisku").
- DM builders carry the guild: attendance reminder (`discord-bot/src/sync/attendance-reminders.ts:102`), roster change DM (`discord-bot/src/rosters/roster-change-service.ts:174`), "Moje zařazení" (`discord-bot/src/events/match-context.ts:82` → `rosterCardEvent.guildId`), late/decline forms (`buildLateNoticeModal`, `buildAttendanceDeclineModal`).
- Routes are unchanged prefixes (`features.ts` registers `attendanceReplyInteractions` and `rosterInteractions`; `interactions.ts:59` routes `attendance-decline:`), so old and new IDs both match.

Evidence:
- `round3/dm-lang-old.txt` (round-2 harness `round2/L1h/dm-lang.mts`, old-format IDs). The server clicks, which were English in round 2, now read "### Zápas už není k dispozici | Velení ho mezitím zrušilo nebo smazalo." The old-format DM IDs (`attendance-confirm:event-gone` and the others, no guild) still route to their handlers. They answer in English because nothing names the clan, as the fix commit documents.
- `round3/dm-lang-new.txt` (`impl/l1b19/dm-lang-new.mts`). The attendance reminder DM now carries `attendance-confirm:event-gone:111111111111111111`, `attendance-late:…:111…` and `attendance-decline:…:111…`. Every new-format DM click answers in Czech: Potvrdím, Přijdu později, Nemůžu and Zobrazit zařazení. So do the server clicks: Potvrdím účast, Přijdu později, Nemůžu, Zobrazit zařazení and Zobrazit soupisku.
- `round3/l1-extra.mts` → `l1-extra.txt` (my own probe, through the production `createInteractionHandler`):
  - The late and decline form IDs carry the guild (73 and 76 characters; the longest new ID is 76, under Discord's 100).
  - A form submitted from a DM after the match was deleted answers "### Tohle se nepovedlo" (Czech). An old short form ID in a DM answers "That didn't work", as documented.
  - "Moje zařazení" Potvrdím and Přijdu později with the guild answer in Czech.
  - The event is read as `event-gone`, never `event-gone:<guild>`. A non-snowflake suffix is ignored.
- Tests: `round3/l1-tests.txt` has 58 passing and 0 failing. This covers `match-gone-replies.test.ts`, with 13 cases: the server, a DM with the guild and an old DM for each button, plus Zobrazit soupisku. It also covers `clan-kit`, `attendance-replies`, `roster-assignment`, `roster-change-service`, `attendance-reminders`, `direct-message-views` and `roster-message`.

Note: "Zobrazit soupisku" exists only on the server roster message (`roster-message.ts:489`), so the server path covers it.

## L3-54 / P6-B05: paused WD League panel within Discord's limits

**DONE.**

Code (commit `e37e70e`): `src/domain/wardogs-league/panel-views.ts:476` (fixtures) and `:140` (standings) measure `finish(...) = markPaused(build(...))`, which is the final paused view, in `fitWithinLimit`.

Evidence: the round-2 P6 case was re-run (`round2/p6/run.ts` copied to `round3/p6/run.ts` with only the output path changed). It uses the board fixtures, the installed application emoji and the real `runPanel` → `runLeaguePanels`. Output is in `round3/p6/run.txt`.
- `paused`, the default fixture count that round 2 saw fail with `text-too-long (4018)` → `render_failed`, now returns `ok: true` with `messages: 2` and `nextAt: null`.
- Text length per message, measured from the payload: the paused fixtures message has **3482** characters (limit 4000) and 26 emoji. It shows 4 fixtures plus "… a další 2 zápasy na webu ligy". The live board has 3923 characters and 5 fixtures; the paused table has 846.
- The first line of both paused messages is "`<:logi_empty_…>` **Pozastaveno** · správce zastavil obnovování · poslední data …". Screenshots: `round3/p6/shots/07-league-paused-fixtures.png` and `06-league-paused-standings.png`. They show the grey "Pozastaveno" chip, the full content, the links and the footer.
- Tests: `round3/p6/tests.txt` has 28 passing and 0 failing. It includes "a paused full fixtures message with installed emoji is still posted, not refused (L3-54, P6-B05)" and "a paused table filled to the limit is measured with its chip".
- Regression: the non-paused board, runtime-no-results and collected-empty-week messages still render (shots 00-05), and so do the results cards (10, 11).

## L3-65: player-report thread card in the clan colour

**DONE.**

Code (commit `d2eda8e`):
- `discord-bot/src/player-reports.ts:306` passes `style` to `renderMessageView`.
- The thread starter passes `style: await clanStyleForGuild(scope.guildId)` (`:460`). `clanStyleForGuild` never throws: `readClanConfig` catches errors and falls back to the cached value, then to null, so a failed read keeps the amber card rather than failing the delivery.

Evidence: `round3/l3-65.mts` → `l3-65.txt` and `round3/l3-65/*.png`, built with the bot's `buildReportThreadMessage`:
- a clan with `#4F9DE0` gives `accent_color` 0x4F9DE0 (blue bar, `00-report-thread-clan-blue.png`);
- a clan with `#3BA55C` gives 0x3BA55C;
- with no style, the card keeps Logi amber 0xE8A33D.

Test: `report-picker.test.ts` "the thread card carries the clan's own colour, like the ticket cards (L3-65)" passes.

## P2-B09: "Naše servery" editor preview uses the installed emoji and chip icons as the bot does

**DONE.**

Code (commit `365c8d8`):
- `src/components/app/discord-panels/editor-preview.ts:425` passes `emoji: input.emoji` to `combinedPanelView`.
- `panelChipIcons` now lives in the domain (`src/domain/discord-publications/live-panel.ts:665`). The bot uses it (`panel-runner.ts` for the single, combined and results panels; `league/panels.ts:149`), and so does the editor (`previewChipIcons`, `editor-preview.ts:112`, for kinds server, servers, league and results, matching the bot; calendar and competition keep the dots on both sides).
- `panel-editor.tsx:1073` passes the icons to `PreviewCard` → `DiscordMessagePreview`, which draws the icon emoji in the chip (`discord-message-preview.tsx:331`).

Evidence, rendered side by side:
- **Editor:** the real `SettingsSectionFrame` + `PanelEditor` from the round-2 harness, copied to a temporary route `audit-r3p2`. The overview's emoji were set to the installed map in `round2/harness/out/emoji.json`, and the Discord emoji CDN was served with the real application-emoji images. Panel p-ours, "Naše servery", 3 servers. Script: `round3/p2/shoot-editor.cjs`; output `editor-ours-a.png`, `editor-ours-c.png` and `.json`.
- **Bot:** the real `runPanel` with the same live data the editor's test-fetch serves (c-v1 Foy 78/100 +3; c-v2 Carentan 12, seeding; c-wd snapshot with the Warcon read failed), the same emoji map, and no Attach Files (as the editor's channel check). Script: `round3/p2/bot-ours.ts`; output `out/payloads.json`, rendered with `render-payload.mjs` → `p2/shots/`.
- **Result:** `round3/p2/side-by-side-ours-a.png` and `side-by-side-ours-c.png`. In style A and in style C, both sides draw 26 custom emoji in the **identical order and IDs**: live/seeding state icons, the US and GER signs on "3 : 2", and the players/free/queue gauge. Text, rows, addresses, join code, buttons and footer match.
- The state chips ("Živě", "Seedujeme", "Starší data") carry the same installed emoji as the bot (`logi_live`, `logi_seeding`).
- The preview draws a chip as a pill beside the row title, while Discord shows it inline as "· icon **Živě**". The DcPanelEditor board draws its editor preview with the same pills, so this is the preview's established convention and not a new gap.
- Tests: `round3/p2n1-tests.txt` has 85 passing and 0 failing, including "Naše servery draws the installed emoji and chip icons the bot uses (P2-B09)" and "chip icons follow the bot: status emoji on live, combined, League and results panels only".

## N1-B07: "Panel náboru" preview equals the bot's panel for a clan with the old stored default

**DONE.**

Code (commit `58da300`):
- `membershipPanelCopy` (`src/domain/membership/application-panel-copy.ts:122`) holds the whole rule: the window count, the effective title and text, and `windowsNote` only under the clan's own text.
- It is used by both the bot (`discord-bot/src/interactions/membership-panel.ts:56`) and the preview (`src/domain/discord-messages/settings-previews.ts:758-785`).
- The settings route passes the clan name, `clanName={server.name}` (`src/app/[locale]/(dashboard)/dashboard/servers/[serverId]/settings/[section]/page.tsx:179`). This is the same guild record name the bot uses (`payload.guild.name` in `syncMembershipPanel`).

Evidence:
- **Preview:** the real `DiscordMessagesSettings` (harness `view=messages&variant=legacy`, with the stored "Přihlásit se do klanu" / "Vyberte typ přihlášky…", `clanName="Vlci"` as the route passes it). Script: `round3/n1/shoot-n1.cjs` → `preview-recruitment-legacy.png` and `.txt`.
- **Bot:** `buildMembershipPanelPayload(sameConfig, "Vlci")`. Script: `round3/n1/bot-recruitment.mts` → `bot-recruitment.txt`, rendered as `bot-00-bot-recruitment-legacy.png`.
- **Side by side:** `round3/n1/side-by-side-recruitment-legacy.png`. Both show "### Přidej se ke klanu Vlci" / "Vyber, jak s námi chceš hrát. Přihláška má tři krátká okna a zabere pár minut." / "**Hlavní člen** · Hell Let Loose · zápasy každý týden" / [Podat přihlášku] / "Spravováno v Logi". **Neither has the separate windows note.** Round 2 saw "Přihlásit se do klanu" plus the note in the preview.
- Tests: in `p2n1-tests.txt`, "the recruitment preview shows today's default for an old stored default, as the bot does (N1-B07, res. 23)" and "the recruitment preview and the bot's panel agree on the words (N1-B07)" pass.

## Broader checks

- `tsc --noEmit`: exit 0 (`round3/tsc.log`). The first attempt failed only on the dev cache that my own temporary page left in `.next/dev/types`. I removed that cache, which was created by my run, and ran it again.
- The full suite `node --import tsx --test "src/**/*.test.ts" "discord-bot/src/**/*.test.ts"`: **3156 tests, 3156 pass, 0 fail** (`round3/test-all.log`).
  - It ran with placeholder env values and the tests' own `INTERNAL_AUTH_SECRET=dev-internal-auth-secret`.
  - A first run with an arbitrary placeholder secret failed 68 Convex/API tests with "Unauthorized.". That came from the environment and not from the code: those tests sign their calls with `dev-internal-auth-secret`.
- `git status` is clean and the temporary route is removed.

## Remaining non-accepted items

None for these seven IDs.

Observation, not part of these IDs: the editor preview never draws the paused state. `editor-preview.ts` builds rows with `paused: false`, while the bot adds a "Pozastaveno" header chip to a paused "Naše servery" panel. The editor shows the draft rather than the live state, so no fix is listed here.
