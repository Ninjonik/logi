import { actorFixture, seedDashboardActor } from "./testing/dashboard-actor"
import { IMAGE_CLEANUP_BATCH } from "../../domain/assets/image-asset"
import * as imageAssets from "../../../convex/imageAssets"
import * as matchTeams from "../../../convex/matchTeams"
import { invoke, testContext } from "./testing/database"
import * as teamReads from "../../../convex/teamReads"
import * as teams from "../../../convex/teams"
import { createHash } from "node:crypto"
import assert from "node:assert/strict"
import test from "node:test"

process.env.INTERNAL_AUTH_SECRET = "dev-internal-auth-secret"
const secret = process.env.INTERNAL_AUTH_SECRET
const guildId = "guild-a"
const access = { secret, guildId, actor: actorFixture }
const key = "k".repeat(64)

function setup(enabledGames = ["hell_let_loose", "wardogs"]) {
    const ctx = testContext()
    seedDashboardActor(ctx.db, guildId)
    ctx.db.tables.guilds[0].enabledGames = enabledGames
    ctx.db.seed("apiKeys", {
        _id: "apiKeys:site",
        guildId,
        keyHash: key,
        readAccess: { resources: ["teams"], gameIds: ["hell_let_loose"] },
    })
    ctx.db.seed("imageAssets", {
        _id: "imageAssets:logo",
        guildId,
        kind: "team-logo",
        publicId: "a".repeat(32),
        storageId: "storage:logo",
        contentType: "image/png",
        width: 512,
        height: 512,
        bytes: 1000,
        sha256: "b".repeat(64),
        publicUrl:
            "https://logi.test/api/image-assets/" + "a".repeat(32) + ".png",
        state: "ready",
        createdAt: "2026-10-01T00:00:00.000Z",
        createdBy: actorFixture.subject,
    })
    ctx.db.seed("imageAssets", {
        _id: "imageAssets:foreign",
        guildId: "guild-b",
        kind: "team-logo",
        publicId: "c".repeat(32),
        storageId: "storage:foreign",
        contentType: "image/png",
        width: 64,
        height: 64,
        bytes: 10,
        sha256: "d".repeat(64),
        publicUrl:
            "https://logi.test/api/image-assets/" + "c".repeat(32) + ".png",
        state: "ready",
        createdAt: "2026-10-01T00:00:00.000Z",
        createdBy: "someone",
    })
    return ctx
}
const reader = (ctx: ReturnType<typeof setup>) =>
    ctx as unknown as Parameters<typeof matchTeams.resolveEventMatchTeams>[0]
const create = (
    ctx: ReturnType<typeof setup>,
    input: Record<string, unknown>
) => invoke(teams.create, ctx, { ...access, input })

test("create is idempotent per key, unique per normalized name and game, and emits an upsert", async () => {
    const ctx = setup()
    const first = await create(ctx, {
        gameId: "hell_let_loose",
        name: "  Valkyria ",
        shortCode: "VLK",
        logoAssetId: "imageAssets:logo",
        idempotencyKey: "create-valkyria-1",
    })
    assert.equal(first.ok, true)
    assert.equal(first.revision, 1)
    const replay = await create(ctx, {
        gameId: "hell_let_loose",
        name: "  Valkyria ",
        shortCode: "VLK",
        logoAssetId: "imageAssets:logo",
        idempotencyKey: "create-valkyria-1",
    })
    assert.deepEqual(replay, {
        ok: true,
        teamId: first.teamId,
        revision: 1,
        replayed: true,
    })
    assert.deepEqual(
        await create(ctx, {
            gameId: "hell_let_loose",
            name: "Different",
            idempotencyKey: "create-valkyria-1",
        }),
        { error: "idempotency_conflict" }
    )
    assert.deepEqual(
        await create(ctx, {
            gameId: "hell_let_loose",
            name: "VALKYRIA",
            idempotencyKey: "create-valkyria-2",
        }),
        { error: "duplicate_name", existingId: first.teamId }
    )
    const wardogs = await create(ctx, {
        gameId: "wardogs",
        name: "Valkyria",
        idempotencyKey: "create-valkyria-3",
    })
    assert.equal(wardogs.ok, true)
    assert.equal(ctx.db.tables.teamDirectory.length, 2)
    assert.equal(ctx.db.tables.teamDirectoryAudit.length, 2)
    assert.deepEqual(
        ctx.db.tables.imageAssetReferences.map((row) => [
            row.owner,
            row.ownerId,
            row.assetId,
        ]),
        [["team", first.teamId, "imageAssets:logo"]]
    )
    const changes = ctx.db.tables.integrationChanges
    assert.equal(changes.length, 2)
    assert.ok(
        changes.every(
            (row) => row.resource === "teams" && row.operation === "upsert"
        )
    )
    const record = await invoke(teams.get, ctx, {
        ...access,
        teamId: first.teamId,
    })
    assert.equal(record.name, "Valkyria")
    assert.equal(record.logoUrl, ctx.db.tables.imageAssets[0].publicUrl)
    assert.equal(record.archivedAt, null)
})

