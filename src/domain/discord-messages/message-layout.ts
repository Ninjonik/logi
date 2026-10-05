/**
 * Lays a {@link MessageView} out as the plain Components V2 tree the bot
 * sends: one container with the accent bar holding text displays, sections,
 * separators, galleries and action rows. The text helpers are shared with
 * the dashboard preview, so both show the same words.
 */

import {
    escapeMarkdownText,
    resolveMessageViewAccent,
    toUnixSeconds,
    type ChipTone,
    type MessageBlock,
    type MessageButton,
    type MessageChip,
    type MessageFooter,
    type MessageHeader,
    type MessageMedia,
    type MessageMetaLine,
    type MessageSelect,
    type MessageView,
} from "./message-view"
import {
    messageLineIcon,
    type MessageIconDensity,
    type MessageStyle,
} from "./message-style"
import { fillTemplate } from "./format"

/** The fixed words of the frame, in the clan language (`clan-language/system.ts`). */
export type MessageKitCopy = {
    /** "Aktualizováno {time}". */
    updated: string
    /** "obnovuje se každých {seconds} s". */
    refreshEvery: string
    /** "Spravováno v Logi". */
    managed: string
    /** "Klan {clan}". */
    dmClan: string
    /** "Nastavit zprávy". */
    dmSettings: string
    /** "Strana {page} z {pages}". */
    page: string
    /** "Pozastaveno". */
    paused: string
    /** "poslední data {time}". */
    lastData: string
}

export type MessageLayoutOptions = {
    copy: MessageKitCopy
    /** Intl locale of the clan language, for the upper-case header label. */
    locale: string
    /** The clan's message style: clan colour and icon density. */
    style?: MessageStyle | null
    /**
     * The emoji in front of a chip per tone. Coloured circles by default;
     * the bot may pass installed application emoji instead.
     */
    chipIcons?: Partial<Record<ChipTone, string>>
}

export const DEFAULT_CHIP_ICONS: Record<ChipTone, string> = {
    success: "🟢",
    warning: "🟡",
    danger: "🔴",
    neutral: "⚪",
    info: "🔵",
}

export type LayoutNode =
    | { type: "text"; content: string }
    | { type: "section"; texts: string[]; thumbnail: MessageMedia }
    | { type: "separator"; divider: boolean; spacing: "small" | "large" }
    | { type: "gallery"; items: MessageMedia[] }
    | { type: "buttons"; buttons: MessageButton[] }
    | { type: "select"; select: MessageSelect }

export type MessageLayout = {
    accentColor: number
    ephemeral: boolean
    nodes: LayoutNode[]
}

/** The header label in upper case, as on the boards ("KALENDÁŘ · VLCI"). */
export function headerLabelText(label: string, locale: string) {
    try {
        return label.toLocaleUpperCase(locale)
    } catch {
        return label.toUpperCase()
    }
}

/** A chip as Discord text: its tone icon and the bold label. */
export function chipText(
    chip: MessageChip,
    icons: Partial<Record<ChipTone, string>> = {}
) {
    const icon = icons[chip.tone] ?? DEFAULT_CHIP_ICONS[chip.tone]
    return `${icon} **${escapeMarkdownText(chip.label)}**`
}

/** The paused chip and its markdown detail ("server neodpovídá · poslední data <t:…:f>"). */
export function pausedState(header: MessageHeader, copy: MessageKitCopy) {
    if (!header.paused) return undefined
    const since = toUnixSeconds(header.paused.since)
    const detail = [
        header.paused.reason?.trim(),
        since === undefined
            ? undefined
            : fillTemplate(copy.lastData, { time: `<t:${since}:f>` }),
    ].filter((part): part is string => Boolean(part))
    return {
        chip: { label: copy.paused, tone: "warning" } satisfies MessageChip,
        detail: detail.join(" · ") || undefined,
    }
}

/** The chips and status of a header, with the paused state taking their place. */
export function headerState(header: MessageHeader, copy: MessageKitCopy) {
    const paused = pausedState(header, copy)
    if (paused) return { chips: [paused.chip], status: paused.detail }
    return {
        chips: header.chips ?? [],
        status: header.status?.trim() || undefined,
    }
}

/** The header as markdown lines: `-# **LABEL**`, `### Title`, chips and status. */
export function headerLines(
    header: MessageHeader,
    options: Pick<MessageLayoutOptions, "copy" | "locale" | "chipIcons">
) {
    const lines: string[] = []
    if (header.label?.trim())
        lines.push(
            `-# **${escapeMarkdownText(headerLabelText(header.label.trim(), options.locale))}**`
        )
    if (header.title?.trim())
        lines.push(`### ${escapeMarkdownText(header.title.trim())}`)
    const state = headerState(header, options.copy)
    const parts = [
        ...state.chips.map((chip) => chipText(chip, options.chipIcons)),
        ...(state.status ? [state.status] : []),
    ]
    if (parts.length) lines.push(parts.join(" · "))
    return lines
}

/** A meta line with its icon when the clan's icon density shows it. */
export function metaLineText(
    line: MessageMetaLine,
    density: MessageIconDensity | undefined
) {
    const icon = line.line
        ? messageLineIcon(line.line, density)
        : line.icon && (density === "rich" || line.iconAlways)
          ? `${line.icon} `
          : ""
    return `${icon}${line.text}`
}

/** The rows of a list block with their marker. */
export function listLines(block: Extract<MessageBlock, { kind: "list" }>) {
    return block.items.map((item, index) =>
        block.marker === "number"
            ? `${index + 1}. ${item}`
            : block.marker === "bullet"
              ? `• ${item}`
              : item
    )
}

