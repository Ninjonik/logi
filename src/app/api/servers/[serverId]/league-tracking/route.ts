import { trackingSettingsSchema } from "@/domain/wardogs-league/discovery.schema"
import { verifyPublicChannel } from "@/lib/gateways/discord-public-channel"
import { getServerContextUncached } from "@/lib/read-models/server-context"
import { currentDashboardActor } from "@/lib/gateways/dashboard-actor"
import { getInternalAuthSecret, getSiteUrl } from "@/lib/env"
import { fetchMutation, fetchQuery } from "convex/nextjs"
import { readBoundedJson } from "@/lib/api/request-json"
import { makeFunctionReference } from "convex/server"
import { z } from "zod"
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
                makeFunctionReference<"query">("leagueDiscovery:list"),
                args
            )
        )
    } catch {
        return json({ error: "Tracking unavailable." }, 503)
    }
}
const command = z.discriminatedUnion("operation", [
    z
        .object({
            operation: z.literal("configure"),
            settings: trackingSettingsSchema,
        })
        .strict(),
    z
        .object({
            operation: z.enum(["add", "pause", "resume", "ignore", "link"]),
            sourceUrl: z.string().max(250),
            eventId: z.string().max(100).optional(),
        })
        .strict(),
])
export async function POST(request: Request, context: Context) {
    const args = await access(context)
    if (
        !args ||
        (request.headers.get("origin") &&
            request.headers.get("origin") !== new URL(getSiteUrl()).origin)
    )
        return json({ error: "Forbidden." }, 403)
    try {
        const input = command.parse(await readBoundedJson(request, 4096))
        if (input.operation === "configure") {
            const ids = [
                ...new Set(
                    [
                        input.settings.inputChannelId,
                        input.settings.outputChannelId,
                    ].filter((id): id is string => id !== null)
                ),
            ]
            const verifiedChannels = input.settings.enabled
                ? await Promise.all(
                      ids.map((id) => verifyPublicChannel(args.guildId, id))
                  )
                : []
            return json(
                await fetchMutation(
                    makeFunctionReference<"mutation">(
                        "leagueDiscovery:configure"
                    ),
                    { ...args, settings: input.settings, verifiedChannels }
                )
            )
        }
        return json(
            await fetchMutation(
                makeFunctionReference<"mutation">("leagueDiscovery:manage"),
                { ...args, ...input }
            )
        )
    } catch {
        return json(
            {
                error: "Unable to save. Check the URL, channel access, event and current admin permissions.",
            },
            400
        )
    }
}
