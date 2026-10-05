/**
 * Support tickets in Discord (boards L4 1.4, M3 1.5 and L2 1.8) as
 * {@link MessageView}s: the panel in #tickety, the private replies of the
 * panel, the card that opens the ticket thread, the close card in the
 * thread, the DM to the author and the replies of `/close_ticket`. Every
 * card is the clan card (a panel may set its own colour); state is a chip.
 * The thread is named "Nahlásit hráče #12" and "uzavřeno · Nahlásit hráče
 * #12" after closing (L4-45). Pure: copy, names, links and times come in.
 */

import {
    errorCard,
    escapeMarkdownText,
    type MessageBlock,
    type MessageButton,
    type MessageView,
} from "../discord-messages/message-view"
import {
    discordWeekdayTimestamp,
    fillTemplate,
} from "../discord-messages/format"
import { joinNatural, roleMention } from "../discord-commands/text"
import type { TicketCopy } from "./ticket-copy"

/** The panel's category button: `ticket:<categoryId>`. */
export const TICKET_BUTTON_PREFIX = "ticket:"
/** The category select of a panel with more than ten categories. */
export const TICKET_SELECT_ID = "ticket-pick"
/** The category window: `ticket-modal:<categoryId>`. */
export const TICKET_MODAL_PREFIX = "ticket-modal:"

/** Discord's thread name limit. */
const THREAD_NAME_MAX = 100
/** Board rule: at most two rows of five buttons; more categories use a select. */
const MAX_CATEGORY_BUTTONS = 10

/** One line of user or stored text; a missing value (an old record) reads as empty. */
const oneLine = (value: string | null | undefined) =>
    (value ?? "").replace(/[\s\p{Cc}]+/gu, " ").trim()

/** User text as markdown: each line escaped, line breaks kept. */
function escapeLines(value: string) {
    return value
        .split(/\r?\n/)
        .map((line) => escapeMarkdownText(line.trim()))
        .filter(Boolean)
        .join("\n")
}

