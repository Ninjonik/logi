import { NextRequest, NextResponse } from "next/server"

import {
    getUserSafeErrorMessage,
    logRouteError,
} from "@/lib/server-route-errors"
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags"
import { topicPresetSchema } from "@/lib/validation/topic-preset"
import { clanAdminWriteDenied } from "@/lib/api/clan-admin-route"
import { saveTopicPreset } from "@/lib/server-topic-presets"

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ serverId: string }> }
) {
    const denied = await clanAdminWriteDenied(request, (await params).serverId)
    if (denied) return denied
    try {
        const body = topicPresetSchema.parse(await request.json())
        const { serverId } = await params
        const presetId = await saveTopicPreset({
            serverId,
            ...body,
        })

        revalidateCacheEntries([
            appCacheTags.serverContext(serverId),
            appCacheTags.topicPresets(serverId),
            appCacheTags.topicPreset(presetId),
        ])

        return NextResponse.json({ presetId })
    } catch (error) {
        logRouteError("topicPresets.create", error)
        return NextResponse.json(
            {
                error: getUserSafeErrorMessage(
                    error,
                    "Unable to save the topic preset."
                ),
            },
            { status: 400 }
        )
    }
}
