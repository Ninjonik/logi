import type { FixtureEventCandidate } from "@/domain/competitions/admin-view"
import type { CompetitionCommand } from "@/lib/api/competition-admin-route"
import { teamRecordSchema, type TeamRecord } from "@/domain/teams/team"
import { z } from "zod"

/** Every code the competition administration routes return; each has a localized message. */
export const COMPETITION_ERROR_CODES = [
    "invalid_competition",
    "not_found",
    "duplicate_slug",
    "duplicate_division",
    "division_not_found",
    "division_not_empty",
    "invalid_order",
    "limit_reached",
    "team_not_found",
    "team_archived",
    "team_game_mismatch",
    "already_registered",
    "registration_has_fixtures",
    "team_not_registered",
    "division_mismatch",
    "event_not_found",
    "event_not_match",
    "event_game_mismatch",
    "event_already_linked",
    "event_team_mismatch",
    "migration_pending",
    "forbidden",
    "unavailable",
] as const
export type CompetitionErrorCode = (typeof COMPETITION_ERROR_CODES)[number]

export function competitionErrorCode(body: unknown): CompetitionErrorCode {
    const code =
        body && typeof body === "object" && "error" in body
            ? (body as { error: unknown }).error
            : null
    return typeof code === "string" &&
        (COMPETITION_ERROR_CODES as readonly string[]).includes(code)
        ? (code as CompetitionErrorCode)
        : "unavailable"
}

export class CompetitionRequestError extends Error {
    constructor(readonly code: CompetitionErrorCode) {
        super(code)
    }
}

async function readJson(response: Response): Promise<unknown> {
    try {
        return await response.json()
    } catch {
        return null
    }
}

export type CompetitionCommandResult =
    | { ok: true; result: Record<string, unknown> }
    | { ok: false; code: CompetitionErrorCode }

/** Sends one administration command; never throws. */
export async function sendCompetitionCommand(
    command: CompetitionCommand
): Promise<CompetitionCommandResult> {
    try {
        const response = await fetch("/api/competitions", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(command),
        })
        const body = await readJson(response)
        if (!response.ok) return { ok: false, code: competitionErrorCode(body) }
        return {
            ok: true,
            result:
                body && typeof body === "object"
                    ? (body as Record<string, unknown>)
                    : {},
        }
    } catch {
        return { ok: false, code: "unavailable" }
    }
}

const teamSearchSchema = z.object({ items: z.array(teamRecordSchema) })

/** Active catalogue teams of the competition's game matching `search`. */
export async function searchCompetitionTeams(
    competitionId: string,
    search: string,
    signal?: AbortSignal
): Promise<TeamRecord[]> {
    const params = new URLSearchParams()
    const term = search.trim()
    if (term) params.set("search", term)
    const response = await fetch(
        `/api/competitions/${encodeURIComponent(competitionId)}/teams${params.size ? `?${params}` : ""}`,
        { signal }
    )
    const body = await readJson(response)
    if (!response.ok)
        throw new CompetitionRequestError(competitionErrorCode(body))
    const parsed = teamSearchSchema.safeParse(body)
    if (!parsed.success) throw new CompetitionRequestError("unavailable")
    return parsed.data.items
}

const candidatesSchema = z.object({
    events: z.array(
        z.object({
            id: z.string(),
            name: z.string(),
            gameStart: z.string(),
            workspace: z.string(),
            teamsMatch: z.boolean(),
            hasResult: z.boolean(),
        })
    ),
})

/** Native match events offered for linking to one fixture. */
export async function fetchFixtureEventCandidates(
    fixtureId: string,
    signal?: AbortSignal
): Promise<FixtureEventCandidate[]> {
    const response = await fetch(
        `/api/competitions/fixtures/${encodeURIComponent(fixtureId)}/events`,
        { signal }
    )
    const body = await readJson(response)
    if (!response.ok)
        throw new CompetitionRequestError(competitionErrorCode(body))
    const parsed = candidatesSchema.safeParse(body)
    if (!parsed.success) throw new CompetitionRequestError("unavailable")
    return parsed.data.events
}
