import {
    gameDataSourceHandlers,
    SOURCE_COMMAND_MAX_BYTES,
    type GameDataSourcePorts,
} from "./game-data-sources-route"
import {
    decryptCredential,
    encryptCredential,
    parseKeyring,
} from "@/infrastructure/game-data/credential-cipher"
import { credentialAad } from "@/domain/game-data/credentials"
import type { DataSource } from "@/domain/game-data/contracts"
import { randomBytes } from "node:crypto"
import assert from "node:assert/strict"
import test from "node:test"

const SENTINEL = "sentinel-provider-key-0d15ea5e"
const keyring = parseKeyring(
    JSON.stringify({
        current: "k1",
        keys: { k1: randomBytes(32).toString("base64") },
    })
)!
const url = "https://logi.test/api/servers/server-1/game-data-sources"
const newRef = "src-0123456789abcdef0123456789abcdef"
const draft = {
    displayName: "Valkyria Warcon",
    gameId: "wardogs",
    provider: "wardogs_warcon",
    origin: "https://Wardogs.example.test",
    providerServerId: "11111111-1111-4111-8111-111111111111",
}
type Call = { name: string; args: unknown[] }

function setup(overrides: Partial<GameDataSourcePorts> = {}) {
    const calls: Call[] = []
    const record =
        <T>(name: string, value: T) =>
        async (...args: unknown[]) => {
            calls.push({ name, args })
            return value
        }
    const ports: GameDataSourcePorts = {
        authorize: async () => ({ guildId: "guild-a" }),
        list: record("list", { sources: [], limit: 20 }),
        reserveTest: record("reserveTest", {
            ok: true as const,
            binding: {
                gameId: "wardogs" as const,
                provider: "wardogs_warcon" as const,
                origin: "https://wardogs.example.test",
                providerServerId: draft.providerServerId,
                revision: 3,
            },
        }),
        create: record("create", {
            ok: true as const,
            ref: newRef,
            revision: 1,
            enabled: true,
        }),
        setCredential: record("setCredential", {
            ok: true as const,
            revision: 4,
            enabled: true,
        }),
        command: record("command", { ok: true as const }),
        testStored: record("testStored", { outcome: "ok" as const }),
        encryption: () => ({
            encrypt: (binding, key) =>
                encryptCredential(keyring, key, credentialAad(binding)),
        }),
        testConnection: async (source: DataSource, key: string | null) => {
            calls.push({ name: "testConnection", args: [source, key] })
            return { outcome: "ok" as const }
        },
        newRef: () => newRef,
        ...overrides,
    }
    return { handlers: gameDataSourceHandlers(ports), calls }
}
function post(body: unknown, headers: Record<string, string> = {}) {
    return new Request(url, {
        method: "POST",
        headers: {
            origin: "https://logi.test",
            "content-type": "application/json",
            ...headers,
        },
        body: typeof body === "string" ? body : JSON.stringify(body),
    })
}
/** Every recorded call except the in-memory test, which must hold the key. */
function leaked(calls: Call[], response: unknown) {
    const outbound = calls.filter((call) => call.name !== "testConnection")
    return (
        JSON.stringify(outbound).includes(SENTINEL) ||
        JSON.stringify(response).includes(SENTINEL)
    )
}

test("writes need this site's Origin, a workspace administrator and a bounded body", async () => {
    const { handlers, calls } = setup()
    for (const headers of [{ origin: "https://evil.test" }, { origin: "" }]) {
        const response = await handlers.POST(
            post({ action: "test", draft, key: SENTINEL }, headers),
            "server-1"
        )
        assert.equal(response.status, 403)
    }
    const forbidden = setup({ authorize: async () => null })
    assert.equal(
        (
            await forbidden.handlers.POST(
                post({ action: "test_stored", ref: "x" }),
                "server-1"
            )
        ).status,
        403
    )
    const huge = await handlers.POST(
        post({
            action: "test",
            draft,
            key: "x".repeat(SOURCE_COMMAND_MAX_BYTES),
        }),
        "server-1"
    )
    assert.equal(huge.status, 400)
    assert.deepEqual(await huge.json(), { error: "invalid_source" })
    assert.deepEqual(calls, [])
})

