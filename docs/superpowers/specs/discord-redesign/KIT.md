# Discord redesign: the W0 kit (developer note)

Everything the later workstreams build on: one message model, one bot adapter,
one dashboard preview, the split clan-language copy, the interaction registry
and the `/api/v1` settings slices. Read this before writing any bot message,
command reply or Discord preview. Never hand-roll a container.

## 1. Layers

```text
src/domain/discord-messages/message-view.ts        MessageView types, standard cards, panel frame, paging
src/domain/discord-messages/message-layout.ts      view + clan copy -> Components V2 tree (shared text helpers)
src/domain/discord-messages/message-validation.ts  board rules + Discord limits
src/lib/clan-language/{core,events,panels,membership,commands,system}.ts   copy in cs/en/de
discord-bot/src/ui/message-kit.ts                  layout -> discord.js builders and payloads
discord-bot/src/ui/replies.ts                      private replies, error path, errors-channel hook
discord-bot/src/interactions/registry.ts           interaction routing per feature
src/components/app/discord-preview/                dashboard preview of the same view
src/domain/api/settings-slices.ts                  /api/v1 clan settings slices
```

The view holds no fixed words. The frame words ("Aktualizováno",
"Spravováno v Logi", "Pozastaveno", "Klan …", "Strana 1 z 5") come from
`getSystemMessages(language).kit` when the view is laid out, for the bot and
the preview alike.

## 2. Building a message

```ts
import {
    panelFrame,
    type MessageView,
} from "@/domain/discord-messages/message-view"

const view = panelFrame({
    label: "Živé skóre · Hell Let Loose", // laid out upper case
    title: "Vlci #1",
    state: {
        chip: { label: "Živě", tone: "success" },
        detail: "Foy · 36 / 100 hráčů",
    },
    image: { url: "attachment://foy.webp", description: "mapa Foy" }, // only when it carries information
    content: [{ kind: "text", markdown: "**NEJVÍC ZABITÍ**\nRex\\_CZ · 31" }],
    actions: [
        [
            {
                kind: "action",
                id: "panel:1:players",
                label: "Zobrazit hráče",
                style: "secondary",
            },
            {
                kind: "link",
                url: "https://logi.app/join/vlci-1",
                label: "Připojit se",
            },
        ],
    ],
    updatedAt: observedAt, // footer "Aktualizováno <t:…:R>"
    refreshSeconds: 60, // "· obnovuje se každých 60 s"
    accentColor: panel.accentColor, // only a panel's own colour; missing = clan colour
    paused: failing
        ? { reason: copy.serverNotResponding, since: lastDataAt }
        : undefined,
})
```

- **Accent:** `"clan"` (clan colour, default `#E8A33D`), `"system"` (grey
  `#80848E`, error log and service status only) or `{ custom: "#RRGGBB" }`.
  State never changes the bar; use chips.
- **Chips:** tones `success`, `warning`, `danger`, `neutral`, `info`. The bot
  writes them as a tone emoji and the bold label (`🟢 **Živě**`); pass
  installed application emoji with `chipIcons` (W2). The preview draws pills.
- **Blocks:** `text` (markdown), `meta` (lines whose icons follow the clan's icon
  density: `{ text, line: "start" }` or `{ text, icon, iconAlways }`), `list`
  (`marker: "number" | "bullet" | "none"`), `fields` (title, chip, text, as the
  `/server-status` rows; an optional `thumbnail` makes the row a section with
  the image on the right, as the server rows of "Naše servery"; each such row
  costs three of the 40 components), `separator`, `gallery`, `buttons` (one
  row), `select`.
- **Plain vs markdown:** titles, labels, chip labels and field titles are plain
  and get escaped. Everything else is markdown: escape user data with
  `escapeMarkdownText`. Timestamps: `discordTimestamp(iso, "R")` from
  `format.ts`.
- **Footers:** `{ kind: "managed", notes, updatedAt, updatedStyle, refreshSeconds, page, managed, managedUrl }`
  or the DM footer `{ kind: "dm", clanName, settingsUrl }` ("Klan Vlci · Nastavit zprávy").
- **Long lists:** `pagedListReply({ title, rows, page, id, previousLabel, nextLabel })`,
  8 rows per page, "Strana 1 z 5" in the footer.

## 3. Errors (one style, M3)

