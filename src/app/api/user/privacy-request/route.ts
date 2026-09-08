import { makeFunctionReference } from "convex/server"
import { fetchMutation } from "convex/nextjs"
import { NextResponse } from "next/server"

import { handleIfNotLoggedIn, getCurrentPlayer } from "@/lib/auth"
import { logNextError, logNextInfo } from "@/lib/system-logs"
import { getInternalAuthSecret } from "@/lib/env"

const privacyRequest = makeFunctionReference<"mutation">("privacy:request")

export async function POST(request: Request) {
    await handleIfNotLoggedIn("/dashboard/settings/user")
    const user = await getCurrentPlayer()
    if (!user)
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    const body = (await request.json()) as { type?: "export" | "erasure" }
    if (body.type !== "export" && body.type !== "erasure") {
        return NextResponse.json(
            { error: "Invalid request type." },
            { status: 400 }
        )
    }
    try {
        const result = await fetchMutation(privacyRequest, {
            secret: getInternalAuthSecret(),
            userId: user.id,
            discordId: user.discordId,
            userName: user.name,
            type: body.type,
        })
        logNextInfo("privacy", "Privacy request created", {
            userId: user.id,
            type: body.type,
        })
        return NextResponse.json({ ok: true, duplicate: result.duplicate })
    } catch (error) {
        logNextError("privacy", "Privacy request failed", {
            error,
            userId: user.id,
            type: body.type,
        })
        return NextResponse.json(
            { error: "Unable to create the privacy request." },
            { status: 500 }
        )
    }
}
