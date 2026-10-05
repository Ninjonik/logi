import {
    escapeMarkdownText,
    panelFrame,
    type MessageView,
} from "../discord-messages/message-view"
import type { CompetitionPanelCopy } from "./panel-copy"
import { shortDate } from "./result-panel"

/**
 * The competition table (L3-19..24, L3-B06): one message per division of a
 * Logi competition, edited after every confirmed result, points by the
 * competition's rule (ECL cap points). The clan's own team is marked subtly.
 */
export type CompetitionTableRow = {
    teamId: string
    code: string
    points: number
    wins: number
    matches: number
    ours: boolean
}

export type CompetitionDivisionTable = {
    divisionId: string
    /** "ECL 2026". */
    competition: string
    division: string
    /** "Hell Let Loose". */
    gameName: string
    rows: CompetitionTableRow[]
    /** Highest league round with a final result; null before the first. */
    round: number | null
    nextMatch: {
        team: string
        title: string
        startAt: string | null
        round: number | null
    } | null
    url: string | null
    updatedAt: number
}

export function competitionTableView(input: {
    copy: CompetitionPanelCopy
    locale: string
    timeZone: string
    table: CompetitionDivisionTable
    accentColor: string | null
}): MessageView {
    const { copy, table } = input
    const rows = table.rows.map((row, index) => {
        const code = escapeMarkdownText(row.code)
        return `${index + 1}. ${row.ours ? `› **${code}**` : code} · **${copy.points(String(row.points))}** · ${copy.wins(row.wins, row.matches)}`
    })
    const next = table.nextMatch
    const nextLine = next
        ? copy.nextMatch(
              escapeMarkdownText(next.team),
              [
                  next.startAt
                      ? `${shortDate(next.startAt, input.locale, input.timeZone)} · <t:${Math.floor(Date.parse(next.startAt) / 1000)}:t>`
                      : null,
                  escapeMarkdownText(next.title),
                  next.round !== null ? copy.round(String(next.round)) : null,
              ]
                  .filter(Boolean)
                  .join(" · ")
          )
        : null
    const view = panelFrame({
        accentColor: input.accentColor,
        label: [table.competition, table.division, table.gameName].join(" · "),
        title:
            table.round !== null
                ? copy.titleAfterRound(String(table.round))
                : copy.title,
        content: [
            {
                kind: "text",
                markdown: rows.length ? rows.join("\n") : copy.empty,
            },
            ...(nextLine
                ? [{ kind: "text" as const, markdown: nextLine }]
                : []),
        ],
        actions: table.url
            ? [[{ kind: "link", url: table.url, label: copy.open }]]
            : [],
        updatedAt: table.updatedAt,
        footerNotes: [copy.rules],
    })
    if (view.footer?.kind === "managed") view.footer.updatedStyle = "f"
    return view
}
