import { actorFixture, seedDashboardActor } from "./testing/dashboard-actor"
import * as integrationChanges from "../../../convex/integrationChanges"
import * as imageAssets from "../../../convex/imageAssets"
import * as matchTeams from "../../../convex/matchTeams"
import { invoke, testContext } from "./testing/database"
import * as teamReads from "../../../convex/teamReads"
import * as teams from "../../../convex/teams"
import assert from "node:assert/strict"
import test from "node:test"

process.env.INTERNAL_AUTH_SECRET = "synthetic-team-authorization"
const secret = process.env.INTERNAL_AUTH_SECRET
const guildId = "guild-a"
const access = { secret, guildId, actor: actorFixture }
const keyHash = "k".repeat(64)
const schedule = {
    registrationEnd: "2030-01-01T17:00:00.000Z",
    meetingStart: "2030-01-01T18:00:00.000Z",
    gameStart: "2030-01-01T18:30:00.000Z",
    gameEnd: "2030-01-01T20:00:00.000Z",
}

/** A workspace with one team assigned to one match, and one restricted reader key. */
async function setup() {
    const ctx = testContext()
    seedDashboardActor(ctx.db, guildId)
    ctx.db.tables.guilds[0].enabledGames = ["hell_let_loose", "wardogs"]
    ctx.db.seed("apiKeys", {
        _id: "apiKeys:site",
        guildId,
        keyHash,
        readAccess: { resources: ["teams"], gameIds: ["hell_let_loose"] },
    })
    const created = await invoke(teams.create, ctx, {
        ...access,
        input: {
            gameId: "hell_let_loose",
            name: "Alpha",
            idempotencyKey: "create-alpha-0001",
        },
    })
    assert.equal(created.ok, true)
    ctx.db.seed("events", {
        _id: "events:match",
        guildId,
        gameId: "hell_let_loose",
        kind: "match",
        status: "registration",
        name: "Match",
        ...schedule,
        pingClan: false,
        createdAt: "2026-10-01T00:00:00.000Z",
        matchTeams: [
            {
                teamId: created.teamId,
                slot: "a",
                side: null,
                snapshot: {
                    name: "Alpha",
                    shortCode: null,
                    logoAssetId: null,
                    logoUrl: null,
                    teamRevision: 1,
                    capturedAt: "2026-10-01T00:00:00.000Z",
                },
            },
        ],
    })
    return { ctx, teamId: created.teamId as string }
}

/** Every session-bound directory, asset and refresh handler. */
function dashboardCalls(teamId: string, actor = actorFixture) {
    const as = { ...access, actor }
    return [
        [
            "teams:create",
            teams.create,
            {
                ...as,
                input: {
                    gameId: "hell_let_loose",
                    name: "Bravo",
                    idempotencyKey: "create-bravo-0001",
                },
            },
        ],
        [
            "teams:update",
            teams.update,
            { ...as, teamId, input: { expectedRevision: 1, name: "Renamed" } },
        ],
        [
            "teams:archive",
            teams.archive,
            { ...as, teamId, input: { expectedRevision: 1 } },
        ],
        [
            "teams:restore",
            teams.restore,
            { ...as, teamId, input: { expectedRevision: 1 } },
        ],
        [
            "teams:list",
            teams.list,
            {
                ...as,
                gameId: "hell_let_loose",
                archived: false,
                cursor: null,
                limit: 10,
            },
        ],
        ["teams:get", teams.get, { ...as, teamId }],
        [
            "imageAssets:reserveUpload",
            imageAssets.reserveUpload,
            { ...as, kind: "team-logo" },
        ],
        [
            "imageAssets:record",
            imageAssets.record,
            {
                ...as,
                asset: {
                    kind: "team-logo",
                    publicId: "e".repeat(32),
                    storageId: "storage:new",
                    contentType: "image/png",
                    width: 64,
                    height: 64,
                    bytes: 100,
                    sha256: "f".repeat(64),
                    publicUrl: "https://logi.test/x.png",
                },
            },
        ],
        ["imageAssets:list", imageAssets.list, { ...as, kind: "team-logo" }],
        [
            "matchTeams:refreshSnapshot",
            matchTeams.refreshSnapshot,
            {
                secret,
                serverId: "guilds:admin",
                eventId: "events:match",
                teamId,
                actor,
            },
        ],
    ] as const
}

const denials: [
    string,
    (ctx: Awaited<ReturnType<typeof setup>>["ctx"]) => void,
][] = [
    [
        "a revoked dashboard session",
        (ctx) => {
            ctx.db.tables.dashboardSessions[0].revokedAt = Date.now()
        },
    ],
    [
        "an expired dashboard session",
        (ctx) => {
            ctx.db.tables.dashboardSessions[0].expiresAt = Date.now() - 1
        },
    ],
    [
        "a session invalidated by a newer user session version",
        (ctx) => {
            ctx.db.tables.users[0].sessionVersion = 1
        },
    ],
    [
        "removed administrator access",
        (ctx) => {
            Object.assign(ctx.db.tables.discordMemberAccess[0], {
                isAdmin: false,
                hasDashboardAccess: false,
            })
        },
    ],
]