```ts
import {
    errorCard,
    notAllowedCard,
    wrongPlaceCard,
} from "@/domain/discord-messages/message-view"
import {
    replyAdminFixableError,
    replyError,
    replyUnknownError,
} from "../ui/replies"

const copy = getMembershipMessages(language) // your workstream's copy module
await replyError(
    interaction,
    notAllowedCard({
        title: copy.ticket.closeNotAllowedTitle, // the reason, one sentence
        whoMay: copy.ticket.closeNotAllowedWho, // who may do it
    }),
    { language }
)
await replyError(interaction, wrongPlaceCard({ title, whereItWorks }), {
    language,
})
await replyError(interaction, errorCard({ title, body, action: retryButton }), {
    language,
}) // ≤ 1 button

// Only an admin can fix it: the person reads "Správci dostali upozornění.",
// the errors channel (error-reporting.ts, look unchanged until W9) gets the details.
await replyAdminFixableError(
    interaction,
    {
        title: copy.reports.cannotSendTitle,
        report: {
            error,
            action: "Create a report thread",
            location: "Player reports",
            scope: "interaction",
        },
    },
    { language }
)
```

Everything is private, in the clan colour and the clan language. Unexpected
errors need nothing: `runInteraction` (index.ts) answers any thrown error with
"Tohle se nepovedlo" in the clan language.

The clan language for a reply: `await interactionLanguage(interaction.guildId)`
(cached, else one read bounded to 1 s) or `clanLanguageForGuild(guildId)` in
workers. Never `interaction.locale`.

## 4. Sending and editing

```ts
import {
    editPayload,
    interactionReplyPayload,
    messagePayload,
} from "../ui/message-kit"
import { editManagedMessage, replyPrivately } from "../ui/replies"

const options = { language, style: config.messageStyle } // clan colour + icon density
await channel.send(messagePayload(view, options)) // IsComponentsV2, no pings
await interaction.reply(interactionReplyPayload(view, options)) // + Ephemeral when view.ephemeral
await replyPrivately(interaction, view, options) // handles deferred / replied
await editManagedMessage(message, view, options) // in place; clears legacy content/embeds

// Managed panels keep using the durable publisher:
await publishManagedMessage(client, {
    guildId,
    key,
    revision,
    channelId,
    message: messagePayload(view, options),
})
```

Payload builders validate first and throw `InvalidMessageViewError`
(`validateMessageView`): at most one primary (blurple or green) button, five
buttons per row, two button rows, link buttons http(s) only and without a
hand-written ↗ (Discord draws it), unique custom IDs, select and gallery
limits, 4,000 characters of text and 40 components. Add your own checks to
tests with `validateMessageView(view, messageKitLayoutOptions({ language }))`.

Managed messages no longer carry the "Automatic updates" button (L1-B15):
ownership is the stored message ID, and an uncertain create is recovered by an
invisible component `id` (`discord-bot/src/sync/publication-marker.ts`).

## 5. Copy

`src/lib/clan-language/` replaced `clan-language.ts`. Each module exports its
typed copy and one getter; the getter adds `locale`.

| Module          | Getter                                                                                                | Owner                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `events.ts`     | `getEventMessages`                                                                                    | W6 (announcements, rosters, reminders, DMs)                                            |
| `panels.ts`     | `getPanelMessages`                                                                                    | W1 (calendar panel)                                                                    |
| `membership.ts` | `getMembershipMessages`                                                                               | W7 (tickets, applications, /link flow)                                                 |
| `commands.ts`   | `getCommandMessages`                                                                                  | W8 (commands, stats, /server-status)                                                   |
| `system.ts`     | `getSystemMessages`                                                                                   | W0 kit (`kit`, `paging`, `errors`, `publication`), W9 (team requests, system messages) |
| `core.ts`       | `resolveClanLanguage`, `getIntlLocaleForClanLanguage`, `formatClanDateTime`, `formatClanRelativeTime` | W0                                                                                     |

Edit only your module; keep cs (board verbatim), en and de in step; bot copy
says "ty"/"du". There is no barrel: import the module you need.

## 6. Dashboard preview

```tsx
import { DiscordMessagePreview } from "@/components/app/discord-preview/discord-message-preview"

;<DiscordMessagePreview
    view={view} // the same MessageView the bot sends
    language={clanLanguage} // bot words and timestamps
    style={messageStyle} // clan colour, icon density
    labels={dictionary.discordPreview} // Discord chrome in the dashboard language
    now={now} // fixed "now" for <t:…:R>; without it times are absolute
    timeZone={clanTimeZone}
    mentions={{ roles: { [roleId]: "Admini" }, channels: { [id]: "oznameni" } }}
    author={{ time: "dnes v 20:14" }} // optional "Logi APP" header
    invokedBy={{ user: "Hráč 17", command: "/notice" }} // optional
/>
```

It renders the accent bar, header, chips, thumbnail, blocks, buttons (Discord
colours, link arrow), select, footer and, for `ephemeral` views, "Tuto zprávu
vidíte jen vy · Zavřít zprávu". Markdown is parsed, never injected as HTML.
It works at 390 px; no hooks, so it renders on the server too.

