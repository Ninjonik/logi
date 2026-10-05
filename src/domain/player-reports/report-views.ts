import {
    adminFixableErrorCard,
    errorCard,
    escapeMarkdownText,
    type MessageBlock,
    type MessageButton,
    type MessageView,
} from "../discord-messages/message-view"
import type { ReportCopy } from "../discord-publications/panel-copy"
import type { ReportObservation } from "./report"

/**
 * "Nahlásit hráče" (L3-58..68, L3-B09): the private picker, the result
 * replies and the card in the private report thread. Everything is in the
 * clan language and private to the reporter and the staff.
 */
export const REPORT_PICKER_PAGE = 20

const cut = (value: string, max: number) =>
    Array.from(value).slice(0, max).join("")
/** A URL inside Markdown link parentheses: brackets and spaces percent-encoded. */
const linkTarget = (url: string) =>
    url.replace(
        /[()\s]/g,
        (char) =>
            `%${char.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`
    )

export type ReportPickerInput = {
    copy: ReportCopy
    draftId: string
    /** The panel's title, e.g. "Vlci #1". */
    serverTitle: string
    observation: ReportObservation
    page: number
    /** Localized side names ("Osa"); null when the side is unknown. */
    sideName: (team: string | null) => string | null
}

/** "Koho chceš nahlásit?" with the observed players, 20 per page, and "Jiný hráč". */
export function reportPickerView(input: ReportPickerInput): MessageView {
    const { copy, observation } = input
    const pages = Math.max(
        1,
        Math.ceil(observation.players.length / REPORT_PICKER_PAGE)
    )
    const page = Math.min(Math.max(0, Math.floor(input.page)), pages - 1)
    const options = observation.players
        .slice(page * REPORT_PICKER_PAGE, (page + 1) * REPORT_PICKER_PAGE)
        .map((player, index) => {
            const side = input.sideName(player.team)
            return {
                value: String(page * REPORT_PICKER_PAGE + index),
                label: cut(player.name, 100),
                description: cut(
                    side ? copy.onServer(side) : copy.onServerNoSide,
                    100
                ),
            }
        })
    options.push({
        value: "-1",
        label: copy.otherPlayer,
        description: copy.otherPlayerHint,
    })
    const observed = observation.observedAt
        ? `<t:${Math.floor(Date.parse(observation.observedAt) / 1000)}:R>`
        : "—"
    const blocks: MessageBlock[] = [
        {
            kind: "meta",
            lines: [
                {
                    text: observation.map
                        ? copy.pickerMeta(
                              escapeMarkdownText(observation.map),
                              observed
                          )
                        : copy.pickerMetaNoMap(observed),
                },
            ],
        },
        { kind: "text", markdown: copy.pickerText },
        {
            kind: "select",
            select: {
                id: `report:pick:${input.draftId}`,
                placeholder: copy.selectPlaceholder,
                options,
            },
        },
    ]
    if (pages > 1) {
        const buttons: MessageButton[] = [
            {
                kind: "action",
                id: `report:page:${input.draftId}:${Math.max(0, page - 1)}:prev`,
                label: copy.previous,
                style: "secondary",
                disabled: page === 0,
            },
            {
                kind: "action",
                id: `report:page:${input.draftId}:${Math.min(pages - 1, page + 1)}:next`,
                label: copy.next,
                style: "secondary",
                disabled: page === pages - 1,
            },
        ]
        blocks.push({ kind: "buttons", buttons })
    }
    return {
        accent: "clan",
        ephemeral: true,
        header: {
            label: copy.pickerLabel(input.serverTitle),
            title: copy.pickerTitle,
        },
        blocks,
        footer: {
            kind: "managed",
            managed: false,
            page: { page: page + 1, pages },
        },
    }
}

/** "Hlášení odesláno" with a link to the private thread (L3-62). */
export function reportSentView(input: {
    copy: ReportCopy
    threadName: string
    threadUrl: string
}): MessageView {
    return {
        accent: "clan",
        ephemeral: true,
        header: { title: input.copy.sentTitle },
        blocks: [
            {
                kind: "text",
                markdown: input.copy.sentBody(
                    `**${escapeMarkdownText(input.threadName)}**`
                ),
            },
            {
                kind: "buttons",
                buttons: [
                    {
                        kind: "link",
                        url: input.threadUrl,
                        label: input.copy.openThread,
                    },
                ],
            },
        ],
    }
}

