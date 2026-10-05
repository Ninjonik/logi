import {
    CredentialCipherError,
    encryptCredential,
    parseKeyring,
} from "@/infrastructure/game-data/credential-cipher"
import {
    credentialAad,
    type CredentialBinding,
    type CredentialEnvelope,
} from "@/domain/game-data/credentials"
import {
    testProviderConnection,
    type ConnectionTestResult,
} from "@/infrastructure/game-data/connection-test"
import { createProviderHttp } from "@/infrastructure/game-data/provider-http"
import type { DataSource } from "@/domain/game-data/contracts"
import { getCredentialKeyring } from "@/lib/env"
import { randomUUID } from "node:crypto"

/**
 * Encrypts a key in this server process, so only ciphertext reaches Convex.
 * Null when the operator has not activated encryption: nothing is stored then,
 * and never as plaintext.
 */
export function credentialEncryption(): {
    encrypt(binding: CredentialBinding, key: string): CredentialEnvelope
} | null {
    let keyring
    try {
        keyring = parseKeyring(getCredentialKeyring())
    } catch (error) {
        if (error instanceof CredentialCipherError) return null
        throw error
    }
    return keyring
        ? {
              encrypt: (binding, key) =>
                  encryptCredential(keyring, key, credentialAad(binding)),
          }
        : null
}

/**
 * One read-only connection test with a key held only in memory, through the
 * collector's transport (HTTPS, address checks, no redirects, path allowlist,
 * timeout and size limit).
 */
export function testGameServerConnection(
    source: DataSource,
    key: string | null
): Promise<ConnectionTestResult> {
    return testProviderConnection(
        source,
        createProviderHttp(source, {
            credential: key === null ? undefined : async () => key,
            now: Date.now,
        }),
        { keyed: key !== null, now: Date.now }
    )
}

/** A stable, unguessable source reference; the administrator's alias is separate. */
export function newSourceRef(): string {
    return `src-${randomUUID().replace(/-/g, "")}`
}