## 7. Interaction registry

```ts
// discord-bot/src/seed/interactions.ts
import type { InteractionFeature } from "../interactions/registry"

export const seedInteractions: InteractionFeature = {
    name: "seed",
    register(registry, context) {
        registry
            .button("seed:", (interaction) =>
                handleSeedButton(interaction, context)
            )
            .modal("seed-modal:", handleSeedModal)
            .command("seed", handleSeedCommand)
    },
}

// discord-bot/src/interactions/features.ts — one line per feature
export const interactionFeatures: readonly InteractionFeature[] = [
    seedInteractions,
]
```

Commands and autocomplete route by name, buttons, string/channel selects and
modals by custom ID prefix (longest prefix wins, duplicates throw). Registered
routes run before the old dispatch in `interactions.ts`; everything else falls
through unchanged. Do not edit the dispatch block; move a feature by
registering its prefix. Test with
`createInteractionHandler({ ...context, registry: createInteractionRegistry([feature], context) })`
(see `registry.test.ts`).

## 8. `/api/v1` settings slices

```ts
// src/domain/api/seed-settings-slice.ts
export const seedSettingsSlice = defineClanSettingsSlice({
    key: "seed",
    description: "Seed plan: thresholds, cooldowns and the seed channel.",
    schema: z.object({
        liveFrom: z.number().int(),
        startBelow: z.number().int(),
    }),
    patchSchema: z
        .object({ liveFrom: z.number().int().min(1).max(100) })
        .partial()
        .strict(),
    read: ({ discordConfig }) => ({
        liveFrom:
            typeof discordConfig?.seedLiveFrom === "number"
                ? discordConfig.seedLiveFrom
                : 40,
        startBelow: 20,
    }),
    toPatch: (patch) =>
        patch.liveFrom === undefined ? {} : { seedLiveFrom: patch.liveFrom },
})

// src/domain/api/clan-settings-slices.ts
export const CLAN_SETTINGS_SLICES: readonly AnyClanSettingsSlice[] = [
    seedSettingsSlice,
]
```

That is all: `PATCH /clan/settings { "seed": { "liveFrom": 40 } }` is
validated by the route and again by `publicApi:mutateClanSettings`, `GET`
returns `data.slices.seed`, and OpenAPI gets `ClanSettingsSeedSlice` and
`ClanSettingsSeedPatch` from the Zod schemas. Add the stored fields to
`convex/schema.ts` (additive, optional). A slice may not write identity,
secrets, plain settings fields or another slice's fields. Record exclusions
in `docs/integrations/website/configuration-coverage.md`.

## 9. Small helpers

- `checkCloseAuthority(guild, userId, { dashboardAdminRoleId, supportRoleIds })`
  (`discord-bot/src/interactions/close-authority.ts`): fresh guild, role and
  member read plus `canCloseSupportThread` (`src/domain/membership/`), used by
  both close commands.
- `DEFAULT_MESSAGE_ACCENT_COLOR` / `DEFAULT_MESSAGE_ACCENT_HEX` (`#E8A33D`) and
  `SYSTEM_MESSAGE_ACCENT_COLOR` (`#80848E`) in `format.ts`.
- `discordWeekdayTimestamp(iso, locale, timeZone)` in `format.ts`: the boards'
  "ne 11. 10. · 20:00" as `ne <t:…:d> · <t:…:t>` (weekday in the clan language
  and zone, date and time as Discord timestamps).
- `factionEmblem(label, emoji)` (`faction-emblem.ts`): installed application
  emoji, else the monochrome ★ Allies / ✚ Axis / ◈ Wardogs. No coloured squares.

## 10. Tests to copy

- Domain: `message-view.test.ts`, `message-layout.test.ts`, `message-validation.test.ts`.
- Bot payload JSON: `discord-bot/src/ui/message-kit.test.ts` (build, then
  `JSON.parse(JSON.stringify(component.toJSON()))`).
- Replies with fake interactions: `discord-bot/src/ui/replies.test.ts`.
- Preview markup: `src/components/app/discord-preview/discord-message-preview.test.ts`
  (`renderToStaticMarkup`).
- Settings slices: `src/domain/api/settings-slices.test.ts`.
- A view laid out with the real clan copy (text, buttons, validation):
  `renderedView(view, language)` in `src/infrastructure/testing/message-views.ts`.

## 11. Panels

Panels (live servers, "Naše servery", results, calendar, competition tables)
are built on `panelFrame` and documented, with their dashboard routes, Convex
functions, bot worker and the hand-offs to W3, W4 and W5, in
[PANELS-API.md](PANELS-API.md).
