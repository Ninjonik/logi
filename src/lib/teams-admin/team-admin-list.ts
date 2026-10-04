import { normalizeTeamName, type TeamRecord } from "@/domain/teams/team"

/** Same order as the catalogue index: normalized name by code unit, then ID. */
function compareTeams(left: TeamRecord, right: TeamRecord) {
    const a = normalizeTeamName(left.name),
        b = normalizeTeamName(right.name)
    if (a !== b) return a < b ? -1 : 1
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0
}

/**
 * Replaces or inserts a re-read record in a loaded page. An archived or
 * merged record leaves a list that shows active entries only.
 */
export function upsertAdminTeam(
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

export function removeById<T extends { id: string }>(
    items: readonly T[],
    id: string
): T[] {
    return items.filter((item) => item.id !== id)
}

/** Appends a further page without duplicating records already loaded. */
export function appendUnique<T extends { id: string }>(
    items: readonly T[],
    page: readonly T[]
): T[] {
    const seen = new Set(items.map((item) => item.id))
    return [...items, ...page.filter((item) => !seen.has(item.id))]
}

/** The lifecycle badge of a catalogue entry: a merged team is also archived. */
export function teamLifecycleBadge(
    team: Pick<TeamRecord, "archivedAt" | "mergedIntoTeamId">
): "merged" | "archived" | null {
    if (team.mergedIntoTeamId) return "merged"
    return team.archivedAt ? "archived" : null
}

/** Which lifecycle actions an entry offers: merged teams are final. */
export function teamAdminActions(
    team: Pick<TeamRecord, "archivedAt" | "mergedIntoTeamId">
): { edit: boolean; archive: boolean; restore: boolean; merge: boolean } {
    const merged = Boolean(team.mergedIntoTeamId),
        archived = Boolean(team.archivedAt)
    return {
        edit: !archived,
        archive: !archived,
        restore: archived && !merged,
        merge: !merged,
    }
}

/** Active teams of the source's game other than the source itself. */
export function mergeCandidates(
    items: readonly TeamRecord[],
    source: Pick<TeamRecord, "id" | "gameId">
): TeamRecord[] {
    return items.filter(
        (team) =>
            team.id !== source.id &&
            team.gameId === source.gameId &&
            !team.archivedAt
    )
}

/** Inserts values into `{key}` placeholders literally; `$` patterns are not expanded. */
export function fillTemplate(
    template: string,
    values: Readonly<Record<string, string>>
): string {
    return Object.entries(values).reduce(
        (text, [key, value]) => text.split(`{${key}}`).join(value),
        template
    )
}

export type WorkspaceOption = { id: string; name: string }
const DISCORD_ID = /^\d{17,20}$/

/**
 * Workspaces a team can be linked to: valid Discord guild IDs only, one entry
 * each, named workspaces by name first; a workspace without a known name
 * follows and shows its ID.
 */
export function linkableWorkspaces(
    guilds: readonly { discordId: string; name: string }[]
): WorkspaceOption[] {
    const byId = new Map<string, WorkspaceOption>()
    for (const guild of guilds) {
        if (!DISCORD_ID.test(guild.discordId)) continue
        const name = guild.name.trim()
        const existing = byId.get(guild.discordId)
        if (!existing || (!existing.name && name))
            byId.set(guild.discordId, { id: guild.discordId, name })
    }
    return [...byId.values()]
        .sort(
            (left, right) =>
                Number(!left.name) - Number(!right.name) ||
                left.name.localeCompare(right.name) ||
                left.id.localeCompare(right.id)
        )
        .map((option) => ({ id: option.id, name: option.name || option.id }))
}

/** The workspace name for a linked ID, or null when the superadmin cannot see it. */
export function workspaceName(
    workspaces: readonly WorkspaceOption[],
    guildId: string | null
): string | null {
    if (!guildId) return null
    return (
        workspaces.find((workspace) => workspace.id === guildId)?.name ?? null
    )
}

/** Localized date and time; an unparsable value is shown as stored. */
export function formatAdminDate(iso: string, locale: string): string {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return iso
    try {
        return new Intl.DateTimeFormat(locale, {
            dateStyle: "medium",
            timeStyle: "short",
        }).format(date)
    } catch {
        return date.toISOString()
    }
}
