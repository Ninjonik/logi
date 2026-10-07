import { makeFunctionReference } from "convex/server"
import { fetchMutation } from "convex/nextjs"
import { NextResponse } from "next/server"
import { z } from "zod"

import { handleIfNotLoggedIn, getCurrentPlayer } from "@/lib/auth"
import { logNextError, logNextInfo } from "@/lib/system-logs"
import { getInternalAuthSecret, getSiteUrl } from "@/lib/env"
import { isSameOrigin } from "@/lib/api/superadmin-route"

const privacyRequest = makeFunctionReference<"mutation">("privacy:request")
const privacyRequestSchema = z.strictObject({
    type: z.enum(["export", "erasure"]),
})

export async function POST(request: Request) {
    await handleIfNotLoggedIn("/dashboard/settings/user")
    if (!isSameOrigin(request, new URL(getSiteUrl()).origin)) {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }
    const user = await getCurrentPlayer()
    if (!user)
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    const parsed = privacyRequestSchema.safeParse(
        await request.json().catch(() => null)
    )
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid request type." },
            { status: 400 }
        )
    }
    const body = parsed.data
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
