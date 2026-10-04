import {
    credentialEnvelopeSchema,
    keyIdSchema,
    providerKeySchema,
    type CredentialEnvelope,
} from "../../domain/game-data/credentials"
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"
import { z } from "zod"

/**
 * The operator keyring: AES-256 keys by ID and the ID new ciphertexts use.
 * Configured once per deployment in `LOGI_CREDENTIAL_KEYRING`, outside the
 * database, and never derived from another secret.
 */
export type Keyring = { current: string; keys: ReadonlyMap<string, Buffer> }

/**
 * A failure category only. Messages never contain key material, plaintext or
 * ciphertext, so these errors are safe to log and to map to a sanitized result.
 */
export class CredentialCipherError extends Error {
    constructor(
        readonly category:
            "keyring_invalid" | "key_unavailable" | "decrypt_failed"
    ) {
        super(`Credential ${category.replace("_", " ")}.`)
        this.name = "CredentialCipherError"
    }
}

const MAX_KEYS = 8
const keyringSchema = z.strictObject({
    current: keyIdSchema,
    keys: z.record(keyIdSchema, z.string().regex(/^[A-Za-z0-9+/]{43}=$/)),
})

/**
 * Parses `{"current":"<id>","keys":{"<id>":"<base64 of 32 random bytes>"}}`.
 * Unset means encryption is not activated (null); anything malformed throws.
 */
export function parseKeyring(raw: string | undefined): Keyring | null {
    if (!raw?.trim()) return null
    let value: unknown
    try {
        value = JSON.parse(raw)
    } catch {
        throw new CredentialCipherError("keyring_invalid")
    }
    const parsed = keyringSchema.safeParse(value)
    if (!parsed.success) throw new CredentialCipherError("keyring_invalid")
    const entries = Object.entries(parsed.data.keys)
    if (!entries.length || entries.length > MAX_KEYS)
        throw new CredentialCipherError("keyring_invalid")
    const keys = new Map<string, Buffer>()
    const material = new Set<string>()
    for (const [id, encoded] of entries) {
        const key = Buffer.from(encoded, "base64")
        // Reusing material under two IDs would defeat rotation.
        if (key.length !== 32 || material.has(encoded))
            throw new CredentialCipherError("keyring_invalid")
        material.add(encoded)
        keys.set(id, key)
    }
    if (!keys.has(parsed.data.current))
        throw new CredentialCipherError("keyring_invalid")
    return { current: parsed.data.current, keys }
}

/** Encrypts one provider key under the current keyring key with a fresh random nonce. */
export function encryptCredential(
    keyring: Keyring,
    plaintext: string,
    aad: string
): CredentialEnvelope {
    const key = providerKeySchema.safeParse(plaintext)
    // Callers validate first; the message never repeats the rejected value.
    if (!key.success) throw new Error("Invalid provider key.")
    const material = keyring.keys.get(keyring.current)
    if (!material) throw new CredentialCipherError("key_unavailable")
    const nonce = randomBytes(12)
    const cipher = createCipheriv("aes-256-gcm", material, nonce, {
        authTagLength: 16,
    })
    cipher.setAAD(Buffer.from(aad, "utf8"))
    const ciphertext = Buffer.concat([
        cipher.update(key.data, "utf8"),
        cipher.final(),
    ])
    return {
        format: 1,
        keyId: keyring.current,
        nonce: nonce.toString("base64url"),
        ciphertext: ciphertext.toString("base64url"),
        tag: cipher.getAuthTag().toString("base64url"),
    }
}

/**
 * Decrypts and re-validates a stored key. A missing keyring or key ID is
 * `key_unavailable`; any tampering, wrong key or different binding is
 * `decrypt_failed`. There is no fallback to another key or credential.
 */
export function decryptCredential(
    keyring: Keyring | null,
    envelope: CredentialEnvelope,
    aad: string
): string {
    const parsed = credentialEnvelopeSchema.safeParse(envelope)
    if (!parsed.success) throw new CredentialCipherError("decrypt_failed")
    const material = keyring?.keys.get(parsed.data.keyId)
    if (!material) throw new CredentialCipherError("key_unavailable")
    let plaintext: string
    try {
        const decipher = createDecipheriv(
            "aes-256-gcm",
            material,
            Buffer.from(parsed.data.nonce, "base64url"),
            { authTagLength: 16 }
        )
        decipher.setAAD(Buffer.from(aad, "utf8"))
        decipher.setAuthTag(Buffer.from(parsed.data.tag, "base64url"))
        plaintext = Buffer.concat([
            decipher.update(Buffer.from(parsed.data.ciphertext, "base64url")),
            decipher.final(),
        ]).toString("utf8")
    } catch {
        throw new CredentialCipherError("decrypt_failed")
    }
    const key = providerKeySchema.safeParse(plaintext)
    if (!key.success || key.data !== plaintext)
        throw new CredentialCipherError("decrypt_failed")
    return plaintext
}

/** A ciphertext under an older keyring key, due for re-encryption. */
export function needsReencryption(
    keyring: Keyring,
    envelope: CredentialEnvelope
): boolean {
    return envelope.keyId !== keyring.current
}
