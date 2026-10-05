import { discordPanelsHandlers } from "@/lib/api/discord-panels-handlers"

export const runtime = "nodejs"
type Context = { params: Promise<{ serverId: string }> }

/** "Načíst data ze serveru": the bot's live read with the rendered preview. */
export async function POST(request: Request, context: Context) {
    return discordPanelsHandlers.testFetch(request, await context.params)
}
