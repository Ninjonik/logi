import { NextResponse } from "next/server"

import { clearSessionToken, getSession } from "@/lib/auth"
import { revokeSsoTokensForUser } from "@/lib/sso-server"

export async function POST() {
    const session = await getSession()
    if (session) await revokeSsoTokensForUser(session.sub)
    await clearSessionToken()
    return NextResponse.json(
        { ok: true },
        { headers: { "cache-control": "no-store" } }
    )
}
