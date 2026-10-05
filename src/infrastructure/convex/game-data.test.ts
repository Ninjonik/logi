import { warconMatchDetail, warconServerId } from "../testing/warcon"
import * as history from "../../../convex/gameDataHistory"
import { readWarconSession } from "../game-data/warcon"
import * as publicApi from "../../../convex/publicApi"
import * as gameData from "../../../convex/gameData"
import test, { type TestContext } from "node:test"
import assert from "node:assert/strict"

type Row = { _id: string } & Record<string, unknown>
class Database {
    tables: Record<string, Row[]> = {
        apiKeys: [
            {
                _id: "key",
                keyHash: "hash",
                guildId: "guild-a",
                readAccess: {
                    resources: ["server-snapshots", "integration-health"],
                    gameIds: ["wardogs"],
                },
            },
        ],
    }
    query(table: string) {
        const checks: Array<(row: Row) => boolean> = []
        const index = {
            eq: (key: string, value: unknown) => {
                checks.push((row) => row[key] === value)
                return index
            },
            gte: (key: string, value: number) => {
                checks.push(
                    (row) =>
                        typeof row[key] === "number" &&
                        (row[key] as number) >= value
                )
                return index
            },
            lte: (key: string, value: number) => {
                checks.push(
                    (row) =>
                        typeof row[key] === "number" &&
                        (row[key] as number) <= value
                )
                return index
            },
        }
        const rows = () =>
            (this.tables[table] ?? []).filter((row) =>
                checks.every((check) => check(row))
            )
        const query = {
            withIndex: (_name: string, fn: (q: typeof index) => unknown) => {
                fn(index)
                return query
            },
            unique: async () => rows()[0] ?? null,
            first: async () => rows()[0] ?? null,
            collect: async () => rows(),
            take: async (n: number) => rows().slice(0, n),
            paginate: async () => ({
                page: rows(),
                continueCursor: "",
                isDone: true,
            }),
        }
        return query
    }
    async get(id: string) {
        return (
            Object.values(this.tables)
                .flat()
                .find((row) => row._id === id) ?? null
        )
    }
    normalizeId(table: string, id: string) {
        return this.tables[table]?.some((row) => row._id === id) ? id : null
    }
    async insert(table: string, value: Record<string, unknown>) {
        const id = `${table}-${(this.tables[table] ?? []).length}`
        ;(this.tables[table] ??= []).push({ _id: id, ...value })
        return id
    }
    async patch(id: string, value: Record<string, unknown>) {
        Object.assign((await this.get(id))!, value)
    }
}

