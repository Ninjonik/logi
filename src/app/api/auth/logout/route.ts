import { NextRequest, NextResponse } from "next/server"

import { sanitizeLocalRedirect } from "@/lib/local-redirect"
import { clearSessionToken } from "@/lib/auth"
import { getSiteUrl } from "@/lib/env"

export async function GET(request: NextRequest) {
    await clearSessionToken()
    const redirectTo = sanitizeLocalRedirect(
        request.nextUrl.searchParams.get("redirectTo"),
        "/en/login"
    )
    return NextResponse.redirect(new URL(redirectTo, getSiteUrl()))
}
