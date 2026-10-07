import {
    credentialAad,
    credentialRequirement,
    displayNameKey,
    resolveCredentialMode,
    sameSourceIdentity,
    sourceFingerprint,
} from "./credentials"
import { draftSource, providerKeySchema } from "./credentials.schema"
import { parseSources } from "./policy.schema"
import assert from "node:assert/strict"
import test from "node:test"

const scope = {
    guildId: "guild-a",
    ref: "src-0123456789abcdef0123456789abcdef",
}
const warcon = {
    displayName: "Valkyria Warcon",
    gameId: "wardogs" as const,
    provider: "wardogs_warcon" as const,
    origin: "https://Wardogs.Example.test",
    providerServerId: "11111111-1111-4111-8111-111111111111",
}

test("a draft becomes a canonical source without operator-only fields", () => {
    const result = draftSource(warcon, scope)
    assert.ok(result.ok)
    assert.equal(result.source.origin, "https://wardogs.example.test")
    assert.equal(result.source.secretRef, null)
    assert.deepEqual(result.source.allowedAddresses, [])
    for (const origin of [
        "http://wardogs.example.test",
        "https://user:pass@wardogs.example.test",
        "https://wardogs.example.test/api",
        "https://wardogs.example.test/?x=1",
        "https://wardogs.example.test/#x",
        "wardogs.example.test",
    ])
        assert.equal(
            draftSource({ ...warcon, origin }, scope).ok,
            false,
            origin
        )
    assert.equal(
        draftSource({ ...warcon, providerServerId: "not-a-uuid" }, scope).ok,
        false
    )
    assert.equal(
        draftSource({ ...warcon, gameId: "hell_let_loose" }, scope).ok,
        false
    )
    const crcon = {
        ...warcon,
        gameId: "hell_let_loose" as const,
        provider: "hll_crcon" as const,
        origin: "https://admin.example.test",
    }
    assert.equal(
        draftSource({ ...crcon, providerServerId: "1" }, scope).ok,
        true
    )
    assert.equal(
        draftSource({ ...crcon, providerServerId: "one" }, scope).ok,
        false
    )
    // The public directory has one fixed origin.
    assert.equal(
        draftSource({ ...warcon, provider: "wardogs_public_directory" }, scope)
            .ok,
        false
    )
})

test("the AAD is a deterministic, canonical, ordered binding", () => {
    const binding = {
        guildId: "guild-a",
        sourceRef: scope.ref,
        provider: "wardogs_warcon" as const,
        origin: "https://Wardogs.example.test/",
        providerServerId: warcon.providerServerId,
    }
    assert.equal(
        credentialAad(binding),
        JSON.stringify([
            "logi.game-data-credential",
            1,
            "guild-a",
            scope.ref,
            "wardogs_warcon",
            "https://wardogs.example.test",
            warcon.providerServerId,
        ])
    )
    assert.equal(credentialAad(binding), credentialAad({ ...binding }))
    // Field values cannot shift into each other.
    assert.notEqual(
        credentialAad({ ...binding, guildId: "a", sourceRef: "b-c" }),
        credentialAad({ ...binding, guildId: "a-b", sourceRef: "c" })
    )
})

test("provider keys are visible ASCII of bounded length", () => {
    assert.equal(providerKeySchema.parse("  abcdefgh\n"), "abcdefgh")
    for (const value of [
        "short",
        "abc def gh",
        "abcdefgh\u0000",
        "abcdéfgh",
        "x".repeat(4097),
    ])
        assert.equal(providerKeySchema.safeParse(value).success, false, value)
})

test("credential modes have one interpretation, including legacy rows", () => {
    const base = {
        provider: "wardogs_warcon" as const,
        managed: "workspace" as const,
        storedMode: undefined,
        secretRef: null,
        encryptedStored: false,
    }
    // A registration from before encrypted keys names a variable an administrator chose.
    assert.deepEqual(
        resolveCredentialMode({ ...base, secretRef: "LOGI_GAME_DATA_X_TOKEN" }),
        { mode: "legacy_env", usable: false, reason: "unconfirmed_variable" }
    )
    assert.deepEqual(resolveCredentialMode(base), {
        mode: "none",
        usable: false,
        reason: "missing_key",
    })
    assert.deepEqual(
        resolveCredentialMode({ ...base, storedMode: "encrypted" }),
        { mode: "encrypted", usable: false, reason: "missing_key" }
    )
    assert.deepEqual(
        resolveCredentialMode({
            ...base,
            storedMode: "encrypted",
            encryptedStored: true,
        }),
        { mode: "encrypted", usable: true, reason: null }
    )
    // Operator entries: a stored key wins; the variable is never a fallback.
    const operator = {
        ...base,
        managed: "operator" as const,
        secretRef: "LOGI_GAME_DATA_X_TOKEN",
    }
    assert.equal(resolveCredentialMode(operator).mode, "legacy_env")
    assert.equal(resolveCredentialMode(operator).usable, true)
    assert.deepEqual(
        resolveCredentialMode({ ...operator, encryptedStored: true }),
        { mode: "encrypted", usable: true, reason: null }
    )
    assert.deepEqual(
        resolveCredentialMode({
            ...base,
            provider: "wardogs_public_directory",
            storedMode: "encrypted",
            encryptedStored: true,
        }),
        { mode: "encrypted", usable: false, reason: "key_not_allowed" }
    )
    assert.deepEqual(
        resolveCredentialMode({
            ...base,
            provider: "hll_crcon",
            storedMode: "none",
        }),
        { mode: "none", usable: true, reason: null }
    )
    assert.equal(credentialRequirement("wardogs_rcon"), "required")
})

test("the fingerprint matches the stored format and never includes key material", () => {
    const [source] = parseSources(
        JSON.stringify([
            {
                ref: "wdg",
                guildId: "guild-a",
                gameId: "wardogs",
                provider: "wardogs_warcon",
                providerServerId: warcon.providerServerId,
                origin: "https://wardogs.example.test",
                secretRef: "LOGI_GAME_DATA_WDG_TOKEN",
            },
        ])
    )
    assert.equal(sourceFingerprint(source!), JSON.stringify(source))
    assert.equal(
        sourceFingerprint({
            ...source!,
            credentialMode: "encrypted",
            managed: "operator",
            usable: true,
        } as typeof source),
        JSON.stringify(source)
    )
})

test("identity and display names compare within one workspace", () => {
    const a = draftSource(warcon, scope)
    const b = draftSource(
        { ...warcon, origin: "https://wardogs.example.test/" },
        { ...scope, ref: "src-ffffffffffffffffffffffffffffffff" }
    )
    const c = draftSource(warcon, { ...scope, guildId: "guild-b" })
    assert.ok(a.ok && b.ok && c.ok)
    assert.equal(sameSourceIdentity(a.source, b.source), true)
    assert.equal(sameSourceIdentity(a.source, c.source), false)
    assert.equal(displayNameKey("  Valkyria   WARCON "), "valkyria warcon")
})