test("a new source is tested, encrypted for its identity and enabled only after a pass", async () => {
    const { handlers, calls } = setup()
    const response = await handlers.POST(
        post({ action: "create", draft, key: `  ${SENTINEL}\n`, enable: true }),
        "server-1"
    )
    const body = await response.json()
    assert.equal(response.status, 200)
    assert.deepEqual(body, {
        ok: true,
        ref: newRef,
        revision: 1,
        enabled: true,
        test: { outcome: "ok" },
    })
    const tested = calls.find((call) => call.name === "testConnection")!
    assert.equal(
        (tested.args[0] as DataSource).origin,
        "https://wardogs.example.test"
    )
    assert.deepEqual((tested.args[0] as DataSource).allowedAddresses, [])
    assert.equal(tested.args[1], SENTINEL)
    const created = calls.find((call) => call.name === "create")!
    const input = created.args[1] as {
        credential: Parameters<typeof decryptCredential>[1]
        enable: boolean
        verified: boolean
        source: Record<string, string>
    }
    assert.equal(input.enable, true)
    assert.equal(input.verified, true)
    assert.equal(input.source.ref, newRef)
    assert.equal(
        decryptCredential(
            keyring,
            input.credential,
            credentialAad({
                guildId: "guild-a",
                sourceRef: newRef,
                provider: "wardogs_warcon",
                origin: "https://wardogs.example.test",
                providerServerId: draft.providerServerId,
            })
        ),
        SENTINEL
    )
    assert.equal(leaked(calls, body), false)
})

test("a failed test saves a disabled draft and reports only the category", async () => {
    const { handlers, calls } = setup({
        testConnection: async () => ({ outcome: "unauthorized" }),
    })
    const response = await handlers.POST(
        post({ action: "create", draft, key: SENTINEL, enable: true }),
        "server-1"
    )
    const body = await response.json()
    assert.deepEqual(body.test, { outcome: "unauthorized" })
    const input = calls.find((call) => call.name === "create")!.args[1] as {
        enable: boolean
        verified: boolean
    }
    assert.deepEqual([input.enable, input.verified], [false, false])
    assert.equal(leaked(calls, body), false)
})

test("keys are validated, never stored without encryption and never echoed", async () => {
    const noKeyring = setup({ encryption: () => null })
    const unavailable = await noKeyring.handlers.POST(
        post({ action: "create", draft, key: SENTINEL, enable: true }),
        "server-1"
    )
    assert.equal(unavailable.status, 503)
    assert.deepEqual(await unavailable.json(), {
        error: "encryption_unavailable",
    })
    assert.deepEqual(noKeyring.calls, [])
    // Testing a key without storing it works before encryption is activated.
    const tested = await noKeyring.handlers.POST(
        post({ action: "test", draft, key: SENTINEL }),
        "server-1"
    )
    assert.deepEqual(await tested.json(), { outcome: "ok" })
    const { handlers, calls } = setup()
    for (const key of [`${SENTINEL}\r\nx: 1`, "short", `${SENTINEL} two`]) {
        const response = await handlers.POST(
            post({ action: "create", draft, key, enable: false }),
            "server-1"
        )
        const body = await response.json()
        assert.deepEqual(body, { error: "invalid_key" })
        assert.equal(JSON.stringify(body).includes(SENTINEL), false)
    }
    assert.deepEqual(
        await (
            await handlers.POST(
                post({ action: "create", draft, key: null, enable: false }),
                "server-1"
            )
        ).json(),
        { error: "key_required" }
    )
    assert.deepEqual(
        await (
            await handlers.POST(
                post({
                    action: "create",
                    draft: {
                        ...draft,
                        provider: "wardogs_public_directory",
                        origin: "https://api.wardogservers.com",
                        providerServerId: "123",
                    },
                    key: SENTINEL,
                    enable: false,
                }),
                "server-1"
            )
        ).json(),
        { error: "key_not_allowed" }
    )
    // Operator-only fields cannot be smuggled in.
    assert.deepEqual(
        await (
            await handlers.POST(
                post({
                    action: "create",
                    draft: { ...draft, allowedAddresses: ["10.0.0.1"] },
                    key: SENTINEL,
                    enable: false,
                }),
                "server-1"
            )
        ).json(),
        { error: "invalid_source" }
    )
    assert.equal(calls.filter((call) => call.name === "create").length, 0)
})

