import type {
    LegacyCandidate,
    StoredCredential,
} from "../src/application/game-data/migrate-credentials"
import {
    credentialRow,
    operatorSources,
    resolveSource,
} from "./gameDataCatalog"
import {
    acceptedEnvelope,
    refreshConnectionCredential,
} from "./gameDataSources"
import { credentialRequirement } from "../src/domain/game-data/credentials"
import { internalQuery, type QueryCtx } from "./_generated/server"
import { gameDataCredentialEnvelope } from "./gameDataValidators"
import { internalMutation } from "./integrationMutation"

import { v } from "convex/values"

/** Recorded as the writer of migrated and re-encrypted credentials. */
export const OPERATOR_MIGRATION = "operator-migration"

async function sharedVariable(
    ctx: Pick<QueryCtx, "db">,
    secretRef: string,
    guildId: string
): Promise<boolean> {
    if (
        operatorSources().some(
            (source) =>
                source.secretRef === secretRef && source.guildId !== guildId
        )
    )
        return true
    const rows = await ctx.db
        .query("gameDataSources")
        .withIndex("secretRef", (q) => q.eq("secretRef", secretRef))
        .take(50)
    return rows.some((row) => row.guildId !== guildId)
}

/**
 * Sources still using an environment variable, without reading any value.
 * Phase `operator` lists `LOGI_GAME_DATA_SOURCES` entries that have no stored
 * key yet; phase `workspace` pages through registrations from before encrypted
 * keys by index.
 */
export const legacyCandidates = internalQuery({
    args: {
        phase: v.union(v.literal("operator"), v.literal("workspace")),
        cursor: v.union(v.string(), v.null()),
        limit: v.number(),
    },
    handler: async (
        ctx,
        args
    ): Promise<{
        candidates: LegacyCandidate[]
        nextCursor: string | null
    }> => {
        const limit = Math.max(1, Math.min(100, Math.floor(args.limit)))
        if (args.phase === "operator") {
            const candidates: LegacyCandidate[] = []
            for (const source of operatorSources()) {
                if (
                    !source.secretRef ||
                    credentialRequirement(source.provider) === "forbidden" ||
                    (await credentialRow(ctx, source.guildId, source.ref))
                )
                    continue
                candidates.push({
                    kind: "operator",
                    guildId: source.guildId,
                    ref: source.ref,
                    provider: source.provider,
                    origin: source.origin,
                    providerServerId: source.providerServerId,
                    secretRef: source.secretRef,
                    expectedRevision: 0,
                    conflict: await sharedVariable(
                        ctx,
                        source.secretRef,
                        source.guildId
                    ),
                    networkException: false,
                })
            }
            return { candidates, nextCursor: null }
        }
        const page = await ctx.db
            .query("gameDataSources")
            .withIndex("credentialMode", (q) =>
                q.eq("credentialMode", undefined)
            )
            .paginate({ cursor: args.cursor, numItems: limit })
        const candidates: LegacyCandidate[] = []
        for (const row of page.page) {
            if (!row.secretRef) continue
            candidates.push({
                kind: "workspace",
                guildId: row.guildId,
                ref: row.ref,
                provider: row.provider,
                origin: row.origin,
                providerServerId: row.providerServerId,
                secretRef: row.secretRef,
                expectedRevision: row.revision ?? 0,
                conflict: await sharedVariable(ctx, row.secretRef, row.guildId),
                networkException: row.allowedAddresses.length > 0,
            })
        }
        return {
            candidates,
            nextCursor: page.isDone ? null : page.continueCursor,
        }
    },
})

/**
 * Stores one migrated key atomically, after re-checking that the source still
 * names the same variable at the same revision. Idempotent: an already stored
 * key is left alone. Collection keeps its enabled state; the new generation
 * fences runs that started with the variable.
 */
