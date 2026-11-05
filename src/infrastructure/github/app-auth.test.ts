import {
    githubConfig,
    githubAppJwt,
    createInstallationTokenProvider,
} from "./app-auth"
import { generateKeyPairSync, verify } from "node:crypto"
import assert from "node:assert/strict"
import test from "node:test"

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
})
const pem = privateKey.export({ type: "pkcs1", format: "pem" }).toString()
const environment = {
    LOGI_GITHUB_REPOSITORY: "owner/repo",
    LOGI_GITHUB_APP_ID: "123",
    LOGI_GITHUB_INSTALLATION_ID: "456",
    LOGI_GITHUB_PRIVATE_KEY: pem,
}
const config = githubConfig(environment)!

test("configuration is optional but rejects partial or malformed app settings", () => {
    assert.equal(githubConfig({}), null)
    for (const override of [
        { LOGI_GITHUB_APP_ID: "invalid" },
        { LOGI_GITHUB_INSTALLATION_ID: "../456" },
        { LOGI_GITHUB_REPOSITORY: "owner/repo/other" },
        { LOGI_GITHUB_PRIVATE_KEY: "" },
    ])
        assert.throws(() => githubConfig({ ...environment, ...override }))
    assert.throws(() =>
        githubConfig({
            LOGI_GITHUB_REPOSITORY: "owner/repo",
            LOGI_GITHUB_TOKEN: "obsolete",
        })
    )
    assert.equal(
        githubConfig({
            ...environment,
            LOGI_GITHUB_PRIVATE_KEY: pem.replace(/\n/g, "\\n"),
        })?.privateKey,
        pem
    )
})
test("app JWT uses a valid RS256 signature and clock-skew-safe lifetime", () => {
    const now = 1800000000000
    const [header, payload, signature] = githubAppJwt(config, now).split(".")
    assert.deepEqual(JSON.parse(Buffer.from(header, "base64url").toString()), {
        alg: "RS256",
        typ: "JWT",
    })
    assert.deepEqual(JSON.parse(Buffer.from(payload, "base64url").toString()), {
        iss: "123",
        iat: now / 1000 - 60,
        exp: now / 1000 + 540,
    })
    assert.ok(
        verify(
            "RSA-SHA256",
            Buffer.from(`${header}.${payload}`),
            publicKey,
            Buffer.from(signature, "base64url")
        )
    )
    assert.throws(
        () => githubAppJwt({ ...config, privateKey: "invalid" }, now),
        /valid RSA PEM/
    )
})
test("installation tokens are scoped, cached and renewed before expiry or when configuration changes", async () => {
    let now = 1800000000000
    let calls = 0
    const request: typeof fetch = async (url, init) => {
        calls++
        assert.equal(
            String(url),
            "https://api.github.com/app/installations/456/access_tokens"
        )
        assert.equal(init?.method, "POST")
        assert.deepEqual(JSON.parse(String(init?.body)), {
            repositories: ["repo"],
            permissions: { issues: "write" },
        })
        const authorization = (init?.headers as Record<string, string>)
            .Authorization
        assert.ok(authorization.startsWith("Bearer ey"))
        return Response.json({
            token: `installation-${calls}`,
            expires_at: new Date(now + 3600000).toISOString(),
        })
    }
    const token = createInstallationTokenProvider(request, () => now)
    assert.equal(await token(config), "installation-1")
    assert.equal(await token(config), "installation-1")
    now += 3550000
    assert.equal(await token(config), "installation-2")
    assert.equal(await token({ ...config, appId: "124" }), "installation-3")
    assert.equal(calls, 3)
})
test("token exchange errors do not expose GitHub response bodies or credentials", async () => {
    const token = createInstallationTokenProvider(
        async () => new Response("sensitive upstream detail", { status: 403 })
    )
    await assert.rejects(token(config), {
        message: "GitHub App token request failed (403)",
    })
    const expired = createInstallationTokenProvider(async () =>
        Response.json({ token: "expired", expires_at: "2020-01-01T00:00:00Z" })
    )
    await assert.rejects(expired(config), /expired installation token/)
})
