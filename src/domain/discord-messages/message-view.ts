/**
 * A framework-free description of one Discord Components V2 message, used by
 * every bot message of the redesign (design boards L3 and M3). The bot turns
 * it into discord.js builders (`discord-bot/src/ui/`) and the dashboard
 * renders the same value as a preview (`src/components/app/discord-preview/`),
 * so an editor shows exactly what the bot posts.
 *
 * The view holds no copy of its own. Fixed words (the footer's "Aktualizováno",
 * "Spravováno v Logi", the paused chip) come from the clan language when the
 * view is laid out (`message-layout.ts`); everything else is passed in.
 *
 * Text conventions: titles, labels, chip labels and field titles are plain
 * text and are escaped when laid out. Text blocks, meta lines, list rows,
 * field text, the header status and footer notes are Discord markdown; escape
 * user data in them with {@link escapeMarkdownText}.
 */

import {
    SYSTEM_MESSAGE_ACCENT_COLOR,
    parseDiscordColor,
    resolveMessageAccentColor,
} from "./format"
import type { MessageLine, MessageStyle } from "./message-style"

/** The fixed state vocabulary of chips; the bar colour never shows state. */
export const CHIP_TONES = [
    "success",
    "warning",
    "danger",
    "neutral",
    "info",
] as const
export type ChipTone = (typeof CHIP_TONES)[number]

/** A small state label inside the card, e.g. "Živě" (success) or "Pozastaveno" (warning). */
export type MessageChip = { label: string; tone: ChipTone }

/**
 * The bar colour: the clan accent (default `#E8A33D`), the neutral grey of
 * system messages for admins, or a panel's own `#RRGGBB` colour.
 */
export type MessageAccent = "clan" | "system" | { custom: string }

/** An image: an http(s) URL or an `attachment://name` of the same message. */
export type MessageMedia = { url: string; description?: string }

/** Milliseconds, an ISO string or a Date. */
export type TimestampInput = number | string | Date

export type ActionButtonStyle = "primary" | "success" | "secondary" | "danger"

/**
 * A button. `primary` (blurple) and `success` (green, for "Přihlásit se")
 * both count as the one primary action of a message. Link buttons are grey
 * and Discord draws the ↗ arrow after their label itself.
 */
export type MessageButton =
    | {
          kind: "action"
          id: string
          label: string
          style: ActionButtonStyle
          emoji?: string
          disabled?: boolean
      }
    | {
          kind: "link"
          url: string
          label: string
          emoji?: string
          disabled?: boolean
      }

export type MessageSelectOption = {
    value: string
    label: string
    description?: string
    emoji?: string
    default?: boolean
}

export type MessageSelect = {
    id: string
    placeholder?: string
    options: MessageSelectOption[]
    minValues?: number
    maxValues?: number
    disabled?: boolean
}

/**
 * One meta line under the header ("Foy · hráči zjištění před 20 s"). Its icon
 * follows the clan's icon density: a standard `line` kind uses the shared
 * icon set, a custom `icon` shows only in the rich density unless
 * `iconAlways` (team and faction signs).
 */
export type MessageMetaLine = {
    text: string
    line?: MessageLine
    icon?: string
    iconAlways?: boolean
}

/** A row of a field block: a bold title, an optional chip and a markdown line below. */
export type MessageField = { title: string; chip?: MessageChip; text?: string }

export type MessageBlock =
    | { kind: "text"; markdown: string }
    | { kind: "meta"; lines: MessageMetaLine[] }
    | {
          kind: "list"
          items: string[]
          /** `number` prefixes "1.", `bullet` "•"; default `none`. */
          marker?: "number" | "bullet" | "none"
      }
    | { kind: "fields"; items: MessageField[] }
    | { kind: "separator"; divider?: boolean; spacing?: "small" | "large" }
    | { kind: "gallery"; items: MessageMedia[] }
    | { kind: "buttons"; buttons: MessageButton[] }
    | { kind: "select"; select: MessageSelect }

/** Data failed: the paused chip says since when; the bar keeps its colour. */
export type MessagePaused = { reason?: string; since?: TimestampInput }

export type MessageHeader = {
    /** Small label "DRUH · HRA"; laid out in upper case. */
    label?: string
    title?: string
    /**
     * A markdown line under the title, before the chips: what the card
     * concerns, e.g. the errors channel's "VLK vs ROG · Přátelák · ne 11. 10."
     */
    subtitle?: string
    chips?: MessageChip[]
    /** Short markdown after the chips, e.g. "Foy · 36 / 100 hráčů". */
    status?: string
    /** An image on the right, only when it carries information (a map). */
    thumbnail?: MessageMedia
    /** Replaces the chips and status with the paused chip and its time. */
    paused?: MessagePaused
}

