import { discordPanelsHandlers } from "@/lib/api/discord-panels-handlers"

export const runtime = "nodejs"
type Context = { params: Promise<{ serverId: string }> }

/** The editor preview's style A score image or style B banner as PNG. */
export async function POST(request: Request, context: Context) {
    return discordPanelsHandlers.previewImage(request, await context.params)
}
