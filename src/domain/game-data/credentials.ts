import {
    dataGameSchema,
    errorCategorySchema,
    providerSchema,
    sourceSchema,
    type ClaimedConnection,
    type DataSource,
} from "./contracts"
import { z } from "zod"

/**
 * How a provider source authenticates:
 * - `none`: keyless public reads (Wardog Servers directory, optionally CRCON).
 * - `legacy_env`: an operator-assigned Convex environment variable, named by
 *   the source's `secretRef`. Kept only for migration.
 * - `encrypted`: a key a workspace administrator entered, stored encrypted in
 *   `gameDataCredentials` and decrypted only by collector actions.
 */
export const credentialModeSchema = z.enum(["none", "legacy_env", "encrypted"])
export type CredentialMode = z.infer<typeof credentialModeSchema>
export type DataProvider = z.infer<typeof providerSchema>

/** Whether a provider needs, may use or must not receive a key. */
export function credentialRequirement(
    provider: DataProvider
): "required" | "optional" | "forbidden" {
    if (provider === "wardogs_public_directory") return "forbidden"
    return provider === "hll_crcon" ? "optional" : "required"
}

/**
 * A provider key as an administrator pastes it. Surrounding whitespace is
 * dropped; the rest must be visible ASCII so it can never split an HTTP header.
 */
export const providerKeySchema = z
    .string()
    .trim()
    .min(8)
    .max(4096)
    .regex(/^[\x21-\x7E]+$/)

/** Identifier of one key in the operator keyring; never the key itself. */
export const keyIdSchema = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,31}$/)

/**
 * A stored ciphertext: AES-256-GCM with a 96-bit random nonce and a 128-bit
 * tag, base64url without padding. Holds no plaintext and leaves Convex only
 * to the collector actions that decrypt it.
 */
export const credentialEnvelopeSchema = z.strictObject({
    format: z.literal(1),
    keyId: keyIdSchema,
    nonce: z.string().regex(/^[A-Za-z0-9_-]{16}$/),
    ciphertext: z.string().regex(/^[A-Za-z0-9_-]{11,5462}$/),
    tag: z.string().regex(/^[A-Za-z0-9_-]{22}$/),
})
export type CredentialEnvelope = z.infer<typeof credentialEnvelopeSchema>

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

/** Workspace-administrator input for a new source. Identity cannot change later. */
export const sourceDraftSchema = z.strictObject({
    displayName: z.string().trim().min(1).max(80),
    gameId: dataGameSchema,
    provider: providerSchema,
    origin: z.string().trim().min(1).max(200),
    providerServerId: z.string().trim().min(1).max(200),
})
export type SourceDraft = z.infer<typeof sourceDraftSchema>
export const displayNameSchema = sourceDraftSchema.shape.displayName

/** Stable source references the gateway generates; aliases are display names. */
export const generatedSourceRefSchema = z.string().regex(/^src-[0-9a-f]{32}$/)

/**
 * The provider source a draft describes, with the canonical origin and no
 * operator-only fields: workspaces never name variables or network exceptions.
 */
export function draftSource(
    draft: SourceDraft,
    scope: { guildId: string; ref: string }
): { ok: true; source: DataSource } | { ok: false } {
    let url: URL
    try {
        url = new URL(draft.origin)
    } catch {
        return { ok: false }
    }
    if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.pathname !== "/" ||
        url.search ||
        url.hash ||
        draft.origin.includes("?") ||
        draft.origin.includes("#") ||
        // CRCON addresses servers by their numeric server number.
        (draft.provider === "hll_crcon" &&
            !/^\d{1,10}$/.test(draft.providerServerId))
    )
        return { ok: false }
    const parsed = sourceSchema.safeParse({
        ref: scope.ref,
        guildId: scope.guildId,
        gameId: draft.gameId,
        provider: draft.provider,
        providerServerId: draft.providerServerId,
        origin: url.origin,
        secretRef: null,
        allowedAddresses: [],
    })
    return parsed.success ? { ok: true, source: parsed.data } : { ok: false }
}

/** Read-only connection test results an administrator sees. */
export const connectionTestOutcomeSchema = z.enum([
    "ok",
    "unauthorized",
    "server_mismatch",
    "rate_limited",
    "timeout",
    "network",
    "invalid_response",
    "configuration",
    "unsupported",
    "key_unavailable",
])
export type ConnectionTestOutcome = z.infer<typeof connectionTestOutcomeSchema>

/** Why a stored key could not be used, as far as the dashboard may know. */
export const credentialFailureSchema = z.enum([
    "key_unavailable",
    "decrypt_failed",
])
export type CredentialFailure = z.infer<typeof credentialFailureSchema>

/**
 * Dashboard projection of one source. An explicit allowlist of fields: no
 * ciphertext, nonce, tag, key ID, variable name or network exception.
 */
export const gameServerSourceSchema = z.strictObject({
    ref: z.string(),
    displayName: z.string(),
    gameId: dataGameSchema,
    provider: providerSchema,
    origin: z.string(),
    providerServerId: z.string(),
    managed: z.enum(["workspace", "operator"]),
    revision: z.number().int().nonnegative(),
    key: z.strictObject({
        state: z.enum([
            "set",
            "missing",
            "not_required",
            "environment",
            "needs_operator",
        ]),
        changedAt: z.string().nullable(),
        verified: z.boolean(),
        failure: credentialFailureSchema.nullable(),
    }),
    collection: z
        .strictObject({
            enabled: z.boolean(),
            errorCategory: errorCategorySchema.nullable(),
            lastSuccessAt: z.string().nullable(),
        })
        .nullable(),
    lastTest: z
        .strictObject({
            at: z.string(),
            outcome: connectionTestOutcomeSchema,
        })
        .nullable(),
})
export type GameServerSource = z.infer<typeof gameServerSourceSchema>
export const GAME_SERVER_SOURCE_LIMIT = 20
export const gameServerSourceListSchema = z.strictObject({
    sources: z
        .array(gameServerSourceSchema)
        .max(GAME_SERVER_SOURCE_LIMIT + 100),
    limit: z.number().int().positive(),
    encryption: z.enum(["active", "unavailable"]),
})
export type GameServerSourceList = z.infer<typeof gameServerSourceListSchema>

/** Errors the source and credential commands return; never a provider message. */
export const sourceCommandErrorSchema = z.enum([
    "invalid_source",
    "invalid_key",
    "duplicate_name",
    "duplicate_identity",
    "limit_reached",
    "not_found",
    "revision_conflict",
    "operator_managed",
    "key_required",
    "key_not_allowed",
    "verification_required",
    "encryption_unavailable",
    "rate_limited",
    "unavailable",
])
export type SourceCommandError = z.infer<typeof sourceCommandErrorSchema>

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

/**
 * Key IDs a runtime's keyring holds, read without decoding key material. The
 * default Convex runtime uses this to refuse a ciphertext it could not decrypt
 * later; only collector actions ever decode keys.
 */
export function keyringIndex(
    raw: string | undefined
): { current: string; ids: string[] } | null {
    if (!raw?.trim()) return null
    try {
        const parsed = z
            .strictObject({
                current: keyIdSchema,
                keys: z.record(keyIdSchema, z.string()),
            })
            .safeParse(JSON.parse(raw))
        if (!parsed.success) return null
        const ids = Object.keys(parsed.data.keys)
        return ids.includes(parsed.data.current)
            ? { current: parsed.data.current, ids }
            : null
    } catch {
        return null
    }
}
