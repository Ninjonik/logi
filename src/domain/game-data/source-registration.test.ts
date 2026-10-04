import {
    registerSource,
    rotateSource,
    sourceRegistrationSchema,
} from "./source-registration"
import { sourceSchema } from "./contracts"
import assert from "node:assert/strict"
import test from "node:test"

const existing = sourceSchema.parse({
    ref: "operator-warcon",
    guildId: "guild",
    gameId: "wardogs",
    provider: "wardogs_warcon",
    providerServerId: "0d1c7f0e-4c2b-4b1a-9d3e-3c6f2d1a8b55",
    origin: "https://panel.example.com",
    secretRef: "LOGI_GAME_DATA_WARCON_TOKEN",
    allowedAddresses: [],
})
const registration = sourceRegistrationSchema.parse({
    ref: "crcon-main",
    gameId: "hell_let_loose",
    provider: "hll_crcon",
    providerServerId: "1",
    origin: "https://crcon.example.com",
    secretRef: "LOGI_GAME_DATA_CRCON_TOKEN",
})

test("a valid registration is scoped to the workspace and keeps the provider rules", () => {
    const result = registerSource([existing], "guild", registration)
    assert.ok(result.ok)
    assert.equal(result.source.guildId, "guild")
    assert.deepEqual(result.source.allowedAddresses, [])
    assert.deepEqual(
        registerSource([existing], "guild", {
            ...registration,
            provider: "wardogs_rcon",
        }),
        { ok: false, error: "invalid_source" }
    )
    assert.deepEqual(
        registerSource([existing], "guild", {
            ...registration,
            origin: "http://crcon.example.com",
        }),
        { ok: false, error: "invalid_source" }
    )
})

test("references are global and one provider identity is registered once per workspace", () => {
    assert.deepEqual(
        registerSource([existing], "other-guild", {
            ...registration,
            ref: "operator-warcon",
        }),
        { ok: false, error: "duplicate_ref" }
    )
    assert.deepEqual(
        registerSource([existing], "guild", {
            ref: "warcon-again",
            gameId: "wardogs",
            provider: "wardogs_warcon",
            providerServerId: existing.providerServerId,
            origin: "https://panel.example.com/",
            secretRef: "LOGI_GAME_DATA_WARCON_2_TOKEN",
            allowedAddresses: [],
        }),
        { ok: false, error: "duplicate_identity" }
    )
    assert.ok(
        registerSource([existing], "other-guild", {
            ref: "warcon-other",
            gameId: "wardogs",
            provider: "wardogs_warcon",
            providerServerId: existing.providerServerId,
            origin: "https://panel.example.com",
            secretRef: "LOGI_GAME_DATA_WARCON_2_TOKEN",
            allowedAddresses: [],
        }).ok
    )
})

test("rotation changes only the credential reference and allowlist, and provider rules still apply", () => {
    const rotated = rotateSource(existing, {
        ref: existing.ref,
        secretRef: "LOGI_GAME_DATA_WARCON_2026_TOKEN",
        allowedAddresses: ["203.0.113.7"],
    })
    assert.ok(rotated.ok)
    assert.equal(rotated.source.secretRef, "LOGI_GAME_DATA_WARCON_2026_TOKEN")
    assert.equal(rotated.source.providerServerId, existing.providerServerId)
    assert.deepEqual(
        rotateSource(existing, {
            ref: existing.ref,
            secretRef: null,
            allowedAddresses: [],
        }),
        { ok: false, error: "invalid_source" }
    )
    assert.ok(
        !sourceRegistrationSchema.safeParse({
            ...registration,
            secretRef: "sk_live_plaintext",
        }).success
    )
})