export const adoptLegacyCredential = internalMutation({
    args: {
        kind: v.union(v.literal("operator"), v.literal("workspace")),
        guildId: v.string(),
        ref: v.string(),
        secretRef: v.string(),
        expectedRevision: v.number(),
        envelope: gameDataCredentialEnvelope,
    },
    handler: async (
        ctx,
        args
    ): Promise<
        "migrated" | "already_encrypted" | "stale" | "encryption_unavailable"
    > => {
        const envelope = acceptedEnvelope(args.envelope)
        if (!envelope) return "encryption_unavailable"
        const entry = await resolveSource(ctx, args.guildId, args.ref)
        if (!entry) return "stale"
        if (entry.credential) return "already_encrypted"
        const now = new Date().toISOString()
        if (args.kind === "operator") {
            if (entry.row || entry.source.secretRef !== args.secretRef)
                return "stale"
        } else {
            const row = entry.row
            if (
                !row ||
                row.credentialMode !== undefined ||
                row.secretRef !== args.secretRef ||
                (row.revision ?? 0) !== args.expectedRevision
            )
                return "stale"
            await ctx.db.patch(row._id, {
                credentialMode: "encrypted",
                secretRef: null,
                allowedAddresses: [],
                revision: (row.revision ?? 0) + 1,
                updatedAt: now,
                updatedBy: OPERATOR_MIGRATION,
            })
        }
        await ctx.db.insert("gameDataCredentials", {
            guildId: args.guildId,
            sourceRef: args.ref,
            ...envelope,
            version: 1,
            verifiedAt: null,
            createdAt: now,
            updatedAt: now,
            updatedBy: OPERATOR_MIGRATION,
        })
        await refreshConnectionCredential(ctx, {
            guildId: args.guildId,
            sourceRef: args.ref,
            entry: await resolveSource(ctx, args.guildId, args.ref),
        })
        return "migrated"
    },
})

/** One page of stored credentials with the identity each one is bound to. */
export const credentialsPage = internalQuery({
    args: { cursor: v.union(v.string(), v.null()), limit: v.number() },
    handler: async (
        ctx,
        args
    ): Promise<{ items: StoredCredential[]; nextCursor: string | null }> => {
        const page = await ctx.db.query("gameDataCredentials").paginate({
            cursor: args.cursor,
            numItems: Math.max(1, Math.min(100, Math.floor(args.limit))),
        })
        const items: StoredCredential[] = []
        for (const row of page.page) {
            const entry = await resolveSource(ctx, row.guildId, row.sourceRef)
            items.push({
                id: row._id,
                guildId: row.guildId,
                sourceRef: row.sourceRef,
                version: row.version,
                envelope: {
                    format: row.format,
                    keyId: row.keyId,
                    nonce: row.nonce,
                    ciphertext: row.ciphertext,
                    tag: row.tag,
                },
                binding:
                    entry?.credential?._id === row._id
                        ? {
                              provider: entry.source.provider,
                              origin: entry.source.origin,
                              providerServerId: entry.source.providerServerId,
                          }
                        : null,
            })
        }
        return { items, nextCursor: page.isDone ? null : page.continueCursor }
    },
})

/**
 * Compare-and-swap of one ciphertext under the current keyring key. A key
 * changed meanwhile (other version or nonce) is left alone; the stored key
 * itself, its version and its verification do not change.
 */
export const replaceCiphertext = internalMutation({
    args: {
        id: v.string(),
        expectedVersion: v.number(),
        expectedNonce: v.string(),
        envelope: gameDataCredentialEnvelope,
    },
    handler: async (
        ctx,
        args
    ): Promise<"reencrypted" | "stale" | "encryption_unavailable"> => {
        const envelope = acceptedEnvelope(args.envelope)
        if (!envelope) return "encryption_unavailable"
        const id = ctx.db.normalizeId("gameDataCredentials", args.id)
        const row = id ? await ctx.db.get(id) : null
        if (
            !row ||
            row.version !== args.expectedVersion ||
            row.nonce !== args.expectedNonce
        )
            return "stale"
        await ctx.db.patch(row._id, {
            ...envelope,
            reencryptedAt: new Date().toISOString(),
        })
        return "reencrypted"
    },
})
