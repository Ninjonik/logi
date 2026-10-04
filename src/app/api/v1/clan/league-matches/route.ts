import {
    authenticateClanRequest,
    isAuthError,
} from "@/lib/api/authenticated-clan-route"
import { leagueMatchResponse } from "@/lib/api/league-match-route"
import { getLeagueMatch } from "@/lib/server-league-matches"
export const runtime = "nodejs"
export async function GET(request: Request) {
    const auth = await authenticateClanRequest(request)
    if (isAuthError(auth)) {
        auth.headers.set("Cache-Control", "no-store")
        return auth
    }
    return leagueMatchResponse(
        request,
        (url) => getLeagueMatch(auth.guildId, url, auth.key),
        auth.headers
    )
}
