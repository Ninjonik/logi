import { NextResponse } from "next/server"
import { z } from "zod"

import {
    handleIfNotLoggedIn,
    markCurrentPlayerOnboardingSeen,
} from "@/lib/auth"

const onboardingSchema = z.object({
    milestone: z.enum(["dashboard_setup", "workspace_tour"]),
    workspaceId: z.string().trim().min(1).optional(),
})

export async function POST(request: Request) {
    await handleIfNotLoggedIn("/dashboard")

    try {
        const body = onboardingSchema.parse(await request.json())
        if (body.milestone === "workspace_tour" && !body.workspaceId) {
            return NextResponse.json(
                { error: "A workspace is required for this tour." },
                { status: 400 }
            )
        }

        await markCurrentPlayerOnboardingSeen(body)
        return NextResponse.json({ ok: true })
    } catch {
        return NextResponse.json(
            { error: "Unable to save onboarding progress." },
            { status: 400 }
        )
    }
}
