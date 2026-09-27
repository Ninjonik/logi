import { NextResponse } from "next/server"
import { getSiteUrl } from "@/lib/env"
export function GET() {
    const issuer = getSiteUrl()
    return NextResponse.json({
        issuer,
        authorization_endpoint: `${issuer}/api/sso/authorize`,
        token_endpoint: `${issuer}/api/sso/token`,
        userinfo_endpoint: `${issuer}/api/sso/userinfo`,
        response_types_supported: ["code"],
        grant_types_supported: ["authorization_code"],
        code_challenge_methods_supported: ["S256"],
        token_endpoint_auth_methods_supported: ["client_secret_post"],
        id_token_signing_alg_values_supported: ["HS256"],
    })
}
