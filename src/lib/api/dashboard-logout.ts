import { sanitizeLocalRedirect } from "../local-redirect"

const headers = {
    "cache-control": "no-store",
    "referrer-policy": "no-referrer",
}

/** Logout changes durable sessions, so link navigation must never invoke it. */
export async function dashboardLogout(
    request: Request,
    ports: { issuer(): string; revoke(allSessions: boolean): Promise<void> }
) {
    if (request.method !== "POST")
        return Response.json(
            { error: "Method not allowed." },
            { status: 405, headers: { ...headers, allow: "POST" } }
        )
    try {
        const issuer = new URL(ports.issuer()).origin
        if (request.headers.get("origin") !== issuer)
            return Response.json(
                { error: "Invalid request origin." },
                { status: 403, headers }
            )
        const url = new URL(request.url)
        await ports.revoke(url.searchParams.get("global") === "true")
        const redirectTo = sanitizeLocalRedirect(
            url.searchParams.get("redirectTo"),
            "/en/login"
        )
        return new Response(null, {
            status: 303,
            headers: { ...headers, location: new URL(redirectTo, issuer).href },
        })
    } catch {
        return Response.json(
            { error: "Logout persistence unavailable. Please retry." },
            { status: 503, headers }
        )
    }
}
