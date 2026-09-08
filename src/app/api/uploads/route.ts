import { NextResponse } from "next/server"

import {
    getUserSafeErrorMessage,
    logRouteError,
} from "@/lib/server-route-errors"
import { generateConvexUploadUrl } from "@/lib/server-uploads"

export async function POST() {
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
