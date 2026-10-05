import { discordPanelsHandlers } from "@/lib/api/discord-panels-handlers"

export const runtime = "nodejs"
type Context = { params: Promise<{ serverId: string }> }

/** "Panely v Discordu": every panel with its state, timing and last error, the bot heartbeat and sources. */
export async function GET(request: Request, context: Context) {
    return discordPanelsHandlers.GET(request, await context.params)
}

/** Saves one panel; `send: true` also sends it ("Odeslat do kanálu"). */
export async function POST(request: Request, context: Context) {
    return discordPanelsHandlers.POST(request, await context.params)
}
