import { getServerContextUncached } from "@/lib/read-models/server-context"
import { currentDashboardActor } from "@/lib/gateways/dashboard-actor"
import { makeFunctionReference } from "convex/server"
import { getInternalAuthSecret } from "@/lib/env"
import { fetchQuery } from "convex/nextjs"
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
/**
 * The saved panels in the old summary shape, still read by "Zprávy a panely"
 * for its live score and results rows. Panels are edited on "Panely v
 * Discordu" (`/api/servers/{serverId}/discord-panels`); the old form's save
 * (`POST`) is gone with the form, so every save goes through the editor's
 * rules.
 */
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
