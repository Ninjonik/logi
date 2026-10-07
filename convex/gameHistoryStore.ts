import {
    HISTORY_HEAD_TOUCH_INTERVAL_MS,
    historyTouchDue,
    isRetainedWarconSession,
} from "../src/domain/game-data/history-rules"
import { readStoredSource } from "../src/domain/game-data/operator-sources"
import type { ProviderSession } from "../src/domain/game-data/contracts"
import type { HistoryRecord } from "../src/domain/game-data/history"
import { nextRevision } from "../src/domain/integrations/change"
import { appendIntegrationChange } from "./integrationChangeLog"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import type { Doc } from "./_generated/dataModel"

async function digest(value: unknown) {
    const bytes = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify(value))
    )
    return Array.from(new Uint8Array(bytes), (byte) =>
        byte.toString(16).padStart(2, "0")
    ).join("")
}

export function historyHead(ctx: Pick<QueryCtx, "db">, guildId: string) {
    return ctx.db
        .query("serverGameHistoryHeads")
        .withIndex("guildId", (q) => q.eq("guildId", guildId))
        .unique()
}

export async function archiveWarconHistory(
    ctx: MutationCtx,
    connection: Doc<"gameDataConnections">,
    input: ProviderSession
) {
    if (connection.provider !== "wardogs_warcon" || !input.warcon) return
    // The commit validator checked the shape; the retention rules and the
    // connection's own stored fingerprint are read without Zod.
    if (!isRetainedWarconSession(input))
        throw new Error("Invalid retained Warcon session.")
    const session = input
    const source = readStoredSource(JSON.parse(connection.sourceFingerprint))
    if (
        !source ||
        source.guildId !== connection.guildId ||
        source.providerServerId !== connection.providerServerId ||
        source.provider !== "wardogs_warcon"
    )
        throw new Error("History source identity conflict.")
    const sourceId = await digest([
        source.guildId,
        source.provider,
        new URL(source.origin).origin,
        source.providerServerId,
    ])
    const existing = await ctx.db
        .query("serverGameHistory")
        .withIndex("source_external", (q) =>
            q
                .eq("guildId", connection.guildId)
                .eq("sourceId", sourceId)
                .eq("externalId", session.externalId)
        )
        .unique()
    if (existing && existing.session.startedAt !== session.startedAt)
        throw new Error("History match identity conflict.")
    const facts = { ...session, sourceDigest: undefined }
    const contentDigest = await digest(facts)
    const head = await historyHead(ctx, connection.guildId)
    const at = Date.now()
    const now = new Date(at).toISOString()
    const revision =
        existing?.contentDigest === contentDigest
            ? (head?.revision ?? "0")
            : nextRevision(head?.revision ?? "0")
    // The daily full walk re-reads every game, one a second. An unchanged
    // game refreshes only "data as of" (`lastCollectedAt`), at most every
    // ten minutes (ARCHITECTURE.md, "Convex hot paths").
    if (head) {
        if (
            head.revision !== revision ||
            historyTouchDue(
                head.lastCollectedAt,
                at,
                HISTORY_HEAD_TOUCH_INTERVAL_MS
            )
        )
            await ctx.db.patch(head._id, { revision, lastCollectedAt: now })
    } else
        await ctx.db.insert("serverGameHistoryHeads", {
            guildId: connection.guildId,
            revision,
            lastCollectedAt: now,
        })
    if (existing?.contentDigest === contentDigest) return existing._id
    const value = {
        session,
        contentDigest,
        revision,
        updatedAt: now,
        endedAt: session.endedAt!,
        map: session.map,
        serverName: connection.observation?.displayName?.slice(0, 200) ?? null,
    }
    const id = existing
        ? existing._id
        : await ctx.db.insert("serverGameHistory", {
              ...value,
              guildId: connection.guildId,
              sourceId,
              externalId: session.externalId,
              collectedAt: now,
          })
    if (existing) await ctx.db.patch(existing._id, value)
    await appendIntegrationChange(ctx, {
        guildId: connection.guildId,
        gameId: "wardogs",
        resource: "server-game-history",
        id: String(id),
        operation: "upsert",
    })
    return id
}

/** The stored row as the website reads it; the schema validated it on write. */
export function projectHistory(row: Doc<"serverGameHistory">): HistoryRecord {
    return {
        schemaVersion: 1,
        id: String(row._id),
        guildId: row.guildId,
        gameId: "wardogs",
        provider: "wardogs_warcon",
        sourceId: row.sourceId,
        serverName: row.serverName,
        revision: row.revision,
        collectedAt: row.collectedAt,
        updatedAt: row.updatedAt,
        session: row.session,
    }
}

export async function readHistoryRecord(
    ctx: Pick<QueryCtx, "db">,
    guildId: string,
    id: string
) {
    const key = ctx.db.normalizeId("serverGameHistory", id)
    const row = key ? await ctx.db.get(key) : null
    return row?.guildId === guildId ? projectHistory(row) : null
}
