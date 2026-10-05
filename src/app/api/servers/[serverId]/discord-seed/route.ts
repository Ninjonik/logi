import { discordSeedHandlers } from "@/lib/api/discord-seed-handlers"

export const runtime = "nodejs"
type Context = { params: Promise<{ serverId: string }> }

/** Seed page data: server tabs, plan, status and 30-day history (`?server=`). */
export async function GET(request: Request, context: Context) {
    return discordSeedHandlers.GET(request, await context.params)
}
