import {
    SSO_ACCESS_TOKEN_TTL_MS,
    SSO_CODE_TTL_MS,
    DASHBOARD_SESSION_TTL_MS,
} from "../../domain/identity/sso-policy"
import { invalidateUserSessions } from "../../../convex/dashboardSessionStore"
import * as sessions from "../../../convex/dashboardSessions"
import { testContext, invoke } from "./testing/database"
import { test, type TestContext } from "node:test"
import { hashSsoValue } from "../../lib/sso"
import * as sso from "../../../convex/sso"
import assert from "node:assert/strict"

const subject = "123456789012345678",
    other = "223456789012345678",
    secret = "isolated-sso-test-secret"
const sid = "s".repeat(43),
    secondSid = "t".repeat(43),
    clientId = "logi_" + "c".repeat(24)
const callback = "https://consumer.invalid/callback"
const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
    challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
async function fixture(t: TestContext) {
    const previous = {
        secret: process.env.INTERNAL_AUTH_SECRET,
        flag: process.env.LOGI_SSO_ENABLED,
    }
    process.env.INTERNAL_AUTH_SECRET = secret
    process.env.LOGI_SSO_ENABLED = "true"
    t.after(() => {
        if (previous.secret === undefined)
            delete process.env.INTERNAL_AUTH_SECRET
        else process.env.INTERNAL_AUTH_SECRET = previous.secret
        if (previous.flag === undefined) delete process.env.LOGI_SSO_ENABLED
        else process.env.LOGI_SSO_ENABLED = previous.flag
    })
    let now = 1900000000000
    t.mock.method(Date, "now", () => now)
    const ctx = testContext()
    ctx.db.seed("users", {
        _id: "users:a",
        discordId: subject,
        id: "imported-a",
        name: "Test Member",
        avatar: "https://images.invalid/avatar.png",
        platformIds: ["private-platform"],
        note: "private-note",
    })
    ctx.db.seed("guilds", {
        _id: "guilds:a",
        discordId: "323456789012345678",
        adminIds: [subject],
        memberIds: [],
        mercenaryIds: [],
    })
    const app = {
        secret,
        guildId: "guilds:a",
        userId: subject,
        clientId,
        clientSecretHash: hashSsoValue("client-secret"),
        name: "Test Consumer",
        websiteUrl: "https://consumer.invalid",
        redirectUris: [callback],
    }
    await invoke(sso.create, ctx, app)
    const session = await invoke(sessions.create, ctx, { secret, subject, sid })
    const binding = { secret, subject, sid, userRecordId: "users:a" }
    const code = {
        ...binding,
        clientId,
        redirectUri: callback,
        codeHash: hashSsoValue("code"),
        codeChallenge: challenge,
        nonce: "consumer-nonce",
        scope: "openid profile",
    }
    const redemption = {
        secret,
        clientId,
        clientSecretHash: app.clientSecretHash,
        codeHash: code.codeHash,
        redirectUri: callback,
        verifier,
        tokenHash: hashSsoValue("access"),
    }
    return {
        ctx,
        app,
        session,
        binding,
        code,
        redemption,
        advance: (ms: number) => {
            now += ms
        },
        issue: () => invoke(sso.createCode, ctx, code),
        redeem: (extra: Record<string, unknown> = {}) =>
            invoke(sso.redeemCode, ctx, { ...redemption, ...extra }),
        profile: () =>
            invoke(sso.getProfile, ctx, {
                secret,
                tokenHash: redemption.tokenHash,
            }),
    }
}

