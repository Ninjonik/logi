import { NextResponse } from "next/server"

import {
    getVisibleGuildsForLoggedInUser,
    handleIfNotLoggedIn,
    updateCurrentPlayerProfile,
} from "@/lib/auth"
import { userSettingsPatchSchema } from "@/lib/validation/user-settings"
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags"
import { logNextError, logNextInfo } from "@/lib/system-logs"
import { isSameOrigin } from "@/lib/api/superadmin-route"
import { getSiteUrl } from "@/lib/env"

export async function POST(request: Request) {
    await handleIfNotLoggedIn("/dashboard/settings/user")
    if (!isSameOrigin(request, new URL(getSiteUrl()).origin)) {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }

    try {
        const parsed = userSettingsPatchSchema.safeParse(
            await request.json().catch(() => null)
        )
        if (!parsed.success) {
            return NextResponse.json(
                {
                    error:
                        parsed.error.issues[0]?.message ??
                        "Invalid user settings.",
                },
                { status: 400 }
            )
        }
        const body = parsed.data

        const defaultWorkspaceId = body.defaultWorkspaceId
        if (defaultWorkspaceId) {
            const visibleWorkspaces = await getVisibleGuildsForLoggedInUser()
            if (
                !visibleWorkspaces.some(
                    (workspace) => workspace.discordId === defaultWorkspaceId
                )
            ) {
                return NextResponse.json(
                    { error: "Choose a workspace you can access." },
                    { status: 400 }
                )
            }
        }

        const userId = await updateCurrentPlayerProfile({
            avatar: body.avatar,
            platformIds: body.platformIds,
            matchRecapNotificationsEnabled: body.matchRecapNotificationsEnabled,
            defaultWorkspaceId,
        })

        revalidateCacheEntries([
            appCacheTags.player(userId),
            appCacheTags.publicProfile(userId),
            appCacheTags.users(),
        ])

        logNextInfo("user-settings", "Saved user settings", { userId })
        return NextResponse.json({ ok: true })
    } catch (error) {
        const message =
            error instanceof Error &&
            error.message.includes("already linked to another player")
                ? "One of these platform IDs is already linked to another player."
                : "Unable to save user settings."
        logNextError("user-settings", "Failed to save user settings", { error })
        return NextResponse.json(
            { error: message },
            { status: message === "Unable to save user settings." ? 500 : 400 }
        )
    }
}
