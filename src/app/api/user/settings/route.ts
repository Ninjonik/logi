import { NextResponse } from "next/server"

import {
    getVisibleGuildsForLoggedInUser,
    handleIfNotLoggedIn,
    updateCurrentPlayerProfile,
} from "@/lib/auth"
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags"
import { logNextError, logNextInfo } from "@/lib/system-logs"

export async function POST(request: Request) {
    await handleIfNotLoggedIn("/dashboard/settings/user")

    try {
        const body = (await request.json()) as {
            avatar?: string
            platformIds?: string
            matchRecapNotificationsEnabled?: boolean
            defaultWorkspaceId?: string
        }

        if (!body.avatar?.trim()) {
            return NextResponse.json(
                { error: "Avatar is required." },
                { status: 400 }
            )
        }

        const defaultWorkspaceId = body.defaultWorkspaceId?.trim()
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