test("a key change is tested against the stored identity before it replaces the old one", async () => {
    const operatorBinding = {
        ok: true as const,
        binding: {
            gameId: "wardogs" as const,
            provider: "wardogs_warcon" as const,
            origin: "https://wardogs.example.test",
            providerServerId: draft.providerServerId,
            revision: 3,
        },
    }
    const failing = setup({
        reserveTest: async () => operatorBinding,
        testConnection: async () => ({ outcome: "server_mismatch" }),
    })
    const refused = await failing.handlers.POST(
        post({
            action: "set_key",
            ref: "valkyria-warcon",
            expectedRevision: 3,
            key: SENTINEL,
            allowUnverified: false,
        }),
        "server-1"
    )
    assert.equal(refused.status, 422)
    assert.deepEqual(await refused.json(), {
        error: "verification_required",
        test: { outcome: "server_mismatch" },
    })
    assert.equal(
        failing.calls.some((call) => call.name === "setCredential"),
        false
    )
    const { handlers, calls } = setup({
        reserveTest: async () => operatorBinding,
    })
    const stored = await handlers.POST(
        post({
            action: "set_key",
            ref: "valkyria-warcon",
            expectedRevision: 3,
            key: SENTINEL,
            allowUnverified: false,
        }),
        "server-1"
    )
    const body = await stored.json()
    assert.deepEqual(body, {
        ok: true,
        revision: 4,
        enabled: true,
        test: { outcome: "ok" },
    })
    const tested = calls.find((call) => call.name === "testConnection")!
    // Operator network exceptions belong to the Convex network; the web server never applies them.
    assert.deepEqual((tested.args[0] as DataSource).allowedAddresses, [])
    const input = calls.find((call) => call.name === "setCredential")!
        .args[1] as {
        binding: unknown
        verified: boolean
        expectedRevision: number
    }
    assert.deepEqual(input.binding, {
        provider: "wardogs_warcon",
        origin: "https://wardogs.example.test",
        providerServerId: draft.providerServerId,
    })
    assert.equal(input.expectedRevision, 3)
    assert.equal(leaked(calls, body), false)
})

test("failures are typed, bounded and never carry exception text", async () => {
    const limited = setup({
        reserveTest: async () => ({
            error: "rate_limited",
            retryAfterMs: 1234.5,
        }),
    })
    const response = await limited.handlers.POST(
        post({ action: "test", draft, key: SENTINEL }),
        "server-1"
    )
    assert.equal(response.status, 429)
    assert.deepEqual(await response.json(), {
        error: "rate_limited",
        retryAfterMs: 1235,
    })
    const broken = setup({
        create: async () => {
            throw new Error(`Convex said ${SENTINEL}`)
        },
    })
    const failed = await broken.handlers.POST(
        post({ action: "create", draft, key: SENTINEL, enable: false }),
        "server-1"
    )
    assert.equal(failed.status, 503)
    assert.deepEqual(await failed.json(), { error: "unavailable" })
    const conflict = setup({
        command: async () => ({ error: "revision_conflict" }),
    })
    assert.equal(
        (
            await conflict.handlers.POST(
                post({
                    action: "remove_key",
                    ref: newRef,
                    expectedRevision: 1,
                }),
                "server-1"
            )
        ).status,
        409
    )
    const unknown = setup({
        command: async () => ({ error: "boom" as never }),
    })
    assert.deepEqual(
        await (
            await unknown.handlers.POST(
                post({ action: "remove", ref: newRef, expectedRevision: 1 }),
                "server-1"
            )
        ).json(),
        { error: "unavailable" }
    )
})

test("the list reports whether encryption is active and nothing else is added", async () => {
    const active = await setup().handlers.GET("server-1")
    assert.deepEqual(await active.json(), {
        sources: [],
        limit: 20,
        encryption: "active",
    })
    const inactive = await setup({ encryption: () => null }).handlers.GET(
        "server-1"
    )
    assert.equal((await inactive.json()).encryption, "unavailable")
    const leaky = await setup({
        list: async () => ({
            sources: [],
            limit: 20,
            ciphertext: "should-not-pass",
        }),
    }).handlers.GET("server-1")
    assert.equal(leaky.status, 503)
})
