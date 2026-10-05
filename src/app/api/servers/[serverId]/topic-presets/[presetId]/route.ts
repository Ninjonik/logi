import { NextRequest, NextResponse } from "next/server"

import {
    getUserSafeErrorMessage,
    logRouteError,
} from "@/lib/server-route-errors"
import { deleteTopicPreset, saveTopicPreset } from "@/lib/server-topic-presets"
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags"
import { topicPresetSchema } from "@/lib/validation/topic-preset"
import { clanAdminWriteDenied } from "@/lib/api/clan-admin-route"

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ serverId: string; presetId: string }> }
) {
    const denied = await clanAdminWriteDenied(request, (await params).serverId)
    if (denied) return denied
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

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ serverId: string; presetId: string }> }
) {
    const { serverId, presetId } = await params
    const denied = await clanAdminWriteDenied(request, serverId)
    if (denied) return denied
    try {
        const result = await deleteTopicPreset({ serverId, presetId })
        if (!result.ok) {
            return NextResponse.json(result, {
                status: result.error === "not_found" ? 404 : 409,
            })
        }

        revalidateCacheEntries([
            appCacheTags.serverContext(serverId),
            appCacheTags.topicPresets(serverId),
            appCacheTags.topicPreset(presetId),
        ])

        return NextResponse.json({ ok: true })
    } catch (error) {
        logRouteError("topicPresets.delete", error)
        return NextResponse.json(
            {
                error: getUserSafeErrorMessage(
                    error,
                    "Unable to delete the topic preset."
                ),
            },
            { status: 400 }
        )
    }
}
