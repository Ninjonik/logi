import { NextRequest, NextResponse } from "next/server"

import { sanitizeLocalRedirect } from "@/lib/local-redirect"
import { clearSessionToken, getSession } from "@/lib/auth"
import { revokeSsoTokensForUser } from "@/lib/sso-server"
import { getSiteUrl } from "@/lib/env"

export async function GET(request: NextRequest) {
    const session = await getSession()
    if (session && request.nextUrl.searchParams.get("global") === "true") {
        await revokeSsoTokensForUser(session.sub)
    }
    await clearSessionToken()
    const redirectTo = sanitizeLocalRedirect(
        request.nextUrl.searchParams.get("redirectTo"),
        "/en/login"
    )
    return NextResponse.redirect(new URL(redirectTo, getSiteUrl()))
}
