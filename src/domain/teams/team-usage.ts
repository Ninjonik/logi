import { normalizeTeamName, type TeamRecord } from "./team"
import { z } from "zod"

/**
 * Where a catalogue team is used, for global administration only (design I1
 * and I2): its competition registrations with fixture counts, and the
 * workspace requests still waiting for it.
 */

/** Teams one usage read may ask about (one catalogue page). */
export const TEAM_USAGE_IDS_MAX = 50
/** Competitions listed per team; more are counted in `competitionCount`. */
export const TEAM_USAGE_COMPETITIONS_MAX = 20

export const teamUsageCompetitionSchema = z.strictObject({
    id: z.string(),
    name: z.string(),
    season: z.string(),
    division: z.string().nullable(),
    fixtures: z.number().int().min(0),
    withdrawn: z.boolean(),
})
export type TeamUsageCompetition = z.infer<typeof teamUsageCompetitionSchema>

export const teamUsageSchema = z.strictObject({
    teamId: z.string(),
    competitions: z
        .array(teamUsageCompetitionSchema)
        .max(TEAM_USAGE_COMPETITIONS_MAX),
    competitionCount: z.number().int().min(0),
    pendingRequests: z.number().int().min(0),
    /** The oldest pending request, opened from the team's detail. */
    pendingRequestId: z.string().nullable(),
})
export type TeamUsage = z.infer<typeof teamUsageSchema>
export const teamUsageListSchema = z.strictObject({
    items: z.array(teamUsageSchema).max(TEAM_USAGE_IDS_MAX),
})

/** The catalogue filter: active entries, archived ones, or entries merged into another team. */
export const TEAM_CATALOGUE_STATES = ["active", "archived", "merged"] as const
export type TeamCatalogueState = (typeof TEAM_CATALOGUE_STATES)[number]
export const teamCatalogueStateSchema = z.enum(TEAM_CATALOGUE_STATES)

/** A merged team is also archived; it is listed under "merged" only. */
export function teamCatalogueState(
    team: Pick<TeamRecord, "archivedAt" | "mergedIntoTeamId">
): TeamCatalogueState {
    if (team.mergedIntoTeamId) return "merged"
    return team.archivedAt ? "archived" : "active"
}

const tokens = (value: string) =>
    normalizeTeamName(value)
        .split(/[^\p{L}\p{N}]+/u)
        .filter(Boolean)

/**
 * A requested team that looks like an existing one: the same name or short
 * code, or one name's words all contained in the other's ("DEF Squad" and
 * "DEF"). Single letters never count as a match on their own.
 */
export function isSimilarTeam(
    requested: { name: string; shortCode: string | null },
    existing: { name: string; shortCode: string | null }
): boolean {
    const a = normalizeTeamName(requested.name),
        b = normalizeTeamName(existing.name)
    if (a === b) return true
    const codeA = requested.shortCode
        ? normalizeTeamName(requested.shortCode)
        : null
    const codeB = existing.shortCode
        ? normalizeTeamName(existing.shortCode)
        : null
    if ((codeA && (codeA === codeB || codeA === b)) || (codeB && codeB === a))
        return true
    const left = tokens(requested.name),
        right = tokens(existing.name)
    const [shorter, longer] =
        left.length <= right.length ? [left, right] : [right, left]
    return (
        shorter.length > 0 &&
        shorter.join("").length >= 2 &&
        shorter.every((word) => longer.includes(word))
    )
}

/** Up to `limit` existing teams similar to the request, in the given order, never the request's own target. */
export function similarTeams<
    T extends { id: string; name: string; shortCode: string | null },
>(
    requested: {
        name: string
        shortCode: string | null
        teamId?: string | null
    },
    candidates: readonly T[],
    limit = 3
): T[] {
    return candidates
        .filter(
            (team) =>
                team.id !== requested.teamId && isSimilarTeam(requested, team)
        )
        .slice(0, limit)
}

export const similarTeamSchema = z.strictObject({
    id: z.string(),
    name: z.string(),
    shortCode: z.string().nullable(),
})
/** Moderation context of one request: who asked and which active teams look the same. */
export const teamRequestContextSchema = z.strictObject({
    requestId: z.string(),
    requester: z
        .strictObject({ name: z.string(), avatarUrl: z.string().nullable() })
        .nullable(),
    similarTeams: z.array(similarTeamSchema).max(3),
})
export type TeamRequestContext = z.infer<typeof teamRequestContextSchema>
export const teamRequestContextListSchema = z.strictObject({
    items: z.array(teamRequestContextSchema).max(TEAM_USAGE_IDS_MAX),
})
