import {
    CredentialCipherError,
    decryptCredential,
    encryptCredential,
    needsReencryption,
    parseKeyring,
} from "./credential-cipher"
import { credentialAad } from "../../domain/game-data/credentials"
import { randomBytes } from "node:crypto"
import assert from "node:assert/strict"
import test from "node:test"

const material = () => randomBytes(32).toString("base64")
const keyA = material(),
    keyB = material()
const keyring = (current: string, keys: Record<string, string>) =>
    parseKeyring(JSON.stringify({ current, keys }))!
const binding = {
    guildId: "guild-a",
    sourceRef: "src-0123456789abcdef0123456789abcdef",
    provider: "wardogs_warcon" as const,
    origin: "https://wardogs.example.test",
    providerServerId: "11111111-1111-4111-8111-111111111111",
}
const aad = credentialAad(binding)
const SENTINEL = "sentinel-provider-key-7f3a9c"
const rejects =
    (category: string) =>
    (error: unknown): boolean =>
        error instanceof CredentialCipherError &&
        error.category === category &&
        !error.message.includes(SENTINEL)

test("round trip stores no plaintext and uses a fresh nonce every time", () => {
    const ring = keyring("k1", { k1: keyA })
    const first = encryptCredential(ring, SENTINEL, aad)
    const second = encryptCredential(ring, SENTINEL, aad)
    assert.equal(first.keyId, "k1")
    assert.equal(first.format, 1)
    assert.notEqual(first.nonce, second.nonce)
    assert.notEqual(first.ciphertext, second.ciphertext)
    assert.equal(JSON.stringify(first).includes(SENTINEL), false)
    assert.equal(
        JSON.stringify(first).includes(
            Buffer.from(SENTINEL).toString("base64")
        ),
        false
    )
    assert.equal(decryptCredential(ring, first, aad), SENTINEL)
    // Pasted whitespace is dropped before encryption.
    assert.equal(
        decryptCredential(
            ring,
            encryptCredential(ring, `  ${SENTINEL}\n`, aad),
            aad
        ),
        SENTINEL
    )
})

test("tampered ciphertext, tag or nonce fails authentication", () => {
    const ring = keyring("k1", { k1: keyA })
    const envelope = encryptCredential(ring, SENTINEL, aad)
    const flip = (value: string) => {
        const bytes = Buffer.from(value, "base64url")
        bytes[0] ^= 1
        return bytes.toString("base64url")
    }
    for (const field of ["ciphertext", "tag", "nonce"] as const)
        assert.throws(
            () =>
                decryptCredential(
                    ring,
                    { ...envelope, [field]: flip(envelope[field]) },
                    aad
                ),
            rejects("decrypt_failed"),
            field
        )
    assert.throws(
        () => decryptCredential(ring, { ...envelope, tag: "short" }, aad),
        rejects("decrypt_failed")
    )
})

test("a different binding cannot open the ciphertext", () => {
    const ring = keyring("k1", { k1: keyA })
    const envelope = encryptCredential(ring, SENTINEL, aad)
    for (const change of [
        { guildId: "guild-b" },
        { sourceRef: "src-ffffffffffffffffffffffffffffffff" },
        { provider: "wardogs_rcon" as const },
        { origin: "https://attacker.example.test" },
        { providerServerId: "22222222-2222-4222-8222-222222222222" },
    ])
        assert.throws(
            () =>
                decryptCredential(
                    ring,
                    envelope,
                    credentialAad({ ...binding, ...change })
                ),
            rejects("decrypt_failed"),
            JSON.stringify(change)
        )
    // The canonical origin is part of the binding, not its spelling.
    assert.equal(
        decryptCredential(
            ring,
            envelope,
            credentialAad({
                ...binding,
                origin: "https://WARDOGS.example.test/",
            })
        ),
        SENTINEL
    )
})

test("wrong material, unknown key ID and a missing keyring are distinct failures", () => {
    const envelope = encryptCredential(
        keyring("k1", { k1: keyA }),
        SENTINEL,
        aad
    )
    assert.throws(
        () => decryptCredential(keyring("k1", { k1: keyB }), envelope, aad),
        rejects("decrypt_failed")
    )
    assert.throws(
        () => decryptCredential(keyring("k2", { k2: keyB }), envelope, aad),
        rejects("key_unavailable")
    )
    assert.throws(
        () => decryptCredential(null, envelope, aad),
        rejects("key_unavailable")
    )
})

test("rotation keeps old ciphertexts readable until they are re-encrypted", () => {
    const old = keyring("k1", { k1: keyA })
    const envelope = encryptCredential(old, SENTINEL, aad)
    const rotated = keyring("k2", { k1: keyA, k2: keyB })
    assert.equal(needsReencryption(rotated, envelope), true)
    assert.equal(decryptCredential(rotated, envelope, aad), SENTINEL)
    const renewed = encryptCredential(
        rotated,
        decryptCredential(rotated, envelope, aad),
        aad
    )
    assert.equal(renewed.keyId, "k2")
    assert.equal(needsReencryption(rotated, renewed), false)
    // Once the old key is retired, only re-encrypted values remain readable.
    const retired = keyring("k2", { k2: keyB })
    assert.equal(decryptCredential(retired, renewed, aad), SENTINEL)
    assert.throws(
        () => decryptCredential(retired, envelope, aad),
        rejects("key_unavailable")
    )
})

test("the keyring is validated without echoing its material", () => {
    assert.equal(parseKeyring(undefined), null)
    assert.equal(parseKeyring("  "), null)
    const short = randomBytes(16).toString("base64")
    for (const raw of [
        "not json",
        JSON.stringify({ current: "k1", keys: {} }),
        JSON.stringify({ current: "k9", keys: { k1: keyA } }),
        JSON.stringify({ current: "k1", keys: { k1: short } }),
        JSON.stringify({ current: "K1", keys: { K1: keyA } }),
        JSON.stringify({ current: "k1", keys: { k1: keyA, k2: keyA } }),
        JSON.stringify({ current: "k1", keys: { k1: keyA }, extra: true }),
        JSON.stringify({
            current: "k0",
            keys: Object.fromEntries(
                Array.from({ length: 9 }, (_, i) => [`k${i}`, material()])
            ),
        }),
    ])
        assert.throws(
            () => parseKeyring(raw),
            (error: unknown) =>
                error instanceof CredentialCipherError &&
                error.category === "keyring_invalid" &&
                !error.message.includes(keyA) &&
                !error.message.includes(short)
        )
})

test("encryption refuses a key that could split a header, without echoing it", () => {
    const ring = keyring("k1", { k1: keyA })
    for (const value of [
        "short",
        `${SENTINEL}\r\nx-evil: 1`,
        `${SENTINEL} two`,
    ])
        assert.throws(
            () => encryptCredential(ring, value, aad),
            (error: unknown) =>
                error instanceof Error && !error.message.includes(SENTINEL)
        )
})