/**
 * The footer of a public post or a private reply:
 * `[notes ·] Aktualizováno <t:…:R> [· obnovuje se každých 60 s] [· Strana 1 z 5] · Spravováno v Logi`.
 */
export type ManagedFooter = {
    kind: "managed"
    notes?: string[]
    updatedAt?: TimestampInput
    /** `R` (relative, ticking by itself) by default; `f` for a fixed time. */
    updatedStyle?: "R" | "f"
    refreshSeconds?: number
    page?: { page: number; pages: number }
    /** Show "Spravováno v Logi"; default true. */
    managed?: boolean
    /** Link "Spravováno v Logi" to this page. */
    managedUrl?: string
}

/** The footer of every DM: "Klan <Název> · Nastavit zprávy". */
export type DirectMessageFooter = {
    kind: "dm"
    clanName: string
    /** The account's DM settings page. */
    settingsUrl?: string
    notes?: string[]
}

export type MessageFooter = ManagedFooter | DirectMessageFooter

export type MessageView = {
    accent: MessageAccent
    header?: MessageHeader
    blocks: MessageBlock[]
    footer?: MessageFooter
    /** A private reply; Discord adds "Tuto zprávu vidíte jen vy · Zavřít zprávu". */
    ephemeral?: boolean
}

/** The Discord limits the views are validated against. */
export const DISCORD_MESSAGE_LIMITS = {
    /** All text displays of a Components V2 message together. */
    totalText: 4000,
    /** Every component, nested ones included. */
    components: 40,
    buttonsPerRow: 5,
    /** Board rule: at most two rows of buttons. */
    buttonRows: 2,
    /** Board rule: one primary (blurple or green) action per message. */
    primaryButtons: 1,
    buttonLabel: 80,
    customId: 100,
    url: 512,
    selectOptions: 25,
    selectOptionText: 100,
    selectPlaceholder: 150,
    galleryItems: 10,
    mediaDescription: 1024,
} as const

/** The bar colour of a view; state never changes it. */
export function resolveMessageViewAccent(
    accent: MessageAccent,
    style?: MessageStyle | null
): number {
    if (accent === "system") return SYSTEM_MESSAGE_ACCENT_COLOR
    const clan = resolveMessageAccentColor({ messageStyle: style })
    if (accent === "clan") return clan
    return parseDiscordColor(accent.custom) ?? clan
}

/** Unix seconds of a timestamp, or undefined when it is not a valid date. */
export function toUnixSeconds(value: TimestampInput | null | undefined) {
    if (value === null || value === undefined || value === "") return undefined
    const ms =
        value instanceof Date
            ? value.getTime()
            : typeof value === "number"
              ? value
              : Date.parse(value)
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : undefined
}

/**
 * Escapes plain text for Discord markdown: formatting characters, mention
 * and timestamp brackets, and a heading, quote or list marker at the start.
 * Line breaks become spaces, so a title stays one line.
 */
