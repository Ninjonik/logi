import { discordPanelsHandlers } from "@/lib/api/discord-panels-handlers"

export const runtime = "nodejs"
type Context = { params: Promise<{ serverId: string; panelId: string }> }

/** Odeslat do kanálu, Obnovit teď, Pozastavit/Spustit, Zkusit znovu, Odstranit zprávu; not part of `/api/v1`. */
export async function POST(request: Request, context: Context) {
    return discordPanelsHandlers.action(request, await context.params)
}
