import { fetchMutation, fetchQuery } from "convex/nextjs"
import { NextRequest, NextResponse } from "next/server"
import { makeFunctionReference } from "convex/server"

import {
    createSsoSecret,
    hashSsoValue,
    isExactHttpsUrl,
    SSO_CODE_TTL_MS,
} from "@/lib/sso"
import { isLocale } from "@/i18n/config"
import { getSession } from "@/lib/auth"
import { getSiteUrl } from "@/lib/env"

const clientReference = makeFunctionReference<"query">("sso:getPublicClient")
const codeReference = makeFunctionReference<"mutation">("sso:createCode")

function fail(error: string) {
    return NextResponse.json(
        { error },
        { status: 400, headers: { "cache-control": "no-store" } }
    )
}

export async function GET(request: NextRequest) {
    const clientId = request.nextUrl.searchParams.get("client_id") ?? ""
    const redirectUri = request.nextUrl.searchParams.get("redirect_uri") ?? ""
    const state = request.nextUrl.searchParams.get("state") ?? ""
    const challenge = request.nextUrl.searchParams.get("code_challenge") ?? ""
    const method = request.nextUrl.searchParams.get("code_challenge_method")
    if (
        request.nextUrl.searchParams.get("response_type") !== "code" ||
        !clientId ||
        !isExactHttpsUrl(redirectUri) ||
        !challenge ||
        method !== "S256"
    )
        return fail("invalid_request")
    const client = (await fetchQuery(clientReference, { clientId })) as {
        redirectUris: string[]
        defaultLanguage: string
    } | null
    if (!client || !client.redirectUris.includes(redirectUri))
        return fail("invalid_client")
    const session = await getSession()
    if (!session) {
        const resume = `${request.nextUrl.pathname}${request.nextUrl.search}`
        const requestedLocale = request.nextUrl.searchParams
            .get("ui_locales")
            ?.split(/\s+/)
            .find(isLocale)
        const locale = requestedLocale ?? client.defaultLanguage
        return NextResponse.redirect(
            new URL(
                `/${locale}/login?redirectTo=${encodeURIComponent(resume)}`,
                getSiteUrl()
            )
        )
    }
    const code = createSsoSecret(32)
    await fetchMutation(codeReference, {
        clientId,
        redirectUri,
        userId: session.sub,
        codeHash: hashSsoValue(code),
        codeChallenge: challenge,
        codeChallengeMethod: method,
        expiresAt: Date.now() + SSO_CODE_TTL_MS,
    })
    const destination = new URL(redirectUri)
    destination.searchParams.set("code", code)
    if (state) destination.searchParams.set("state", state)
    return NextResponse.redirect(destination)
}
