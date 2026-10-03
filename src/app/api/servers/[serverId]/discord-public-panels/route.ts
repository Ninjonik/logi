import { publicPanelSettingsSchema } from "@/domain/discord-publications/settings"
import { verifyPublicChannel } from "@/lib/gateways/discord-public-channel"
import { getServerContextUncached } from "@/lib/read-models/server-context"
import { currentDashboardActor } from "@/lib/gateways/dashboard-actor"
import { fetchMutation, fetchQuery } from "convex/nextjs"
import { readBoundedJson } from "@/lib/api/request-json"
import { makeFunctionReference } from "convex/server"
import { getInternalAuthSecret } from "@/lib/env"
type Context = { params: Promise<{ serverId: string }> }
const json = (value: unknown, status = 200) =>
    Response.json(value, { status, headers: { "Cache-Control": "no-store" } })
async function access(context: Context) {
    const server = await getServerContextUncached(
        (await context.params).serverId
    )
    const actor = await currentDashboardActor()
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
                makeFunctionReference<"query">("discordPublicPanels:list"),
                args
            )
        )
    } catch {
        return json({ error: "Panel settings unavailable." }, 503)
    }
}
export async function POST(request: Request, context: Context) {
    const args = await access(context)
    if (
        !args ||
        (request.headers.get("origin") &&
            request.headers.get("origin") !== new URL(request.url).origin)
    )
        return json({ error: "Forbidden." }, 403)
    try {
        const settings = publicPanelSettingsSchema.parse(
            await readBoundedJson(request, 4096)
        )
        const verifying =
            new URL(request.url).searchParams.get("verify") === "1"
        const verifiedChannel =
            settings.enabled || verifying
                ? await verifyPublicChannel(args.guildId, settings.channelId)
                : {
                      id: settings.channelId,
                      guildId: args.guildId,
                      type: 0,
                      canPublish: false,
                  }
        if ((settings.enabled || verifying) && !verifiedChannel.canPublish)
            return json(
                {
                    error: "Bot needs View Channel, Read Message History, Send Messages, Embed Links and Attach Files.",
                },
                400
            )
        if (new URL(request.url).searchParams.get("verify") === "1")
            return json({ ok: true })
        const id = await fetchMutation(
            makeFunctionReference<"mutation">("discordPublicPanels:configure"),
            { ...args, settings, verifiedChannel }
        )
        return json({ ok: true, id })
    } catch {
        return json(
            {
                error: "Unable to save. Verify the source, channel and current admin access.",
            },
            400
        )
    }
}