test("Warcon archive survives collector disable and credential rotation, replaces corrections and rejects reused identities", async (t) => {
    const ctx = fixture(t)
    const warcon = {
        ...source,
        provider: "wardogs_warcon",
        providerServerId: warconServerId,
    }
    process.env.LOGI_GAME_DATA_SOURCES = JSON.stringify([warcon])
    const detail = warconMatchDetail()
    const session = await readWarconSession(
        warcon as Parameters<typeof readWarconSession>[0],
        "7",
        {
            get: async () => ({ status: 200, etag: null, body: detail }),
        }
    )
    const commit = async (value = session) => {
        await handler(gameData.configure)(ctx, {
            secret: "synthetic-data-secret",
            guildId: source.guildId,
            sourceRef: source.ref,
            enabled: true,
        })
        const claim = (await handler(history.claimNext)(ctx, {})) as {
            runId: string
            generation: number
            fence: number
        }
        return handler(history.commit)(ctx, {
            ...claim,
            result: {
                session: value,
                progress: { page: 1, pendingIds: [], nextPage: null },
                completed: true,
            },
        })
    }
    await commit()
    assert.equal(ctx.db.tables.serverGameHistory?.length, 1)
    const originalId = ctx.db.tables.serverGameHistory[0]._id
    assert.equal(ctx.db.tables.serverGameHistory[0].revision, "1")
    await commit()
    assert.equal(ctx.db.tables.serverGameHistory.length, 1)
    assert.equal(
        ctx.db.tables.serverGameHistory[0].revision,
        "1",
        "unchanged reads don't invent revisions"
    )
    await commit({
        ...session,
        warcon: { ...session.warcon!, winner: "Alpha" },
        sourceDigest: "f".repeat(64),
    })
    assert.equal(ctx.db.tables.serverGameHistory[0]._id, originalId)
    assert.equal(ctx.db.tables.serverGameHistory[0].revision, "2")
    await handler(gameData.configure)(ctx, {
        secret: "synthetic-data-secret",
        guildId: source.guildId,
        sourceRef: source.ref,
        enabled: false,
    })
    assert.equal(ctx.db.tables.serverGameHistory.length, 1)
    process.env.LOGI_GAME_DATA_SOURCES = JSON.stringify([
        { ...warcon, secretRef: "LOGI_GAME_DATA_ROTATED_TOKEN" },
    ])
    await commit()
    assert.equal(
        ctx.db.tables.serverGameHistory.length,
        1,
        "credential changes preserve source identity"
    )
    await assert.rejects(
        () => commit({ ...session, startedAt: "2026-10-01T11:00:00.000Z" }),
        /identity conflict/i
    )
    assert.equal(ctx.db.tables.serverGameHistory[0]._id, originalId)
    process.env.LOGI_GAME_DATA_SOURCES = JSON.stringify([
        { ...warcon, origin: "https://other-source.test" },
    ])
    await commit()
    assert.equal(
        ctx.db.tables.serverGameHistory.length,
        2,
        "a different provider origin has its own match identity"
    )
    assert.notEqual(
        ctx.db.tables.serverGameHistory[0].sourceId,
        ctx.db.tables.serverGameHistory[1].sourceId
    )
})
const source = {
    ref: "wdg",
    guildId: "guild-a",
    gameId: "wardogs",
    provider: "wardogs_rcon",
    providerServerId: "one",
    origin: "https://example.test",
    secretRef: "LOGI_GAME_DATA_WDG_TOKEN",
    allowedAddresses: [],
}
function handler(fn: unknown) {
    return (
        fn as {
            _handler: (
                ctx: unknown,
                args: Record<string, unknown>
            ) => Promise<unknown>
        }
    )._handler
}
function fixture(t: TestContext) {
    const previous = {
        catalog: process.env.LOGI_GAME_DATA_SOURCES,
        secret: process.env.INTERNAL_AUTH_SECRET,
    }
    process.env.LOGI_GAME_DATA_SOURCES = JSON.stringify([source])
    process.env.INTERNAL_AUTH_SECRET = "synthetic-data-secret"
    t.after(() => {
        for (const [key, value] of [
            ["LOGI_GAME_DATA_SOURCES", previous.catalog],
            ["INTERNAL_AUTH_SECRET", previous.secret],
        ]) {
            if (value === undefined) delete process.env[key!]
            else process.env[key!] = value
        }
    })
    return { db: new Database(), scheduler: { runAfter: async () => null } }
}

test("configuration cannot bind another tenant or accept a browser-supplied origin", async (t) => {
    const ctx = fixture(t)
    await assert.rejects(
        handler(gameData.configure)(ctx, {
            secret: "wrong",
            guildId: "guild-a",
            sourceRef: "wdg",
            enabled: true,
        }),
        /Unauthorized/
    )
    await assert.rejects(
        handler(gameData.configure)(ctx, {
            secret: "synthetic-data-secret",
            guildId: "guild-b",
            sourceRef: "wdg",
            enabled: true,
        }),
        /source/i
    )
    await handler(gameData.configure)(ctx, {
        secret: "synthetic-data-secret",
        guildId: "guild-a",
        sourceRef: "wdg",
        enabled: true,
    })
    const listed = await handler(gameData.listConnections)(ctx, {
        secret: "synthetic-data-secret",
        guildId: "guild-a",
    })
    assert.ok(JSON.stringify(listed).includes('"enabled":true'))
    assert.equal(
        JSON.stringify(listed).includes("LOGI_GAME_DATA_WDG_TOKEN"),
        false
    )
    assert.equal(JSON.stringify(listed).includes("https://example.test"), false)
})

