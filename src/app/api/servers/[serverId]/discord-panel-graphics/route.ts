import {
    panelGraphicsHandlers,
    panelGraphicsUpdateResultSchema,
} from "@/lib/api/panel-graphics-route"
import type { DashboardActor } from "../../../../../../convex/dashboardActor"
import { getServerContextUncached } from "@/lib/read-models/server-context"
import { currentDashboardActor } from "@/lib/gateways/dashboard-actor"
import { getInternalAuthSecret, getSiteUrl } from "@/lib/env"
import { fetchMutation, fetchQuery } from "convex/nextjs"
import { makeFunctionReference } from "convex/server"

export const runtime = "nodejs"
type Context = { params: Promise<{ serverId: string }> }
type Access = { secret: string; guildId: string; actor: DashboardActor }

const handlers = panelGraphicsHandlers<Access>({
    origin: new URL(getSiteUrl()).origin,
    access: async (serverId) => {
        const [server, actor] = await Promise.all([
            getServerContextUncached(serverId),
            currentDashboardActor(),
        ])
        return server?.canAdmin && actor
            ? {
                  secret: getInternalAuthSecret(),
                  guildId: server.server.discordId,
                  actor,
              }
            : null
    },
    read: (access) =>
        fetchQuery(
            makeFunctionReference<"query">("discordPanelGraphics:get"),
            access
        ),
    // Convex re-authorizes the actor and verifies every server and asset.
    update: async (access, patch) =>
        panelGraphicsUpdateResultSchema.parse(
            await fetchMutation(
                makeFunctionReference<"mutation">(
                    "discordPanelGraphics:update"
                ),
                { ...access, patch }
            )
        ),
})

/** "Grafika panelů": default style, server banners, map images, emoji status. */
export async function GET(request: Request, context: Context) {
    return handlers.GET(request, (await context.params).serverId)
}

/** Applies a partial graphics change for a current clan admin. */
export async function PATCH(request: Request, context: Context) {
    return handlers.PATCH(request, (await context.params).serverId)
}
