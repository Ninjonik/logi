import "server-only"

import { redirect } from "next/navigation"
import { headers } from "next/headers"

import { sanitizeLocalRedirect } from "@/lib/local-redirect"
import { loginPath } from "@/lib/login-redirect"

/** Preserve the URL even when a stale cookie passes the proxy's quick check. */
export async function redirectToPageLogin(fallback: string): Promise<never> {
    const destination = sanitizeLocalRedirect(
        (await headers()).get("x-logi-request-path"),
        fallback
    )
    redirect(loginPath(destination))
}
