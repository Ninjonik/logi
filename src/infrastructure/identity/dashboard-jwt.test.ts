import {
    DASHBOARD_SESSION_AUDIENCE,
    DASHBOARD_SESSION_TTL_MS,
} from "../../domain/identity/sso-policy"
import { readDashboardJwt, signDashboardJwt } from "./dashboard-jwt"
import assert from "node:assert/strict"
import { test } from "node:test"
import { SignJWT } from "jose"

const config = {
    secret: "isolated-test-signing-secret-longer-than-thirty-two-bytes",
    issuer: "https://provider.invalid",
}
const claims = {
    sub: "123456789012345678",
    sid: "s".repeat(43),
    userRecordId: "users:fixture",
    name: "Test Member",
    avatar: "https://images.invalid/avatar",
}
test("dashboard JWT uses explicit issuer audience algorithm and durable binding", async () => {
    const createdAt = Date.now()
    const token = await signDashboardJwt(
        claims,
        { createdAt, expiresAt: createdAt + DASHBOARD_SESSION_TTL_MS },
        config
    )
    assert.deepEqual(await readDashboardJwt(token, config), {
        ...claims,
        discordGuilds: [],
    })
    assert.equal(
        await readDashboardJwt(token, {
            ...config,
            secret: "other-signing-secret",
        }),
        null
    )
    assert.equal(
        await readDashboardJwt(token, {
            ...config,
            issuer: "https://other.invalid",
        }),
        null
    )
})
for (const mode of [
    "HS512",
    "unbound",
    "wrong-audience",
    "missing-issuer",
    "expired",
    "overlong",
    "future",
] as const) {
    test(`dashboard JWT rejects ${mode}`, async () => {
        const now = Math.floor(Date.now() / 1000)
        const jwt = new SignJWT({
            name: claims.name,
            avatar: claims.avatar,
            ...(mode !== "unbound"
                ? { sid: claims.sid, usr: claims.userRecordId }
                : {}),
        })
            .setProtectedHeader({
                alg: mode === "HS512" ? "HS512" : "HS256",
                typ: "JWT",
            })
            .setSubject(claims.sub)
            .setAudience(
                mode === "wrong-audience"
                    ? "website-consumer"
                    : DASHBOARD_SESSION_AUDIENCE
            )
            .setIssuedAt(mode === "future" ? now + 100 : now)
            .setExpirationTime(
                mode === "expired"
                    ? now
                    : now +
                          (mode === "overlong"
                              ? DASHBOARD_SESSION_TTL_MS / 1000 + 1
                              : 3600)
            )
        if (mode !== "missing-issuer") jwt.setIssuer(config.issuer)
        const token = await jwt.sign(new TextEncoder().encode(config.secret))
        assert.equal(await readDashboardJwt(token, config), null)
    })
}
