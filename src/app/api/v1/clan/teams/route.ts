import {
    openTeamCursor,
    parseTeamCollectionQuery,
    sealTeamCursor,
    teamErrorResponse,
    type TeamCollectionQuery,
} from "@/lib/api/teams-route"
import {
    authenticateClanRequest,
    isAuthError,
} from "@/lib/api/authenticated-clan-route"
import { teamPageSchema, type TeamPage } from "@/domain/teams/team"
import { makeFunctionReference } from "convex/server"
import { getInternalAuthSecret } from "@/lib/env"
import { hashApiKey } from "@/lib/public-api"
import { fetchQuery } from "convex/nextjs"
export const runtime = "nodejs"

const listTeams = makeFunctionReference<
    "query",
    TeamCollectionQuery & { secret: string; keyHash: string; guildId: string },
    TeamPage | null
>("teamReads:list")

export async function GET(request: Request) {
    const auth = await authenticateClanRequest(request)
    if (isAuthError(auth)) {
        auth.headers.set("Cache-Control", "no-store")
        return auth
    }
    const headers = { ...auth.headers, "Cache-Control": "no-store" },
        input = parseTeamCollectionQuery(request)
    if (!input)
        return teamErrorResponse(
            "invalid_query",
            headers,
            "One supported game and bounded pagination are required."
        )
    const secret = getInternalAuthSecret(),
        binding = { secret, guildId: auth.guildId, gameId: input.gameId }
    // Only a cursor this route issued for the same workspace and game reaches Convex.
    const cursor =
        input.cursor === null ? null : openTeamCursor(binding, input.cursor)
    if (input.cursor !== null && cursor === null)
        return teamErrorResponse(
            "invalid_query",
            headers,
            "The cursor was not issued for this game."
        )
    try {
        const page = await fetchQuery(listTeams, {
            secret,
            keyHash: hashApiKey(auth.key),
            guildId: auth.guildId,
            ...input,
            cursor,
        })
        // null means Convex refused the key, workspace or game grant.
        if (!page) return teamErrorResponse("insufficient_scope", headers)
        const data = teamPageSchema.parse(page)
        return Response.json(
            {
                data: {
                    ...data,
                    nextCursor:
                        data.nextCursor === null
                            ? null
                            : sealTeamCursor(binding, data.nextCursor),
                },
            },
            { headers }
        )
    } catch {
        return teamErrorResponse("unavailable", headers)
    }
}
