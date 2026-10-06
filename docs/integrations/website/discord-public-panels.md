# Discord public panels

Public server/score panels and reviewed results are configured in the Discord
settings of a Logi workspace. This implementation follows the
[approved compact design](roadmap/discord-public-panels.md) and, since the
Discord redesign, the panel contract in
[PANELS-API.md](../../superpowers/specs/discord-redesign/PANELS-API.md).

## Panels in Discord (redesign)

The redesign (spec `docs/superpowers/specs/2026-10-05-discord-redesign-design.md`,
boards L3, P4–P8) turns the panels into one model with explicit delivery:

- **Kinds**: `server` (one per game server; live score and server status are
  one kind, old `scoreboard` rows read as `server`), `servers` ("Naše servery"),
  `results` (one per game), `league`, `calendar` and `competition`. All use the
  shared `panelFrame` (Components V2) with a state chip: Živě, Prázdný,
  Seedujeme, Nedostupný, Pozastaveno. Every live panel refreshes every 60 s.
- **Delivery**: a new panel is a draft until "Odeslat do kanálu". Dashboard
  actions (send, refresh, pause/resume, retry, delete message, remove) are
  application use-cases (`src/application/discord-publications/panel-actions.ts`)
  behind dashboard-authenticated Convex mutations; each stamps `requestedAt`,
  which the bot answers within 15 s and reports as `handledRequestAt`. Pause is
  a real `paused` flag (legacy rows read `!enabled`).
- **Status**: the bot reports every pass (`discordPanelBot:report`) with a typed
  error code, missing permission names, warnings and timing; the dashboard
  turns the code into a plain sentence with its fix step. The bot writes a
  heartbeat with its version every 30 s.
- **Test fetch**: `discordPanels:testFetch` runs the CRCON or Warcon live read
  with the admin's session and returns the provider status, a summary and the
  rendered preview, never a key, address or password. HLL live reads accept a
  current clan admin (`actor`) in addition to scoped keys and panels.
- **Server password**: sealed with the AES-256-GCM credential keyring
  (`LOGI_CREDENTIAL_KEYRING`, AAD bound to the workspace and server) in the
  Next server, stored in `discordPanelServers`, decrypted only by the
  `discordPanelSecrets:serverPassword` action after the bot confirmed that
  `@everyone` cannot view the channel, re-checked on every refresh. When the
  channel turns public the password is withheld and the errors channel is told
  once. Never on "Naše servery", the join page or in any response.
- **Join page**: `/join/<slug>` opens `steam://connect/<ip:port>` with a manual
  fallback, shows the Wardogs join code, needs no login and reads only
  `discordPanelBot:joinPage`.
- **Clan-only facts**: in a channel `@everyone` cannot view, the live panel
  shows the running Logi match and "Z klanu hraje" (verified Steam links of
  workspace members) and drops the report button.
- **Results**: a new results panel posts the last five confirmed results, then
  each new one; corrections edit the card and say the previous score.

## Configuration

