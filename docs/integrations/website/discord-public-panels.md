# Discord public panels

Public server/score panels and reviewed results are configured in the Discord
settings of a Logi workspace. This implementation follows the
[approved compact design](roadmap/discord-public-panels.md).

## Configuration

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

The refresh selector supports 30, 60 and 300 seconds. An independent bot worker
checks settings every 15 seconds. Saving an existing feature requests a refresh.
Discord errors back off; changing settings never discards an uncertain create.
Last success, pending recovery, the owned message link and delivery errors are
visible in settings. HLL uses the collector's snapshot; Warcon's scoped live read
uses the existing shared cache, lease and provider budget.

## Content and privacy

- Combined server/score and separate score panels show game/server, map,
  players/capacity, supported faction scores and an observation timestamp.
- Missing counts are unknown, never fabricated zeroes. Old values are labeled.
- Public Warcon leaders are a separate **off-by-default** setting (`showLeaders`):
  top three by kills and cash overall, plus the best killer and cash holder for
  each recognized faction. They use current connected players only. Cash means
  provider-reported current balance, not cumulative earnings. Missing metrics
  are excluded, zero remains valid, ties are deterministic, and unknown factions
  may rank globally without being assigned to an invented team.
- Warcon player details are optional, private, paginated (8 per page), and
  show names, faction, kills, deaths, cash and ping. Player freshness is separate
  from server freshness. HLL's current snapshot contract has no public player
  list; the panel does not invent one.
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
- Results use only explicitly reviewed, game-matching event results. New reviews
  since feature creation publish one message per event. Corrections edit that
  binding. Withdrawal, deletion or disabling the results feature removes its
  owned messages. Existing historical results are not backfilled automatically.
- The dashboard controls have Czech and English labels. Public bot copy currently
  uses an intentional English fallback, consistent across supported games.
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

Creation records its marker **before** the Discord POST. A lost response is
reconciled against an exact marker on a message authored by the current bot in
the recorded channel. It never uses a title/name match or deletes unrelated
messages. Recovery currently searches the latest 100 messages. If an uncertain
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
banners. Faction names are matched semantically; unknown/provider labels such as
Alpha/Bravo/Charlie retain a neutral icon. Metric symbols use Unicode.

The three existing faction marker assets keep their adjacent MIT license and
upstream attribution in `public/stratmap/icons/wardogs/LICENSE`. Provision them
once into the selected application (never automatically on restart):

```text
# Supply the intended application's DISCORD_BOT_TOKEN in this process only.
npx tsx scripts/provision-discord-panel-emoji.ts <expected-application-id>
```

The script verifies application identity, uses a content hash in each name,
reuses existing matching emoji and never deletes unknown emoji. The bot only
looks up the exact current catalog names; absent assets fall back to text.
See [Discord's application emoji API](https://docs.discord.com/developers/resources/emoji#application-owned-emoji)
and [channel permission rules](https://docs.discord.com/developers/topics/permissions).

## API and activation

The dashboard session API is `GET/POST
/api/servers/{serverId}/discord-public-panels`; `POST ?verify=1` verifies a channel
without saving. Input is bounded to 4 KiB and strictly validated. Write requests
reject cross-origin callers. The final mutation takes the server-attested actor,
never an actor supplied in the request body.

**Deliberate v1 exclusion:** existing website bearer read grants cannot configure
Discord publication or application emoji. These actions cause messages in a
third-party guild and require the current interactive administrator, including
revocation checks. There is no new bearer management endpoint or broadened key
scope. Game-data and reviewed-result read APIs remain unchanged.

Deploy the schema/functions to the intended backend, deploy the matching bot and
dashboard, provision application emoji, then configure the desired panels. Keep
the old bot stopped during rollout. Production activation is separate from local
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
