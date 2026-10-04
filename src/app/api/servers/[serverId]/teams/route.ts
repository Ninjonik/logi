import {
    TEAM_MUTATION_FOR,
    parseTeamsQuery,
    teamCommandResponse,
    teamCommandSchema,
} from "@/lib/api/teams-dashboard-route"
import { getServerContextUncached } from "@/lib/read-models/server-context"
import { currentDashboardActor } from "@/lib/gateways/dashboard-actor"
import { fetchMutation, fetchQuery } from "convex/nextjs"
import { readBoundedJson } from "@/lib/api/request-json"
import { makeFunctionReference } from "convex/server"
import { getInternalAuthSecret } from "@/lib/env"

export const runtime = "nodejs"
type Context = { params: Promise<{ serverId: string }> }
const json = (value: unknown, status = 200) =>
    Response.json(value, { status, headers: { "Cache-Control": "no-store" } })
async function access(context: Context) {
    const server = await getServerContextUncached(
            (await context.params).serverId
        ),
        actor = await currentDashboardActor()
    return server?.canAdmin && actor
        ? {
              secret: getInternalAuthSecret(),
              guildId: server.server.discordId,
              actor,
          }
        : null
}

/** `?teamId=` reads one record as `{ team }`; otherwise `?game=` pages one game's directory. */
export async function GET(request: Request, context: Context) {
    const args = await access(context)
    if (!args) return json({ error: "forbidden" }, 403)
    const query = parseTeamsQuery(new URL(request.url).searchParams)
    if (!query) return json({ error: "invalid_team" }, 400)
    try {
        if (query.kind === "get") {
            const team = await fetchQuery(
                makeFunctionReference<"query">("teams:get"),
                { ...args, teamId: query.teamId }
            )
            return team ? json({ team }) : json({ error: "not_found" }, 404)
        }
        return json(
            await fetchQuery(makeFunctionReference<"query">("teams:list"), {
                ...args,
                gameId: query.gameId,
                archived: query.archived,
                ...(query.search ? { search: query.search } : {}),
                cursor: query.cursor,
                limit: query.limit,
            })
        )
    } catch {
        return json({ error: "unavailable" }, 503)
    }
}

export async function POST(request: Request, context: Context) {
    if (request.headers.get("origin") !== new URL(request.url).origin)
        return json({ error: "forbidden" }, 403)
    const args = await access(context)
    if (!args) return json({ error: "forbidden" }, 403)
    const command = teamCommandSchema.safeParse(
        await readBoundedJson(request, 16384)
    )
    if (!command.success) return json({ error: "invalid_team" }, 400)
    try {
        const { action, ...payload } = command.data
        const result = teamCommandResponse(
            await fetchMutation(
                makeFunctionReference<"mutation">(TEAM_MUTATION_FOR[action]),
                { ...args, ...payload }
            )
        )
        return json(result.body, result.status)
    } catch {
        return json({ error: "unavailable" }, 503)
    }
}
