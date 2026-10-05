import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import {
    initializeDefaultHelperData,
    resetHelperData,
} from "@/lib/server-setup"
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags"
import { getUserSafeErrorMessage } from "@/lib/server-route-errors"
import { clanAdminWriteDenied } from "@/lib/api/clan-admin-route"
import { logNextError, logNextInfo } from "@/lib/system-logs"

const helperDataActionSchema = z.object({
    action: z.enum(["initialize", "reset"]),
})

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ serverId: string }> }
) {
    const { serverId } = await params
    // Resetting replaces the clan's groups and presets: clan admins only.
    const denied = await clanAdminWriteDenied(request, serverId)
    if (denied) return denied
    try {
        const body = helperDataActionSchema.parse(await request.json())

        if (body.action === "initialize") {
            await initializeDefaultHelperData(serverId)
        } else {
            await resetHelperData(serverId)
        }

        revalidateCacheEntries([
            appCacheTags.serverContext(serverId),
            appCacheTags.groups(serverId),
            appCacheTags.topicPresets(serverId),
            appCacheTags.squadPresets(serverId),
            appCacheTags.rosterImage(),
        ])

        logNextInfo("helper-data", "Updated helper data", {
            serverId,
            action: body.action,
        })
        return NextResponse.json({ ok: true })
    } catch (error) {
        logNextError("helper-data", "Failed to update helper data", { error })
        return NextResponse.json(
            {
                error: getUserSafeErrorMessage(
                    error,
                    "Unable to update helper data."
                ),
            },
            { status: 400 }
        )
    }
}
