import { NextRequest, NextResponse } from "next/server"
import { makeFunctionReference } from "convex/server"
import { fetchMutation } from "convex/nextjs"
import { z } from "zod"

import { getServerContextUncached } from "@/lib/read-models/server-context"
import { isDashboardWriteOrigin } from "@/lib/api/dashboard-write-origin"
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags"
import { readBoundedJson } from "@/lib/api/request-json"
import { getInternalAuthSecret } from "@/lib/env"

const setPlayerAdminAccessInternalReference = makeFunctionReference<"mutation">(
    "guilds:setPlayerAdminAccessInternal"
)
const adminAccessSchema = z.object({
    playerId: z.string().min(1),
    isAdmin: z.boolean(),
})

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ serverId: string }> }
) {
    const { serverId } = await params
    // Granting dashboard admin access is accepted only from the dashboard.
    if (!isDashboardWriteOrigin(request)) {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }
    const parsed = adminAccessSchema.safeParse(
        await readBoundedJson(request, 1024)
    )
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid admin access change." },
            { status: 400 }
        )
    }
    const body = parsed.data
    const context = await getServerContextUncached(serverId)
    if (!context?.canAdmin) {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }

    await fetchMutation(setPlayerAdminAccessInternalReference, {
        secret: getInternalAuthSecret(),
        serverId: serverId as never,
        playerId: body.playerId,
        isAdmin: body.isAdmin,
    })
    revalidateCacheEntries([
        appCacheTags.serverContext(serverId),
        appCacheTags.player(body.playerId),
    ])
    return NextResponse.json({ isAdmin: body.isAdmin })
}
