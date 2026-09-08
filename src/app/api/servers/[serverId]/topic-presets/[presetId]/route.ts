import { NextRequest, NextResponse } from "next/server"

import {
    getUserSafeErrorMessage,
    logRouteError,
} from "@/lib/server-route-errors"
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags"
import { topicPresetSchema } from "@/lib/validation/topic-preset"
import { saveTopicPreset } from "@/lib/server-topic-presets"

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ serverId: string; presetId: string }> }
) {
    try {
        const body = topicPresetSchema.parse(await request.json())
        const { serverId, presetId } = await params
        const updatedPresetId = await saveTopicPreset({
            serverId,
            presetId,
            ...body,
        })

        revalidateCacheEntries([
            appCacheTags.serverContext(serverId),
            appCacheTags.topicPresets(serverId),
            appCacheTags.topicPreset(updatedPresetId),
        ])

        return NextResponse.json({ presetId: updatedPresetId })
    } catch (error) {
        logRouteError("topicPresets.update", error)
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
