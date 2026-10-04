import {
    teamDashboardRateBucket,
    teamRateLimitedResponse,
    type TeamDashboardRateLimit,
} from "@/lib/api/teams-dashboard-route"
import {
    matchTeamAssignmentSchema,
    type MatchTeamError,
} from "@/domain/teams/match-teams"
import { readBoundedJson } from "@/lib/api/request-json"
import { teamIdSchema } from "@/domain/teams/team"
import { z } from "zod"

const json = (value: unknown, status = 200) =>
    Response.json(value, { status, headers: { "Cache-Control": "no-store" } })

/** Dashboard request body: one explicit refresh of one assigned team. */
export const matchTeamRefreshCommandSchema = z.strictObject({
    action: z.literal("refresh"),
    teamId: teamIdSchema,
})
const MATCH_TEAM_ERRORS = new Set<string>([
    "invalid_match_teams",
    "team_not_found",
    "team_archived",
    "team_game_mismatch",
    "match_concluded",
    "training_event",
] satisfies MatchTeamError[])
const refreshedSchema = z.array(matchTeamAssignmentSchema).max(3)

/** The dashboard actor is passed through so Convex can recheck its session. */
export type MatchTeamRefreshPorts<
    Actor extends { subject: string } = { subject: string },
> = {
    /** Current workspace admin and dashboard actor; null denies the request. */
    access(serverId: string): Promise<{
        serverRecordId: string
        guildId: string
        actor: Actor
    } | null>
    /** The directory bucket shared with team reads and writes. */
    rateLimit(bucket: string): Promise<TeamDashboardRateLimit>
    refresh(input: {
        serverRecordId: string
        eventId: string
        teamId: string
        actor: Actor
    }): Promise<unknown>
    revalidate(serverId: string, eventId: string): void
}

/**
 * Explicit, audited re-capture of one assigned team's presentation before a
 * match concludes. Same-origin admin only; Convex enforces every match rule.
 */
export function matchTeamRefreshHandler<Actor extends { subject: string }>(
    ports: MatchTeamRefreshPorts<Actor>
) {
    return async function POST(
        request: Request,
        params: { serverId: string; eventId: string }
    ): Promise<Response> {
        if (request.headers.get("origin") !== new URL(request.url).origin)
            return json({ error: "forbidden" }, 403)
        try {
            const access = await ports.access(params.serverId)
            if (!access) return json({ error: "forbidden" }, 403)
            // Every refresh writes an audit row, so it consumes the directory bucket.
            const rate = await ports.rateLimit(
                teamDashboardRateBucket(access.guildId, access.actor.subject)
            )
            if (!rate.allowed) return teamRateLimitedResponse(rate)
            const input = matchTeamRefreshCommandSchema.safeParse(
                await readBoundedJson(request, 4096)
            )
            if (!input.success) return json({ error: "invalid_request" }, 400)
            const result = (await ports.refresh({
                serverRecordId: access.serverRecordId,
                eventId: params.eventId,
                teamId: input.data.teamId,
                actor: access.actor,
            })) as { ok?: unknown; matchTeams?: unknown; error?: unknown }
            if (typeof result?.error === "string")
                return MATCH_TEAM_ERRORS.has(result.error)
                    ? json({ error: result.error }, 400)
                    : json({ error: "unavailable" }, 503)
            const matchTeams = refreshedSchema.safeParse(result?.matchTeams)
            if (result?.ok !== true || !matchTeams.success)
                return json({ error: "unavailable" }, 503)
            ports.revalidate(params.serverId, params.eventId)
            return json({ ok: true, matchTeams: matchTeams.data })
        } catch {
            return json({ error: "unavailable" }, 503)
        }
    }
}