Panels are configured on **Settings → Discord → Panely v Discordu**
(`settings/discord-panels`, `src/components/app/discord-panels/`). The list
shows the bot's heartbeat and version, the data sources, every panel grouped
(live servers, results and the WD League, calendar and competitions, seed
control messages) with its state chip, timing line, last error with its fix and
the live actions. **Nový panel** and a panel's **Upravit** open the editor
(`settings/discord-panels/new`, `settings/discord-panels/<panelId>`): type,
server(s), channel with **Ověřit**, content switches, join details and the
encrypted password, title, description, banner, bar colour, style A/B/C and
footer timing, with the rendered preview on the right ("Načíst data ze
serveru" reads the provider once), the source and the delivery timeline. A new
panel is saved not sent until **Odeslat do kanálu**. Grafika panelů and Seed
serverů are sub-pages of Panely v Discordu. The old per-feature form on
"Zprávy a panely" is gone.

Select an existing HLL or Wardogs data connection, a feature and a destination.
The channel picker searches names/IDs, groups by Discord category and accepts a
pasted ID. Public panels accept guild text and announcement channels. Categories,
threads and forums are not public-panel destinations. Each feature has its own
channel. A separate scoreboard cannot duplicate the combined server/score panel
in the same channel for the same source.

The shared picker also serves legacy publishing settings. Ticket and recruitment
**private-thread parent** selectors accept ordinary text channels only; Discord
announcement channels cannot be private-thread parents. The central settings API
checks selected IDs against the current guild channel inventory and rejects
unsupported types. This destination check does not replace the legacy endpoint's
existing authorization with the new public-panel actor transaction.

Save verifies current workspace administration and bot channel permissions:
View Channel, Read Message History, Send Messages, Embed Links and Attach Files.
The Convex write rechecks the durable dashboard session and current authority.
Publishing verifies the current guild, bot ownership and permissions again.
Disabling remains possible after the bot loses access; the resulting paused card
can only be displayed after access is restored.

Every panel refreshes every 60 s; the `refreshSeconds` stored by older forms is
ignored. An independent bot worker checks settings every 15 seconds. Saving an existing feature requests a refresh.
Discord errors back off; changing settings never discards an uncertain create.
Last success, pending recovery, the owned message link and delivery errors are
visible in settings. HLL CRCON and Warcon use scoped live reads with their shared
cache, lease and provider budget. See [HLL live data and private reports](hll-live-and-player-reports.md).

## Content and privacy

- Server panels show game/server, map, players/capacity, supported faction
  scores and an observation timestamp; HLL also the queue, next map and day or
  night when CRCON reports them.
- Missing counts are unknown, never fabricated zeroes. Old values are labeled.
- Public Warcon leaders are a separate **off-by-default** setting (`showLeaders`):
  top three by kills and cash overall, plus the best killer and cash holder for
  each recognized faction. They use current connected players only. Cash means
  provider-reported current balance, not cumulative earnings. Missing metrics
  are excluded, zero remains valid, ties are deterministic, and unknown factions
  may rank globally without being assigned to an invented team.
- Warcon player details are optional, private, paginated (8 per page), and
  show names, faction, kills, deaths, cash and ping. Player freshness is separate
  from server freshness. HLL CRCON has a separate live contract for connected
  current-round players, with kills/deaths/combat/offense/defense/support scores.
  HLL public leaders are opt-in and use kills overall and per team.
- Player buttons acknowledge privately before loading. Each navigation button has
  a distinct component ID, including a one-page list. Loading is bounded to 12
  seconds; a failed read or response produces a private retry message. Current
  guild, destination channel, configuration revision and enabled/privacy settings
  must match before reading. Guild ownership, channel overwrites, member roles
  and role permissions are fetched fresh; View Channel and Read Message History
  are required before and after loading. Configuration is also rechecked after
  loading. Retained controls from older revisions or destinations fail privately
  and cannot query the new panel. Unversioned legacy controls expire.
- No platform IDs, Discord identity links, provider credentials, administrative
  links or join secrets are rendered. Mentions are disabled. Authorized legacy
  event role pings remain limited to creation.
- `reportCategoryId` optionally adds private player reporting to CRCON/Warcon
  server or scoreboard panels. The existing ticket category chooses its parent
  and staff roles. Report text and provider IDs appear only inside the authorized
  private report thread, never on the public card or website report API.
- Results use only explicitly reviewed, game-matching event results. New reviews
  since feature creation publish one message per event. Corrections edit that
  binding. Withdrawal, deletion or disabling the results feature removes its
  owned messages. A new results panel backfills the last five confirmed
  results, oldest first.
- The dashboard controls have Czech and English labels; the Appearance section
  also has German labels. Bot copy follows the clan language (cs, en, de).
- Website deep links are not guessed: different Logi guilds have different public
  sites and event identifiers. This iteration exposes player details and the
  dashboard's exact Discord message link; public site links need a confirmed
  per-workspace server/event URL mapping.

## Delivery lifecycle

`discordPublications` stores the guild/logical key, destination/message IDs,
configuration revision, lease fence, pending create marker, payload hash and
delivery health. `discordPublicPanels` stores public feature configuration.
The shared application publisher is used by public panels and the existing
ticket, per-game recruitment, calendar and event announcement paths.

Creation records its marker **before** the Discord POST. Ownership is the
stored message ID: existence checks, edits and removal use only
`discordPublications.messageId`. The marker never appears in Discord: there is
no "Automatic updates" button. Instead the create request sets the numeric
component `id` (invisible to members) of the message's first top-level
component to a value derived from the marker
(`discord-bot/src/sync/publication-marker.ts`). A lost response is reconciled
against that exact id on a message authored by the current bot in the recorded
channel. It never uses a title/name match or deletes unrelated messages. A
message without components carries no id, so its uncertain create waits for an
operator. Recovery currently searches the latest 100 messages. If an uncertain
message falls outside that window, the operator must reconcile the stored attempt;
automatic retries remain blocked rather than risk a duplicate. Discord nonce
deduplication is additional protection, not the durable guarantee.

Existence checks bypass the Discord.js message cache. Only Discord `10008`
(Unknown Message) means a known message was deleted.
403, 429, timeouts and other failures retain the binding. A definite rejected
create may retry; an ambiguous create may only recover. A channel move first
deletes the previous owned message; failed deletion prevents a replacement.
Expired workers cannot acknowledge a newer lease. Unchanged payloads skip edits.
Discord and Convex do not share a transaction: this is conservative recovery,
not a claim of unconditional exactly-once delivery across arbitrary failures.

Existing stored message IDs are adopted. Historic messages whose IDs were already
lost are not guessed by title. A legacy ticket/recruitment ID does not record its
old channel; reconcile any pre-migration move manually before enabling the new
worker. New moves use the durable channel binding.
Per-game recruitment configurations own their message IDs even before their first
publication; they never inherit another game's ID. Legacy event announcements
adopt the old channel recorded in their sync state before moving to a new one.

A configuration change cannot cancel an already in-flight Discord HTTP request.
The subsequent worker pass reconciles the durable binding with the new settings;
do not interpret the lease as an atomic transaction across both services.

## Artwork

Map selection uses a fixed local catalog (Wardogs Bakurani, Ozeti, Zestafona), then
a game image, then text. Packaged assets are uploaded directly by the bot (8 MiB
maximum) and shown as compact, clickable thumbnails. Filenames contain a content
hash; updates and restarts retain the same attachment, while changed artwork
uploads a new one. Only catalog paths enter the file reader. If packaged artwork
is absent, a configured public HTTPS `SITE_URL` can provide the catalog URL;
otherwise the panel uses text. A loopback dashboard does not prevent packaged
artwork from displaying.

Components V2 may consume an upload without listing it in `message.attachments`.
The transport also reads the freshly fetched, bot-owned component's
[`attachment_id`](https://docs.discord.com/developers/components/reference#unfurled-media-item).
An exact catalog filename on Discord's attachment CDN is retained with both ID
and filename; signed CDN query strings are not persisted. Disabling artwork clears
the old attachment. Real Discord acceptance verified this update/restart path.

Map images are the existing tactical artwork, not newly licensed promotional
banners; a workspace may upload its own banner (see [Appearance](#appearance)).
Faction names are matched semantically; unknown/provider labels such as
Alpha/Bravo/Charlie retain a neutral icon. Metric symbols use Unicode.

The Wardogs faction marker assets keep their adjacent MIT license and upstream
attribution in `public/stratmap/icons/wardogs/LICENSE`. Since the panel
graphics redesign (see [Panel graphics](#panel-graphics)) the bot provisions the
whole fixed sign set itself: on start and then hourly it lists the
application's emoji, reuses every exact `logi_<key>_<digest>` name and uploads
only what is missing, so restarts upload nothing and unknown emoji are never
deleted. The operator script remains as a fallback for the same set:

```text
# Supply the intended application's DISCORD_BOT_TOKEN in this process only.
npx tsx scripts/provision-discord-panel-emoji.ts <expected-application-id>
```

The script verifies application identity, uses a content hash in each name,
reuses existing matching emoji and never deletes unknown emoji. Absent assets
fall back to text.
See [Discord's application emoji API](https://docs.discord.com/developers/resources/emoji#application-owned-emoji)
and [channel permission rules](https://docs.discord.com/developers/topics/permissions).

## Panel graphics

Owner decision (spec `docs/superpowers/specs/2026-10-05-discord-redesign-design.md`,
boards P7/P8): panels have three styles, **A** (a generated scoreboard image
over the map art, the default for Hell Let Loose and Wardogs), **B** (banner
and map thumbnail) and **C** (compact text). A panel's own
`presentation.style` (`a`/`b`/`c`, absent or `null` = clan default) overrides
the clan-wide default stored in `discordPanelGraphics.defaultStyle`.

| Piece                                                                                                                                                                                                           | Location                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Styles, map catalogue and key matching, map/banner/background resolution, bar colour, server state, player gauge, nation detection, new-map badge, image hash, 60 s redraw rule, file names, 10-attachment plan | `src/domain/discord-publications/panel-graphics.ts`                                                     |
| Fixed signs: Logi's HLL nation emblems (SVG), Wardogs icons, 4 status icons, 3 gauge pieces, emoji names                                                                                                        | `src/domain/discord-publications/panel-emblems.ts`                                                      |
| Image model the panel worker fills (validated, provider-independent, no secrets) and alt text                                                                                                                   | `src/domain/discord-publications/panel-image-model.ts`, copy in `panel-image-copy.ts`                   |
| Clan settings: default style, one banner per server (crop, map-image switch, style B bar colour), map overrides; patch merge                                                                                    | `src/domain/discord-publications/panel-graphics-settings.ts`, `convex/discordPanelGraphics.ts`          |
| Renderer (`next/og` + `sharp`, Inter subset under OFL in `public/fonts/inter/`)                                                                                                                                 | `src/lib/panel-image/`                                                                                  |
| Bot: emoji provisioning, image client with throttle, built-in map thumbnails                                                                                                                                    | `discord-bot/src/runtime/application-emoji.ts`, `discord-bot/src/public-panels/{score-image,assets}.ts` |

**Score image route.** `POST /api/discord/panel-image` takes
`{ secret, request }`, where `secret` is the internal secret (the bot sends it
in the body exactly as for `/api/cache/revalidate`) and `request` is
`{ kind: "score" | "banner", model }`. The secret is checked in constant time
before the model is parsed, the body is bounded to 16 KiB, the model is a
strict Zod schema (no URLs: a background is a catalogue map key or a 32-hex
image asset public ID that the route resolves through Convex), and the route
reads no workspace data by ID, so there is nothing to enumerate. The answer is
a private `image/png` of at most 1200 × 400 with an `X-Logi-Image-Hash`
content hash. Identical content (ignoring the corner time stamp) is served
from an in-process cache and concurrent identical requests render once. The
bot calls it over `INTERNAL_SITE_URL`, keeps the previous image unless the
content changed **and** 60 s passed, and names every version
`skore-<server>-<HHMM>-<hash>.png` so Discord never shows a cached old image.
If rendering fails the last image stays; without one the text panel stands
alone.

**Graphics settings route.** `GET/PATCH
/api/servers/{serverId}/discord-panel-graphics` (dashboard session, clan
admin; PATCH also same-origin, 32 KiB bounded, Zod-validated) reads the page
data (servers, banner files, all catalogue map tiles, emoji status) and applies
a partial change with optional `expectedRevision` (409 on conflict). Banners
upload with `kind=panel-banner`, map images with `kind=panel-map` (PNG, JPEG or
WebP up to 2 MiB, at least 160 × 160 px, normalized to WebP within
1200 × 1200) through `/api/servers/{serverId}/image-assets`; the mutation
verifies each asset with `attachableAsset`, stores its public URL and keeps
`imageAssetReferences` with owner `panelGraphics`, so referenced files survive
the unattached-upload sweep and removed ones are released in the same
transaction. The bot reads `discordPanelGraphics:forBot` and reports installed
emoji through `discordPanelGraphics:reportEmoji` (both internal secret).

## Appearance

Each panel record has an optional `presentation`, edited in the panel
editor's step **Vzhled** (banner, bar colour, style A/B/C; the default style
comes from Grafika panelů) and validated by
`src/domain/discord-publications/panel-presentation.ts`:

| Field                                                   | Values                                                                                                                         | Rendering                                                                                                                                                                                              |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `layout.showMap`                                        | boolean, default `true`                                                                                                        | Map line and map thumbnail. The thumbnail still needs `artwork`; hidden maps upload no artwork.                                                                                                        |
| `layout.showScoreboard`                                 | boolean, default `true`                                                                                                        | Faction/team score section of live panels, including per-team leaders.                                                                                                                                 |
| `layout.showPlayerCount`                                | boolean, default `true`                                                                                                        | Connected players / capacity in the live header.                                                                                                                                                       |
| `layout.compact`                                        | boolean, default `false`                                                                                                       | Two-line header with subtext facts, inline scores, no separators; results use a condensed title.                                                                                                       |
| `accentColor`                                           | `#RRGGBB` or `null`                                                                                                            | Replaces the green live color and the result color. Stale and paused cards keep the amber warning. The HLL private player embed uses it too.                                                           |
| `bannerAssetId` / `bannerUrl`                           | image asset ID or `null`; the URL is server-resolved                                                                           | An HTTPS banner is a Components V2 media gallery above the header and replaces the map thumbnail and its upload. A non-HTTPS URL (local development) is ignored and artwork rules apply.               |
| `factionEmoji.{allies,axis,valkyra,manticore,lonestar}` | one Unicode emoji (Extended_Pictographic, flag pair, skin tone, up to three ZWJ joins) or `<:name:id>` / `<a:name:id>`, max 64 | **Retired (P8-B06).** The editor no longer offers it and always saves `{}`, so a stored override is cleared on the panel's next save. The redesigned renderers draw fixed faction signs and ignore it. |

Records without `presentation` resolve to the defaults, and the renderers are
byte-identical for a missing and a fully defaulted appearance. A save without
`presentation` clears a stored appearance and its banner reference. Result
messages apply map, compact, accent, banner and emoji; they ignore the
scoreboard and player-count switches. Private player pages use the accent color
for the HLL embed and prefix only workspace emoji overrides (never the
application-emoji defaults) to semantically matched factions; a Warcon page
whose overrides would exceed Discord's 2000-character content limit is sent
without them. Without overrides both pages are byte-identical to before.

**Banner reference rule.** The client sends only `bannerAssetId`; `bannerUrl` in
the request is ignored by the route and rejected by the Convex validator. The
save (`discordPanels:save`, and the older `discordPublicPanels:configure`)
verifies the asset with
`attachableAsset` (same workspace, kind `panel-banner`, state `ready`) and, if it
is foreign, of another kind, being deleted or missing, returns
`{ error: "asset_unavailable" }` without writing; the dashboard shows a localized
message. Otherwise it stores the asset's `publicUrl` as `bannerUrl` and, in the
same transaction, calls `syncAssetReferences` with owner `panel` and the panel
document ID as `ownerId`. A source/feature pair keeps that document across
edits, so each save replaces exactly that panel's references; clearing the
banner or saving without appearance releases it. Referenced banners survive the
unattached-upload sweep; released or never-saved uploads are removed after 24
hours. Uploads use `POST /api/servers/{serverId}/image-assets?kind=panel-banner`
(PNG, JPEG or WebP up to 2 MiB and 4096 × 4096 px, normalized to WebP of at most
1920 × 1080 px); **Choose an uploaded banner** reads `GET` on the same path to
reuse one of the workspace's banners, which the save verifies the same way.
While an upload is in flight the editor disables saving; the result merges
only `bannerAssetId` into the current draft.

## API and activation

The redesigned dashboard routes are under
`/api/servers/{serverId}/discord-panels` (overview, save, actions, test fetch,
channel check, server join details, and for the editor the WD League preview,
the preview image and "Obnovit teď" of a seed control message); see
[PANELS-API.md](../../superpowers/specs/discord-redesign/PANELS-API.md). The
older session API `/api/servers/{serverId}/discord-public-panels` is now `GET`
only (the summary "Zprávy a panely" reads); its `POST` left with the old form,
so every save goes through the editor's rules. Write requests reject
cross-origin callers before the body is read; bodies are bounded and strictly
validated. The final mutation takes the server-attested actor, never an actor
supplied in the request body.

**API parity.** Panel settings are the `discordPanels` slice of
`GET/PATCH /api/v1/clan/settings`
(`src/domain/api/discord-panels-settings-slice.ts`; see
[configuration coverage](configuration-coverage.md#discordpanels-panely-v-discordu)):
the same `panelSaveSchema` the editor saves, with revisions, a dry run of every
entry before any write, and new panels saved not sent.

**Deliberate v1 exclusion:** banner uploads, application emoji and the live
actions (send, refresh, pause, retry, delete message, remove, test fetch,
channel check, server password, the editor's preview image and League preview,
and "Obnovit teď" of a control message) cause messages, uploads or provider
reads for a third-party guild and require the current interactive
administrator, including revocation checks. There is no new bearer management
endpoint or broadened key scope. Game-data and reviewed-result read APIs remain
unchanged.

Deploy the schema/functions to the intended backend, deploy the matching bot and
dashboard (the bot provisions its application emoji on start), then configure
the desired panels. Keep the old bot stopped during rollout. Production activation is separate from local
test acceptance; this PR does not authorize production Convex writes.

## Verification

Behavioral tests cover restart/edit reuse, lost create recovery, definite versus
ambiguous failure, move failure, concurrent claims, stale acknowledgements,
current actor/source scope, Warcon panel read restrictions, redaction/freshness,
semantic faction mapping and idempotent emoji provisioning. Runtime evidence is
recorded separately with the exact tested revision; do not reuse older PR test
totals as evidence for these changes.

See the [2026-10-03 acceptance and review record](evidence/2026-10-03-public-panels/README.md)
for commands, assertions, genuine Discord web screenshots, the reported loading
bug and its repair, security scope, and explicit deployment limitations.
