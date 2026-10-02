import { getSsoProvider } from "@/lib/gateways/sso-provider"
import { ssoError, ssoHeaders } from "@/lib/api/sso-routes"
import { clearSessionToken } from "@/lib/auth"
import { getSiteUrl } from "@/lib/env"
// Same-origin Logi UI operation, not an OIDC RP-initiated logout endpoint.
export async function POST(request: Request) {
    try {
        await getSsoProvider()
    } catch {
        return ssoError("temporarily_unavailable", 503)
    }
    if (request.headers.get("origin") !== new URL(getSiteUrl()).origin)
        return ssoError("invalid_request", 403)
    try {
        await clearSessionToken(true)
        return Response.json({ ok: true }, { headers: ssoHeaders })
    } catch {
        return ssoError("temporarily_unavailable", 503)
    }
}
