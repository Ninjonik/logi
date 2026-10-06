import type { ClaimedConnection, DataSource } from "./contracts"

// The Zod schemas (`providerKeySchema`, `credentialEnvelopeSchema`,
// `sourceDraftSchema`, `gameServerSourceSchema`, …) and the validating helpers
// `draftSource` and `keyringIndex` live in `credentials.schema.ts`, so the
// catalogue reads behind every panel refresh stay free of Zod.
export type {
    ConnectionTestOutcome,
    CredentialEnvelope,
    CredentialFailure,
    GameServerSource,
    GameServerSourceList,
    SourceCommandError,
    SourceDraft,
} from "./credentials.schema"

/**
 * How a provider source authenticates:
 * - `none`: keyless public reads (Wardog Servers directory, optionally CRCON).
 * - `legacy_env`: an operator-assigned Convex environment variable, named by
 *   the source's `secretRef`. Kept only for migration.
 * - `encrypted`: a key a workspace administrator entered, stored encrypted in
 *   `gameDataCredentials` and decrypted only by collector actions.
 */
export const CREDENTIAL_MODES = ["none", "legacy_env", "encrypted"] as const
export type CredentialMode = (typeof CREDENTIAL_MODES)[number]
export type DataProvider = DataSource["provider"]

/** Whether a provider needs, may use or must not receive a key. */
export function credentialRequirement(
    provider: DataProvider
): "required" | "optional" | "forbidden" {
    if (provider === "wardogs_public_directory") return "forbidden"
    return provider === "hll_crcon" ? "optional" : "required"
}

/** Everything a ciphertext is bound to; a change to any field makes it unreadable. */
export type CredentialBinding = {
    guildId: string
    sourceRef: string
    provider: DataProvider
    origin: string
    providerServerId: string
}

/**
 * Additional authenticated data for one credential. Deterministic: a fixed-order
 * JSON array of the owner workspace, the stable source reference, the provider,
 * the canonical origin and the provider server ID. A ciphertext copied to another
 * workspace or source, or kept after a host change, fails authentication instead
 * of sending the key somewhere else.
 */
export function credentialAad(binding: CredentialBinding): string {
    return JSON.stringify([
        "logi.game-data-credential",
        1,
        binding.guildId,
        binding.sourceRef,
        binding.provider,
        new URL(binding.origin).origin,
        binding.providerServerId,
    ])
}

/**
 * The credential a source uses, and whether collection may use it now.
 *
 * Operator catalog entries (`LOGI_GAME_DATA_SOURCES`): a stored encrypted key
 * wins over the variable the entry names, so a migrated source never falls back
 * to its old variable. Workspace registrations carry an explicit mode; a
 * registration from before encrypted keys is read as `legacy_env` and is never
 * usable: a workspace administrator chose that variable name, so it could name
 * another workspace's key. The operator migration encrypts it after checking.
 */
export function resolveCredentialMode(input: {
    provider: DataProvider
    managed: "operator" | "workspace"
    storedMode: CredentialMode | undefined
    secretRef: string | null
    encryptedStored: boolean
}): {
    mode: CredentialMode
    usable: boolean
    reason: "missing_key" | "unconfirmed_variable" | "key_not_allowed" | null
} {
    const mode: CredentialMode =
        input.managed === "operator"
            ? input.encryptedStored
                ? "encrypted"
                : input.secretRef
                  ? "legacy_env"
                  : "none"
            : (input.storedMode ?? (input.secretRef ? "legacy_env" : "none"))
    const requirement = credentialRequirement(input.provider)
    if (requirement === "forbidden" && mode !== "none")
        return { mode, usable: false, reason: "key_not_allowed" }
    if (mode === "none")
        return requirement === "required"
            ? { mode, usable: false, reason: "missing_key" }
            : { mode, usable: true, reason: null }
    if (mode === "encrypted")
        return input.encryptedStored
            ? { mode, usable: true, reason: null }
            : { mode, usable: false, reason: "missing_key" }
    if (!input.secretRef) return { mode, usable: false, reason: "missing_key" }
    return input.managed === "operator"
        ? { mode, usable: true, reason: null }
        : { mode, usable: false, reason: "unconfirmed_variable" }
}

/** A catalog source with how it authenticates; claims and reads pass this to providers. */
export type ResolvedSource = DataSource & {
    credentialMode: CredentialMode
    managed: "operator" | "workspace"
    usable: boolean
}

/** A claimed collection run with how its source authenticates. */
export type ResolvedClaim = ClaimedConnection & ResolvedSource

/**
 * Identity of the provider endpoint a connection was configured for. Includes
 * the operator variable name and network exception, never a key or ciphertext.
 * Field order matches the stored format so existing connections keep matching.
 */
export function sourceFingerprint(source: DataSource): string {
    return JSON.stringify({
        ref: source.ref,
        guildId: source.guildId,
        gameId: source.gameId,
        provider: source.provider,
        providerServerId: source.providerServerId,
        origin: source.origin,
        secretRef: source.secretRef,
        allowedAddresses: source.allowedAddresses,
    })
}

export const GAME_SERVER_SOURCE_LIMIT = 20

/** Two sources of one workspace address the same provider server. */
export function sameSourceIdentity(a: DataSource, b: DataSource): boolean {
    return (
        a.guildId === b.guildId &&
        a.provider === b.provider &&
        a.providerServerId === b.providerServerId &&
        new URL(a.origin).origin === new URL(b.origin).origin
    )
}

/** Display names compare case- and whitespace-insensitively within a workspace. */
export function displayNameKey(value: string): string {
    return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase()
}