export function escapeMarkdownText(value: string) {
    return value
        .replace(/[\r\n]+/g, " ")
        .replace(/([\\*_~`|[\]<>])/g, "\\$1")
        .replace(/^(\s*)([#>-])/, "$1\\$2")
        .replace(/^(\s*\d+)\./, "$1\\.")
}

// --- Standard cards (copy-free: every word is passed in) --------------------

type CardAction = { action?: MessageButton }

/**
 * The one error style (M3-05): the reason as the title, the next step below
 * and at most one button that really helps. Private, in the clan colour.
 */
export function errorCard(
    input: { title: string; body: string } & CardAction
): MessageView {
    return {
        accent: "clan",
        ephemeral: true,
        header: { title: input.title },
        blocks: [
            { kind: "text", markdown: input.body },
            ...(input.action
                ? [{ kind: "buttons" as const, buttons: [input.action] }]
                : []),
        ],
    }
}

/** "Nepovoleno": says who may do it (M3-07). */
export function notAllowedCard(
    input: { title: string; whoMay: string } & CardAction
): MessageView {
    return errorCard({
        title: input.title,
        body: input.whoMay,
        action: input.action,
    })
}

/** "Jinde": says where it works (M3-07). */
export function wrongPlaceCard(
    input: { title: string; whereItWorks: string } & CardAction
): MessageView {
    return errorCard({
        title: input.title,
        body: input.whereItWorks,
        action: input.action,
    })
}

/**
 * An error only an admin can fix: the person gets the reason and "správci
 * dostali upozornění"; the details go to the errors channel (M3-07).
 */
export function adminFixableErrorCard(input: {
    title: string
    adminNotified: string
}): MessageView {
    return errorCard({ title: input.title, body: input.adminNotified })
}

/**
 * The unknown error of any button or command (M3-08): "Tohle se nepovedlo" /
 * "Zkus to za chvíli znovu. Když to nepůjde, napiš správcům klanu."
 */
export function unknownErrorCard(copy: {
    title: string
    body: string
}): MessageView {
    return errorCard(copy)
}

// --- The panel frame (L3-07..11) ------------------------------------------------

export type PanelFrameInput = {
    /** The panel's own bar colour (`#RRGGBB`); missing means the clan colour. */
    accentColor?: string | null
    /** "Druh panelu · Hra". */
    label: string
    title: string
    /** The state chip with a short state text. */
    state?: { chip: MessageChip; detail?: string }
    /** An image on the right, only when it carries information. */
    image?: MessageMedia
    /** Only what the panel shows; long lists belong to a private paged reply. */
    content?: MessageBlock[]
    /** Up to two rows; a panel without actions has no buttons. */
    actions?: MessageButton[][]
    updatedAt: TimestampInput
    /** Live panels say how often they refresh. */
    refreshSeconds?: number
    footerNotes?: string[]
    managedUrl?: string
    /** Data failed: no content and no buttons, the paused chip says since when. */
    paused?: MessagePaused
}

/**
 * One frame for every panel the bot keeps in a channel and edits in place:
 * header (label, title, state chip, optional image), content, a divider,
 * buttons and the footer "Aktualizováno … · Spravováno v Logi". The bar is the
 * clan colour unless the panel sets its own; pause and outage are a chip.
 */
export function panelFrame(input: PanelFrameInput): MessageView {
    const paused = input.paused
    const rows = paused
        ? []
        : (input.actions ?? []).filter((row) => row.length > 0)
    return {
        accent: input.accentColor?.trim()
            ? { custom: input.accentColor.trim() }
            : "clan",
        header: {
            label: input.label,
            title: input.title,
            chips: input.state ? [input.state.chip] : [],
            status: input.state?.detail,
            thumbnail: input.image,
            ...(paused ? { paused } : {}),
        },
        blocks: [
            ...(paused ? [] : (input.content ?? [])),
            { kind: "separator", divider: true, spacing: "small" },
            ...rows.map((buttons) => ({ kind: "buttons" as const, buttons })),
        ],
        footer: {
            kind: "managed",
            notes: input.footerNotes,
            updatedAt: input.updatedAt,
            refreshSeconds: input.refreshSeconds,
            managedUrl: input.managedUrl,
        },
    }
}

// --- Private paged lists (L3-08) -------------------------------------------------

/**
 * "Předchozí" / "Další" for page `page` (1-based) of `pages`; the buttons at
 * the ends are disabled. `id(page)` builds each button's custom ID; a
 * disabled end button points past the range so the two IDs stay unique.
 */
export function pageButtons(input: {
    page: number
    pages: number
    id: (page: number) => string
    previousLabel: string
    nextLabel: string
}): MessageButton[] {
    const pages = Math.max(1, Math.floor(input.pages))
    const page = Math.min(Math.max(1, Math.floor(input.page)), pages)
    return [
        {
            kind: "action",
            id: input.id(page - 1),
            label: input.previousLabel,
            style: "secondary",
            disabled: page <= 1,
        },
        {
            kind: "action",
            id: input.id(page + 1),
            label: input.nextLabel,
            style: "secondary",
            disabled: page >= pages,
        },
    ]
}

/**
 * A long list as a private reply, one page at a time: header, optional meta,
 * the page's rows, paging buttons and "Strana 1 z 5 · Spravováno v Logi".
 */
export function pagedListReply(input: {
    label?: string
    title: string
    meta?: MessageMetaLine[]
    rows: string[]
    page: number
    pageSize?: number
    marker?: "number" | "bullet" | "none"
    id: (page: number) => string
    previousLabel: string
    nextLabel: string
}): MessageView {
    const size = Math.max(1, Math.floor(input.pageSize ?? 8))
    const pages = Math.max(1, Math.ceil(input.rows.length / size))
    const page = Math.min(Math.max(1, Math.floor(input.page)), pages)
    const rows = input.rows.slice((page - 1) * size, page * size)
    return {
        accent: "clan",
        ephemeral: true,
        header: { label: input.label, title: input.title },
        blocks: [
            ...(input.meta?.length
                ? [{ kind: "meta" as const, lines: input.meta }]
                : []),
            ...(rows.length
                ? [
                      {
                          kind: "list" as const,
                          items: rows,
                          marker: input.marker,
                      },
                  ]
                : []),
            { kind: "separator", divider: true, spacing: "small" },
            ...(pages > 1
                ? [
                      {
                          kind: "buttons" as const,
                          buttons: pageButtons({ ...input, page, pages }),
                      },
                  ]
                : []),
        ],
        footer: { kind: "managed", page: { page, pages } },
    }
}
