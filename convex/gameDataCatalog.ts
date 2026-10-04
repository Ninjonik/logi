import {
    resolveCredentialMode,
    sourceFingerprint,
    type ResolvedSource,
} from "../src/domain/game-data/credentials"
import {
    sourceSchema,
    type DataSource,
} from "../src/domain/game-data/contracts"
import { parseSources } from "../src/domain/game-data/policy"
import type { QueryCtx } from "./_generated/server"
import type { Doc } from "./_generated/dataModel"

type Db = Pick<QueryCtx, "db">

/** Upper bound of one workspace's registrations, read through the guild index. */
export const WORKSPACE_SOURCE_READ_LIMIT = 120

export type CatalogEntry = {
    source: ResolvedSource
    /** The workspace registration, or null for an operator catalog entry. */
    row: Doc<"gameDataSources"> | null
    credential: Doc<"gameDataCredentials"> | null
    reason: ReturnType<typeof resolveCredentialMode>["reason"]
}

export function operatorSources(): DataSource[] {
    return parseSources(process.env.LOGI_GAME_DATA_SOURCES)
}

/**
 * A registration shaped like an operator entry. A workspace never uses a
 * network exception; a legacy registration keeps its variable name only so the
 * operator migration can find it.
 */
export function registeredSource(row: Doc<"gameDataSources">): DataSource {
    const legacy =
        row.credentialMode === undefined || row.credentialMode === "legacy_env"
    return sourceSchema.parse({
        ref: row.ref,
        guildId: row.guildId,
        gameId: row.gameId,
        provider: row.provider,
        providerServerId: row.providerServerId,
        origin: row.origin,
        secretRef: legacy ? row.secretRef : null,
        allowedAddresses: [],
    })
}

export async function credentialRow(
    ctx: Db,
    guildId: string,
    sourceRef: string
): Promise<Doc<"gameDataCredentials"> | null> {
    return await ctx.db
        .query("gameDataCredentials")
        .withIndex("guildId_sourceRef", (q) =>
            q.eq("guildId", guildId).eq("sourceRef", sourceRef)
        )
        .unique()
}

async function operatorEntry(
    ctx: Db,
    source: DataSource
): Promise<CatalogEntry> {
    const credential = await credentialRow(ctx, source.guildId, source.ref)
    const mode = resolveCredentialMode({
        provider: source.provider,
        managed: "operator",
        storedMode: undefined,
        secretRef: source.secretRef,
        encryptedStored: Boolean(credential),
    })
    return {
        source: {
            ...source,
            credentialMode: mode.mode,
            managed: "operator",
            usable: mode.usable,
        },
        row: null,
        credential,
        reason: mode.reason,
    }
}

async function workspaceEntry(
    ctx: Db,
    row: Doc<"gameDataSources">
): Promise<CatalogEntry | null> {
    const parsed = sourceSchema.safeParse(registeredSource(row))
    if (!parsed.success) return null
    const credential =
        row.credentialMode === "encrypted"
            ? await credentialRow(ctx, row.guildId, row.ref)
            : null
    const mode = resolveCredentialMode({
        provider: parsed.data.provider,
        managed: "workspace",
        storedMode: row.credentialMode,
        secretRef: row.secretRef,
        encryptedStored: Boolean(credential),
    })
    return {
        source: {
            ...parsed.data,
            credentialMode: mode.mode,
            managed: "workspace",
            usable: mode.usable,
        },
        row,
        credential,
        reason: mode.reason,
    }
}

/**
 * The one source a workspace may use under this reference, by index. Both the
 * workspace and the reference must match; knowing another workspace's
 * reference resolves nothing. An operator catalog reference always wins, so a
 * registration can never shadow operator configuration.
 */
export async function resolveSource(
    ctx: Db,
    guildId: string,
    ref: string
): Promise<CatalogEntry | null> {
    const operator = operatorSources().find((source) => source.ref === ref)
    if (operator)
        return operator.guildId === guildId
            ? await operatorEntry(ctx, operator)
            : null
    const row = await ctx.db
        .query("gameDataSources")
        .withIndex("guildId_ref", (q) =>
            q.eq("guildId", guildId).eq("ref", ref)
        )
        .unique()
    return row ? await workspaceEntry(ctx, row) : null
}

/** Every source of one workspace: its operator entries, then its registrations. */
export async function workspaceSources(
    ctx: Db,
    guildId: string
): Promise<CatalogEntry[]> {
    const operator = operatorSources()
    const refs = new Set(operator.map((source) => source.ref))
    const entries = await Promise.all(
        operator
            .filter((source) => source.guildId === guildId)
            .map((source) => operatorEntry(ctx, source))
    )
    const rows = await ctx.db
        .query("gameDataSources")
        .withIndex("guildId", (q) => q.eq("guildId", guildId))
        .take(WORKSPACE_SOURCE_READ_LIMIT)
    for (const row of rows) {
        if (refs.has(row.ref)) continue
        const entry = await workspaceEntry(ctx, row)
        if (entry) entries.push(entry)
    }
    return entries
}

/**
 * The source a connection may collect from now: same workspace and reference,
 * a usable credential and the fingerprint (provider identity, origin, operator
 * variable and network exception) the connection was configured with.
 * Anything else is a configuration problem, never a fallback.
 */
export async function connectionSource(
    ctx: Db,
    connection: Doc<"gameDataConnections">
): Promise<ResolvedSource | null> {
    const entry = await resolveSource(
        ctx,
        connection.guildId,
        connection.sourceRef
    )
    if (
        !entry?.source.usable ||
        sourceFingerprint(entry.source) !== connection.sourceFingerprint
    )
        return null
    return entry.source
}

export async function connectionFor(
    ctx: Db,
    guildId: string,
    sourceRef: string
): Promise<Doc<"gameDataConnections"> | null> {
    return await ctx.db
        .query("gameDataConnections")
        .withIndex("guildId_sourceRef", (q) =>
            q.eq("guildId", guildId).eq("sourceRef", sourceRef)
        )
        .unique()
}
