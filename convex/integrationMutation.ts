import {
    mutation as baseMutation,
    internalMutation as baseInternalMutation,
    type MutationCtx,
} from "./_generated/server"
import { synchronizeSharedMatch } from "../src/infrastructure/convex/shared-match-store"
import { rosterRevisionTimestamp } from "../src/domain/rosters/shared-roster"
import { SHARED_MATCH_FIELDS } from "../src/domain/events/shared-match"
import type { FeedResource } from "../src/domain/integrations/change"
import { currentEventStatus } from "../src/domain/events/status"
import { appendIntegrationChange } from "./integrationChangeLog"
import { assignmentDiscordSubject } from "./membershipSubject"
import type { Doc, Id } from "./_generated/dataModel"
import { withPeopleChanges } from "./peopleChanges"

// The website projections of a tracked row live in `integrationProjection.ts`;
// this wrapper runs inside every tracked mutation and compares stored fields
// only, so it must not bundle the summary schemas (ARCHITECTURE.md, "Convex
// hot paths").
// `gameDataConnections` is not tracked: its observation and health are live
// state, re-observed on every collector poll, and the website reads them from
// `/clan/server-snapshots` and `/clan/integration-health`, not from the feed.
const tables = ["events", "userAssignments"] as const
type TrackedTable = (typeof tables)[number]
type Row = Doc<"events"> | Doc<"userAssignments">

