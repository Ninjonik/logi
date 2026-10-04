import type { CredentialEnvelope } from "../src/domain/game-data/credentials"
import { internalMutation, internalQuery } from "./_generated/server"
import { connectionSource, credentialRow } from "./gameDataCatalog"
import { gameDataCredentialFailure } from "./gameDataValidators"
import type { QueryCtx } from "./_generated/server"
import { v } from "convex/values"

const fence = { connectionId: v.string(), generation: v.number() }

/** The enabled connection at this generation and its current, usable source. */
async function currentConnection(
    ctx: Pick<QueryCtx, "db">,
    args: { connectionId: string; generation: number }
) {
    const id = ctx.db.normalizeId("gameDataConnections", args.connectionId)
    const connection = id ? await ctx.db.get(id) : null
    if (!connection?.enabled || connection.generation !== args.generation)
        return null
    const source = await connectionSource(ctx, connection)
    return source ? { connection, source } : null
}

/**
 * The ciphertext for one claimed run, only while its generation is current
 * (a rotation, removal or disable moves the generation). Internal: only the
 * collector and read actions call it, and only they hold the keyring.
 */
export const envelope = internalQuery({
    args: fence,
    handler: async (ctx, args): Promise<CredentialEnvelope | null> => {
        const current = await currentConnection(ctx, args)
        if (current?.source.credentialMode !== "encrypted") return null
        const row = await credentialRow(
            ctx,
            current.connection.guildId,
            current.connection.sourceRef
        )
        return row
            ? {
                  format: row.format,
                  keyId: row.keyId,
                  nonce: row.nonce,
                  ciphertext: row.ciphertext,
                  tag: row.tag,
              }
            : null
    },
})

/** A sanitized reason a stored key could not be used, for the dashboard only. */
export const reportFailure = internalMutation({
    args: { ...fence, category: gameDataCredentialFailure },
    handler: async (ctx, args): Promise<void> => {
        const current = await currentConnection(ctx, args)
        if (!current) return
        const row = await credentialRow(
            ctx,
            current.connection.guildId,
            current.connection.sourceRef
        )
        if (row)
            await ctx.db.patch(row._id, {
                failure: args.category,
                failureAt: new Date().toISOString(),
            })
    },
})