test("atomic claim excludes a concurrent worker; disable fences the old success", async (t) => {
    const ctx = fixture(t)
    await handler(gameData.configure)(ctx, {
        secret: "synthetic-data-secret",
        guildId: "guild-a",
        sourceRef: "wdg",
        enabled: true,
    })
    const first = (await handler(gameData.claimNext)(ctx, {})) as {
        id: string
        generation: number
        fence: number
    }
    assert.ok(first)
    assert.equal(await handler(gameData.claimNext)(ctx, {}), null)
    await handler(gameData.configure)(ctx, {
        secret: "synthetic-data-secret",
        guildId: "guild-a",
        sourceRef: "wdg",
        enabled: false,
    })
    assert.equal(
        await handler(gameData.finishSnapshot)(ctx, {
            id: first.id,
            generation: first.generation,
            fence: first.fence,
            result: {
                errorCategory: null,
                nextAttemptAt: Date.now() + 60_000,
                observation: {
                    observedAt: new Date().toISOString(),
                    providerUpdatedAt: null,
                    displayName: "Fixture",
                    state: "online",
                    map: null,
                    players: 0,
                    capacity: 100,
                    providerInstanceId: null,
                    scores: [],
                    capabilities: ["server_snapshot"],
                },
            },
        }),
        false
    )
    assert.equal(ctx.db.tables.gameDataConnections[0].observation, null)
})

test("snapshot and health reads enforce key resource, game, tenant and revocation in Convex", async (t) => {
    const ctx = fixture(t)
    await handler(gameData.configure)(ctx, {
        secret: "synthetic-data-secret",
        guildId: "guild-a",
        sourceRef: "wdg",
        enabled: true,
    })
    const id = ctx.db.tables.gameDataConnections[0]._id
    const input = {
        secret: process.env.INTERNAL_AUTH_SECRET ?? "",
        keyHash: "hash",
        resource: "server-snapshots",
        game: "wardogs",
        cursor: null,
        limit: 25,
    }
    const page = (await handler(publicApi.getClanResourcePage)(ctx, input)) as {
        items: Array<Record<string, unknown>>
    }
    assert.equal(page.items.length, 1)
    assert.equal(page.items[0].players, null)
    ctx.db.tables.gameDataConnections[0].updatedAt = "2030-01-01T00:00:00.000Z"
    const tied = (await handler(publicApi.getClanResourcePage)(ctx, {
        ...input,
        updatedSince: "2030-01-01T00:00:00Z",
    })) as { items: unknown[] }
    assert.equal(
        tied.items.length,
        1,
        "inclusive timestamp ties compare instants, not ISO formatting"
    )
    assert.equal(
        await handler(publicApi.getClanResourcePage)(ctx, {
            ...input,
            game: "hell_let_loose",
        }),
        null
    )
    ctx.db.tables.apiKeys[0].readAccess = {
        resources: ["integration-health"],
        gameIds: ["wardogs"],
    }
    assert.equal(
        await handler(publicApi.getClanResource)(ctx, {
            secret: input.secret,
            keyHash: "hash",
            resource: "server-snapshots",
            id,
        }),
        null
    )
    ctx.db.tables.apiKeys[0].guildId = "guild-b"
    assert.equal(
        await handler(publicApi.getClanResource)(ctx, {
            secret: input.secret,
            keyHash: "hash",
            resource: "integration-health",
            id,
        }),
        null
    )
    ctx.db.tables.apiKeys[0].revokedAt = "2030-01-01T00:00:00Z"
    assert.equal(
        await handler(publicApi.getClanResourcePage)(ctx, {
            ...input,
            resource: "integration-health",
        }),
        null
    )
})

