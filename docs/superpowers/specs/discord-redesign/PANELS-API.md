# Panels API: the contract of "Panely v Discordu"

Workstream W1 (Panels core) built the panels end to end: the stored panel, the
dashboard routes, the Convex functions, the bot worker and the public join page.
This page is the contract the dashboard UI (W3), the seed control message (W4)
and the WD League renderer (W5) build on. The message kit it uses is described
in [KIT.md](KIT.md); the owner decisions are in
[the redesign spec](../2026-10-05-discord-redesign-design.md).

## 1. Model

One row of `discordPublicPanels` is one panel. A panel may own several Discord
messages (results, competition divisions, League), all keyed
`panel:<panelId>` or `panel:<panelId>:…` in `discordPublications`; the calendar
keeps the old key `calendar` so its message is edited, not reposted.

| Kind          | What it is                                                         | Source fields                           |
| ------------- | ------------------------------------------------------------------ | --------------------------------------- |
| `server`      | One live game server (P4). Old `scoreboard` rows read as `server`. | `connectionId`                          |
| `servers`     | "Naše servery", several servers in one message (P4-37..39)         | `connectionIds` (1–10, ordered)         |
| `results`     | Confirmed results of one game, one card per match (P6)             | `gameId`; one per game per workspace    |
| `league`      | WD League, two messages (P5); rendering is W5's                    | `league` options; one per workspace     |
| `calendar`    | "Nejbližší akce" (L3-12..18)                                       | `calendarCategories`; one per workspace |
| `competition` | One table per division of a Logi competition (L3-19..24)           | `competitionId`                         |

Fields added by W1 (all optional, additive): `paused`, `pausedAt`, `pausedBy`,
`draft`, `removing`, `savedAt`, `savedBy`, `requestedAt`, `requestKind`,
`connectionIds`, `title`, `description`, `content`, `league`,
`calendarCategories`, `competitionId`. New tables: `discordPanelStatus` (the
bot's last pass per panel), `discordPanelServers` (join link, address, join
code and the encrypted password per server) and `discordBotHeartbeats`.

- **Paused** is the real flag (`isPanelPaused(row) = row.paused ?? !row.enabled`);
  rows saved before it read their old `enabled` switch. Saving never resumes.
- **Draft** ("Neodesláno"): a new panel is not posted until "Odeslat do kanálu"
  or a save with `send: true`. "Odstranit zprávu" returns a panel to draft.
- **Request**: every accepted action stamps `requestedAt`. The bot answers it on
  its next pass (within 15 s) and reports `handledRequestAt`; a request is
  pending until then. Repeating an action is harmless.
- **Refresh** is fixed at 60 s for every panel (`PANEL_REFRESH_SECONDS`).

Pure rules: `src/domain/discord-publications/settings.ts` (kinds, save schema,
content switches) and `panel-delivery.ts` (error codes, state chip, actions,
worker decision, heartbeat).

## 2. Dashboard routes

All under `/api/servers/{serverId}/discord-panels`, where `serverId` is the
dashboard's server ID. Every route needs a live dashboard session of a clan
admin; writes also need the dashboard origin, which is checked before the body
is read. Bodies are bounded JSON validated with Zod
(`src/lib/api/discord-panels-route.ts`); Convex re-checks the session and the
admin right on every call. Responses are `Cache-Control: no-store`. Backend
failures are a plain `503 {"error":"unavailable"}`.