test("create rejects disabled games, foreign or missing logo assets and invalid labels", async () => {
    const ctx = setup(["hell_let_loose"])
    assert.deepEqual(
        await create(ctx, {
            gameId: "wardogs",
            name: "Lonestar",
            idempotencyKey: "k-00000001",
        }),
        { error: "game_disabled" }
    )
    assert.deepEqual(
        await create(ctx, {
            gameId: "hell_let_loose",
            name: "Lonestar",
            logoAssetId: "imageAssets:foreign",
            idempotencyKey: "k-00000002",
        }),
        { error: "asset_unavailable" }
    )
    assert.deepEqual(
        await create(ctx, {
            gameId: "hell_let_loose",
            name: "Lonestar",
            logoAssetId: "imageAssets:missing",
            idempotencyKey: "k-00000003",
        }),
        { error: "asset_unavailable" }
    )
    assert.deepEqual(
        await create(ctx, {
            gameId: "hell_let_loose",
            name: "bad\u0007",
            idempotencyKey: "k-00000004",
        }),
        { error: "invalid_team" }
    )
    assert.equal(ctx.db.tables.teamDirectory, undefined)
})

test("update, archive and restore enforce revisions and keep historical logos referenced", async () => {
    const ctx = setup()
    const created = await create(ctx, {
        gameId: "hell_let_loose",
        name: "Valkyria",
        logoAssetId: "imageAssets:logo",
        idempotencyKey: "k-00000001",
    })
    await create(ctx, {
        gameId: "hell_let_loose",
        name: "Other",
        idempotencyKey: "k-00000002",
    })
    const stale = await invoke(teams.update, ctx, {
        ...access,
        teamId: created.teamId,
        input: { expectedRevision: 9, name: "Renamed" },
    })
    assert.deepEqual(stale, { error: "revision_conflict" })
    const clash = await invoke(teams.update, ctx, {
        ...access,
        teamId: created.teamId,
        input: { expectedRevision: 1, name: "other" },
    })
    assert.equal(clash.error, "duplicate_name")
    const renamed = await invoke(teams.update, ctx, {
        ...access,
        teamId: created.teamId,
        input: { expectedRevision: 1, name: "Valkyria II", logoAssetId: null },
    })
    assert.deepEqual(renamed, { ok: true, revision: 2 })
    assert.equal(ctx.db.tables.imageAssetReferences.length, 0)
    const archived = await invoke(teams.archive, ctx, {
        ...access,
        teamId: created.teamId,
        input: { expectedRevision: 2 },
    })
    assert.deepEqual(archived, { ok: true, revision: 3 })
    assert.equal(ctx.db.tables.integrationChanges.at(-1)?.operation, "remove")
    assert.deepEqual(
        await invoke(teams.archive, ctx, {
            ...access,
            teamId: created.teamId,
            input: { expectedRevision: 3 },
        }),
        { error: "archived" }
    )
    const active = await invoke(teams.list, ctx, {
        ...access,
        gameId: "hell_let_loose",
        archived: false,
        cursor: null,
        limit: 50,
    })
    assert.deepEqual(
        active.items.map((item: { name: string }) => item.name),
        ["Other"]
    )
    const all = await invoke(teams.list, ctx, {
        ...access,
        gameId: "hell_let_loose",
        archived: true,
        cursor: null,
        limit: 50,
    })
    assert.equal(all.items.length, 2)
    const found = await invoke(teams.list, ctx, {
        ...access,
        gameId: "hell_let_loose",
        archived: true,
        search: "valk",
        cursor: null,
        limit: 50,
    })
    assert.deepEqual(
        found.items.map((item: { name: string }) => item.name),
        ["Valkyria II"]
    )
    const restored = await invoke(teams.restore, ctx, {
        ...access,
        teamId: created.teamId,
        input: { expectedRevision: 3 },
    })
    assert.deepEqual(restored, { ok: true, revision: 4 })
    assert.equal(ctx.db.tables.teamDirectory[0].archivedAt, null)
    assert.deepEqual(
        ctx.db.tables.teamDirectoryAudit.map((row) => row.operation),
        ["create", "create", "update", "archive", "restore"]
    )
})

