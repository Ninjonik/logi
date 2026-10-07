import { PARSER_VERSION } from "./league-constants"
import type { LeagueSnapshot } from "./contracts"

/**
 * A stored League page (`snapshotJson` of `leagueFixtures` and
 * `leagueTrackedMatches`), written by the League jobs after
 * `leagueMatchSchema` validated the parser's output. The panel reads walk
 * it on every pass, so they read it back through this guard instead of Zod
 * (ARCHITECTURE.md, "Convex hot paths"). A page written by another parser
 * contract reads as absent, as it did before.
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === "object" && !Array.isArray(value)
const isNullableText = (value: unknown): value is string | null =>
    value === null || typeof value === "string"
const isNullableCount = (value: unknown): value is number | null =>
    value === null || typeof value === "number"
const isNullableRecord = (value: unknown) => value === null || isRecord(value)
const isNullableArray = (value: unknown) =>
    value === null || Array.isArray(value)

function isTeam(value: unknown): boolean {
    return (
        isRecord(value) &&
        typeof value.code === "string" &&
        isNullableText(value.name) &&
        typeof value.profileUrl === "string" &&
        isNullableArray(value.nations) &&
        isNullableCount(value.displayedMemberCount) &&
        isNullableText(value.faction) &&
        isNullableText(value.readyCheck)
    )
}

function isResults(value: unknown): boolean {
    if (value === null) return true
    return (
        isRecord(value) &&
        typeof value.confirmed === "boolean" &&
        Array.isArray(value.placements) &&
        value.placements.every(
            (entry) =>
                isRecord(entry) &&
                typeof entry.place === "number" &&
                typeof entry.teamCode === "string"
        )
    )
}

export function isLeagueSnapshot(value: unknown): value is LeagueSnapshot {
    if (!isRecord(value) || value.parserVersion !== PARSER_VERSION) return false
    return (
        typeof value.id === "string" &&
        typeof value.sourceUrl === "string" &&
        typeof value.title === "string" &&
        isNullableCount(value.fixtureNumber) &&
        isNullableText(value.type) &&
        isNullableText(value.status) &&
        isNullableText(value.scheduledAt) &&
        isNullableRecord(value.request) &&
        (value.teams === null ||
            (Array.isArray(value.teams) && value.teams.every(isTeam))) &&
        isNullableRecord(value.map) &&
        isNullableRecord(value.hosting) &&
        isNullableText(value.moderator) &&
        isNullableRecord(value.mapVote) &&
        isNullableRecord(value.rules) &&
        isNullableText(value.readyCheck) &&
        (value.progress === null ||
            (Array.isArray(value.progress) &&
                value.progress.every(
                    (entry) =>
                        isRecord(entry) && typeof entry.label === "string"
                ))) &&
        isNullableText(value.scoringRule) &&
        isResults(value.results) &&
        Array.isArray(value.warnings) &&
        typeof value.fetchedAt === "string"
    )
}

/** The stored page, or null when absent or not written by this parser contract. */
export function readLeagueSnapshotPayload(
    json: string | undefined
): LeagueSnapshot | null {
    if (!json) return null
    let value: unknown
    try {
        value = JSON.parse(json)
    } catch {
        return null
    }
    return isLeagueSnapshot(value) ? value : null
}