/** A quoted reason, one `>` per line; empty when there is none (L4-34). */
export function quotedReason(reason: string | null | undefined) {
    return (reason ?? "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => `> ${escapeMarkdownText(line)}`)
        .join("\n")
}

function cut(value: string, max: number) {
    return value.length <= max ? value : `${value.slice(0, max - 1)}…`
}

/** A ticket category as the panel and the thread show it. */
export type TicketPanelCategory = {
    id: string
    label?: string
    emoji?: string
    description?: string
}

export function ticketCategoryLabel(category: { id: string; label?: string }) {
    return oneLine(category.label ?? "") || category.id
}

/**
 * The ticket panel (L4-35..37): the clan colour or the panel's own colour,
 * the heading and text from Nastavení → Tickety, one line per category
 * ("**Nahlásit hráče** · chování na serveru"), one grey button per category
 * and "Spravováno v Logi". More than ten categories become one select.
 */
export function ticketPanelView(input: {
    title: string
    description?: string
    imageUrl?: string
    accentColor?: string | null
    categories: readonly TicketPanelCategory[]
    copy: TicketCopy
    managedUrl?: string
}): MessageView {
    const categories = input.categories
    const lines = categories.map((category) => {
        const label = `**${escapeMarkdownText(ticketCategoryLabel(category))}**`
        const description = oneLine(category.description ?? "")
        return description ? `${label} · ${description}` : label
    })
    const buttons: MessageButton[] = categories.map((category) => ({
        kind: "action",
        id: `${TICKET_BUTTON_PREFIX}${category.id}`,
        label: cut(ticketCategoryLabel(category), 80),
        style: "secondary",
        ...(category.emoji?.trim() ? { emoji: category.emoji.trim() } : {}),
    }))
    const actions: MessageBlock[] =
        categories.length > MAX_CATEGORY_BUTTONS
            ? [
                  {
                      kind: "select",
                      select: {
                          id: TICKET_SELECT_ID,
                          placeholder: input.copy.panel.selectPlaceholder,
                          options: categories.slice(0, 25).map((category) => ({
                              value: category.id,
                              label: cut(ticketCategoryLabel(category), 100),
                              ...(oneLine(category.description ?? "")
                                  ? {
                                        description: cut(
                                            oneLine(category.description!),
                                            100
                                        ),
                                    }
                                  : {}),
                              ...(category.emoji?.trim()
                                  ? { emoji: category.emoji.trim() }
                                  : {}),
                          })),
                      },
                  },
              ]
            : [buttons.slice(0, 5), buttons.slice(5, 10)]
                  .filter((row) => row.length)
                  .map((row) => ({ kind: "buttons" as const, buttons: row }))
    const description = input.description?.trim()
    const image = input.imageUrl?.trim()
    return {
        accent: input.accentColor?.trim()
            ? { custom: input.accentColor.trim() }
            : "clan",
        header: {
            title: cut(oneLine(input.title), 256),
            // The optional panel image; only a web address Discord can load.
            ...(image && /^https?:\/\//i.test(image)
                ? { thumbnail: { url: image } }
                : {}),
        },
        blocks: [
            ...(description
                ? [{ kind: "text" as const, markdown: cut(description, 2000) }]
                : []),
            ...(lines.length
                ? [{ kind: "text" as const, markdown: lines.join("\n") }]
                : []),
            { kind: "separator", divider: true, spacing: "small" },
            ...actions,
        ],
        footer: {
            kind: "managed",
            ...(input.managedUrl ? { managedUrl: input.managedUrl } : {}),
        },
    }
}

/** "Nahlásit hráče #12", cut to Discord's limit (L4-45). */
export function ticketThreadName(
    copy: TicketCopy,
    category: string,
    ticketNumber: number
) {
    return cut(
        fillTemplate(copy.thread.name, {
            category: oneLine(category),
            number: String(ticketNumber),
        }),
        THREAD_NAME_MAX
    )
}

/** "uzavřeno · Nahlásit hráče #12" after `/close_ticket` (L4-45). */
export function closedTicketThreadName(
    copy: TicketCopy,
    category: string,
    ticketNumber: number
) {
    return cut(
        fillTemplate(copy.thread.closedName, {
            category: oneLine(category),
            number: String(ticketNumber),
        }),
        THREAD_NAME_MAX
    )
}

/** "Ticket #12 je otevřený" with the thread and "Otevřít vlákno" (L4-39). */
export function ticketOpenedView(input: {
    copy: TicketCopy
    ticketNumber: number
    threadId: string
    threadUrl: string
}): MessageView {
    const { copy } = input
    return {
        accent: "clan",
        ephemeral: true,
        header: {
            title: fillTemplate(copy.opened.title, {
                number: String(input.ticketNumber),
            }),
        },
        blocks: [
            {
                kind: "text",
                markdown: fillTemplate(copy.opened.body, {
                    thread: `<#${input.threadId}>`,
                }),
            },
            {
                kind: "buttons",
                buttons: [
                    {
                        kind: "link",
                        url: input.threadUrl,
                        label: copy.opened.openThread,
                    },
                ],
            },
        ],
    }
}

/** "Tickety jsou teď vypnuté" (L4-41). */
export function ticketsDisabledCard(copy: TicketCopy): MessageView {
    return errorCard(copy.disabled)
}

/** A button of a category that no longer exists. */
export function ticketCategoryGoneCard(copy: TicketCopy): MessageView {
    return errorCard(copy.staleCategory)
}

/** One answer of the category's window. */
export type TicketAnswer = { label: string; value: string }

/** Room for the answers inside Discord's 4,000 characters of a card. */
const ANSWERS_BUDGET = 3000

/**
 * The card that opens the ticket thread (L4-42): "TICKET #12 · NAHLÁSIT
 * HRÁČE", the author's title, the chip "Otevřený" with the opening time,
 * the questions and answers and "Ticket uzavře podpora příkazem
 * /close_ticket · Spravováno v Logi". The pings sit above the card and are
 * limited to the author and the category's support roles (L4-B05).
 */
export function ticketIntroView(input: {
    copy: TicketCopy
    ticketNumber: number
    category: string
    /** The category's own card title, e.g. "{author} nahlašuje hráče". */
    titleTemplate?: string
    authorName: string
    openedAt: string | number
    answers: readonly TicketAnswer[]
    locale: string
    timeZone: string
    accentColor?: string | null
}): MessageView {
    const { copy } = input
    const category = oneLine(input.category)
    const author = oneLine(input.authorName)
    const opened = discordWeekdayTimestamp(
        input.openedAt,
        input.locale,
        input.timeZone
    )
    const answered = input.answers.filter(
        (answer) => answer.label.trim() && answer.value.trim()
    )
    const perAnswer = Math.max(
        120,
        Math.floor(ANSWERS_BUDGET / Math.max(1, answered.length))
    )
    const qa = answered
        .map(
            (answer) =>
                `**${escapeMarkdownText(oneLine(answer.label))}**\n${escapeLines(cut(answer.value.trim(), perAnswer))}`
        )
        .join("\n")
    return {
        accent: input.accentColor?.trim()
            ? { custom: input.accentColor.trim() }
            : "clan",
        header: {
            label: fillTemplate(copy.thread.label, {
                number: String(input.ticketNumber),
                category,
            }),
            title: cut(
                fillTemplate(input.titleTemplate?.trim() || copy.thread.title, {
                    author,
                    category,
                }),
                256
            ),
            chips: [{ label: copy.thread.openChip, tone: "success" }],
        },
        blocks: [
            ...(opened
                ? [
                      {
                          kind: "text" as const,
                          markdown: fillTemplate(copy.thread.openedAt, {
                              time: opened,
                          }),
                      },
                  ]
                : []),
            ...(qa ? [{ kind: "text" as const, markdown: qa }] : []),
            { kind: "separator", divider: true, spacing: "small" },
        ],
        footer: { kind: "managed", notes: [copy.thread.footer] },
    }
}

/** The pings above the opening card: the author and the support roles only. */
export function ticketIntroMentions(input: {
    authorId: string
    supportRoleIds: readonly string[]
}) {
    const roles = [...new Set(input.supportRoleIds)].filter((roleId) =>
        Boolean(roleMention(roleId))
    )
    return {
        content: [`<@${input.authorId}>`, ...roles.map((id) => `<@&${id}>`)]
            .join(" ")
            .trim(),
        allowedMentions: {
            users: [input.authorId],
            roles,
            parse: [] as never[],
        },
    }
}

/**
 * The close card in the thread (L4-43): "TICKET #12 · UZAVŘEN", "Vyřešeno",
 * the chip "Uzavřený", who closed it and when, the quoted reason (left out
 * without one) and "Vlákno je zamčené a archivované · Spravováno v Logi".
 */
export function ticketClosedView(input: {
    copy: TicketCopy
    ticketNumber: number
    closerId: string
    closedAt: string | number
    reason?: string
    locale: string
    timeZone: string
}): MessageView {
    const { copy } = input
    const when = discordWeekdayTimestamp(
        input.closedAt,
        input.locale,
        input.timeZone
    )
    const closedBy = fillTemplate(copy.closed.closedBy, {
        closer: `<@${input.closerId}>`,
        time: when ?? "",
    }).replace(/\s*·\s*$/, "")
    const reason = quotedReason(input.reason)
    return {
        accent: "clan",
        header: {
            label: fillTemplate(copy.closed.label, {
                number: String(input.ticketNumber),
            }),
            title: copy.closed.title,
            chips: [{ label: copy.closed.chip, tone: "neutral" }],
        },
        blocks: [
            { kind: "text", markdown: closedBy },
            ...(reason ? [{ kind: "text" as const, markdown: reason }] : []),
            { kind: "separator", divider: true, spacing: "small" },
        ],
        footer: { kind: "managed", notes: [copy.closed.footer] },
    }
}

/**
 * The DM to the author (L4-44, L2-56): "KLAN VLCI · TICKET #12", "Tvůj
 * ticket je vyřešený", "Nahlásit hráče · zavřel Hráč 02" (a name, never a
 * mention: Discord cannot show those outside the server), the quoted reason,
 * "Otevřít vlákno" and the DM footer "Klan Vlci · Nastavit zprávy".
 */
export function ticketClosedDmView(input: {
    copy: TicketCopy
    clanName: string
    ticketNumber: number
    category: string
    closerName: string
    reason?: string
    threadUrl: string
    settingsUrl?: string
}): MessageView {
    const { copy } = input
    const clan = oneLine(input.clanName) || "Logi"
    const reason = quotedReason(input.reason)
    return {
        accent: "clan",
        header: {
            label: fillTemplate(copy.dm.label, {
                clan,
                number: String(input.ticketNumber),
            }),
            title: copy.dm.title,
        },
        blocks: [
            {
                kind: "text",
                markdown: fillTemplate(copy.dm.closedBy, {
                    category: escapeMarkdownText(oneLine(input.category)),
                    closer: escapeMarkdownText(oneLine(input.closerName)),
                }),
            },
            ...(reason ? [{ kind: "text" as const, markdown: reason }] : []),
            {
                kind: "buttons",
                buttons: [
                    {
                        kind: "link",
                        url: input.threadUrl,
                        label: copy.dm.openThread,
                    },
                ],
            },
            { kind: "separator", divider: true, spacing: "small" },
        ],
        footer: {
            kind: "dm",
            clanName: clan,
            ...(input.settingsUrl ? { settingsUrl: input.settingsUrl } : {}),
        },
    }
}

/**
 * The private reply of `/close_ticket` (M3-30, M3-31): closed, and whether
 * the author got the DM (M3-B06).
 */
export function ticketClosedReplyView(input: {
    copy: TicketCopy
    ticketNumber: number
    dmDelivered: boolean
}): MessageView {
    const { copy } = input
    return {
        accent: "clan",
        ephemeral: true,
        header: {
            title: fillTemplate(copy.close.successTitle, {
                number: String(input.ticketNumber),
            }),
        },
        blocks: [
            {
                kind: "text",
                markdown: input.dmDelivered
                    ? copy.close.successBody
                    : copy.close.dmFailedBody,
            },
        ],
    }
}

/**
 * "Tento ticket můžou zavřít jen podpora a správci" (M3-32): who closes this
 * category's tickets.
 */
export function ticketCloseNotAllowedCard(input: {
    copy: TicketCopy
    category: string
    supportRoleIds: readonly string[]
}): MessageView {
    const { copy } = input
    const roles = input.supportRoleIds
        .map(roleMention)
        .filter((value): value is string => Boolean(value))
    const category = escapeMarkdownText(oneLine(input.category))
    return errorCard({
        title: copy.close.notAllowedTitle,
        body: roles.length
            ? fillTemplate(copy.close.notAllowedBody, {
                  category,
                  roles: joinNatural(roles, copy.close.or),
              })
            : fillTemplate(copy.close.notAllowedAdminsBody, { category }),
    })
}

/** "Teď nejde ověřit tvoje role" (M3-33). */
export function ticketCloseUnverifiableCard(copy: TicketCopy): MessageView {
    return errorCard({
        title: copy.close.unverifiableTitle,
        body: copy.close.unverifiableBody,
    })
}

/** "/close_ticket funguje jen ve vlákně ticketu" (M3-34). */
export function ticketCloseOutsideCard(copy: TicketCopy): MessageView {
    return errorCard({
        title: copy.close.outsideTitle,
        body: copy.close.outsideBody,
    })
}

/** "Tohle vlákno není ticket" (M3-35). */
export function ticketCloseNotTicketCard(copy: TicketCopy): MessageView {
    return errorCard({
        title: copy.close.notTicketTitle,
        body: copy.close.notTicketBody,
    })
}

/** "Ticket #12 je už uzavřený" (M3-36). */
export function ticketAlreadyClosedCard(
    copy: TicketCopy,
    ticketNumber: number
): MessageView {
    return errorCard({
        title: fillTemplate(copy.close.alreadyClosedTitle, {
            number: String(ticketNumber),
        }),
        body: copy.close.alreadyClosedBody,
    })
}

/**
 * "Ticket se nepodařilo otevřít" / "Nic se neuložilo. Správci dostali
 * upozornění; …" (L4-40): the person's side of a failure an admin fixes;
 * the details go to the errors channel.
 */
export function ticketFailedCard(copy: TicketCopy): MessageView {
    return errorCard(copy.failed)
}
