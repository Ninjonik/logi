# Discord public panels: design and implementation handoff

Status: **implemented; local/test-guild acceptance in progress; production not activated**, 2026-10-03.
The original design baseline was `f853c0ad2853edb1849c90c0ed6409924adf5dd2`.
See the [implementation and operator guide](../discord-public-panels.md) for current behavior and limits.
The priority chosen by the owner is public server panels, live scoreboards and
confirmed results. This document records the agreed requirements and suggested
implementation. Existing commands remain described in the
[Discord reference](../v0.10/discord-reference.md).

## Current capabilities and gaps

| Area | Present in the source baseline | Remaining work |
| --- | --- | --- |
| Game data | HLL server snapshots and [Warcon reads](../v0.11/README.md), including live status/players with separate freshness | Public Discord rendering and scheduling |
| Server command | `/server-status` is a private manager response from stored observations | Persistent public panels; do not change this command's visibility implicitly |
| Existing messages | Event, calendar, recruitment and ticket panels have saved message IDs | Common restart/retry handling and migration to a reliable message publisher |
| Channels | Dashboard metadata includes channel IDs, names, types and parent categories | Shared picker with category grouping, search, paste-ID mode and server-side validation |
| Player profiles | `/player` renders existing profile/performance data | Explicit game selection and mapping to verified collected-session facts; legacy totals are not proof of current HLL/Warcon integration |
| Artwork | Upstream now supplies three Wardogs maps and Valkyra/Manticore/Lonestar map-marker icons; the design exploration uses those icons with an existing general Valkyria Wardogs banner | Curated map-to-banner catalog and provisioning of appropriately sized application emoji |

Source inspection found two relevant reliability gaps in
[`sync/events.ts`](../../../../discord-bot/src/sync/events.ts): message fetch
errors are collapsed to `null` before sending a replacement, and recovery searches
legacy embed titles using the event name. This can mistake a transient error for
a missing message and does not identify Components V2 messages reliably. Similar
fetch fallbacks exist in [`sync/panels.ts`](../../../../discord-bot/src/sync/panels.ts).
These are **open implementation items**, not fixes delivered by this design.

## Public content

Prefer one compact, automatically edited message per configured game server.
Allow the scoreboard to use the same panel or a separately configured channel.
Do not automatically create both layouts for the same destination.

| Panel | Primary content | Detail action |
| --- | --- | --- |
| Server / live score | Server name, map banner/name, player count/capacity, faction names/icons/scores, observation age | Current players and the corresponding Valkyria server page |
| Players | In-game names and supported kills/deaths; Wardogs cash when available | Paginated response visible only to the person pressing the button |
| Confirmed result | Explicit event identity, map, participants, reviewed scores, confirmation/correction version | Corresponding website match detail |

The live scoreboard must say that the score is in progress. A completed provider
session alone does not establish an official clan result. Publish the result only
after explicit event association and the existing confirmed/corrected result
workflow. Update the original result message for a correction instead of posting
a second result. A withdrawn result must update or remove its owned public
message according to the configured publication policy.

The Warcon live contract includes server/map, counts/capacity, faction scores,
nullable match timing and player faction, kills, deaths, cash and ping. Publish
only fields supported and fresh in the selected source. Do not infer a timer's
direction, units or meaning without verified provider semantics. Do not label
cash as objective points or map it onto HLL metrics. HLL gets a separate renderer
using its actual available fields.

Live server players are not clan membership. Do not publish Steam IDs, internal
user IDs, Discord-to-game identity links, server passwords or administrative
provider links. Player-list publication is configurable per panel. Escape
provider-controlled display text, cap lengths, and disable mentions on both
message creation and every edit.

Status and player-list freshness are independent. Old observations retain their
last known value with age and a stale label; an unavailable source is not zero
players and is not proof that the server is offline. Detail buttons must not
quietly present an old player list as live.

## Destination and appearance settings

Every public publishing feature has its own destination configuration. Reuse
the same picker for existing event, calendar, ticket and recruitment features as
they adopt this lifecycle. Personal reminders and private responses retain their
own audience rules; a channel setting must not turn private content public.