test("website reads require the explicit grant and game and exclude archived or foreign teams", async () => {
    const ctx = setup()
    const created = await create(ctx, {
        gameId: "hell_let_loose",
        name: "Valkyria",
        logoAssetId: "imageAssets:logo",
        idempotencyKey: "k-00000001",
    })
    const credentials = {
        secret,
        keyHash: key,
        guildId,
        gameId: "hell_let_loose",
    }
    const page = await invoke(teamReads.list, ctx, {
        ...credentials,
        cursor: null,
        limit: 50,
    })
    assert.deepEqual(page.items, [
        {
            id: created.teamId,
            gameId: "hell_let_loose",
            name: "Valkyria",
            shortCode: null,
            logoUrl: ctx.db.tables.imageAssets[0].publicUrl,
            revision: 1,
            updatedAt: ctx.db.tables.teamDirectory[0].updatedAt,
        },
    ])
    assert.equal(
        await invoke(teamReads.list, ctx, {
            ...credentials,
            gameId: "wardogs",
            cursor: null,
            limit: 50,
        }),
        null
    )
    assert.equal(
        await invoke(teamReads.list, ctx, {
            ...credentials,
            guildId: "guild-b",
            cursor: null,
            limit: 50,
        }),
        null
    )
    ctx.db.tables.apiKeys[0].readAccess = undefined
    assert.equal(
        await invoke(teamReads.list, ctx, {
            ...credentials,
            cursor: null,
            limit: 50,
        }),
        null,
        "legacy keys never acquire the teams resource"
    )
    ctx.db.tables.apiKeys[0].readAccess = {
        resources: ["teams"],
        gameIds: ["hell_let_loose"],
    }
    await invoke(teams.archive, ctx, {
        ...access,
        teamId: created.teamId,
        input: { expectedRevision: 1 },
    })
    assert.deepEqual(
        await invoke(teamReads.get, ctx, {
            ...credentials,
            id: created.teamId,
        }),
        {
            team: null,
        }
    )
})

test("match team resolution captures snapshots, preserves them and freezes concluded matches", async () => {
    const ctx = setup()
    const a = await create(ctx, {
        gameId: "hell_let_loose",
        name: "Alpha",
        logoAssetId: "imageAssets:logo",
        idempotencyKey: "k-00000001",
    })
    const b = await create(ctx, {
        gameId: "hell_let_loose",
        name: "Bravo",
        idempotencyKey: "k-00000002",
    })
    const w = await create(ctx, {
        gameId: "wardogs",
        name: "Wolf",
        idempotencyKey: "k-00000003",
    })
    const base = {
        guildId,
        gameId: "hell_let_loose",
        kind: "match" as const,
        status: "registration" as const,
        previous: undefined,
        now: "2026-10-04T12:00:00.000Z",
    }
    const resolved = await matchTeams.resolveEventMatchTeams(reader(ctx), {
        ...base,
        inputs: [
            { teamId: a.teamId, slot: "a", side: "Allies" },
            { teamId: b.teamId, slot: "b", side: null },
        ],
    })
    assert.ok(resolved.ok)
    assert.equal(resolved.matchTeams?.[0]?.snapshot.name, "Alpha")
    assert.equal(
        resolved.matchTeams?.[0]?.snapshot.logoAssetId,
        "imageAssets:logo"
    )
    assert.equal(
        resolved.matchTeams?.[0]?.snapshot.logoUrl,
        ctx.db.tables.imageAssets[0].publicUrl
    )
    assert.deepEqual(
        await matchTeams.resolveEventMatchTeams(reader(ctx), {
            ...base,
            inputs: [{ teamId: w.teamId, slot: "a", side: null }],
        }),
        { ok: false, error: "team_game_mismatch" }
    )
    assert.deepEqual(
        await matchTeams.resolveEventMatchTeams(reader(ctx), {
            ...base,
            inputs: [{ teamId: "teamDirectory:nope", slot: "a", side: null }],
        }),
        { ok: false, error: "team_not_found" }
    )
    // Omitted input keeps the saved selection, even after the team is renamed and archived.
    await invoke(teams.update, ctx, {
        ...access,
        teamId: a.teamId,
        input: { expectedRevision: 1, name: "Alpha Renamed" },
    })
    await invoke(teams.archive, ctx, {
        ...access,
        teamId: a.teamId,
        input: { expectedRevision: 2 },
    })
    const preserved = await matchTeams.resolveEventMatchTeams(reader(ctx), {
        ...base,
        inputs: undefined,
        previous: resolved.matchTeams,
    })
    assert.deepEqual(preserved, { ok: true, matchTeams: resolved.matchTeams })
    const moved = await matchTeams.resolveEventMatchTeams(reader(ctx), {
        ...base,
        inputs: [{ teamId: a.teamId, slot: "b", side: "Axis" }],
        previous: resolved.matchTeams,
    })
    assert.ok(moved.ok)
    assert.equal(moved.matchTeams?.[0]?.snapshot.name, "Alpha")
    assert.equal(moved.matchTeams?.[0]?.side, "Axis")
    assert.deepEqual(
        await matchTeams.resolveEventMatchTeams(reader(ctx), {
            ...base,
            gameId: "wardogs",
            inputs: undefined,
            previous: resolved.matchTeams,
        }),
        { ok: false, error: "team_game_mismatch" }
    )
    assert.deepEqual(
        await matchTeams.resolveEventMatchTeams(reader(ctx), {
            ...base,
            status: "concluded",
            inputs: [{ teamId: b.teamId, slot: "a", side: null }],
            previous: resolved.matchTeams,
        }),
        { ok: false, error: "match_concluded" }
    )
    assert.deepEqual(
        await matchTeams.resolveEventMatchTeams(reader(ctx), {
            ...base,
            status: "concluded",
            inputs: resolved.matchTeams!.map(({ teamId, slot, side }) => ({
                teamId,
                slot,
                side,
            })),
            previous: resolved.matchTeams,
        }),
        { ok: true, matchTeams: resolved.matchTeams }
    )
    assert.deepEqual(
        await matchTeams.resolveEventMatchTeams(reader(ctx), {
            ...base,
            kind: "training",
            inputs: [{ teamId: b.teamId, slot: "a", side: null }],
        }),
        { ok: false, error: "training_event" }
    )
})

