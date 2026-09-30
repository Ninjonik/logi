import {
    mutation as baseMutation,
    internalMutation as baseInternalMutation,
    type MutationCtx,
} from "./_generated/server"
import {
    projectEventSummary,
    projectMatchSummary,
} from "../src/domain/api/event-summaries"
import { projectHealth, projectSnapshot } from "../src/domain/game-data/policy"
import { projectResultSummary } from "../src/domain/api/result-summaries"
import type { SyncResource } from "../src/domain/integrations/change"
import { appendIntegrationChange } from "./integrationChangeLog"
import { assignmentDiscordSubject } from "./membershipSubject"
import type { Doc, Id } from "./_generated/dataModel"

const tables = ["events", "gameDataConnections", "userAssignments"] as const
type TrackedTable = (typeof tables)[number]
type Row = Doc<"events"> | Doc<"gameDataConnections"> | Doc<"userAssignments">
export function projectIntegrationRow(
    table: TrackedTable,
    row: Row | null,
    now: number
): Array<{
    resource: SyncResource
    data: { id: string; guildId: string; gameId: string }
}> {
    if (!row) return []
    if (table === "userAssignments") return [] // Per-key membership projection is read separately.
    if (table === "events") {
        const event = row as Doc<"events">
        return [
            { resource: "event-summaries", data: projectEventSummary(event) },
            ...((event.kind ?? "match") === "match"
                ? [
                      {
                          resource: "match-summaries" as const,
                          data: projectMatchSummary(event),
                      },
                      {
                          resource: "result-summaries" as const,
                          data: projectResultSummary(event),
                      },
                  ]
                : []),
        ]
    }
    const connection = {
        ...(row as Doc<"gameDataConnections">),
        id: String(row._id),
    }
    return [
        {
            resource: "server-snapshots",
            data: projectSnapshot(connection, now),
        },
        {
            resource: "integration-health",
            data: projectHealth(connection, now),
        },
    ]
}

