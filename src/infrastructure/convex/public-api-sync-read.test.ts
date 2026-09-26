import assert from "node:assert/strict"
import test from "node:test"

import * as migrations from "../../../convex/migrations"
import * as publicApi from "../../../convex/publicApi"

type Document = Record<string, unknown> & { _id: string }

class FakeQuery {
    private equalities: Array<[string, unknown]> = []
    private minimum?: [string, string]

    constructor(private readonly documents: Document[]) {}

    withIndex(
        _index: string,
        callback: (query: {
            eq: (field: string, value: unknown) => typeof query
            gte: (field: string, value: string) => typeof query
        }) => unknown
    ) {
        const query = {
            eq: (field: string, value: unknown) => {
                this.equalities.push([field, value])
                return query
            },
            gte: (field: string, value: string) => {
                this.minimum = [field, value]
                return query
            },
        }
        callback(query)
        return this
    }

    async unique() {
        return this.matching()[0] ?? null
    }

    async first() {
        return this.matching()[0] ?? null
    }

    async paginate({
        cursor,
        numItems,
    }: {
        cursor: string | null
        numItems: number
    }) {
        const offset = cursor ? Number(cursor) : 0
        const matches = this.matching()
        const page = matches.slice(offset, offset + numItems)
        const next = offset + page.length
        return {
            page,
            continueCursor: String(next),
            isDone: next >= matches.length,
        }
    }

    private matching() {
        return this.documents.filter(
            (document) =>
                this.equalities.every(
                    ([field, value]) => document[field] === value
                ) &&
                (!this.minimum ||
                    String(document[this.minimum[0]] ?? "") >= this.minimum[1])
        )
    }
}

class FakeDb {
    readonly tables: Record<string, Map<string, Document>> = {
        apiKeys: new Map([
            ["key", { _id: "key", keyHash: "key-hash", guildId: "guild-a" }],
        ]),
        events: new Map([
            ["event-hll", { _id: "event-hll", guildId: "guild-a" }],
            ["event-other", { _id: "event-other", guildId: "guild-b" }],
        ]),
        rosters: new Map([
            [
                "roster-hll",
                {
                    _id: "roster-hll",
                    guildId: "guild-a",
                    eventId: "event-hll",
                    updatedAt: "2026-01-03T00:00:00.000Z",
                },
            ],
            [
                "roster-other",
                {
                    _id: "roster-other",
                    guildId: "guild-b",
                    eventId: "event-other",
                    updatedAt: "2026-01-03T00:00:00.000Z",
                },
            ],
        ]),
        clanApiUserProjections: new Map([
            [
                "projection-a",
                {
                    _id: "projection-a",
                    guildId: "guild-a",
                    userId: "user-1",
                    updatedAt: "2026-01-02T00:00:00.000Z",
                },
            ],
            [
                "projection-b",
                {
                    _id: "projection-b",
                    guildId: "guild-a",
                    userId: "user-2",
                    updatedAt: "2026-01-03T00:00:00.000Z",
                },
            ],
            [
                "projection-other",
                {
                    _id: "projection-other",
                    guildId: "guild-b",
                    userId: "user-other",
                    updatedAt: "2026-01-03T00:00:00.000Z",
                },
            ],
        ]),
        users: new Map([
            ["user-1", { _id: "user-1", discordId: "user-1", name: "One" }],
            ["user-2", { _id: "user-2", discordId: "user-2", name: "Two" }],
            [
                "user-other",
                { _id: "user-other", discordId: "user-other", name: "Other" },
            ],
        ]),
        userAssignments: new Map([
            [
                "assignment-1",
                {
                    _id: "assignment-1",
                    serverId: "guild-a",
                    userId: "user-1",
                    updatedAt: "2026-01-02T00:00:00.000Z",
                },
            ],
            [
                "assignment-2",
                {
                    _id: "assignment-2",
                    serverId: "guild-a",
                    userId: "user-1",
                    updatedAt: "2026-01-03T00:00:00.000Z",
                },
            ],
        ]),
    }

    query(table: string) {
        return new FakeQuery([...(this.tables[table]?.values() ?? [])])
    }

    async get(id: string) {
        return (
            Object.values(this.tables)
                .map((table) => table.get(id))
                .find(Boolean) ?? null
        )
    }

    async patch(id: string, value: Record<string, unknown>) {
        const document = await this.get(id)
        if (!document) throw new Error("Document not found.")
        Object.assign(document, value)
    }

    async insert(table: string, value: Record<string, unknown>) {
        const id = `${table}-${this.tables[table]?.size ?? 0}`
        this.tables[table] ??= new Map()
        this.tables[table].set(id, { _id: id, ...value })
        return id
    }
}

function handler(value: unknown) {
    return (
        value as {
            _handler: (
                ctx: { db: FakeDb },
                args: Record<string, unknown>
            ) => Promise<unknown>
        }
    )._handler
}

function resourcePage(overrides: Record<string, unknown> = {}) {
    return handler(publicApi.getClanResourcePage)(
        { db: new FakeDb() },
        {
            secret: "dev-internal-auth-secret",
            keyHash: "key-hash",
            resource: "users",
            game: "hell_let_loose",
            cursor: null,
            limit: 25,
            ...overrides,
        }
    ) as Promise<{ items: Array<{ id: string }>; nextCursor: string | null }>
}

test("user pages are tenant-scoped, unique across assignments, and cursor-stable", async () => {
    const first = await resourcePage({ limit: 1 })
    const second = await resourcePage({ limit: 1, cursor: first.nextCursor })

    assert.deepEqual(
        first.items.map((user) => user.id),
        ["user-1"]
    )
    assert.deepEqual(
        second.items.map((user) => user.id),
        ["user-2"]
    )
})

test("user projection timestamps support a bounded updatedSince page", async () => {
    const result = await resourcePage({
        updatedSince: "2026-01-03T00:00:00.000Z",
    })

    assert.deepEqual(
        result.items.map((user) => user.id),
        ["user-2"]
    )
})

test("roster pages use the roster update index and keep legacy HLL event scope", async () => {
    const result = (await handler(publicApi.getClanResourcePage)(
        { db: new FakeDb() },
        {
            secret: "dev-internal-auth-secret",
            keyHash: "key-hash",
            resource: "rosters",
            game: "hell_let_loose",
            cursor: null,
            limit: 25,
            updatedSince: "2026-01-03T00:00:00.000Z",
        }
    )) as { items: Array<{ id: string; gameId: string }> }

    assert.deepEqual(
        result.items.map((roster) => [roster.id, roster.gameId]),
        [["roster-hll", "hell_let_loose"]]
    )
})

test("projection backfill deduplicates multi-game memberships and fills legacy roster ownership", async () => {
    const db = new FakeDb()
    db.tables.rosters.get("roster-hll")!.guildId = undefined
    db.tables.clanApiUserProjections.clear()

    await handler(migrations.backfillClanApiReadProjections)(
        { db },
        {
            secret: "dev-internal-auth-secret",
            kind: "rosters",
            cursor: null,
            limit: 100,
        }
    )
    await handler(migrations.backfillClanApiReadProjections)(
        { db },
        {
            secret: "dev-internal-auth-secret",
            kind: "users",
            cursor: null,
            limit: 100,
        }
    )

    assert.equal(db.tables.rosters.get("roster-hll")?.guildId, "guild-a")
    assert.equal(db.tables.clanApiUserProjections.size, 1)
    assert.equal(
        db.tables.clanApiUserProjections.values().next().value?.updatedAt,
        "2026-01-03T00:00:00.000Z"
    )
})