/** A field row: bold title, optional chip, then its text on the next line. */
export function fieldText(
    field: { title: string; chip?: MessageChip; text?: string },
    icons?: Partial<Record<ChipTone, string>>
) {
    const head = [
        `**${escapeMarkdownText(field.title)}**`,
        ...(field.chip ? [chipText(field.chip, icons)] : []),
    ].join(" · ")
    return field.text?.trim() ? `${head}\n${field.text}` : head
}

/**
 * The footer as markdown without the subtext marker, e.g.
 * "Aktualizováno <t:1791741600:R> · obnovuje se každých 60 s · Spravováno v Logi".
 */
export function footerText(footer: MessageFooter, copy: MessageKitCopy) {
    const notes = (footer.notes ?? []).filter((note) => note.trim())
    if (footer.kind === "dm") {
        const settings = footer.settingsUrl
            ? `[${copy.dmSettings}](${footer.settingsUrl})`
            : copy.dmSettings
        return [
            ...notes,
            fillTemplate(copy.dmClan, {
                clan: escapeMarkdownText(footer.clanName.trim()),
            }),
            settings,
        ].join(" · ")
    }
    const updated = toUnixSeconds(footer.updatedAt)
    const parts = [...notes]
    if (updated !== undefined)
        parts.push(
            fillTemplate(copy.updated, {
                time: `<t:${updated}:${footer.updatedStyle ?? "R"}>`,
            })
        )
    if (footer.refreshSeconds && footer.refreshSeconds > 0)
        parts.push(
            fillTemplate(copy.refreshEvery, {
                seconds: String(Math.round(footer.refreshSeconds)),
            })
        )
    if (footer.page)
        parts.push(
            fillTemplate(copy.page, {
                page: String(footer.page.page),
                pages: String(footer.page.pages),
            })
        )
    if (footer.managed !== false)
        parts.push(
            footer.managedUrl
                ? `[${copy.managed}](${footer.managedUrl})`
                : copy.managed
        )
    return parts.join(" · ")
}

function blockNodes(
    block: MessageBlock,
    options: MessageLayoutOptions
): LayoutNode[] {
    switch (block.kind) {
        case "text":
            return block.markdown.trim()
                ? [{ type: "text", content: block.markdown }]
                : []
        case "meta": {
            const lines = block.lines
                .filter((line) => line.text.trim())
                .map((line) => metaLineText(line, options.style?.iconDensity))
            return lines.length
                ? [{ type: "text", content: lines.join("\n") }]
                : []
        }
        case "list": {
            const lines = listLines(block)
            return lines.length
                ? [{ type: "text", content: lines.join("\n") }]
                : []
        }
        case "fields":
            return block.items.flatMap((field, index): LayoutNode[] => [
                ...(index > 0
                    ? [
                          {
                              type: "separator" as const,
                              divider: true,
                              spacing: "small" as const,
                          },
                      ]
                    : []),
                field.thumbnail
                    ? {
                          type: "section" as const,
                          texts: [fieldText(field, options.chipIcons)],
                          thumbnail: field.thumbnail,
                      }
                    : {
                          type: "text" as const,
                          content: fieldText(field, options.chipIcons),
                      },
            ])
        case "separator":
            return [
                {
                    type: "separator",
                    divider: block.divider ?? true,
                    spacing: block.spacing ?? "small",
                },
            ]
        case "gallery":
            return block.items.length
                ? [{ type: "gallery", items: block.items }]
                : []
        case "buttons":
            return block.buttons.length
                ? [{ type: "buttons", buttons: block.buttons }]
                : []
        case "select":
            return [{ type: "select", select: block.select }]
    }
}

/** The view as the Components V2 tree the bot sends. */
export function layoutMessageView(
    view: MessageView,
    options: MessageLayoutOptions
): MessageLayout {
    const nodes: LayoutNode[] = []
    const header = view.header ? headerLines(view.header, options) : []
    if (header.length) {
        const content = header.join("\n")
        nodes.push(
            view.header?.thumbnail
                ? {
                      type: "section",
                      texts: [content],
                      thumbnail: view.header.thumbnail,
                  }
                : { type: "text", content }
        )
    }
    for (const block of view.blocks) nodes.push(...blockNodes(block, options))
    // A trailing divider without anything after it is noise, unless a footer follows.
    const footer = view.footer ? footerText(view.footer, options.copy) : ""
    while (!footer && nodes.at(-1)?.type === "separator") nodes.pop()
    if (footer) nodes.push({ type: "text", content: `-# ${footer}` })
    return {
        accentColor: resolveMessageViewAccent(view.accent, options.style),
        ephemeral: Boolean(view.ephemeral),
        nodes,
    }
}

/** Every component Discord counts: the container and everything nested in it. */
export function countLayoutComponents(layout: MessageLayout) {
    return layout.nodes.reduce((total, node) => {
        switch (node.type) {
            case "section":
                // The section, its text displays and the thumbnail.
                return total + 1 + node.texts.length + 1
            case "buttons":
                return total + 1 + node.buttons.length
            case "select":
                return total + 2
            default:
                return total + 1
        }
    }, 1)
}

/** All text Discord counts against the message text limit. */
export function layoutTextLength(layout: MessageLayout) {
    return layout.nodes.reduce(
        (total, node) =>
            total +
            (node.type === "text"
                ? node.content.length
                : node.type === "section"
                  ? node.texts.reduce((sum, text) => sum + text.length, 0)
                  : 0),
        0
    )
}
