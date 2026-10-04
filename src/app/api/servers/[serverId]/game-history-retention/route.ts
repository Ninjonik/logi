import { historyRetentionSettingsSchema } from "@/domain/game-data/history-retention"
import { getServerContextUncached } from "@/lib/read-models/server-context"
import { currentDashboardActor } from "@/lib/gateways/dashboard-actor"
import { getInternalAuthSecret, getSiteUrl } from "@/lib/env"
import { fetchMutation, fetchQuery } from "convex/nextjs"
import { readBoundedJson } from "@/lib/api/request-json"
import { makeFunctionReference } from "convex/server"

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

export async function GET(_request: Request, context: Context) {
    const args = await access(context)
    if (!args) return json({ error: "Forbidden." }, 403)
    try {
        return json(
            await fetchQuery(
                makeFunctionReference<"query">("gameHistoryRetention:read"),
                args
            )
        )
    } catch {
        return json({ error: "Retention settings unavailable." }, 503)
    }
}

export async function POST(request: Request, context: Context) {
    if (request.headers.get("origin") !== new URL(getSiteUrl()).origin)
        return json({ error: "Forbidden." }, 403)
    const args = await access(context)
    if (!args) return json({ error: "Forbidden." }, 403)
    const input = historyRetentionSettingsSchema.safeParse(
        await readBoundedJson(request, 1024)
    )
    if (!input.success)
        return json(
            { error: "Choose one of the offered retention windows." },
            400
        )
    try {
        return json(
            await fetchMutation(
                makeFunctionReference<"mutation">(
                    "gameHistoryRetention:configure"
                ),
                { ...args, retentionDays: input.data.retentionDays }
            )
        )
    } catch {
        return json({ error: "Unable to save retention settings." }, 503)
    }
}
