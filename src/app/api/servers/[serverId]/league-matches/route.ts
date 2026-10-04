import { getServerContextUncached } from "@/lib/read-models/server-context"
import { leagueMatchResponse } from "@/lib/api/league-match-route"
import { getLeagueMatch } from "@/lib/server-league-matches"
export const runtime = "nodejs"
export async function GET(
    request: Request,
    context: { params: Promise<{ serverId: string }> }
) {
    const { serverId } = await context.params
    const access = await getServerContextUncached(serverId)
    if (!access?.canAdmin)
        return Response.json(
            { error: "Forbidden." },
            { status: 403, headers: { "Cache-Control": "no-store" } }
        )
    return leagueMatchResponse(request, (url) =>
        getLeagueMatch(access.server.discordId, url)
    )
}
