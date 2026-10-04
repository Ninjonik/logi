import { configureSsoSigning } from "../../infrastructure/identity/sso-signing"
import { generateKeyPair, exportJWK, createLocalJWKSet, jwtVerify } from "jose"
import { ssoRoutes, type SsoRoutePorts } from "./sso-routes"
import { createSsoSecret, hashSsoValue } from "../sso"
import assert from "node:assert/strict"
import { test } from "node:test"

const origin = "https://provider.invalid",
    callback = "https://consumer.invalid/callback"
const subject = "123456789012345678",
    sid = "s".repeat(43)
const profile = {
    sub: subject,
    sid,
    guild_id: "guilds:test",
    name: "Test Member",
    picture: "https://images.invalid/avatar",
}
const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
    challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
const signing = generateKeyPair("RS256", { extractable: true }).then(
    async ({ privateKey }) =>
        configureSsoSigning({
            issuer: origin,
            privateJwk: JSON.stringify({
                ...(await exportJWK(privateKey)),
                kid: "fixture-key",
            }),
            allowLoopbackHttp: false,
        })
)
function fixture() {
    const issued: unknown[] = []
    const redeemed: unknown[] = []
    const ports: SsoRoutePorts = {
        provider: () => signing,
        client: async () => ({
            redirectUris: [callback],
            defaultLanguage: "en",
        }),
        session: async () => ({
            sub: subject,
            sid,
            userRecordId: "users:fixture",
            name: profile.name,
            avatar: profile.picture,
        }),
        createCode: async (input) => {
            issued.push(input)
        },
        redeem: async (input) => {
            redeemed.push(input)
            return {
                ...profile,
                nonce: "opaque-nonce",
                scope: "openid profile",
                issuedAt: Date.now(),
                expiresAt: Date.now() + 3600000,
            }
        },
        profile: async () => profile,
        hash: hashSsoValue,
        random: createSsoSecret,
    }
    const params = new URLSearchParams({
        client_id: "client",
        redirect_uri: callback,
        response_type: "code",
        scope: "openid profile",
        code_challenge: challenge,
        code_challenge_method: "S256",
        state: "opaque-state",
        nonce: "opaque-nonce",
    })
    const form = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: "client",
        client_secret: "client-secret",
        code: "c".repeat(43),
        redirect_uri: callback,
        code_verifier: verifier,
    })
    return {
        ports,
        issued,
        redeemed,
        params,
        form,
        http: ssoRoutes(ports),
        auth: () => new Request(`${origin}/api/sso/authorize?${params}`),
        token: () =>
            new Request(`${origin}/api/sso/token`, {
                method: "POST",
                body: form,
            }),
    }
}
test("authorization binds nonce and S256 proof and echoes opaque RP state", async () => {
    const f = fixture(),
        result = await f.http.authorize(f.auth())
    assert.equal(result.status, 302)
    const destination = new URL(result.headers.get("location")!)
    assert.equal(destination.origin, new URL(callback).origin)
    assert.equal(destination.searchParams.get("state"), "opaque-state")
    const issued = f.issued[0] as {
        nonce: string
        sid: string
        codeChallenge: string
    }
    assert.equal(issued.nonce, "opaque-nonce")
    assert.equal(issued.sid, sid)
    assert.equal(issued.codeChallenge, challenge)
    assert.equal(result.headers.get("cache-control"), "no-store")
})
test("unauthenticated authorization starts Discord login with exact resume parameters", async () => {
    const f = fixture()
    f.ports.session = async () => null
    const result = await f.http.authorize(f.auth())
    assert.equal(result.status, 302)
    const login = new URL(result.headers.get("location")!)
    assert.equal(login.origin, origin)
    assert.equal(login.pathname, "/api/auth/discord")
    assert.equal(
        login.searchParams.get("redirectTo"),
        `/api/sso/authorize?${f.params}`
    )
    assert.equal(f.issued.length, 0)
})