const handlerNames = dashboardCalls("").map(([name]) => name)
const callFor = (name: string, teamId: string) =>
    dashboardCalls(teamId).find(([candidate]) => candidate === name)!

test("every directory, asset and refresh handler succeeds for the current administrator", async () => {
    for (const name of handlerNames) {
        const { ctx, teamId } = await setup()
        const [, fn, args] = callFor(name, teamId)
        await assert.doesNotReject(invoke(fn, ctx, args), name)
    }
})

test("expired, revoked, invalidated and demoted actors are refused by every session-bound handler", async () => {
    for (const [label, deny] of denials) {
        for (const name of handlerNames) {
            const { ctx, teamId } = await setup()
            deny(ctx)
            const [, fn, args] = callFor(name, teamId)
            // A thrown handler commits nothing (the fixture rolls back like Convex).
            await assert.rejects(
                invoke(fn, ctx, args),
                /Forbidden/,
                `${name} with ${label}`
            )
        }
    }
})

test("a forged actor identity or a wrong gateway secret is refused", async () => {
    const { ctx, teamId } = await setup()
    for (const [name, fn, args] of dashboardCalls(teamId, {
        ...actorFixture,
        subject: "100000000000000099",
    }))
        await assert.rejects(invoke(fn, ctx, args), /Forbidden/, name)
    for (const [name, fn, args] of dashboardCalls(teamId))
        await assert.rejects(
            invoke(fn, ctx, { ...args, secret: "wrong" }),
            /Unauthorized/,
            name
        )
})

test("foreign assets and teams are not attachable or editable from another workspace", async () => {
    const { ctx, teamId } = await setup()
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
        publicUrl: "https://logi.test/foreign.png",
        state: "ready",
        createdAt: "2026-10-01T00:00:00.000Z",
        createdBy: "someone",
    })
    assert.deepEqual(
        await invoke(teams.update, ctx, {
            ...access,
            teamId,
            input: { expectedRevision: 1, logoAssetId: "imageAssets:foreign" },
        }),
        { error: "asset_unavailable" }
    )
    // The same administrator of another workspace cannot reach this team.
    seedDashboardActor(ctx.db, "guild-b")
    assert.deepEqual(
        await invoke(teams.update, ctx, {
            ...access,
            guildId: "guild-b",
            teamId,
            input: { expectedRevision: 1, name: "Hijack" },
        }),
        { error: "not_found" }
    )
    assert.equal(
        await invoke(teams.get, ctx, { ...access, guildId: "guild-b", teamId }),
        null
    )
})

test("website team reads and the teams sync record refuse revoked, legacy and ungranted keys", async () => {
    const { ctx, teamId } = await setup()
    const credentials = { secret, keyHash, guildId, gameId: "hell_let_loose" }
    const record = {
        secret,
        keyHash,
        gameId: "hell_let_loose",
        resource: "teams",
        id: teamId,
    }
    const reads = () =>
        Promise.all([
            invoke(teamReads.list, ctx, {
                ...credentials,
                cursor: null,
                limit: 10,
            }),
            invoke(teamReads.get, ctx, { ...credentials, id: teamId }),
            invoke(integrationChanges.readSyncRecord, ctx, record),
        ])
    const [page, detail, sync] = await reads()
    assert.equal(page.items[0].id, teamId)
    assert.equal(detail.team.id, teamId)
    assert.equal(sync.operation, "upsert")
    assert.equal(sync.data.id, teamId)
    const key = ctx.db.tables.apiKeys[0]
    for (const [label, change, undo] of [
        [
            "revoked",
            () => (key.revokedAt = "2026-10-04T00:00:00.000Z"),
            () => delete key.revokedAt,
        ],
        [
            "legacy unrestricted",
            () => (key.readAccess = undefined),
            () =>
                (key.readAccess = {
                    resources: ["teams"],
                    gameIds: ["hell_let_loose"],
                }),
        ],
        [
            "granted another resource only",
            () =>
                (key.readAccess = {
                    resources: ["event-summaries"],
                    gameIds: ["hell_let_loose"],
                }),
            () =>
                (key.readAccess = {
                    resources: ["teams"],
                    gameIds: ["hell_let_loose"],
                }),
        ],
    ] as const) {
        change()
        assert.deepEqual(await reads(), [null, null, null], label)
        undo()
    }
    // A key of another workspace never reads this directory.
    assert.equal(
        await invoke(teamReads.list, ctx, {
            ...credentials,
            guildId: "guild-b",
            cursor: null,
            limit: 10,
        }),
        null
    )
    // An ungranted game is refused even with a valid key.
    assert.equal(
        await invoke(integrationChanges.readSyncRecord, ctx, {
            ...record,
            gameId: "wardogs",
        }),
        null
    )
})
