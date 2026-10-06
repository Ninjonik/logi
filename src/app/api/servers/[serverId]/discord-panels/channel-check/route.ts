import { discordPanelsHandlers } from "@/lib/api/discord-panels-handlers"

export const runtime = "nodejs"
type Context = { params: Promise<{ serverId: string }> }

/** "Ověřit": the bot's permissions in a channel and whether @everyone can view it. */
export async function POST(request: Request, context: Context) {
    return discordPanelsHandlers.channelCheck(request, await context.params)
}