test("an explicit refresh re-captures from an active team and records an audit entry", async () => {
    const ctx = setup()
    const a = await create(ctx, {
        gameId: "hell_let_loose",
        name: "Alpha",
        idempotencyKey: "k-00000001",
    })
    const now = "2026-10-04T12:00:00.000Z"
    const resolved = await matchTeams.resolveEventMatchTeams(reader(ctx), {
        guildId,
        gameId: "hell_let_loose",
        kind: "match",
        status: "registration",
        inputs: [{ teamId: a.teamId, slot: "a", side: null }],
        previous: undefined,
        now,
    })
    assert.ok(resolved.ok)
    ctx.db.seed("events", {
        _id: "events:match",
        guildId,
        gameId: "hell_let_loose",
        kind: "match",
        status: "registration",
        name: "Match",
        registrationEnd: now,
        meetingStart: now,
        gameStart: now,
        gameEnd: now,
        pingClan: false,
        createdAt: now,
        matchTeams: resolved.matchTeams,
    })
    await invoke(teams.update, ctx, {
        ...access,
        teamId: a.teamId,
        input: {
            expectedRevision: 1,
            shortCode: "ALP",
            logoAssetId: "imageAssets:logo",
        },
    })
    const refreshed = await invoke(matchTeams.refreshSnapshot, ctx, {
        secret,
        serverId: "guilds:admin",
        eventId: "events:match",
        teamId: a.teamId,
        actor: actorFixture.subject,
    })
    assert.equal(refreshed.ok, true)
    assert.equal(
        ctx.db.tables.events[0].matchTeams[0].snapshot.shortCode,
        "ALP"
    )
    assert.equal(ctx.db.tables.events[0].matchTeams[0].snapshot.teamRevision, 2)
    assert.ok(
        ctx.db.tables.imageAssetReferences.some(
            (row) => row.owner === "event" && row.ownerId === "events:match"
        )
    )
    assert.equal(
        ctx.db.tables.teamDirectoryAudit.at(-1)?.operation,
        "snapshot_refresh"
    )
    assert.equal(
        ctx.db.tables.teamDirectoryAudit.at(-1)?.eventId,
        "events:match"
    )
    ctx.db.tables.events[0].status = "concluded"
    assert.deepEqual(
        await invoke(matchTeams.refreshSnapshot, ctx, {
            secret,
            serverId: "guilds:admin",
            eventId: "events:match",
            teamId: a.teamId,
            actor: actorFixture.subject,
        }),
        { error: "match_concluded" }
    )
})