The picker lists channels grouped by their current Discord category, supports
search by name/ID and offers explicit paste-ID mode. Refresh metadata on demand.
Categories are group headings, not message destinations. Initially accept ordinary
guild text and announcement channels; forum/thread destinations need a separate
explicit lifecycle. Show archived, unsupported or inaccessible destinations with
the reason they cannot be selected.

Resolve pasted IDs in the current guild. Validate both the human's current
configuration permission and the bot's ability to view the channel, read message
history and send the chosen message format, including embeds/files when used.
Enforce the same policy in backend mutations and authenticated management APIs;
read-only website grants cannot configure publication or manage application
artwork. Recheck before sending because permissions may change after save.

For each feature, expose enabled/paused, game/source, channel, layout, optional
player details, refresh policy, message link, last successful publication and a
useful retry/permission error. Add preview, channel verification and manual refresh.
Changing a channel is an explicit move of the owned message, with an observable
pending state if the old channel cannot be cleaned up. No deletion by matching
arbitrary text or by scanning unrelated bot messages.

Suggested default refresh: 60 seconds while active, with a 30-second option and
5-minute idle cadence. Result publication follows result revision changes.
Provider freshness and Discord rate limits take precedence; a display timer does
not force a fresh upstream fetch. Skip edits whose meaningful content is unchanged
and use Discord timestamps to avoid editing solely to increment an age counter.

## Banners and emoji

Use native Discord Components V2 containers, text, media galleries, separators
and buttons. Discord messages do not accept arbitrary website HTML/CSS. If a
message uses `IS_COMPONENTS_V2`, do not also send legacy `content`/`embeds` in that
message; account for current component limits in the renderer.

Use static map artwork selected by game/map ID, then a general game banner,
then a text-only fallback. Keep counts and scores as native text so they remain
readable and can update independently of the image. Final result cards can later
have a generated share image, but must also carry accessible text.

Prefer **application-owned emoji** for Valkyra, Manticore, Lonestar and metric
symbols. Discord currently permits up to 2,000 emoji owned by an application,
usable only by that application, without `USE_EXTERNAL_EMOJIS`. Members wanting
to use the same pictures in ordinary chat need a separate guild emoji set.
Application emoji management is bot-owner administration, not an authority
granted to every community administrator.

Maintain semantic names such as `wdg_valkyra`, `wdg_manticore`, `wdg_lonestar`,
`metric_players`, `metric_score`, `metric_kills`, `metric_deaths` and `metric_cash`.
Map each to an uploaded emoji ID and source asset hash. Reuse/reconcile that mapping
after restart; do not upload the pack every startup or delete unrelated emoji.
Creation accepts a 128 x 128 image up to 256 KiB. Keep text labels and a Unicode
or text fallback when an emoji is missing. Distinguish the **Valkyra faction**
from the **Valkyria community** in names and artwork.

The upstream icon set is under
[`public/stratmap/icons/wardogs`](../../../../public/stratmap/icons/wardogs/LICENSE),
with the original WARDOGS Calculator source and MIT notice retained. Keep this
attribution with any derived pack. The map images live under `public/maps/wardogs/`;
their presence is separate from selecting and qualifying a readable Discord banner.

Record source/provenance for selected map and faction assets. Accept approved
uploaded raster files through bounded type/dimension validation, rather than
letting the bot fetch arbitrary external image URLs. The interactive discussion
preview uses the existing faction icons and a general game banner, not a verified
screenshot of the named map. Implementation provisioned the three faction icons
into the authorized test application and verified idempotent reuse; production
applications require their own guarded provisioning step.

## Restart, retries and ownership

Store a durable publication record scoped to Logi workspace, Discord guild,
game, feature and source/event. Its logical identity must survive restarts.
Suggested fields: destination channel ID, message ID, configuration generation,
desired payload hash/revision, last published revision, next attempt, attempt
status, sanitized error and a worker lease/fencing token. Use transactional
uniqueness and claim/ack operations; process-local locks are insufficient.

