import { discordSeedHandlers } from "@/lib/api/discord-seed-handlers"

export const runtime = "nodejs"
type Context = { params: Promise<{ serverId: string }> }

/** "Vytvořit roli Seed": a live Discord action; deliberately not part of `/api/v1`. */
export async function POST(request: Request, context: Context) {
    return discordSeedHandlers.ROLE(request, await context.params)
}
