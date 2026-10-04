import {
    dataGameSchema,
    providerSchema,
    sourceSchema,
    type DataSource,
} from "./contracts"
import { z } from "zod"

const ref = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/)
/** Name of the Convex environment variable that holds the provider token; never the token. */
const secretRef = z
    .string()
    .regex(/^LOGI_GAME_DATA_[A-Z0-9_]+_TOKEN$/)
    .nullable()
const allowedAddresses = z.array(z.string().min(1).max(64)).max(16).default([])

/** What a workspace administrator supplies to register a provider source. */
export const sourceRegistrationSchema = z.strictObject({
    ref,
    gameId: dataGameSchema,
    provider: providerSchema,
    providerServerId: z.string().trim().min(1).max(200),
    origin: z.string().trim().min(1).max(200),
    secretRef,
    allowedAddresses,
})
export type SourceRegistration = z.infer<typeof sourceRegistrationSchema>

/** Rotation points an existing source at a new credential reference; identity never changes. */
export const sourceRotationSchema = z.strictObject({
    ref,
    secretRef,
    allowedAddresses,
})
export type SourceRotation = z.infer<typeof sourceRotationSchema>

export type SourceRegistrationError =
    "invalid_source" | "duplicate_ref" | "duplicate_identity"

function sameIdentity(a: DataSource, b: DataSource) {
    return (
        a.guildId === b.guildId &&
        a.provider === b.provider &&
        a.providerServerId === b.providerServerId &&
        new URL(a.origin).origin === new URL(b.origin).origin
    )
}

/** Validates a registration against the full provider rules and the current catalog. */
export function registerSource(
    catalog: readonly DataSource[],
    guildId: string,
    input: SourceRegistration
):
    | { ok: true; source: DataSource }
    | { ok: false; error: SourceRegistrationError } {
    const parsed = sourceSchema.safeParse({ ...input, guildId })
    if (!parsed.success) return { ok: false, error: "invalid_source" }
    const source = parsed.data
    // References are global: an operator catalog entry and a registration may not collide.
    if (catalog.some((entry) => entry.ref === source.ref))
        return { ok: false, error: "duplicate_ref" }
    if (catalog.some((entry) => sameIdentity(entry, source)))
        return { ok: false, error: "duplicate_identity" }
    return { ok: true, source }
}

/** Applies a credential rotation; provider rules still decide whether the result is valid. */
export function rotateSource(
    current: DataSource,
    input: SourceRotation
): { ok: true; source: DataSource } | { ok: false; error: "invalid_source" } {
    const parsed = sourceSchema.safeParse({
        ...current,
        secretRef: input.secretRef,
        allowedAddresses: input.allowedAddresses,
    })
    return parsed.success
        ? { ok: true, source: parsed.data }
        : { ok: false, error: "invalid_source" }
}

/** Dashboard projection: the credential reference is a variable name, not a secret. */
export const registeredSourceSchema = z.strictObject({
    ref,
    gameId: dataGameSchema,
    provider: providerSchema,
    providerServerId: z.string(),
    origin: z.string(),
    secretRef,
    allowedAddresses: z.array(z.string()),
    managed: z.enum(["workspace", "operator"]),
    updatedAt: z.string().nullable(),
})
export type RegisteredSource = z.infer<typeof registeredSourceSchema>
export const registeredSourceListSchema = z.strictObject({
    sources: z.array(registeredSourceSchema).max(200),
})