/** The report is stored; the thread is still being reconciled. */
export function reportSavedView(copy: ReportCopy): MessageView {
    return errorCard({ title: copy.savedTitle, body: copy.savedBody })
}

/**
 * Why a report cannot be sent, each with its own sentence (L3-63, L3-64).
 * `admin` causes only an admin can fix: the person reads "Správci dostali
 * upozornění." and the errors channel gets the details.
 */
export const REPORT_FAILURES = [
    "limit",
    "wait",
    "too_many_forms",
    "expired",
    "reason",
    "evidence",
    "player",
    "no_access",
    "admin",
    "unavailable",
] as const
export type ReportFailure = (typeof REPORT_FAILURES)[number]

export function reportFailureView(
    copy: ReportCopy,
    failure: ReportFailure,
    adminNotified: string
): MessageView {
    if (failure === "admin")
        return adminFixableErrorCard({
            title: copy.cannotSendTitle,
            adminNotified,
        })
    const body: Record<Exclude<ReportFailure, "admin">, string> = {
        limit: copy.limitBody,
        wait: copy.waitBody,
        too_many_forms: copy.tooManyFormsBody,
        expired: copy.expiredBody,
        reason: copy.reasonBody,
        evidence: copy.evidenceBody,
        player: copy.playerBody,
        no_access: copy.noAccessBody,
        unavailable: copy.unavailableBody,
    }
    return errorCard({ title: copy.cannotSendTitle, body: body[failure] })
}

/** The stored report a thread card shows (`playerReports.contextJson`). */
export type ReportThreadContext = {
    gameId: string
    serverName: string | null
    map: string | null
    observedAt: string | null
    player: {
        name: string
        playerId: string | null
        team: string | null
        provenance: string
    }
    reason: string
    incident: string
    evidence: string
}

/** Thread name by number and player, never an internal marker (L3-68). */
export function reportThreadName(
    copy: ReportCopy,
    number: number,
    player: string
) {
    return cut(
        copy.threadName(String(number), player.replace(/\s+/g, " ").trim()),
        100
    )
}

/**
 * The card in the private thread (L3-65..67): "HLÁŠENÍ HRÁČE #17 · K
 * PROVĚŘENÍ", the player and side, where and when, the reason, the time and
 * the evidence link, and how to close it.
 */
export function reportThreadView(input: {
    copy: ReportCopy
    number: number
    context: ReportThreadContext
    reporterId: string
    /** Localized side of the player ("Osa"), when known. */
    sideName: string | null
    /** "ne 11. 10. v 20:41": when the players were observed. */
    observedText: string | null
    /** The panel's title, e.g. "Vlci #1". */
    serverTitle: string | null
}): MessageView {
    const { copy, context } = input
    const evidence = context.evidence.trim()
    // Server and map are provider text; the time is Discord markup.
    const where = [
        ...[input.serverTitle ?? context.serverName, context.map]
            .filter((part): part is string => Boolean(part))
            .map((part) => escapeMarkdownText(part)),
        ...(input.observedText ? [input.observedText] : []),
    ]
    const details = [
        context.incident.trim()
            ? `**${copy.when}** ${escapeMarkdownText(context.incident.trim())}`
            : null,
        evidence
            ? `**${copy.evidence}** [${escapeMarkdownText(
                  cut(evidence.replace(/^https:\/\//, ""), 60)
              )}](${linkTarget(evidence)})`
            : null,
    ].filter(Boolean)
    return {
        accent: "clan",
        header: {
            label: copy.cardLabel(String(input.number)),
            title: [context.player.name, input.sideName]
                .filter(Boolean)
                .join(" · "),
        },
        blocks: [
            {
                kind: "meta",
                lines: [
                    {
                        text:
                            context.player.provenance === "observed"
                                ? copy.observedIdentity
                                : copy.manualIdentity,
                    },
                    {
                        text: [
                            ...where,
                            copy.reportedBy(`<@${input.reporterId}>`),
                        ].join(" · "),
                    },
                ],
            },
            {
                kind: "text",
                markdown: `> ${escapeMarkdownText(context.reason)}`,
            },
            ...(details.length
                ? [{ kind: "text" as const, markdown: details.join(" · ") }]
                : []),
            { kind: "separator", divider: true, spacing: "small" },
        ],
        footer: { kind: "managed", managed: false, notes: [copy.footer] },
    }
}
