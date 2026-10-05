import { actorFixture, seedDashboardActor } from "./testing/dashboard-actor"
import * as integrationChanges from "../../../convex/integrationChanges"
import type { DashboardActor } from "../../../convex/dashboardActor"
import * as teamRequests from "../../../convex/teamRequests"
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
const superadmin: DashboardActor = { ...actorFixture, superadmin: true }
const keyHash = "k".repeat(64)
const schedule = {
    registrationEnd: "2030-01-01T17:00:00.000Z",
    meetingStart: "2030-01-01T18:00:00.000Z",
    gameStart: "2030-01-01T18:30:00.000Z",
    gameEnd: "2030-01-01T20:00:00.000Z",
}
const recordedAsset = {
    kind: "team-logo",
    publicId: "e".repeat(32),
    storageId: "storage:new",
    contentType: "image/png",
    width: 64,
    height: 64,
    bytes: 100,
    sha256: "f".repeat(64),
    publicUrl: "https://logi.test/x.png",
}

/** One catalogue team assigned to one match, one pending request and one reader key. */
async function setup() {
    const ctx = testContext()
    seedDashboardActor(ctx.db, guildId)
    ctx.db.seed("apiKeys", {
        _id: "apiKeys:site",
        guildId,
        keyHash,
        readAccess: { resources: ["teams"], gameIds: ["hell_let_loose"] },
    })
    const created = await invoke(teams.create, ctx, {
        secret,
        actor: superadmin,
        input: {
            gameId: "hell_let_loose",
            name: "Alpha",
            idempotencyKey: "create-alpha-0001",
        },
    })
    assert.equal(created.ok, true)
    const requested = await invoke(teamRequests.submit, ctx, {
        secret,
        guildId,
        actor: actorFixture,
        input: {
            kind: "create",
            gameId: "hell_let_loose",
            proposal: { name: "Charlie" },
            idempotencyKey: "request-charlie-1",
        },
    })
    assert.equal(requested.ok, true)
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
    return {
        ctx,
        teamId: created.teamId as string,
        requestId: requested.requestId as string,
    }
}
type Fixture = Awaited<ReturnType<typeof setup>>
type Call = readonly [string, unknown, Record<string, unknown>]

/** Handlers only a global administrator may use. */
function platformCalls(f: Fixture, actor: DashboardActor = superadmin): Call[] {
    const as = { secret, actor }
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
            {
                ...as,
                teamId: f.teamId,
                input: { expectedRevision: 1, name: "Renamed" },
            },
        ],
        [
            "teams:archive",
            teams.archive,
            { ...as, teamId: f.teamId, input: { expectedRevision: 1 } },
        ],
        [
            "teams:restore",
            teams.restore,
            { ...as, teamId: f.teamId, input: { expectedRevision: 1 } },
        ],
        [
            "teams:merge",
            teams.merge,
            {
                ...as,
                teamId: f.teamId,
                input: {
                    expectedRevision: 1,
                    targetTeamId: f.teamId,
                    targetRevision: 1,
                },
            },
        ],
        [
            "teams:adminList",
            teams.adminList,
            {
                ...as,
                gameId: "hell_let_loose",
                archived: true,
                cursor: null,
                limit: 10,
            },
        ],
        ["teams:adminGet", teams.adminGet, { ...as, teamId: f.teamId }],
        [
            "imageAssets:reserveUpload (platform)",
            imageAssets.reserveUpload,
            { ...as, guildId: "platform", kind: "team-logo" },
        ],
        [
            "imageAssets:record (platform)",
            imageAssets.record,
            { ...as, guildId: "platform", asset: recordedAsset },
        ],
        [
            "imageAssets:list (platform)",
            imageAssets.list,
            { ...as, guildId: "platform", kind: "team-logo" },
        ],
        [
            "teamRequests:queue",
            teamRequests.queue,
            { ...as, status: "pending", cursor: null, limit: 10 },
        ],
        [
            "teamRequests:get",
            teamRequests.get,
            { ...as, requestId: f.requestId },
        ],
        [
            "teamRequests:decide",
            teamRequests.decide,
            {
                ...as,
                requestId: f.requestId,
                input: { decision: "reject", reason: "Not a team" },
            },
        ],
    ]
}