test("history upserts session and checkpoint atomically, keeps connection identities separate and fences disable", async (t) => {
    const ctx = fixture(t)
    const hll = {
        ...source,
        ref: "hll",
        gameId: "hell_let_loose",
        provider: "hll_crcon",
        providerServerId: "1",
    }
    process.env.LOGI_GAME_DATA_SOURCES = JSON.stringify([
        hll,
        { ...hll, ref: "hll-two", providerServerId: "2" },
    ])
    const configure = (ref: string, enabled: boolean) =>
        handler(gameData.configure)(ctx, {
            secret: "synthetic-data-secret",
            guildId: "guild-a",
            sourceRef: ref,
            enabled,
        })
    await configure("hll", true)
    const claim = (await handler(history.claimNext)(ctx, {})) as {
        runId: string
        generation: number
        fence: number
    }
    assert.ok(claim)
    const session = {
        externalId: "42",
        startedAt: null,
        endedAt: null,
        complete: false,
        map: null,
        participants: [],
        players: [],
        sourceDigest: "a".repeat(64),
    }
    const result = {
        session,
        progress: { page: 2, pendingIds: [], nextPage: null },
        completed: false,
    }
    const input = {
        runId: claim.runId,
        generation: claim.generation,
        fence: claim.fence,
        result,
    }
    assert.equal(await handler(history.commit)(ctx, input), true)
    assert.equal(ctx.db.tables.gameSessions.length, 1)
    assert.equal(
        (ctx.db.tables.gameDataHistoryRuns[0].progress as { page: number })
            .page,
        2
    )
    assert.equal(
        await handler(history.commit)(ctx, input),
        false,
        "same claim cannot commit twice"
    )
    await configure("hll", true)
    const again = (await handler(history.claimNext)(ctx, {})) as typeof claim
    await handler(history.commit)(ctx, {
        ...input,
        generation: again.generation,
        fence: again.fence,
    })
    assert.equal(ctx.db.tables.gameSessions.length, 1, "reimport is an upsert")
    await configure("hll", false)
    await configure("hll-two", true)
    const other = (await handler(history.claimNext)(ctx, {})) as typeof claim
    await handler(history.commit)(ctx, {
        ...input,
        runId: other.runId,
        generation: other.generation,
        fence: other.fence,
    })
    assert.equal(
        ctx.db.tables.gameSessions.length,
        2,
        "same external ID belongs to a different connection"
    )
    await configure("hll-two", true)
    const late = (await handler(history.claimNext)(ctx, {})) as typeof claim
    await configure("hll-two", false)
    assert.equal(
        await handler(history.commit)(ctx, {
            ...input,
            runId: late.runId,
            generation: late.generation,
            fence: late.fence,
        }),
        false
    )
})

test("unfinished session revisit is independent of pagination and crash recovery rewinds a page hint", async (t) => {
    const ctx = fixture(t)
    process.env.LOGI_GAME_DATA_SOURCES = JSON.stringify([
        {
            ...source,
            ref: "hll",
            gameId: "hell_let_loose",
            provider: "hll_crcon",
            providerServerId: "1",
        },
    ])
    await handler(gameData.configure)(ctx, {
        secret: "synthetic-data-secret",
        guildId: "guild-a",
        sourceRef: "hll",
        enabled: true,
    })
    const connectionId = ctx.db.tables.gameDataConnections[0]._id
    await ctx.db.insert("gameSessions", {
        connectionId,
        externalId: "old-unfinished",
        complete: false,
        fetchedAt: 0,
    })
    Object.assign(ctx.db.tables.gameDataHistoryRuns[0], {
        progress: { page: 4, pendingIds: [], nextPage: null },
        leaseUntil: 1,
    })
    const claim = (await handler(history.claimNext)(ctx, {})) as {
        revisitId: string
        progress: { page: number }
    }
    assert.equal(claim.revisitId, "old-unfinished")
    assert.equal(claim.progress.page, 3)
})

test("source changes and expired claims reject writes until a new generation is claimed", async (t) => {
    const ctx = fixture(t)
    const configure = () =>
        handler(gameData.configure)(ctx, {
            secret: "synthetic-data-secret",
            guildId: "guild-a",
            sourceRef: "wdg",
            enabled: true,
        })
    await configure()
    const original = (await handler(gameData.claimNext)(ctx, {})) as {
        id: string
        generation: number
        fence: number
    }
    const result = {
        errorCategory: "timeout",
        nextAttemptAt: Date.now() + 5000,
    }
    process.env.LOGI_GAME_DATA_SOURCES = JSON.stringify([
        { ...source, origin: "https://replacement.example.test" },
    ])
    assert.equal(
        await handler(gameData.finishSnapshot)(ctx, { ...original, result }),
        false
    )
    await configure()
    const next = (await handler(gameData.claimNext)(ctx, {})) as typeof original
    assert.ok(next.generation > original.generation)
    assert.equal(
        await handler(gameData.finishSnapshot)(ctx, { ...original, result }),
        false
    )
    ctx.db.tables.gameDataConnections[0].leaseUntil = Date.now() - 1
    assert.equal(
        await handler(gameData.finishSnapshot)(ctx, { ...next, result }),
        false
    )
    assert.equal(ctx.db.tables.gameDataConnections[0].errorCategory, null)
})
