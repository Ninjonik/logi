import { NextResponse } from "next/server"

import {
    getUserSafeErrorMessage,
    logRouteError,
} from "@/lib/server-route-errors"
import { isDashboardWriteOrigin } from "@/lib/api/dashboard-write-origin"
import { currentDashboardActor } from "@/lib/gateways/dashboard-actor"
import { generateConvexUploadUrl } from "@/lib/server-uploads"

/** An upload URL for file storage; signed-in dashboard users only. */
export async function POST(request: Request) {
    if (!isDashboardWriteOrigin(request) || !(await currentDashboardActor()))
        return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    try {
        const uploadUrl = await generateConvexUploadUrl()
        return NextResponse.json({ uploadUrl })
    } catch (error) {
        logRouteError("uploads.generate", error)
        return NextResponse.json(
            {
                error: getUserSafeErrorMessage(
                    error,
                    "Unable to prepare the upload."
                ),
            },
            { status: 400 }
        )
    }
}