test("trusted session and issuance authority are required at the database boundary", async (t) => {
    const f = await fixture(t)
    for (const bad of [undefined, "wrong"]) {
        await assert.rejects(
            invoke(sessions.create, f.ctx, {
                secret: bad,
                subject,
                sid: secondSid,
            }),
            /Unauthorized/
        )
        await assert.rejects(
            invoke(sso.createCode, f.ctx, { ...f.code, secret: bad }),
            /Unauthorized/
        )
        await assert.rejects(f.redeem({ secret: bad }), /Unauthorized/)
        await assert.rejects(
            invoke(sso.getProfile, f.ctx, {
                secret: bad,
                tokenHash: f.redemption.tokenHash,
            }),
            /Unauthorized/
        )
    }
    assert.equal("createAccessToken" in sso, false)
    delete process.env.INTERNAL_AUTH_SECRET
    await assert.rejects(f.issue(), /Unauthorized/)
})
test("provider defaults off while durable dashboard sessions remain independent", async (t) => {
    const f = await fixture(t)
    delete process.env.LOGI_SSO_ENABLED
    await assert.rejects(f.issue(), /unavailable/)
    assert.ok(await invoke(sessions.validate, f.ctx, f.binding))
})
test("session creation uses an exact Discord record and server-owned lifetime", async (t) => {
    const f = await fixture(t)
    assert.equal(
        f.session.expiresAt - f.session.createdAt,
        DASHBOARD_SESSION_TTL_MS
    )
    f.ctx.db.seed("users", { _id: "users:legacy", id: other })
    await assert.rejects(
        invoke(sessions.create, f.ctx, {
            secret,
            subject: other,
            sid: secondSid,
        }),
        /Linked account/
    )
    await assert.rejects(
        invoke(sessions.create, f.ctx, { secret, subject, sid }),
        /exists/
    )
    await assert.rejects(
        invoke(sso.createCode, f.ctx, { ...f.code, subject: other }),
        /Invalid request/
    )
    await assert.rejects(
        invoke(sso.createCode, f.ctx, {
            ...f.code,
            userRecordId: "users:legacy",
        }),
        /Invalid request/
    )
})
test("S256 exchange binds nonce and creates exactly one token atomically", async (t) => {
    const f = await fixture(t)
    await f.issue()
    const row = f.ctx.db.tables.ssoAuthorizationCodes[0]
    assert.equal(row.expiresAt - Date.now(), SSO_CODE_TTL_MS)
    const result = await f.redeem()
    assert.equal(result.nonce, "consumer-nonce")
    assert.equal(result.sub, subject)
    assert.equal(result.sid, sid)
    assert.equal(result.expiresAt - Date.now(), SSO_ACCESS_TOKEN_TTL_MS)
    assert.equal(f.ctx.db.tables.ssoAccessTokens.length, 1)
    assert.equal(await f.redeem(), null)
    assert.equal(f.ctx.db.tables.ssoAccessTokens.length, 1)
})
test("wrong proof, client, callback and secret never consume a valid code", async (t) => {
    const f = await fixture(t)
    await f.issue()
    for (const extra of [
        { verifier: "x".repeat(43) },
        { verifier: "short" },
        { verifier: "x".repeat(129) },
        { verifier: "!".repeat(43) },
        { clientId: "other" },
        { clientSecretHash: hashSsoValue("wrong") },
        { redirectUri: "https://consumer.invalid/other" },
    ]) {
        assert.equal(await f.redeem(extra), null)
        assert.equal(f.ctx.db.tables.ssoAuthorizationCodes[0].usedAt, undefined)
        assert.equal(f.ctx.db.tables.ssoAccessTokens?.length ?? 0, 0)
    }
    assert.ok(await f.redeem())
})
test("security clocks cannot be supplied by a caller and exact expiry fails", async (t) => {
    const f = await fixture(t)
    await invoke(sso.createCode, f.ctx, {
        ...f.code,
        expiresAt: Date.now() + 999999999,
    })
    f.advance(SSO_CODE_TTL_MS)
    assert.equal(await f.redeem({ now: 0 }), null)
    await invoke(sso.createCode, f.ctx, {
        ...f.code,
        codeHash: hashSsoValue("second-code"),
    })
    assert.ok(await f.redeem({ codeHash: hashSsoValue("second-code") }))
    f.advance(SSO_ACCESS_TOKEN_TTL_MS)
    assert.equal(
        await invoke(sso.getProfile, f.ctx, {
            secret,
            tokenHash: f.redemption.tokenHash,
            now: 0,
        }),
        null
    )
})
test("closed userinfo never serializes storage fields or membership authority", async (t) => {
    const f = await fixture(t)
    await f.issue()
    await f.redeem()
    assert.deepEqual(await f.profile(), {
        sub: subject,
        sid,
        name: "Test Member",
        picture: "https://images.invalid/avatar.png",
        guild_id: "323456789012345678",
    })
})
test("logout before redemption invalidates pending codes, after issuance invalidates tokens", async (t) => {
    const f = await fixture(t)
    await f.issue()
    await invoke(sessions.revoke, f.ctx, { ...f.binding, allSessions: false })
    assert.equal(await f.redeem(), null)
    assert.equal(await invoke(sessions.validate, f.ctx, f.binding), null)
    await invoke(sessions.create, f.ctx, { secret, subject, sid: secondSid })
    await invoke(sso.createCode, f.ctx, {
        ...f.code,
        sid: secondSid,
        codeHash: hashSsoValue("new-code"),
    })
    assert.ok(await f.redeem({ codeHash: hashSsoValue("new-code") }))
    await invoke(sessions.revoke, f.ctx, {
        ...f.binding,
        sid: secondSid,
        allSessions: false,
    })
    assert.equal(await f.profile(), null)
})
test("local logout preserves another session; global logout revokes all bound sessions", async (t) => {
    const f = await fixture(t)
    await invoke(sessions.create, f.ctx, { secret, subject, sid: secondSid })
    await invoke(sessions.revoke, f.ctx, { ...f.binding, allSessions: false })
    assert.ok(
        await invoke(sessions.validate, f.ctx, { ...f.binding, sid: secondSid })
    )
    await invoke(sessions.revoke, f.ctx, {
        ...f.binding,
        sid: secondSid,
        allSessions: true,
    })
    assert.equal(
        await invoke(sessions.validate, f.ctx, {
            ...f.binding,
            sid: secondSid,
        }),
        null
    )
    assert.equal((await f.ctx.db.get("users:a"))?.sessionVersion, 1)
})
for (const change of [
    "unlink",
    "delete-user",
    "delete-guild",
    "relink",
    "delete-client",
    "rotate-client",
    "replace-client",
] as const) {
    test(`userinfo fails closed after ${change}`, async (t) => {
        const f = await fixture(t)
        await f.issue()
        await f.redeem()
        const app = f.ctx.db.tables.ssoApplications[0]
        if (change === "unlink")
            await f.ctx.db.patch("users:a", {
                discordId: undefined,
                id: subject,
            })
        if (change === "delete-user") await f.ctx.db.delete("users:a")
        if (change === "delete-guild") await f.ctx.db.delete("guilds:a")
        if (change === "relink") {
            await invalidateUserSessions(f.ctx as never, "users:a" as never)
            await f.ctx.db.patch("users:a", { discordId: other })
            await f.ctx.db.patch("users:a", { discordId: subject })
        }
        if (change === "delete-client" || change === "replace-client")
            await f.ctx.db.delete(app._id)
        if (change === "replace-client") await invoke(sso.create, f.ctx, f.app)
        if (change === "rotate-client")
            await f.ctx.db.patch(app._id, {
                clientSecretHash: hashSsoValue("rotated"),
            })
        assert.equal(await f.profile(), null)
    })
}
test("legacy unbound codes and tokens are rejected, and session exact expiry rejects", async (t) => {
    const f = await fixture(t)
    await f.issue()
    await f.ctx.db.patch(f.ctx.db.tables.ssoAuthorizationCodes[0]._id, {
        sessionId: undefined,
    })
    assert.equal(await f.redeem(), null)
    f.ctx.db.seed("ssoAccessTokens", {
        _id: "ssoAccessTokens:legacy",
        tokenHash: f.redemption.tokenHash,
        clientId,
        userId: subject,
        expiresAt: Date.now() + 99999,
    })
    assert.equal(await f.profile(), null)
    f.advance(DASHBOARD_SESSION_TTL_MS)
    assert.equal(await invoke(sessions.validate, f.ctx, f.binding), null)
})
test("backend registration enforces exact HTTPS callback policy and rejects unsupported logout registration", async (t) => {
    const f = await fixture(t)
    for (const redirect of [
        "https://consumer.invalid/callback#x",
        "http://consumer.invalid/callback",
        "https://user@consumer.invalid/callback",
        "https://consumer.invalid\\evil",
    ]) {
        await assert.rejects(
            invoke(sso.create, f.ctx, { ...f.app, redirectUris: [redirect] }),
            /Invalid application/
        )
    }
    await assert.rejects(
        invoke(sso.create, f.ctx, { ...f.app, backchannelLogoutUri: callback }),
        /Invalid application/
    )
    for (const change of [
        { codeChallenge: "invalid" },
        { nonce: "" },
        { scope: "openid admin" },
    ])
        await assert.rejects(
            invoke(sso.createCode, f.ctx, { ...f.code, ...change }),
            /Invalid request/
        )
})
