import { GAME_IDS, type GameId } from "@/domain/games/game"
import { readBoundedJson } from "./request-json"
import { z } from "zod"

const MAX_BYTES = 1024
const enabledGamesSchema = z.strictObject({
    enabledGames: z.array(z.enum(GAME_IDS)).max(GAME_IDS.length),
})

export type WorkspaceAdminActionPorts = {
    /** The dashboard's public origin; writes from any other origin are refused. */
    origin: string
    /** Discord ID of the signed-in administrator of this workspace, or null. */
    authorize(serverId: string): Promise<string | null>
    setEnabledGames(
        serverId: string,
        userId: string,
        enabledGames: GameId[]
    ): Promise<void>
    resyncDashboardAdmins(serverId: string, userId: string): Promise<void>
    revalidate(serverId: string): void
}

const json = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: { "Cache-Control": "no-store" } })

/**
 * Workspace administration writes that used to run from the browser directly
 * against Convex with a caller-supplied user ID. The acting administrator now
 * comes from the dashboard session, never from the request body.
 */
export function workspaceAdminActions(ports: WorkspaceAdminActionPorts) {
    async function actor(request: Request, serverId: string) {
        if (request.headers.get("origin") !== ports.origin) return null
        return await ports.authorize(serverId)
    }
    return {
        async setEnabledGames(request: Request, serverId: string) {
            const userId = await actor(request, serverId)
            if (!userId) return json({ error: "Forbidden." }, 403)
            const parsed = enabledGamesSchema.safeParse(
                await readBoundedJson(request, MAX_BYTES).catch(() => null)
            )
            if (!parsed.success)
                return json({ error: "Invalid enabled games." }, 400)
            await ports.setEnabledGames(serverId, userId, [
                ...new Set(parsed.data.enabledGames),
            ])
            ports.revalidate(serverId)
            return json({ ok: true })
        },
        async resyncDashboardAdmins(request: Request, serverId: string) {
            const userId = await actor(request, serverId)
            if (!userId) return json({ error: "Forbidden." }, 403)
            await ports.resyncDashboardAdmins(serverId, userId)
            ports.revalidate(serverId)
            return json({ ok: true })
        },
    }
}
