import { getMembershipObservation } from "@/lib/server-member-observations"
import type { AuthenticatedClanRequest } from "./authenticated-clan-route"
import { parseMembershipQuery } from "./membership-query"
import { NextResponse } from "next/server"
export async function handleMembershipRead(
    request: Request,
    auth: AuthenticatedClanRequest
) {
    const headers = { ...auth.headers, "Cache-Control": "no-store" }
    const error = (code: string, status: number) =>
        NextResponse.json(
            {
                error: {
                    code,
                    message: "Membership lookup unavailable or not permitted.",
                },
            },
            { status, headers }
        )
    const input = parseMembershipQuery(request)
    if (!input) return error("invalid_query", 400)
    try {
        const data = await getMembershipObservation(
            auth.key,
            {
                guildId: auth.guildId,
                gameId: input.gameId,
                discordUserId: input.discordUserId,
            },
            input.maxAgeMs
        )
        return data
            ? NextResponse.json({ data }, { headers })
            : error("insufficient_scope", 403)
    } catch {
        return error("membership_unavailable", 503)
    }
}
