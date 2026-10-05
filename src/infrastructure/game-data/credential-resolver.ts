import {
    credentialAad,
    providerKeySchema,
    type CredentialEnvelope,
    type CredentialFailure,
    type ResolvedSource,
} from "../../domain/game-data/credentials"
import {
    CredentialCipherError,
    decryptCredential,
    parseKeyring,
} from "./credential-cipher"
import { ProviderError } from "../../domain/game-data/contracts"

export type CredentialPorts = {
    /** Reads one operator-named variable; never enumerates the environment. */
    env(name: string): string | undefined
    /** The raw `LOGI_CREDENTIAL_KEYRING` value of this runtime. */
    keyring(): string | undefined
    /** The stored ciphertext for this source, checked against the claim's generation. */
    loadEnvelope(): Promise<CredentialEnvelope | null>
    /** Records why a stored key could not be used; best effort. */
    reportFailure?(category: CredentialFailure): Promise<unknown>
}

/**
 * The key for one claimed source, resolved lazily and at most once per
 * collection run. Every failure is `ProviderError("configuration")`; there is
 * no fallback to an environment variable, another source's key or a keyless
 * request. Undefined means the source is keyless.
 */
export function providerCredential(
    source: ResolvedSource,
    ports: CredentialPorts
): (() => Promise<string>) | undefined {
    if (source.credentialMode === "none") return undefined
    let pending: Promise<string> | undefined
    return () => (pending ??= resolve())
    async function resolve(): Promise<string> {
        if (!source.usable) throw new ProviderError("configuration")
        if (source.credentialMode === "legacy_env") {
            const value = source.secretRef
                ? ports.env(source.secretRef)
                : undefined
            const key = providerKeySchema.safeParse(value)
            if (!key.success) throw new ProviderError("configuration")
            return key.data
        }
        const envelope = await ports.loadEnvelope()
        if (!envelope) throw new ProviderError("configuration")
        try {
            return decryptCredential(
                parseKeyring(ports.keyring()),
                envelope,
                credentialAad({
                    guildId: source.guildId,
                    sourceRef: source.ref,
                    provider: source.provider,
                    origin: source.origin,
                    providerServerId: source.providerServerId,
                })
            )
        } catch (error) {
            const category: CredentialFailure =
                error instanceof CredentialCipherError &&
                error.category === "decrypt_failed"
                    ? "decrypt_failed"
                    : "key_unavailable"
            await ports.reportFailure?.(category).catch(() => undefined)
            throw new ProviderError("configuration")
        }
    }
}

/**
 * The resolver a Convex action uses: this runtime's keyring and the one
 * operator-named variable, with the ciphertext loaded through an internal,
 * generation-checked query.
 */
export function actionCredential(
    source: ResolvedSource,
    runtime: Pick<CredentialPorts, "loadEnvelope" | "reportFailure">
): (() => Promise<string>) | undefined {
    return providerCredential(source, {
        env: (name) => process.env[name],
        keyring: () => process.env.LOGI_CREDENTIAL_KEYRING,
        ...runtime,
    })
}
