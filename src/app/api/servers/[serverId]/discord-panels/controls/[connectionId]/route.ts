import { discordPanelsHandlers } from "@/lib/api/discord-panels-handlers"

export const runtime = "nodejs"
type Context = { params: Promise<{ serverId: string; connectionId: string }> }

/** "Obnovit teď" of a server's "Ovládání serveru" message. */
export async function POST(request: Request, context: Context) {
    return discordPanelsHandlers.control(request, await context.params)
}
