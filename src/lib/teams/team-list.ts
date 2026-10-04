import { normalizeTeamName, type TeamRecord } from "@/domain/teams/team"

/** Same order as the directory index: normalized name by code unit, then ID. */
function compareTeams(left: TeamRecord, right: TeamRecord) {
    const a = normalizeTeamName(left.name),
        b = normalizeTeamName(right.name)
    if (a !== b) return a < b ? -1 : 1
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0
}

/**
 * Replaces or inserts a re-read record in a loaded page. An archived record
 * leaves a list that shows active entries only.
 */
export function upsertTeamRecord(
    items: readonly TeamRecord[],
    team: TeamRecord,
    includeArchived: boolean
): TeamRecord[] {
    const others = items.filter((item) => item.id !== team.id)
    if (team.archivedAt && !includeArchived) return others
    const index = others.findIndex((item) => compareTeams(team, item) < 0)
    return index === -1
        ? [...others, team]
        : [...others.slice(0, index), team, ...others.slice(index)]
}

export function removeTeamRecord(
    items: readonly TeamRecord[],
    teamId: string
): TeamRecord[] {
    return items.filter((item) => item.id !== teamId)
}

/** Appends a further page without duplicating records already loaded. */
export function appendTeamPage(
    items: readonly TeamRecord[],
    page: readonly TeamRecord[]
): TeamRecord[] {
    const seen = new Set(items.map((item) => item.id))
    return [...items, ...page.filter((item) => !seen.has(item.id))]
}

/** Inserts a team name into a `{name}` label literally; `$` patterns in the name are not expanded. */
export function teamActionLabel(template: string, name: string): string {
    return template.split("{name}").join(name)
}
