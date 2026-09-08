import { NextRequest, NextResponse } from "next/server"
import { makeFunctionReference } from "convex/server"
import { fetchMutation } from "convex/nextjs"
import { z } from "zod"

import { getServerContext } from "@/lib/server-context"
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
    const body = adminAccessSchema.parse(await request.json())
    const context = await getServerContext(serverId)
    if (!context?.canAdmin) {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }

    await fetchMutation(setPlayerAdminAccessInternalReference, {
        secret: getInternalAuthSecret(),
        serverId: serverId as never,
        playerId: body.playerId,
        isAdmin: body.isAdmin,
    })
    return NextResponse.json({ isAdmin: body.isAdmin })
}