test("image assets: attach checks, upload reservations and cleanup spare referenced logos", async (t) => {
    const now = Date.parse("2026-10-04T12:00:00.000Z")
    t.mock.method(Date, "now", () => now)
    const ctx = setup()
    for (let attempt = 0; attempt < 10; attempt++) {
        const reserved = await invoke(imageAssets.reserveUpload, ctx, {
            ...access,
            kind: "team-logo",
        })
        // A reservation only counts the attempt; it never issues an upload URL.
        assert.deepEqual(reserved, { ok: true })
    }
    const limited = await invoke(imageAssets.reserveUpload, ctx, {
        ...access,
        kind: "team-logo",
    })
    assert.equal(limited.error, "upload_limited")
    const created = await invoke(imageAssets.record, ctx, {
        ...access,
        asset: {
            kind: "team-logo",
            publicId: "e".repeat(32),
            storageId: "storage:new",
            contentType: "image/png",
            width: 512,
            height: 300,
            bytes: 1234,
            sha256: "f".repeat(64),
            publicUrl:
                "https://logi.test/api/image-assets/" + "e".repeat(32) + ".png",
        },
    })
    assert.equal(created.ok, true)
    assert.equal(
        created.asset.url,
        "https://logi.test/api/image-assets/" + "e".repeat(32) + ".png"
    )
    assert.deepEqual(
        await invoke(imageAssets.record, ctx, {
            ...access,
            asset: {
                kind: "team-logo",
                publicId: "e".repeat(32),
                storageId: "storage:dup",
                contentType: "image/png",
                width: 600,
                height: 300,
                bytes: 1234,
                sha256: "f".repeat(64),
                publicUrl: "https://logi.test/x.png",
            },
        }),
        { error: "invalid_asset" }
    )
    ctx.storage.files.set("storage:logo", "https://files/logo")
    assert.deepEqual(
        await invoke(imageAssets.resolvePublic, ctx, {
            secret,
            publicId: "a".repeat(32),
        }),
        { url: "https://files/logo", contentType: "image/png" }
    )
    // Reference the seeded logo from a team; the unreferenced seed and the fresh upload differ by age.
    await create(ctx, {
        gameId: "hell_let_loose",
        name: "Alpha",
        logoAssetId: "imageAssets:logo",
        idempotencyKey: "k-00000001",
    })
    ctx.db.tables.imageAssets.find(
        (row) => row._id === created.asset.id
    )!.createdAt = "2026-10-01T00:00:00.000Z"
    const swept = await invoke(imageAssets.cleanupUnattached, ctx, {})
    assert.deepEqual(swept, { deleted: 2, done: true })
    assert.equal(ctx.scheduler.calls.length, 0)
    assert.deepEqual(
        ctx.db.tables.imageAssets.map((row) => row._id),
        ["imageAssets:logo"]
    )
    assert.equal(
        await invoke(imageAssets.resolvePublic, ctx, {
            secret,
            publicId: "e".repeat(32),
        }),
        null
    )
})

