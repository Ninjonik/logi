import { discordPanelsHandlers } from "@/lib/api/discord-panels-handlers"

export const runtime = "nodejs"
type Context = { params: Promise<{ serverId: string; connectionId: string }> }

/** A server's address, join code and encrypted password for its panels and join page. */
export async function PUT(request: Request, context: Context) {
    return discordPanelsHandlers.server(request, await context.params)
}