/** Tracks the initial and final projection, including nested repository writes. Flush shares the mutation transaction. */
export async function withIntegrationChanges<T>(
    ctx: MutationCtx,
    execute: (tracked: MutationCtx) => Promise<T>
): Promise<T> {
    const touched = new Map<
        string,
        { table: TrackedTable; before: Row | null; subject?: string | null }
    >()
    const capture = async (id: string) => {
        if (touched.has(id)) return
        const table = tables.find((table) => ctx.db.normalizeId(table, id))
        if (table) {
            const row = await ctx.db.get(id as Id<TrackedTable>)
            touched.set(id, {
                table,
                before: row ? structuredClone(row) : null,
                ...(table === "userAssignments" && row
                    ? {
                          subject: await assignmentDiscordSubject(
                              ctx,
                              (row as Doc<"userAssignments">).userId
                          ),
                      }
                    : {}),
            })
        }
    }
    const userAliases = (value: unknown): unknown[] =>
        value && typeof value === "object"
            ? [
                  "id" in value ? value.id : null,
                  "discordId" in value ? value.discordId : null,
              ]
            : []
    const captureAssignments = async (aliases: unknown[]) => {
        for (const alias of new Set(
            aliases.filter(
                (value): value is string =>
                    typeof value === "string" && value.length > 0
            )
        )) {
            const assignments = await ctx.db
                .query("userAssignments")
                .withIndex("userId", (q) => q.eq("userId", alias))
                .collect()
            for (const row of assignments) await capture(String(row._id))
        }
    }
    const db = new Proxy(ctx.db, {
        get(target, property) {
            if (property === "insert")
                return async (table: string, value: unknown) => {
                    if (table === "users")
                        await captureAssignments(userAliases(value))
                    const id = await target.insert(
                        table as TrackedTable,
                        value as never
                    )
                    if ((tables as readonly string[]).includes(table))
                        touched.set(String(id), {
                            table: table as TrackedTable,
                            before: null,
                        })
                    return id
                }
            if (
                property === "patch" ||
                property === "replace" ||
                property === "delete"
            )
                return async (id: string, value: unknown) => {
                    if (
                        property !== "patch" ||
                        (value &&
                            typeof value === "object" &&
                            ("id" in value || "discordId" in value))
                    ) {
                        const userId = ctx.db.normalizeId("users", id)
                        if (userId) {
                            const user = await ctx.db.get(userId)
                            await captureAssignments([
                                ...userAliases(user),
                                ...userAliases(value),
                            ])
                        }
                    }
                    await capture(id)
                    if (property === "delete")
                        return target.delete(id as Id<TrackedTable>)
                    if (property === "patch")
                        return target.patch(
                            id as Id<TrackedTable>,
                            value as never
                        )
                    return target.replace(
                        id as Id<TrackedTable>,
                        value as never
                    )
                }
            const value = Reflect.get(target, property)
            return typeof value === "function" ? value.bind(target) : value
        },
    })
    const result = await execute({ ...ctx, db })
    for (const [id, { table, before, subject }] of touched) {
        if (table === "userAssignments") {
            const after = await ctx.db.get(id as Id<"userAssignments">)
            const previous = before as Doc<"userAssignments"> | null
            const identity = (
                row: Doc<"userAssignments">,
                discordUserId: string
            ) => ({
                guildId: row.serverId,
                gameId: row.gameId ?? "hell_let_loose",
                resource: "membership-summaries" as const,
                id: discordUserId,
                operation: "upsert" as const,
            })
            const fingerprint = (row: Doc<"userAssignments"> | null) =>
                row
                    ? JSON.stringify([
                          row.serverId,
                          row.gameId ?? "hell_let_loose",
                          row.userId,
                          row.type,
                          row.status,
                      ])
                    : null
            const nextSubject = after
                ? await assignmentDiscordSubject(ctx, after.userId)
                : null
            const oldIdentity =
                previous && subject ? identity(previous, subject) : null
            const newIdentity =
                after && nextSubject ? identity(after, nextSubject) : null
            if (
                fingerprint(previous) !== fingerprint(after) ||
                JSON.stringify(oldIdentity) !== JSON.stringify(newIdentity)
            ) {
                if (oldIdentity) await appendIntegrationChange(ctx, oldIdentity)
                if (
                    newIdentity &&
                    JSON.stringify(oldIdentity) !== JSON.stringify(newIdentity)
                )
                    await appendIntegrationChange(ctx, newIdentity)
            }
            continue
        }
        // Old migration input can predate the current DTO schema. Compare source
        // fields without parsing it; wire validation belongs to the read path.
        const fingerprints = (row: Row | null) => {
            if (!row) return []
            const data = row as unknown as Record<string, unknown>
            const fields =
                table === "events"
                    ? [
                          "name",
                          "kind",
                          "status",
                          "gameStart",
                          "gameEnd",
                          "updatedAt",
                          "eventResult",
                          "reviewedResult",
                          "reviewedResultGameId",
                      ]
                    : [
                          "provider",
                          "enabled",
                          "observation",
                          "lastAttemptAt",
                          "nextAttemptAt",
                          "errorCategory",
                          "historyCount",
                          "historyLastSuccessAt",
                          "historyErrorCategory",
                          "updatedAt",
                      ]
            const fingerprint = JSON.stringify(fields.map((key) => data[key]))
            const resources: SyncResource[] =
                table === "events"
                    ? [
                          "event-summaries",
                          ...((data.kind ?? "match") === "match"
                              ? [
                                    "match-summaries" as const,
                                    "result-summaries" as const,
                                ]
                              : []),
                      ]
                    : ["server-snapshots", "integration-health"]
            return resources.map((resource) => ({
                resource,
                data: {
                    id,
                    guildId: "guildId" in row ? row.guildId : row.serverId,
                    gameId: row.gameId ?? "hell_let_loose",
                    fingerprint,
                },
            }))
        }
        const oldRows = fingerprints(before)
        const newRows = fingerprints(await ctx.db.get(id as Id<TrackedTable>))
        const identity = (row: (typeof oldRows)[number]) =>
            JSON.stringify([
                row.data.guildId,
                row.data.gameId,
                row.resource,
                row.data.id,
            ])
        for (const previous of oldRows)
            if (!newRows.some((row) => identity(row) === identity(previous)))
                await appendIntegrationChange(ctx, {
                    guildId: previous.data.guildId,
                    gameId: previous.data.gameId,
                    resource: previous.resource,
                    id,
                    operation: "remove",
                })
        for (const current of newRows)
            if (
                !oldRows.some(
                    (row) =>
                        identity(row) === identity(current) &&
                        JSON.stringify(row.data) ===
                            JSON.stringify(current.data)
                )
            )
                await appendIntegrationChange(ctx, {
                    guildId: current.data.guildId,
                    gameId: current.data.gameId,
                    resource: current.resource,
                    id,
                    operation: "upsert",
                })
    }
    return result
}

// Retain Convex's generic argument/return validator inference at each entrypoint.
function trackedBuilder<B>(base: B): B {
    return ((definition: {
        handler: (ctx: MutationCtx, args: unknown) => Promise<unknown>
    }) =>
        (base as (value: unknown) => unknown)({
            ...definition,
            handler: (ctx: MutationCtx, args: unknown) =>
                withIntegrationChanges(ctx, (tracked) =>
                    definition.handler(tracked, args)
                ),
        })) as B
}
export const mutation = trackedBuilder(baseMutation)
export const internalMutation = trackedBuilder(baseInternalMutation)