test("silent authorization without a session never starts interactive Discord login", async () => {
    const f = fixture()
    f.ports.session = async () => null
    f.params.set("prompt", "none")
    const response = await f.http.authorize(f.auth())
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { error: "login_required" })
    assert.equal(response.headers.get("location"), null)
    assert.equal(f.issued.length, 0)
})
for (const mode of [
    "duplicate",
    "nonce",
    "scope",
    "challenge",
    "callback",
    "oversize",
] as const) {
    test(`authorization rejects ${mode} without issuance or unsafe redirect`, async () => {
        const f = fixture()
        if (mode === "duplicate") f.params.append("client_id", "second")
        if (mode === "nonce") f.params.delete("nonce")
        if (mode === "scope") f.params.set("scope", "openid admin")
        if (mode === "challenge") f.params.set("code_challenge", "x")
        if (mode === "callback")
            f.params.set("redirect_uri", callback + "#secret")
        if (mode === "oversize") f.params.set("state", "x".repeat(9000))
        const response = await f.http.authorize(f.auth())
        assert.equal(response.status, 400)
        assert.equal(response.headers.get("cache-control"), "no-store")
        assert.equal(response.headers.get("location"), null)
        assert.equal(f.issued.length, 0)
    })
}
test("discovery and public JWKS verify RS256 identity claims with independent jose verifier", async () => {
    const f = fixture()
    const metadata = await (await f.http.discovery()).json()
    assert.deepEqual(metadata.id_token_signing_alg_values_supported, ["RS256"])
    assert.deepEqual(metadata.subject_types_supported, ["public"])
    assert.deepEqual(metadata.scopes_supported, ["openid", "profile"])
    assert.equal(metadata.end_session_endpoint, undefined)
    assert.equal(metadata.backchannel_logout_supported, undefined)
    const jwks = await (await f.http.jwks()).json()
    assert.deepEqual(Object.keys(jwks.keys[0]).sort(), [
        "alg",
        "e",
        "kid",
        "kty",
        "n",
        "use",
    ])
    const response = await f.http.token(f.token())
    assert.equal(response.status, 200)
    const body = await response.json()
    const verified = await jwtVerify(body.id_token, createLocalJWKSet(jwks), {
        issuer: origin,
        audience: "client",
        algorithms: ["RS256"],
    })
    assert.equal(verified.payload.nonce, "opaque-nonce")
    assert.equal(verified.payload.sid, sid)
    assert.equal(verified.payload.sub, subject)
    assert.equal(verified.payload.guild_id, profile.guild_id)
    assert.equal(verified.payload.role, undefined)
    await assert.rejects(
        jwtVerify(body.id_token, createLocalJWKSet(jwks), {
            audience: "wrong-client",
        })
    )
    await assert.rejects(
        jwtVerify(body.id_token, createLocalJWKSet(jwks), {
            issuer: "https://other.invalid",
        })
    )
    assert.equal(
        (
            await f.http.userinfo(
                new Request(origin, {
                    headers: { authorization: `Bearer ${body.id_token}` },
                })
            )
        ).status,
        401
    )
})
test("token request validates duplicates, grammar, body size and content type before redemption", async () => {
    for (const mode of [
        "duplicate",
        "verifier",
        "oversize",
        "json",
        "credentials",
    ] as const) {
        const f = fixture()
        if (mode === "duplicate") f.form.append("code", "duplicate")
        if (mode === "verifier") f.form.set("code_verifier", "short")
        if (mode === "oversize") f.form.set("code", "x".repeat(9000))
        const request =
            mode === "json"
                ? new Request(origin, {
                      method: "POST",
                      body: "{}",
                      headers: { "content-type": "application/json" },
                  })
                : f.token()
        if (mode === "credentials")
            request.headers.set("authorization", "Basic invalid")
        const response = await f.http.token(request)
        assert.equal(response.status, 400, mode)
        assert.equal(response.headers.get("cache-control"), "no-store")
        assert.equal(f.redeemed.length, 0)
    }
})
test("revocation during signing prevents returning a successful token response", async () => {
    const f = fixture()
    f.ports.profile = async () => null
    const response = await f.http.token(f.token())
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { error: "invalid_grant" })
})
test("userinfo is a closed DTO and outages fail closed without internal exception text", async () => {
    const f = fixture()
    f.ports.profile = async () => ({ ...profile, privateNote: "never-expose" })
    const request = new Request(origin, {
        headers: { authorization: `Bearer ${"a".repeat(43)}` },
    })
    assert.deepEqual(await (await f.http.userinfo(request)).json(), profile)
    f.ports.profile = async () => {
        throw new Error("internal-secret-must-not-leak")
    }
    const response = await f.http.userinfo(request)
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), {
        error: "temporarily_unavailable",
    })
})
test("all protocol endpoints remain disabled with absent or invalid signing configuration", async () => {
    const f = fixture()
    f.ports.provider = async () => {
        throw new Error("unconfigured")
    }
    for (const response of await Promise.all([
        f.http.authorize(f.auth()),
        f.http.token(f.token()),
        f.http.userinfo(new Request(origin)),
        f.http.discovery(),
        f.http.jwks(),
    ])) {
        assert.equal(response.status, 503)
        assert.equal(response.headers.get("cache-control"), "no-store")
    }
})
