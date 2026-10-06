import type { PeopleResource } from "../src/domain/api/people-summaries"
import { nextRevision } from "../src/domain/integrations/change"
import { appendIntegrationChange } from "./integrationChangeLog"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { resolveGameScope } from "../src/domain/games/game"
import type { Doc, Id } from "./_generated/dataModel"

export async function peopleGeneration(ctx: Pick<QueryCtx, "db">) {
    return (
        (
            await ctx.db
                .query("peopleIntegrationState")
                .withIndex("key", (q) => q.eq("key", "global"))
                .unique()
        )?.generation ?? "0"
    )
}
export async function invalidatePeopleGeneration(ctx: MutationCtx) {
    const row = await ctx.db
        .query("peopleIntegrationState")
        .withIndex("key", (q) => q.eq("key", "global"))
        .unique()
    const generation = nextRevision(row?.generation ?? "0")
    if (row) await ctx.db.patch(row._id, { generation })
    else
        await ctx.db.insert("peopleIntegrationState", {
            key: "global",
            generation,
        })
}

/** Bounded reverse links are hints only; reads recheck the current event, revision and digest. */
export async function rebuildPeopleResultLinks(
    ctx: MutationCtx,
    eventId: Id<"events">
) {
    const previous = await ctx.db
        .query("peopleResultLinks")
        .withIndex("eventId", (q) => q.eq("eventId", eventId))
        .take(5)
    if (previous.length > 4)
        throw new Error("Invalid reviewed session link count.")
    const event = await ctx.db.get(eventId),
        result = event?.reviewedResult
    const next: Array<Omit<Doc<"peopleResultLinks">, "_id" | "_creationTime">> =
        []
    if (
        event &&
        (event.kind ?? "match") === "match" &&
        result &&
        result.status !== "provisional" &&
        event.reviewedResultGameId === resolveGameScope(event.gameId)
    ) {
        const revision = await ctx.db
            .query("eventResultRevisions")
            .withIndex("eventId_version", (q) =>
                q.eq("eventId", eventId).eq("version", result.version)
            )
            .unique()
        if (
            revision &&
            revision.guildId === event.guildId &&
            revision.gameId === resolveGameScope(event.gameId) &&
            revision.revision.status === result.status
        ) {
            if (revision.revision.sessionLinks.length > 4)
                throw new Error("Invalid reviewed session link count.")
            for (const source of revision.revision.sessionLinks) {
                const sessionId = ctx.db.normalizeId(
                    "gameSessions",
                    source.sessionId
                )
                if (
                    sessionId &&
                    !next.some((item) => item.sessionId === sessionId)
                )
                    next.push({
                        eventId,
                        sessionId,
                        sourceDigest: source.sourceDigest,
                        resultVersion: result.version,
                    })
            }
        }
    }
    const fingerprint = (rows: typeof next) =>
        JSON.stringify(
            rows
                .map((row) => [
                    row.sessionId,
                    row.sourceDigest,
                    row.resultVersion,
                ])
                .sort()
        )
    if (fingerprint(previous) === fingerprint(next)) return false
    for (const row of previous) await ctx.db.delete(row._id)
    for (const row of next) await ctx.db.insert("peopleResultLinks", row)
    return true
}

