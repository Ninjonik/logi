import { NextRequest, NextResponse } from "next/server"

import {
    getUserSafeErrorMessage,
    logRouteError,
} from "@/lib/server-route-errors"
import { deleteSquadPreset, saveSquadPreset } from "@/lib/server-squad-presets"
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags"
import { squadPresetSchema } from "@/lib/validation/squad-preset"
import { clanAdminWriteDenied } from "@/lib/api/clan-admin-route"

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ serverId: string; presetId: string }> }
) {
    const denied = await clanAdminWriteDenied(request, (await params).serverId)
    if (denied) return denied
    try {
        const body = squadPresetSchema.parse(await request.json())
        const { serverId, presetId } = await params
        const updatedPresetId = await saveSquadPreset({
            serverId,
            presetId,
            ...body,
        })

        revalidateCacheEntries([
            appCacheTags.serverContext(serverId),
            appCacheTags.squadPresets(serverId),
            appCacheTags.squadPreset(updatedPresetId),
        ])

        return NextResponse.json({ presetId: updatedPresetId })
    } catch (error) {
        logRouteError("squadPresets.update", error)
        return NextResponse.json(
            {
                error: getUserSafeErrorMessage(
                    error,
                    "Unable to save the squad preset."
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
        const result = await deleteSquadPreset({ serverId, presetId })
        if (!result.ok) {
            return NextResponse.json(result, {
                status: result.error === "not_found" ? 404 : 409,
            })
        }

        revalidateCacheEntries([
            appCacheTags.serverContext(serverId),
            appCacheTags.squadPresets(serverId),
            appCacheTags.squadPreset(presetId),
        ])

        return NextResponse.json({ ok: true })
    } catch (error) {
        logRouteError("squadPresets.delete", error)
        return NextResponse.json(
            {
                error: getUserSafeErrorMessage(
                    error,
                    "Unable to delete the squad preset."
                ),
            },
            { status: 400 }
        )
    }
}