| Method and path               | Body                                                                                           | Answer                                                                                                                                |
| ----------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /`                       | —                                                                                              | `PanelOverviewResponse` (§3)                                                                                                          |
| `POST /`                      | `{ panelId: string \| null, settings, send?: boolean, expectedRevision?: number \| null }`     | `200 { status: "saved", id, revision, sent }`; `400 { error: "invalid_settings", issues }`; `400/404/409 { error: PanelSaveError }`   |
| `POST /{panelId}/actions`     | `{ action: "publish" \| "refresh" \| "pause" \| "resume" \| "retry" \| "delete" \| "remove" }` | `202 { status: "accepted", action, requestedAt }`; `404`; `409 { error: "not_sent" \| "removing" }`                                   |
| `POST /test-fetch`            | `{ connectionId, panelId?: string \| null }`                                                   | `PanelTestResponse` (§4); `404`                                                                                                       |
| `POST /channel-check`         | `{ channelId }`                                                                                | `PanelChannelCheck { channelId, supported, permissions, everyoneCanView, timedOut }`                                                  |
| `PUT /servers/{connectionId}` | `{ address?, joinCode?, password? }` (absent keeps, `null` or `""` clears)                     | `200 { status: "saved", slug, joinUrl }`; `400 { error: "invalid_request", field }`; `404`; `503 { error: "encryption_unavailable" }` |

`settings` is `panelSaveSchema` (kind, `channelId`, the kind's source fields,
`title` ≤ 80, `description` ≤ 300, `showPlayers`, `showLeaders`,
`reportCategoryId` (live server only), `artwork`, `content`, `presentation`,
`league`, `calendarCategories`, `competitionId`). `content` holds the switches
of P2: `nextMap`, `queue`, `address` (IP:port or join code), `joinButton`,
`password` (default **off**), `seedProgress`, `footerTiming`.

`PanelSaveError`: `not_found`, `conflict` (409, `expectedRevision` is older),
`kind_locked` (409, a sent panel keeps its kind), `removing` (409),
`source_not_found`, `report_destination_missing`, `report_provider`,
`duplicate_channel`, `results_exists`, `league_exists`, `calendar_exists`,
`competition_not_found`, `panel_limit` (20 per workspace), `asset_unavailable`.

Action meanings: `publish` "Odeslat do kanálu" (first post, or a resend; also
resumes), `refresh` "Obnovit teď", `pause`/`resume` "Pozastavit"/"Spustit",
`retry` "Zkusit znovu" (clears the retry wait and forgets a create Discord did
not confirm, so it is sent again), `delete` "Odstranit zprávu" (the message
goes, the panel stays as draft), `remove` (messages go, then the row).

The server password is plaintext only between the browser and the Next server:
`saveDiscordPanelServer` seals it with the AES-256-GCM keyring
(`LOGI_CREDENTIAL_KEYRING`, AAD `["logi.panel-server-password",1,guildId,connectionId]`)
before it reaches Convex. Without a keyring the route answers
`encryption_unavailable` and stores nothing. No response ever contains it;
the overview only says `hasPassword`.

**`/api/v1`**: live Discord actions (send, refresh, pause, delete, retry, test
fetch, channel check, password) are a deliberate exclusion, recorded in
`docs/integrations/website/configuration-coverage.md`. Exposing panel settings
in `GET/PATCH clan/settings` (P1-B10) is left to W3 with the UI.

## 3. Overview (`GET /`)

`buildPanelOverview` (`src/application/discord-publications/panel-overview.ts`):

```ts
type PanelOverviewResponse = {
    bot:
        | { state: "unknown" }
        | {
              state: "online" | "offline" | "outdated"
              version
              protocol
              seenAt
              requiredProtocol
          }
    botInServer: boolean | null // the bot visited this server in the last 3 min
    counts: Record<
        "published" | "error" | "waiting" | "unsent" | "paused",
        number
    >
    panels: PanelOverviewItem[]
    sources: PanelSourceHealth[] // "Zdroje dat": collecting, lastDataAt, freshness, errorCategory
    servers: PanelServerInfo[] // slug, joinUrl, address, joinCode, hasPassword
}
type PanelOverviewItem = {
    id
    kind
    gameId
    channelId
    connectionId
    connectionIds
    title
    state: "published" | "error" | "waiting" | "unsent" | "paused"
    paused
    pausedAt
    pausedBy
    revision
    settings // exactly what the editor loads into panelSaveSchema
    timeline: {
        savedAt
        savedBy
        requestedAt
        claimedAt
        sentAt
        lastUpdateAt
        lastAttemptAt
        nextUpdateAt
        dataAt
    }
    error: {
        code: PanelErrorCode
        at
        permissions?: PanelPermission[]
        category?
    } | null
    uncertain: boolean // a create Discord did not confirm; "Zkusit znovu" sends again
    warnings: Array<
        | "password_hidden_public_channel"
        | "live_data_unavailable"
        | "attach_files_missing"
    >
    message: { channelId; messageId } | null // "Otevřít zprávu"
    messages: number
    style: "a" | "b" | "c"
}
```

State chip (P1-B01): removing → `waiting`; draft → `unsent` (or `waiting`
while its message is being withdrawn); paused → `paused`; an unconfirmed create
or an error newer than the last success → `error`; a pending request or no
success yet → `waiting`; otherwise `published`. Poll the overview every few
seconds while the page is open (P1-B09).

Bot heartbeat: written every 30 s with the bot version (`LOGI_BOT_VERSION`,
else the package version) and `PANEL_PROTOCOL`. Silence for 3 min is
`offline`; a protocol below `REQUIRED_PANEL_PROTOCOL` is `outdated` (P1-05,
P1-06).

Error codes and the plain sentence with its fix step for each are in the
dashboard messages under `discordPanelStatus.errors.<code>.{title, fix}`
(cs/en/de), with permission names under `discordPanelStatus.permissions` and
warnings under `discordPanelStatus.warnings`. `{channel}` and `{permissions}`
are placeholders. Codes: `bot_not_in_server`, `channel_missing`,
`channel_type`, `missing_permissions`, `delivery_uncertain`,
`discord_unavailable`, `source_missing`, `source_not_collecting`,
`provider_unreachable`, `provider_rate_limited`, `render_failed`,
`unsupported_kind`, `competition_missing`, `unknown`.

## 4. Test fetch and preview (`POST /test-fetch`)

"Načíst data ze serveru" runs the same live read as the bot with the admin's
session: CRCON for HLL (`hllLiveData:read` with `actor`), Warcon for Wardogs
(`warconData:read` with `actor`). Other providers show the collected snapshot.

```ts
type PanelTestResponse = {
    provider
    collecting: boolean
    status:
        | "ok"
        | "stale"
        | "unavailable"
        | "busy"
        | "denied"
        | "failed"
        | "snapshot"
    readAt
    dataAt
    errorCategory
    retryAfterMs
    warnings
    summary: {
        serverName
        map
        players
        capacity
        queue
        timeLeftMinutes
        score
        nextMap
        playersInStats
    }
    preview: MessageView | null // the live panel as the bot would post it now, without a password
}
```

Render `preview` with the dashboard's Discord preview component; it is the
same `liveServerPanelView` the bot posts. No key, provider address or password
is ever part of the answer.

## 5. Bot side

The worker (`discord-bot/src/public-panels/worker.ts`) ticks every 15 s, isolates
each workspace, decides per panel with `panelWork`, runs one pass with
`runPanel` (`panel-runner.ts`, all Discord/Convex/image calls are ports) and
reports every pass to `discordPanelBot:report`. It never skips a post because a
live read failed; it then shows the collected data with the warning
`live_data_unavailable`.

Convex functions for the bot (internal secret):

| Function                                      | Purpose                                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `discordPublicPanels:forGuild`                | Every panel with its servers (snapshot, seed plan, join details, `hasPassword`) and status |
| `discordPanelBot:heartbeat`                   | Version, protocol, servers visited                                                         |
| `discordPanelBot:report`                      | One pass: `panelAttemptSchema`; `passwordNotified` / `passwordReset`                       |
| `discordPanelBot:purge`                       | Deletes a removed panel once its messages are gone                                         |
| `discordPanelBot:act`                         | An action from Discord: `{ guildId, actorId, action, panelId? \| connectionId? }`          |
| `discordPanelBot:calendarPanel`               | The calendar panel row and its handled request                                             |
| `discordPanelBot:clanPlayers`                 | Which live Steam IDs belong to members (verified links)                                    |
| `discordPanelBot:runningMatch`                | The Logi match running on a server now                                                     |
| `discordPanelBot:competition`                 | Division tables with ECL cap points and the clan's next match                              |
| `discordPanelBot:guildContext`                | Clan language, time zone, name, message style, event categories                            |
| `discordPanelBot:joinPage`                    | The public join page read (§6)                                                             |
| `discordPanelSecrets:serverPassword` (action) | The decrypted password, asked only after the bot confirmed a private channel               |

**Password (P4-B06).** Shown only on a server's own panel, only with the switch
on, only while `@everyone` cannot view the channel, checked on every refresh.
When the channel turns public the password is left out, the errors channel gets
one notice and the overview warns `password_hidden_public_channel`; turning the
channel private again re-arms the notice. Never on "Naše servery" or the join
page. Decryption fails closed: no key or a foreign binding gives no password.

**Buttons.** "Připojit se" is a grey link to `/join/<slug>`. "Zobrazit hráče"
(`logi:players:<panelId>:<revision>:<page>:<action>`) answers privately, 8 per
page, current round only, split by side. "Nahlásit hráče"
(`report:open:<panelId>:<revision>`) opens the private report flow; it is not on
clan-only panels. All are registered through the interaction feature
`panelInteractions`.

### Hand-offs

- **W3 (dashboard UI)**: build P1/P2 on §2–§4 and the `discordPanelStatus` and
  `joinPage` message namespaces. "Ověřit" is `POST /channel-check`; the password
  field writes `PUT /servers/{connectionId}`.
- **W4 (seed control message)**: "Obnovit panel" / "Pozastavit panel" /
  "Pokračovat" call `discordPanelBot:act` with `connectionId` after the bot's own
  fresh admin-role check. The live panel reads running seeds from
  `discordSeedBot:panelStates` and draws "Seedujeme" with the progress bar.
- **W5 (WD League)**: implement `PanelRunPorts.league(panel, pass)` returning the
  number of messages it owns, keyed `panel:<id>:…`. Until then a League panel
  reports `unsupported_kind`.

## 6. Join page

`/<locale>/join/<slug>` (and `/join/<slug>`, which redirects to a locale) is
public and needs no login. The narrow read `discordPanelBot:joinPage` returns
only `{ gameId, name, address (HLL), joinCode (Wardogs), players, capacity, map }`
and never a password. The page opens `steam://connect/<ip:port>` at once (Discord
link buttons allow only http/https), keeps the address with "Kopírovat" and the
Steam instructions when the browser blocks the link, shows the join code for
Wardogs and links "Zpět do Discordu". It is not indexed.

## 7. Owner activation

1. Deploy Convex first (additive schema, new functions), then the web app, then
   the bot. A bot older than `REQUIRED_PANEL_PROTOCOL` shows as outdated.
2. Set the same `LOGI_CREDENTIAL_KEYRING` in Convex and the Next server
   (see `docs/integrations/website/game-server-credentials.md`); without it
   passwords cannot be saved.
3. Optionally set `LOGI_BOT_VERSION` for the bot so the heartbeat shows the
   release; it falls back to the package version.
4. Give the bot View Channel, Send Messages, Embed Links, Attach Files and Read
   Message History in panel channels, and Create Private Threads, Send Messages
   in Threads and Manage Threads in the report parent channel.
