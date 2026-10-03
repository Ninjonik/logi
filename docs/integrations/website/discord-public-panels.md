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
- Warcon player details are optional, private, paginated (8 per page), and
  show names, faction, kills, deaths, cash and ping. Player freshness is separate
  from server freshness. HLL's current snapshot contract has no public player
  list; the panel does not invent one.
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

## Artwork

Map selection uses a fixed local catalog (Wardogs Bakurani, Ozeti, Zestafona), then
a game image, then text. Discord fetches artwork from the deployment's HTTPS
`SITE_URL`; a loopback-only dashboard deliberately emits text-only panels.
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