/** Tracks the initial and final projection, including nested repository writes. Flush shares the mutation transaction. */
async function trackIntegrationChanges<T>(
    ctx: MutationCtx,
    execute: (tracked: MutationCtx) => Promise<T>
): Promise<T> {
    const sharedHosts = new Set<Id<"events">>()
    const localRosterBefore = new Map<Id<"rosters">, Doc<"rosters">>()
    const touched = new Map<
        string,
        { table: TrackedTable; before: Row | null; subject?: string | null }
    >()
    const capture = async (id: string, rosterContent = true) => {
        const rosterId = ctx.db.normalizeId("rosters", id)
        if (rosterContent && rosterId) {
            const roster = await ctx.db.get(rosterId)
            if (roster) {
                const event = await ctx.db.get(roster.eventId)
                if (event) sharedHosts.add(event.hostEventId ?? event._id)
                if (event?.hostEventId && !localRosterBefore.has(rosterId))
                    localRosterBefore.set(rosterId, structuredClone(roster))
            }
        }
        if (touched.has(id)) return
        const table = tables.find((table) => ctx.db.normalizeId(table, id))
        if (table) {
            const row = await ctx.db.get(id as Id<TrackedTable>)
            if (table === "events" && row) {
                const event = row as Doc<"events">
                sharedHosts.add(event.hostEventId ?? event._id)
            }
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
                    if (table === "rosters") await capture(String(id))
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
                            ("id" in value ||
                                "discordId" in value ||
                                "guildId" in value))
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
                    await capture(
                        id,
                        property !== "patch" ||
                            Boolean(
                                value &&
                                typeof value === "object" &&
                                [
                                    "squads",
                                    "reservePlayerIds",
                                    "notAttendingPlayerIds",
                                    "reserveAttendances",
                                    "published",
                                ].some((key) => key in value)
                            )
                    )
                    const eventId = ctx.db.normalizeId("events", id)
                    if (
                        eventId &&
                        property !== "delete" &&
                        value &&
                        typeof value === "object"
                    ) {
                        const event = await ctx.db.get(eventId)
                        if (event?.hostEventId) {
                            const host = await ctx.db.get(event.hostEventId)
                            for (const field of SHARED_MATCH_FIELDS) {
                                if (
                                    !(field in value) ||
                                    field === "statusUpdatedAt"
                                )
                                    continue
                                const next = (value as Record<string, unknown>)[
                                    field
                                ]
                                if (
                                    JSON.stringify(next) ===
                                    JSON.stringify(event[field])
                                )
                                    continue
                                // Local projections may only adopt the host's current facts.
                                if (
                                    host &&
                                    JSON.stringify(next) ===
                                        JSON.stringify(host[field])
                                )
                                    continue
                                if (
                                    field === "status" &&
                                    host &&
                                    next === currentEventStatus(host)
                                )
                                    continue
                                if (
                                    field === "concludedAt" &&
                                    host?.concludedAt === next
                                )
                                    continue
                                throw new Error(
                                    "Only the host can change shared match details or results."
                                )
                            }
                        }
                    }
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
    const membershipGuilds = new Set<string>()
    for (const [id, change] of touched)
        if (change.table === "userAssignments") {
            const previous = change.before as Doc<"userAssignments"> | null
            const current = await ctx.db.get(id as Id<"userAssignments">)
            if (previous) membershipGuilds.add(previous.serverId)
            if (current) membershipGuilds.add(current.serverId)
        }
    for (const guildId of membershipGuilds) {
        const events = await ctx.db
            .query("events")
            .withIndex("guildId", (q) => q.eq("guildId", guildId))
            .collect()
        for (const event of events)
            if (
                !event.sharedAccessRevoked &&
                currentEventStatus(event) !== "concluded" &&
                (event.hostEventId || event.sharedLocalPlayerIds)
            )
                sharedHosts.add(event.hostEventId ?? event._id)
    }
    // Voice-channel attendance and personal acknowledgements use existing local writers.
    // Carry only changed local attendance flags into the shared roster before projection.
    for (const [id, before] of localRosterBefore) {
        const after = await ctx.db.get(id)
        const event = after ? await ctx.db.get(after.eventId) : null
        if (!after || !event?.hostEventId) continue
        const canonical = await ctx.db
            .query("rosters")
            .withIndex("eventId", (q) => q.eq("eventId", event.hostEventId!))
            .unique()
        if (!canonical) continue
        const old = new Map(
            before.squads.flatMap((squad) =>
                squad.players.flatMap((slot) =>
                    slot.id ? [[slot.id, slot] as const] : []
                )
            )
        )
        const updates = new Map(
            after.squads.flatMap((squad) =>
                squad.players.flatMap((slot) => {
                    const previous = slot.id ? old.get(slot.id) : null
                    return slot.id &&
                        after.localPlayerIds?.includes(slot.id) &&
                        previous &&
                        (slot.ack !== previous.ack ||
                            slot.confirmed !== previous.confirmed)
                        ? [[slot.id, slot] as const]
                        : []
                })
            )
        )
        const previousReserves = new Map(
            (before.reserveAttendances ?? []).map((item) => [item.userId, item])
        )
        const reserveUpdates = (after.reserveAttendances ?? []).filter(
            (item) => {
                const previous = previousReserves.get(item.userId)
                return (
                    after.localPlayerIds?.includes(item.userId) &&
                    canonical.reservePlayerIds.includes(item.userId) &&
                    (item.ack !== previous?.ack ||
                        item.confirmed !== previous?.confirmed)
                )
            }
        )
        const changedReserves = new Set(
            reserveUpdates.map((item) => item.userId)
        )
        if (updates.size || reserveUpdates.length)
            await db.patch(canonical._id, {
                squads: canonical.squads.map((squad) => ({
                    ...squad,
                    players: squad.players.map((slot) => {
                        const update = slot.id ? updates.get(slot.id) : null
                        return update
                            ? {
                                  ...slot,
                                  ack: update.ack,
                                  confirmed: update.confirmed,
                              }
                            : slot
                    }),
                })),
                reserveAttendances: [
                    ...(canonical.reserveAttendances ?? []).filter(
                        (item) => !changedReserves.has(item.userId)
                    ),
                    ...reserveUpdates,
                ],
                updatedAt: rosterRevisionTimestamp(
                    canonical.updatedAt,
                    new Date()
                ),
            })
    }
    for (const hostId of sharedHosts)
        await synchronizeSharedMatch({ ...ctx, db }, hostId)
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
        const fingerprints = (row: Doc<"events"> | null) => {
            if (!row) return []
            const data = row as unknown as Record<string, unknown>
            const fingerprint = JSON.stringify(
                [
                    "name",
                    "kind",
                    "status",
                    "gameStart",
                    "wardogsFixtureUrl",
                    "gameEnd",
                    "updatedAt",
                    "eventResult",
                    "reviewedResult",
                    "reviewedResultGameId",
                    "matchTeams",
                ].map((key) => data[key])
            )
            const resources: FeedResource[] = [
                "event-summaries",
                ...((row.kind ?? "match") === "match"
                    ? ["match-summaries" as const, "result-summaries" as const]
                    : []),
            ]
            return resources.map((resource) => ({
                resource,
                data: {
                    id,
                    guildId: row.guildId,
                    gameId: row.gameId ?? "hell_let_loose",
                    fingerprint,
                },
            }))
        }
        const oldRows = fingerprints(before as Doc<"events"> | null)
        const newRows = fingerprints(await ctx.db.get(id as Id<"events">))
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
export function withIntegrationChanges<T>(
    ctx: MutationCtx,
    execute: (tracked: MutationCtx) => Promise<T>
) {
    return withPeopleChanges(ctx, (tracked) =>
        trackIntegrationChanges(tracked, execute)
    )
}
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
