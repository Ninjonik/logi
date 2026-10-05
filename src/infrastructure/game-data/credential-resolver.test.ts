import {
    credentialAad,
    type ResolvedSource,
} from "../../domain/game-data/credentials"
import { encryptCredential, parseKeyring } from "./credential-cipher"
import { ProviderError } from "../../domain/game-data/contracts"
import { providerCredential } from "./credential-resolver"
import { createProviderHttp } from "./provider-http"
import { randomBytes } from "node:crypto"
import assert from "node:assert/strict"
import test from "node:test"

const SENTINEL = "sentinel-provider-key-51d0e2"
const raw = JSON.stringify({
    current: "k1",
    keys: { k1: randomBytes(32).toString("base64") },
})
const source: ResolvedSource = {
    ref: "src-0123456789abcdef0123456789abcdef",
    guildId: "guild-a",
    gameId: "wardogs",
    provider: "wardogs_warcon",
    providerServerId: "11111111-1111-4111-8111-111111111111",
    origin: "https://wardogs.example.test",
    secretRef: null,
    allowedAddresses: [],
    credentialMode: "encrypted",
    managed: "workspace",
    usable: true,
}
const envelope = encryptCredential(
    parseKeyring(raw)!,
    SENTINEL,
    credentialAad({ ...source, sourceRef: source.ref })
)
const configuration = (error: unknown) =>
    error instanceof ProviderError &&
    error.category === "configuration" &&
    !String(error.message).includes(SENTINEL)

test("an encrypted key is decrypted once per run, just before the request", async () => {
    let loads = 0
    const credential = providerCredential(source, {
        env: () => assert.fail("no environment read for an encrypted key"),
        keyring: () => raw,
        loadEnvelope: async () => {
            loads++
            return envelope
        },
    })
    assert.ok(credential)
    assert.equal(loads, 0)
    const http = createProviderHttp(source, {
        credential,
        now: Date.now,
        fetch: async (_url, init) => {
            assert.equal(
                new Headers(init?.headers).get("authorization"),
                `Bearer ${SENTINEL}`
            )
            return Response.json({ ok: true, live: {} })
        },
    })
    await http.get(`/api/live?ids=${source.providerServerId}`)
    await http.get(`/api/live?ids=${source.providerServerId}`)
    assert.equal(loads, 1)
})

test("a key failure never falls back to the environment, another key or no key", async () => {
    const failures: string[] = []
    const cases: Array<[string, Parameters<typeof providerCredential>[1]]> = [
        [
            "missing keyring",
            {
                env: () => SENTINEL,
                keyring: () => undefined,
                loadEnvelope: async () => envelope,
                reportFailure: async (category) => failures.push(category),
            },
        ],
        [
            "other keyring",
            {
                env: () => SENTINEL,
                keyring: () =>
                    JSON.stringify({
                        current: "k1",
                        keys: { k1: randomBytes(32).toString("base64") },
                    }),
                loadEnvelope: async () => envelope,
                reportFailure: async (category) => failures.push(category),
            },
        ],
        [
            "removed credential",
            {
                env: () => SENTINEL,
                keyring: () => raw,
                loadEnvelope: async () => null,
            },
        ],
    ]
    for (const [label, ports] of cases) {
        let requests = 0
        const http = createProviderHttp(source, {
            credential: providerCredential(source, ports),
            now: Date.now,
            fetch: async () => {
                requests++
                return Response.json({})
            },
        })
        await assert.rejects(
            http.get(`/api/live?ids=${source.providerServerId}`),
            configuration,
            label
        )
        assert.equal(requests, 0, label)
    }
    assert.deepEqual(failures, ["key_unavailable", "decrypt_failed"])
    // A copied ciphertext opens for no other source or host.
    for (const other of [
        { ...source, guildId: "guild-b" },
        { ...source, origin: "https://attacker.example.test" },
    ]) {
        const credential = providerCredential(other, {
            env: () => undefined,
            keyring: () => raw,
            loadEnvelope: async () => envelope,
        })
        await assert.rejects(credential!(), configuration)
    }
})

test("a legacy variable is read by its operator-assigned name only", async () => {
    const legacy: ResolvedSource = {
        ...source,
        credentialMode: "legacy_env",
        secretRef: "LOGI_GAME_DATA_WDG_TOKEN",
    }
    const names: string[] = []
    const credential = providerCredential(legacy, {
        env: (name) => {
            names.push(name)
            return ` ${SENTINEL} `
        },
        keyring: () => assert.fail("no keyring for a legacy variable"),
        loadEnvelope: async () =>
            assert.fail("no ciphertext for a legacy variable"),
    })
    assert.equal(await credential!(), SENTINEL)
    assert.deepEqual(names, ["LOGI_GAME_DATA_WDG_TOKEN"])
    const unconfirmed = providerCredential(
        { ...legacy, usable: false },
        {
            env: () => SENTINEL,
            keyring: () => undefined,
            loadEnvelope: async () => null,
        }
    )
    await assert.rejects(unconfirmed!(), configuration)
    assert.equal(
        providerCredential(
            { ...source, credentialMode: "none" },
            {
                env: () => SENTINEL,
                keyring: () => raw,
                loadEnvelope: async () => envelope,
            }
        ),
        undefined
    )
})
