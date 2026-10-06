import {
    dataGameSchema,
    errorCategorySchema,
    providerSchema,
    sourceSchema,
    type DataSource,
} from "./contracts"
import { CREDENTIAL_MODES, GAME_SERVER_SOURCE_LIMIT } from "./credentials"
import { z } from "zod"

/**
 * Zod schemas of provider keys, sources and their dashboard projections. The
 * pure rules (`credentialRequirement`, `resolveCredentialMode`,
 * `sourceFingerprint`, …) stay in `credentials.ts`, which every catalogue
 * read walks without Zod.
 */
export const credentialModeSchema = z.enum(CREDENTIAL_MODES)

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
