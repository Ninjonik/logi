import {
    sourceRegistrationSchema,
    sourceRotationSchema,
} from "@/domain/game-data/source-registration"
import { getServerContextUncached } from "@/lib/read-models/server-context"
import { currentDashboardActor } from "@/lib/gateways/dashboard-actor"
import { fetchMutation, fetchQuery } from "convex/nextjs"
import { readBoundedJson } from "@/lib/api/request-json"
import { makeFunctionReference } from "convex/server"
import { getInternalAuthSecret } from "@/lib/env"
import { z } from "zod"

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
const command = z.discriminatedUnion("action", [
    z.strictObject({
        action: z.literal("register"),
        registration: sourceRegistrationSchema,
    }),
    z.strictObject({
        action: z.literal("rotate"),
        rotation: sourceRotationSchema,
    }),
    z.strictObject({
        action: z.literal("remove"),
        ref: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/),
    }),
])
const mutationFor = {
    register: "gameDataSources:register",
    rotate: "gameDataSources:rotate",
    remove: "gameDataSources:remove",
} as const

export async function GET(_request: Request, context: Context) {
    const args = await access(context)
    if (!args) return json({ error: "forbidden" }, 403)
    try {
        return json(
            await fetchQuery(
                makeFunctionReference<"query">("gameDataSources:list"),
                args
            )
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
    const input = command.safeParse(await readBoundedJson(request, 8192))
    if (!input.success) return json({ error: "invalid_source" }, 400)
    try {
        const { action, ...payload } = input.data
        const result = (await fetchMutation(
            makeFunctionReference<"mutation">(mutationFor[action]),
            { ...args, ...payload }
        )) as { ok?: true; error?: string }
        return result.error ? json({ error: result.error }, 400) : json(result)
    } catch {
        return json({ error: "unavailable" }, 503)
    }
}