test("image cleanup pages past a full batch of referenced assets and stops when done", async (t) => {
    const now = Date.parse("2026-10-04T12:00:00.000Z")
    t.mock.method(Date, "now", () => now)
    const ctx = setup()
    ctx.db.tables.imageAssets = []
    const seedAsset = (n: number, createdAt: string) => {
        const id = `imageAssets:old${n}`
        ctx.db.seed("imageAssets", {
            _id: id,
            guildId,
            kind: "team-logo",
            publicId: n.toString(16).padStart(32, "0"),
            storageId: `storage:old${n}`,
            contentType: "image/png",
            width: 64,
            height: 64,
            bytes: 10,
            sha256: "b".repeat(64),
            publicUrl: "https://logi.test/x.png",
            state: "ready",
            createdAt,
            createdBy: actorFixture.subject,
        })
        return id
    }
    // A full batch of the oldest assets stays referenced forever.
    for (let n = 0; n < IMAGE_CLEANUP_BATCH; n++)
        ctx.db.seed("imageAssetReferences", {
            _id: `imageAssetReferences:${n}`,
            assetId: seedAsset(
                n,
                `2026-09-01T00:00:${String(n).padStart(2, "0")}.000Z`
            ),
            guildId,
            owner: "team",
            ownerId: `teamDirectory:${n}`,
            createdAt: "2026-09-01T00:00:00.000Z",
        })
    // A newer, but still expired, unattached upload sits behind them.
    const orphan = seedAsset(999, "2026-10-02T00:00:00.000Z")
    const fresh = seedAsset(1000, "2026-10-04T11:00:00.000Z")
    const first = await invoke(imageAssets.cleanupUnattached, ctx, {})
    assert.deepEqual(first, { deleted: 0, done: false })
    assert.equal(ctx.scheduler.calls.length, 1)
    const [, , next] = ctx.scheduler.calls[0] as [
        number,
        unknown,
        { cursor: string; cutoff: string },
    ]
    assert.equal(next.cutoff, "2026-10-03T12:00:00.000Z")
    assert.equal(typeof next.cursor, "string")
    const second = await invoke(imageAssets.cleanupUnattached, ctx, next)
    assert.deepEqual(second, { deleted: 1, done: true })
    // The scan finished, so no further run is chained.
    assert.equal(ctx.scheduler.calls.length, 1)
    const ids = ctx.db.tables.imageAssets.map((row) => row._id)
    assert.equal(ids.includes(orphan), false)
    assert.equal(ids.includes(fresh), true)
    assert.equal(ids.length, IMAGE_CLEANUP_BATCH + 1)
})

test("storeNormalized stores and records together and deletes the blob when recording fails", async (t) => {
    const now = Date.parse("2026-10-04T12:00:00.000Z")
    t.mock.method(Date, "now", () => now)
    const ctx = setup()
    const png = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4,
    ])
    const stored = new Map<string, Blob>()
    let sequence = 0
    const actionCtx = {
        storage: {
            store: async (blob: Blob) => {
                const id = `storage:upload${++sequence}`
                stored.set(id, blob)
                return id
            },
            delete: async (id: string) => {
                stored.delete(id)
            },
        },
        runMutation: async (_ref: unknown, args: Record<string, unknown>) =>
            await invoke(imageAssets.record, ctx, args),
    }
    const asset = {
        kind: "team-logo",
        publicId: "9".repeat(32),
        contentType: "image/png",
        width: 64,
        height: 64,
        publicUrl:
            "https://logi.test/api/image-assets/" + "9".repeat(32) + ".png",
    }
    const run = (args: Record<string, unknown>) =>
        (
            imageAssets.storeNormalized as unknown as {
                _handler: (ctx: unknown, args: unknown) => Promise<unknown>
            }
        )._handler(actionCtx, {
            ...access,
            asset,
            bytes: png.buffer.slice(0),
            ...args,
        })
    const ok = (await run({})) as { ok: true; asset: { bytes: number } }
    assert.equal(ok.ok, true)
    assert.equal(ok.asset.bytes, png.byteLength)
    assert.deepEqual([...stored.keys()], ["storage:upload1"])
    const row = ctx.db.tables.imageAssets.find(
        (entry) => entry.publicId === asset.publicId
    )!
    assert.equal(row.storageId, "storage:upload1")
    assert.equal(row.bytes, png.byteLength)
    // The digest is computed from the stored bytes, not supplied by the caller.
    assert.equal(row.sha256, createHash("sha256").update(png).digest("hex"))
    // A rejected record (publicId already used) removes exactly the new blob.
    assert.deepEqual(await run({}), { error: "invalid_asset" })
    assert.deepEqual([...stored.keys()], ["storage:upload1"])
    // A revoked dashboard session makes the record throw; the blob is removed.
    ctx.db.tables.dashboardSessions[0].revokedAt = "2026-10-04T11:00:00.000Z"
    await assert.rejects(
        run({ asset: { ...asset, publicId: "8".repeat(32) } }),
        { message: "Image asset could not be recorded." }
    )
    assert.deepEqual([...stored.keys()], ["storage:upload1"])
    assert.equal(
        ctx.db.tables.imageAssets.some(
            (entry) => entry.publicId === "8".repeat(32)
        ),
        false
    )
    // Bytes that are not the kind's normalized output are never stored.
    assert.deepEqual(
        await run({
            asset: { ...asset, publicId: "7".repeat(32) },
            bytes: new Uint8Array([0xff, 0xd8, 0xff, 0]).buffer,
        }),
        { error: "invalid_asset" }
    )
    assert.equal(sequence, 3)
    await assert.rejects(run({ secret: "wrong" }), /Unauthorized/)
    assert.equal(sequence, 3)
})
