import { buildSsoProfile, hashSsoValue } from "@/lib/sso"
import { NextRequest, NextResponse } from "next/server"
import { makeFunctionReference } from "convex/server"
import { fetchQuery } from "convex/nextjs"

const profileReference = makeFunctionReference<"query">("sso:getProfile")
export async function GET(request: NextRequest) {
    const token = request.headers
        .get("authorization")
        ?.match(/^Bearer (.+)$/i)?.[1]
    if (!token)
        return NextResponse.json({ error: "invalid_token" }, { status: 401 })
    const profile = (await fetchQuery(profileReference, {
        tokenHash: hashSsoValue(token),
        now: Date.now(),
    })) as {
        user: Record<string, unknown>
        membership: "member" | "guest"
        guildId: string
        clientId: string
    } | null
    if (!profile)
        return NextResponse.json({ error: "invalid_token" }, { status: 401 })
    return NextResponse.json(
        {
            sub: String(profile.user.discordId),
            guild_id: profile.guildId,
            ...buildSsoProfile(profile.user, profile.membership),
        },
        { headers: { "cache-control": "no-store" } }
    )
}
