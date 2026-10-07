import { discordPanelsHandlers } from "@/lib/api/discord-panels-handlers"

export const runtime = "nodejs"
type Context = { params: Promise<{ serverId: string }> }

/** The WD League messages' current data for the editor preview (`?count=` fixtures). */
export async function GET(request: Request, context: Context) {
    return discordPanelsHandlers.leaguePreview(request, await context.params)
}