1. Claim due work, check the current configuration generation and authorization,
   and render bounded content from stored observations.
2. Fetch the exact stored message and verify channel plus bot ownership. Edit
   that message when content changed. Permission errors, timeout, 429 and 5xx
   responses retain the binding and use a bounded retry policy.
3. Only an explicit Discord `Unknown Message` response for the expected channel
   permits automatic replacement. An unknown/inaccessible channel is blocked
   configuration, not permission to publish somewhere else.
4. Persist a creation attempt before sending. Use a bounded Discord nonce and
   `enforce_nonce` as an additional short-window defense, plus an exact recoverable
   panel identity in a versioned component `custom_id` or visible footer text.
   A display name or embed title is not an identity.
5. If Discord accepted a send but its response or database acknowledgement was
   lost, reconcile only exact owned candidates. If bounded history cannot prove
   whether a send happened, mark the attempt unresolved and require operator
   reconciliation rather than issuing a blind replacement.
6. Fence acknowledgements against newer configuration generations. Serialize
   destination moves and in-flight sends, and retain their pending/uncertain
   state across crashes. Fencing a database write cannot cancel a Discord request
   already in flight; the design must expose and reconcile that outcome.

Discord nonce deduplication lasts only a few minutes. This design aims to prevent
duplicate creation through durable ownership and conservative recovery; it must
not promise transactional exactly-once delivery across Convex and Discord.
Legacy panels without exact identity need explicit stored-ID adoption or manager
reconciliation, not a destructive title-based migration.

## Implementation order and required acceptance

| Step | Deliverable | Required evidence before activation |
| --- | --- | --- |
| P1 | Shared durable publisher and error classification; migrate saved panel IDs | Restart edits same ID; 403/429/timeout never trigger replacement; confirmed missing message can be replaced; two workers; lost send acknowledgement; edit-after-move race |
| P2 | Shared channel picker and per-feature management | Group/search/paste-ID; foreign-guild rejection; lost permissions; pause/resume; explicit channel move; management API parity |
| P3 | HLL/WDG status and scoreboard builders | Provider fixtures, null/zero distinction, independent freshness, long/malicious names, no mentions/identity leakage, component limits |
| P4 | Asset registry and application emoji provisioning | Missing/deleted emoji fallback; game/map fallback; rerun does not duplicate uploads; dimensions/size bounds; bot-owner authorization |
| P5 | Reviewed result publication and corrections | Unreviewed result withheld; exact event association; correction edits same ID; withdrawal; distinct same-name events |
| P6 | Authorized test-guild run | Real channel validation, create/update/restart/recovery, observed rate-limit handling, actual mobile/desktop Discord screenshots and configuration read-back |

Place pure identity, refresh, freshness and publication decisions in `src/domain`;
orchestration behind ports in `src/application`; persistence in Convex adapters;
Discord transport/builders in `discord-bot`; settings in the dashboard. Update
the matching public wiki and API/OpenAPI contracts with implementation. Keep
public UI examples clearly separate from runtime acceptance.

The original design-only documentation pass inspected the current callers and Discord documentation
and exercised an interactive local design preview. It did **not** send Discord
messages, upload emoji, deploy Convex, change provider configuration or test the
proposed durable publisher. Implementation acceptance is recorded separately in
the linked operator guide; those original design-only checks are not runtime proof.

Upstream merged Wardogs stratmap work into the PR at `f853c0a` during this design
pass. Its [GitHub checks passed](https://github.com/Ninjonik/logi/actions/runs/37107907954).
The older local HTTP/source-manifest and security evidence remains tied to its
recorded runtime and must not be represented as a new validation of that merge.

## Official references checked on 2026-10-03

- [Components overview](https://docs.discord.com/developers/components/overview)
  and [component reference](https://docs.discord.com/developers/components/reference)
- [Message resource](https://docs.discord.com/developers/resources/message):
  history permissions, message edits, mentions and nonce deduplication
- [Emoji resource](https://docs.discord.com/developers/resources/emoji):
  application-owned emoji, management API and image constraints
