import { NextResponse } from "next/server"

import { autoLinkPlatformIdsFromEventImports } from "@/lib/server-match-results"
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags"
import { logNextError, logNextInfo } from "@/lib/system-logs"
import { getServerContext } from "@/lib/server-context"
import { handleIfNotLoggedIn } from "@/lib/auth"

export async function POST(
    request: Request,
    { params }: { params: Promise<{ serverId: string }> }
) {
    const { serverId } = await params
    await handleIfNotLoggedIn(`/dashboard/servers/${serverId}/users`)

    const context = await getServerContext(serverId)
    if (!context?.canAdmin) {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }

    try {
        const body = (await request.json()) as { clanTag?: string }
        const clanTag = String(body.clanTag ?? "").trim()

        if (!clanTag) {
            return NextResponse.json(
                { error: "Clan tag is required." },
                { status: 400 }
            )
        }

        const sourceUrls = [
            ...new Set(
                context.events
                    .map((event) => event.eventResult?.sourceUrl?.trim())
                    .filter((value): value is string => Boolean(value))
            ),
        ]

        const result = await autoLinkPlatformIdsFromEventImports({
            serverId,
            clanTag,
            sourceUrls,
        })

        revalidateCacheEntries([
            appCacheTags.users(),
            ...result.linkedUserIds.map((userId) =>
                appCacheTags.player(userId)
            ),
        ])

        logNextInfo(
            "auto-link-platform-ids",
            "Auto-linked platform IDs from event imports",
            {
                serverId,
                userId: context.user.discordId,
                clanTag,
                linkedCount: result.linkedUserIds.length,
            }
        )
        return NextResponse.json(result)
    } catch (error) {
        logNextError(
            "auto-link-platform-ids",
            "Failed to auto-link platform IDs",
            { serverId, error }
        )
        return NextResponse.json(
            { error: "Unable to auto-link platform IDs." },
            { status: 500 }
        )
    }
}
