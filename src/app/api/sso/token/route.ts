import { NextRequest, NextResponse } from "next/server"
import { makeFunctionReference } from "convex/server"
import { fetchMutation } from "convex/nextjs"
import { SignJWT } from "jose"

import {
    createSsoSecret,
    hashSsoValue,
    SSO_ACCESS_TOKEN_TTL_MS,
    verifyPkceS256,
} from "@/lib/sso"
import { getSiteUrl } from "@/lib/env"

const redeemReference = makeFunctionReference<"mutation">("sso:redeemCode")
const tokenReference = makeFunctionReference<"mutation">(
    "sso:createAccessToken"
)

export async function POST(request: NextRequest) {
    const form = await request.formData()
    const clientId = String(form.get("client_id") ?? "")
    const clientSecret = String(form.get("client_secret") ?? "")
    const code = String(form.get("code") ?? "")
    const redirectUri = String(form.get("redirect_uri") ?? "")
    const verifier = String(form.get("code_verifier") ?? "")
    if (
        form.get("grant_type") !== "authorization_code" ||
        !clientId ||
        !clientSecret ||
        !code ||
        !redirectUri ||
        !verifier
    )
        return NextResponse.json({ error: "invalid_request" }, { status: 400 })
    const redeemed = (await fetchMutation(redeemReference, {
        clientId,
        clientSecretHash: hashSsoValue(clientSecret),
        codeHash: hashSsoValue(code),
        redirectUri,
        now: Date.now(),
    })) as {
        userId: string
        codeChallenge: string
        codeChallengeMethod: string
        guildId: string
    } | null
    if (
        !redeemed ||
        redeemed.codeChallengeMethod !== "S256" ||
        !verifyPkceS256(verifier, redeemed.codeChallenge)
    )
        return NextResponse.json({ error: "invalid_grant" }, { status: 400 })
    const accessToken = createSsoSecret(32)
    const expiresAt = Date.now() + SSO_ACCESS_TOKEN_TTL_MS
    await fetchMutation(tokenReference, {
        tokenHash: hashSsoValue(accessToken),
        clientId,
        userId: redeemed.userId,
        expiresAt,
    })
    const idToken = await new SignJWT({ guild_id: redeemed.guildId })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setIssuer(getSiteUrl())
        .setAudience(clientId)
        .setSubject(redeemed.userId)
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(new TextEncoder().encode(clientSecret))
    return NextResponse.json(
        {
            access_token: accessToken,
            token_type: "Bearer",
            expires_in: Math.floor(SSO_ACCESS_TOKEN_TTL_MS / 1000),
            id_token: idToken,
        },
        { headers: { "cache-control": "no-store" } }
    )
}
