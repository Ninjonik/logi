import type { StandingRow } from "./standings"

/** Column headers in the clan language ("#", "Tým", "B", "Z", "1.", "2.", "3.", "Název"). */
export type StandingsTableLabels = {
    rank: string
    team: string
    points: string
    played: string
    first: string
    second: string
    third: string
    name: string
}

/** Longest team name before "…" ("Batallón de Asalto, Manio…", P6-08). */
export const STANDINGS_NAME_WIDTH = 26
/** Marker in front of the clan's own rank (P6-09). */
export const OUR_TEAM_MARKER = "›"
/** ANSI bold bright white for the clan's row; Discord desktop renders it in an `ansi` code block. */
export const ANSI_OUR_ROW = "\u001b[1;37m"
export const ANSI_RESET = "\u001b[0m"

/**
 * Text inside a code block must not end the block or carry terminal escapes:
 * League names are untrusted.
 */
export function codeBlockCell(value: string | null) {
    return (value ?? "")
        .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
        .replace(/`/g, "'")
        .replace(/\s+/g, " ")
        .trim()
}

function truncate(value: string, width: number) {
    const chars = Array.from(value)
    return chars.length > width
        ? `${chars.slice(0, width - 1).join("")}…`
        : value
}

const length = (value: string) => Array.from(value).length
const padStart = (value: string, width: number) =>
    " ".repeat(Math.max(0, width - length(value))) + value
const padEnd = (value: string, width: number) =>
    value + " ".repeat(Math.max(0, width - length(value)))

/**
 * Lays the table out as fixed-width lines for a Discord code block (P6-08,
 * P6-12): rank, team code, then points and matches right after the code so
 * they stay visible on a phone where the block scrolls sideways, then the
 * 1st/2nd/3rd counts and the truncated name. The clan's row starts with "›";
 * with `ansi` it is also bold bright white on desktop.
 */
export function layoutStandingsTable(
    rows: readonly StandingRow[],
    labels: StandingsTableLabels,
    options: { ansi?: boolean; nameWidth?: number } = {}
): { lines: string[]; text: string } {
    const nameWidth = Math.max(2, options.nameWidth ?? STANDINGS_NAME_WIDTH)
    const header = [
        labels.rank,
        labels.team,
        labels.points,
        labels.played,
        labels.first,
        labels.second,
        labels.third,
        labels.name,
    ].map((label) => codeBlockCell(label))
    const body = rows.map((row) => [
        String(row.rank),
        codeBlockCell(row.teamCode),
        String(row.points),
        String(row.played),
        String(row.firsts),
        String(row.seconds),
        String(row.thirds),
        truncate(codeBlockCell(row.teamName), nameWidth),
    ])
    // Number columns are at least two wide so single digits line up (board).
    const width = (column: number) =>
        Math.max(
            column >= 2 && column <= 6 ? 2 : 1,
            ...[header, ...body].map((cells) => length(cells[column]))
        )
    const widths = header.map((_, column) => width(column))
    const line = (cells: string[], marker: string) =>
        [
            marker + padStart(cells[0], widths[0]),
            padEnd(cells[1], widths[1]),
            ...[2, 3, 4, 5, 6].map((column) =>
                padStart(cells[column], widths[column])
            ),
            cells[7],
        ]
            .join("  ")
            .trimEnd()
    const lines = [
        line(header, " "),
        ...body.map((cells, index) => {
            const ours = rows[index].ours
            const text = line(cells, ours ? OUR_TEAM_MARKER : " ")
            return ours && options.ansi
                ? `${ANSI_OUR_ROW}${text}${ANSI_RESET}`
                : text
        }),
    ]
    return { lines, text: lines.join("\n") }
}