const trackedTables = [
    "userAssignments",
    "rosters",
    "gameSessions",
    "users",
    "groups",
    "platformIdentityLinks",
    "gameDataConnections",
    "events",
] as const
type Table = (typeof trackedTables)[number]
type Row = Doc<Table>
type Identity = {
    guildId: string
    gameId: string
    resource: PeopleResource
    id: string
}
async function identity(
    ctx: Pick<QueryCtx, "db">,
    table: Table,
    row: Row | null
): Promise<Identity | null> {
    if (!row) return null
    let value: Identity | null = null
    if (table === "userAssignments") {
        const source = row as Doc<"userAssignments">
        value = {
            guildId: source.serverId,
            gameId: resolveGameScope(source.gameId),
            resource: "member-summaries",
            id: String(source._id),
        }
    } else if (table === "rosters") {
        const source = row as Doc<"rosters">,
            event = await ctx.db.get(source.eventId)
        if (source.published && event)
            value = {
                guildId: event.guildId,
                gameId: resolveGameScope(event.gameId),
                resource: "roster-summaries",
                id: String(source._id),
            }
    } else if (table === "gameSessions") {
        const source = row as Doc<"gameSessions">
        value = {
            guildId: source.guildId,
            gameId: source.gameId,
            resource: "player-stat-summaries",
            id: String(source._id),
        }
    }
    return value && /^\d{5,25}$/.test(value.guildId) ? value : null
}
const dependencies: Partial<Record<Table, string[]>> = {
    users: ["id", "discordId", "name"],
    groups: ["guildId", "gameId", "name"],
    platformIdentityLinks: [
        "active",
        "revokedAt",
        "platformId",
        "userRecordId",
        "discordUserId",
        "logiUserId",
        "verifiedAt",
        "method",
    ],
    gameDataConnections: [
        "guildId",
        "gameId",
        "provider",
        "enabled",
        "generation",
    ],
    userAssignments: [
        "serverId",
        "gameId",
        "userId",
        "type",
        "status",
        "paused",
        "primaryGroupId",
        "secondaryGroupIds",
    ],
    events: [
        "guildId",
        "gameId",
        "kind",
        "reviewedResult",
        "reviewedResultGameId",
        "participants",
    ],
}
function fields(row: Row | null, names: string[]) {
    if (!row) return null
    const value = row as unknown as Record<string, unknown>
    return JSON.stringify(names.map((name) => value[name]))
}
// Fields a collector rewrites on every run without changing what the
// people projections serve; comparing them appended a change per run.
const volatile: Partial<Record<Table, string[]>> = {
    gameSessions: ["fetchedAt", "updatedAt"],
}
function comparable(table: Table, row: Row | null) {
    if (!row) return null
    const skip = volatile[table]
    if (!skip) return JSON.stringify(row)
    const value = { ...(row as unknown as Record<string, unknown>) }
    for (const name of skip) delete value[name]
    return JSON.stringify(value)
}

/** One global dependency generation avoids an unbounded cross-user/session write fanout. */
export async function withPeopleChanges<T>(
    ctx: MutationCtx,
    execute: (tracked: MutationCtx) => Promise<T>
) {
    const touched = new Map<
        string,
        { table: Table; before: Row | null; identity: Identity | null }
    >()
    const capture = async (id: string) => {
        if (touched.has(id)) return
        const table = trackedTables.find((name) => ctx.db.normalizeId(name, id))
        if (!table) return
        const row = await ctx.db.get(id as Id<Table>)
        touched.set(id, {
            table,
            before: row ? structuredClone(row) : null,
            identity: await identity(ctx, table, row),
        })
    }
    const db = new Proxy(ctx.db, {
        get(target, property) {
            if (property === "insert")
                return async (table: string, value: unknown) => {
                    const id = await target.insert(
                        table as Table,
                        value as never
                    )
                    if ((trackedTables as readonly string[]).includes(table))
                        touched.set(String(id), {
                            table: table as Table,
                            before: null,
                            identity: null,
                        })
                    return id
                }
            if (
                property === "patch" ||
                property === "replace" ||
                property === "delete"
            )
                return async (id: string, value: unknown) => {
                    await capture(id)
                    return property === "delete"
                        ? target.delete(id as Id<Table>)
                        : property === "patch"
                          ? target.patch(id as Id<Table>, value as never)
                          : target.replace(id as Id<Table>, value as never)
                }
            const value = Reflect.get(target, property)
            return typeof value === "function" ? value.bind(target) : value
        },
    })
    const result = await execute({ ...ctx, db })
    let invalidate = false
    for (const [id, captured] of touched) {
        const after = await ctx.db.get(id as Id<Table>),
            next = await identity(ctx, captured.table, after)
        const names = dependencies[captured.table]
        if (names && fields(captured.before, names) !== fields(after, names))
            invalidate = true
        if (
            captured.table === "events" &&
            fields(captured.before, [
                "guildId",
                "gameId",
                "kind",
                "reviewedResult",
                "reviewedResultGameId",
            ]) !==
                fields(after, [
                    "guildId",
                    "gameId",
                    "kind",
                    "reviewedResult",
                    "reviewedResultGameId",
                ])
        )
            await rebuildPeopleResultLinks(ctx, id as Id<"events">)
        if (
            captured.identity &&
            JSON.stringify(captured.identity) !== JSON.stringify(next)
        )
            await appendIntegrationChange(ctx, {
                ...captured.identity,
                operation: "remove",
            })
        if (
            next &&
            comparable(captured.table, captured.before) !==
                comparable(captured.table, after)
        )
            await appendIntegrationChange(ctx, { ...next, operation: "upsert" })
    }
    if (invalidate) await invalidatePeopleGeneration(ctx)
    return result
}