/** Handlers a workspace administrator uses in that workspace's dashboard. */
function workspaceCalls(
    f: Fixture,
    actor: DashboardActor = actorFixture
): Call[] {
    const as = { secret, guildId, actor }
    return [
        [
            "teams:list",
            teams.list,
            { ...as, gameId: "hell_let_loose", cursor: null, limit: 10 },
        ],
        ["teams:get", teams.get, { ...as, teamId: f.teamId }],
        [
            "imageAssets:reserveUpload",
            imageAssets.reserveUpload,
            { ...as, kind: "team-logo" },
        ],
        [
            "imageAssets:record",
            imageAssets.record,
            { ...as, asset: recordedAsset },
        ],
        ["imageAssets:list", imageAssets.list, { ...as, kind: "team-logo" }],
        [
            "matchTeams:refreshSnapshot",
            matchTeams.refreshSnapshot,
            {
                secret,
                serverId: "guilds:admin",
                eventId: "events:match",
                teamId: f.teamId,
                actor,
            },
        ],
        [
            "teamRequests:submit",
            teamRequests.submit,
            {
                ...as,
                input: {
                    kind: "update",
                    teamId: f.teamId,
                    proposal: { name: "Alpha" },
                    idempotencyKey: "request-alpha-01",
                },
            },
        ],
        [
            "teamRequests:listMine",
            teamRequests.listMine,
            { ...as, cursor: null, limit: 10 },
        ],
        [
            "teamRequests:cancel",
            teamRequests.cancel,
            { ...as, requestId: f.requestId },
        ],
    ]
}

const sessionDenials: [string, (ctx: Fixture["ctx"]) => void][] = [
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
]

async function eachCall(
    calls: (f: Fixture) => Call[],
    run: (f: Fixture, call: Call) => Promise<void>
) {
    const names = calls(await setup()).map(([name]) => name)
    for (const name of names) {
        const f = await setup()
        await run(
            f,
            calls(f).find(([candidate]) => candidate === name)!
        )
    }
}

test("every global and workspace handler succeeds for its current administrator", async () => {
    for (const calls of [platformCalls, workspaceCalls])
        await eachCall(calls, async (f, [name, fn, args]) => {
            await assert.doesNotReject(invoke(fn, f.ctx, args), name)
        })
})

test("expired, revoked and invalidated sessions are refused by every session-bound handler", async () => {
    for (const [label, deny] of sessionDenials)
        for (const calls of [platformCalls, workspaceCalls])
            await eachCall(calls, async (f, [name, fn, args]) => {
                deny(f.ctx)
                // A thrown handler commits nothing (the fixture rolls back like Convex).
                await assert.rejects(
                    invoke(fn, f.ctx, args),
                    /Forbidden/,
                    `${name} with ${label}`
                )
            })
})

test("global handlers refuse workspace administrators; workspace handlers refuse removed access", async () => {
    await eachCall(
        (f) => platformCalls(f, actorFixture),
        async (f, [name, fn, args]) => {
            await assert.rejects(invoke(fn, f.ctx, args), /Forbidden/, name)
        }
    )
    await eachCall(workspaceCalls, async (f, [name, fn, args]) => {
        Object.assign(f.ctx.db.tables.discordMemberAccess[0], {
            isAdmin: false,
            hasDashboardAccess: false,
        })
        await assert.rejects(invoke(fn, f.ctx, args), /Forbidden/, name)
    })
})

test("a forged actor identity or a wrong gateway secret is refused", async () => {
    const f = await setup()
    const forged = { ...actorFixture, subject: "100000000000000099" }
    for (const [name, fn, args] of [
        ...platformCalls(f, { ...forged, superadmin: true }),
        ...workspaceCalls(f, forged),
    ])
        await assert.rejects(invoke(fn, f.ctx, args), /Forbidden/, name)
    for (const [name, fn, args] of [...platformCalls(f), ...workspaceCalls(f)])
        await assert.rejects(
            invoke(fn, f.ctx, { ...args, secret: "wrong" }),
            /Unauthorized/,
            name
        )
})

test("logos and requests stay inside their scope", async () => {
    const f = await setup()
    f.ctx.db.seed("imageAssets", {
        _id: "imageAssets:workspace",
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
    // A workspace upload is never a catalogue logo without an approved request.
    assert.deepEqual(
        await invoke(teams.update, f.ctx, {
            secret,
            actor: superadmin,
            teamId: f.teamId,
            input: {
                expectedRevision: 1,
                logoAssetId: "imageAssets:workspace",
            },
        }),
        { error: "asset_unavailable" }
    )
    // Another workspace's upload cannot travel in this workspace's request.
    assert.deepEqual(
        await invoke(teamRequests.submit, f.ctx, {
            secret,
            guildId,
            actor: actorFixture,
            input: {
                kind: "create",
                gameId: "hell_let_loose",
                proposal: {
                    name: "Delta",
                    logoAssetId: "imageAssets:workspace",
                },
                idempotencyKey: "request-delta-01",
            },
        }),
        { error: "asset_unavailable" }
    )
    // Another workspace's administrator cannot cancel or list this request.
    seedDashboardActor(f.ctx.db, "guild-b")
    assert.deepEqual(
        await invoke(teamRequests.cancel, f.ctx, {
            secret,
            guildId: "guild-b",
            actor: actorFixture,
            requestId: f.requestId,
        }),
        { error: "not_found" }
    )
    const theirs = await invoke(teamRequests.listMine, f.ctx, {
        secret,
        guildId: "guild-b",
        actor: actorFixture,
        cursor: null,
        limit: 10,
    })
    assert.deepEqual(theirs.items, [])
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
    // The key must belong to the workspace that authenticated the request.
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
