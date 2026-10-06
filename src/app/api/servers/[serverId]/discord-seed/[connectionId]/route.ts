import { discordSeedHandlers } from "@/lib/api/discord-seed-handlers"

export const runtime = "nodejs"
type Context = { params: Promise<{ serverId: string; connectionId: string }> }

/** Saves one server's seed plan and control channel after checking them in Discord. */
export async function PUT(request: Request, context: Context) {
    return discordSeedHandlers.PUT(request, await context.params)
}

/** Live actions "Seed teď" and "Ukončit seed"; deliberately not part of `/api/v1`. */
export async function POST(request: Request, context: Context) {
    return discordSeedHandlers.POST(request, await context.params)
}
