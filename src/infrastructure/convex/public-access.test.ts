import {
    CLIENT_GRANT_TTL_MS,
    clientGrantScopes,
} from "@/domain/identity/client-grant"
import * as assignments from "../../../convex/userAssignments"
import * as serverContext from "../../../convex/serverContext"
import * as configuration from "../../../convex/discordConfig"
import * as rosters from "../../../convex/serverRosters"
import { invoke, testContext } from "./testing/database"
import * as stratmaps from "../../../convex/stratmaps"
import { issueClientGrant } from "@/lib/client-grants"
import * as guilds from "../../../convex/guilds"
import * as users from "../../../convex/users"
import assert from "node:assert/strict"
import test from "node:test"

const secret = (process.env.INTERNAL_AUTH_SECRET = "dev-internal-auth-secret")
const GUILD = "200000000000000001"
const OTHER_GUILD = "200000000000000002"
const ADMIN = "100000000000000001"
const MEMBER = "100000000000000002"
const SESSIONS: Record<string, string> = {
    [ADMIN]: "a".repeat(43),
    [MEMBER]: "m".repeat(43),
}

function fixture() {
    const ctx = testContext()
    ctx.db.seed("guilds", {
        _id: "guilds:a",
        discordId: GUILD,
        name: "Clan A",
        adminIds: [ADMIN],
        adminAccessOverrides: {},
    })
    ctx.db.seed("guilds", {
        _id: "guilds:b",
        discordId: OTHER_GUILD,
        name: "Clan B",
        adminIds: [],
    })
    for (const [id, discordId, guildId] of [
        ["users:admin", ADMIN, GUILD],
        ["users:member", MEMBER, GUILD],
    ])
        ctx.db.seed("users", {
            _id: id,
            discordId,
            name: id,
            guildId,
            managedGuildIds: [],
            mercenaryGuildIds: [],
        })
    ctx.db.seed("events", {
        _id: "events:e1",
        guildId: GUILD,
        name: "VLK vs ROG",
        participants: [],
        signUps: [],
    })
    ctx.db.seed("rosters", {
        _id: "rosters:r1",
        eventId: "events:e1",
        published: false,
        squads: [],
        reservePlayerIds: [],
        notAttendingPlayerIds: [],
    })
    ctx.db.seed("discordConfigs", {
        _id: "discordConfigs:a",
        guildId: GUILD,
        timezone: "Europe/Prague",
        defaultLanguage: "cs",
        meetingChannelId: "300000000000000001",
        calendarCategories: [],
        calendarFeedToken: "calendar-capability",
        playerStatsServers: [{ token: "stats-token", url: "https://s.test" }],
        gameOverrides: {
            wardogs: {
                playerStatsServers: [
                    { token: "wardogs-token", url: "https://w.test" },
                ],
            },
        },
    })
    ctx.db.seed("userAssignments", {
        _id: "userAssignments:foreign",
        serverId: OTHER_GUILD,
        userId: MEMBER,
        type: "member",
        status: "active",
        secondaryGroupIds: [],
        paused: false,
    })
    for (const [userRecordId, subject] of [
        ["users:admin", ADMIN],
        ["users:member", MEMBER],
    ])
        ctx.db.seed("dashboardSessions", {
            _id: `dashboardSessions:${subject}`,
            sid: SESSIONS[subject],
            subject,
            userRecordId,
            userSessionVersion: 0,
            expiresAt: Date.now() + 60 * 60 * 1000,
        })
    return ctx
}

const session = (discordId: string) => ({
    discordId,
    sid: SESSIONS[discordId],
})
const rosterGrant = (discordId: string, rosterId = "rosters:r1") =>
    issueClientGrant(
        session(discordId),
        clientGrantScopes.roster("guilds:a", rosterId)
    )

test("server-only functions refuse callers without the internal secret", async () => {
    const ctx = fixture()
    const calls: Array<[unknown, Record<string, unknown>]> = [
        [configuration.getConfigByGuild, { guildId: "guilds:a" }],
        [configuration.getConfigByDiscordGuildId, { guildId: GUILD }],
        [users.listUsers, {}],
        [assignments.getById, { assignmentId: "userAssignments:foreign" }],
        [
            serverContext.getServerContext,
            { userId: ADMIN, serverId: "guilds:a" },
        ],
        [
            guilds.setEnabledGames,
            { userId: ADMIN, guildId: "guilds:a", enabledGames: [] },
        ],
    ]
    for (const [fn, args] of calls) {
        await assert.rejects(
            invoke(fn as never, ctx, { ...args, secret: "guessed" }),
            /Unauthorized/
        )
    }
    const config = await invoke(configuration.getConfigByGuild, ctx, {
        secret,
        guildId: "guilds:a",
    })
    assert.equal(config.guildId, GUILD)
})

test("the live roster names its viewer only through a signed grant", async () => {
    const ctx = fixture()
    const detail = await invoke(rosters.getRosterDetail, ctx, {
        grant: rosterGrant(ADMIN),
        serverId: "guilds:a",
        rosterId: "rosters:r1",
    })
    assert.equal(detail.canAdmin, true)
    assert.equal(detail.roster.id, "rosters:r1")
    // The board needs only these two settings; tokens never reach the browser.
    assert.deepEqual(detail.discordConfig, {
        timezone: "Europe/Prague",
        meetingChannelId: "300000000000000001",
    })
})

test("members cannot read an unpublished roster, even with their own grant", async () => {
    const ctx = fixture()
    const args = {
        grant: rosterGrant(MEMBER),
        serverId: "guilds:a",
        rosterId: "rosters:r1",
    }
    assert.equal(await invoke(rosters.getRosterDetail, ctx, args), null)
    ctx.db.tables.rosters[0].published = true
    const published = await invoke(rosters.getRosterDetail, ctx, args)
    assert.equal(published.canAdmin, false)
    assert.equal(published.roster.id, "rosters:r1")
})

test("forged, reused, tampered and expired grants are refused", async () => {
    const ctx = fixture()
    ctx.db.seed("rosters", {
        _id: "rosters:r2",
        eventId: "events:e1",
        published: true,
        squads: [],
        reservePlayerIds: [],
        notAttendingPlayerIds: [],
    })
    const grant = rosterGrant(ADMIN)
    const [payload, signature] = grant.split(".")
    const flipped = `${payload}.${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`
    const expired = issueClientGrant(
        session(ADMIN),
        clientGrantScopes.roster("guilds:a", "rosters:r1"),
        Date.now() - CLIENT_GRANT_TTL_MS - 1
    )
    const otherSession = issueClientGrant(
        { discordId: ADMIN, sid: SESSIONS[MEMBER] },
        clientGrantScopes.roster("guilds:a", "rosters:r1")
    )
    // A live query treats an unusable grant as no data instead of crashing the page.
    for (const [badGrant, rosterId] of [
        [grant, "rosters:r2"],
        [flipped, "rosters:r1"],
        [expired, "rosters:r1"],
        [otherSession, "rosters:r1"],
        ["not-a-grant", "rosters:r1"],
    ])
        assert.equal(
            await invoke(rosters.getRosterDetail, ctx, {
                grant: badGrant,
                serverId: "guilds:a",
                rosterId,
            }),
            null
        )
})

test("a grant stops working when its dashboard session ends", async () => {
    const ctx = fixture()
    const args = {
        grant: rosterGrant(ADMIN),
        serverId: "guilds:a",
        rosterId: "rosters:r1",
    }
    assert.ok(await invoke(rosters.getRosterDetail, ctx, args))
    ctx.db.tables.dashboardSessions.find(
        (row) => row.subject === ADMIN
    )!.revokedAt = new Date().toISOString()
    assert.equal(await invoke(rosters.getRosterDetail, ctx, args), null)
})

test("grants are refused when the internal secret is not configured", async () => {
    const ctx = fixture()
    const args = {
        grant: rosterGrant(ADMIN),
        serverId: "guilds:a",
        rosterId: "rosters:r1",
    }
    delete process.env.INTERNAL_AUTH_SECRET
    try {
        assert.equal(await invoke(rosters.getRosterDetail, ctx, args), null)
        await assert.rejects(
            invoke(configuration.getConfigByGuild, ctx, {
                secret: "dev-internal-auth-secret",
                guildId: "guilds:a",
            }),
            /Unauthorized/
        )
    } finally {
        process.env.INTERNAL_AUTH_SECRET = secret
    }
})

test("members get the clan context without drafts or manager secrets", async () => {
    const ctx = fixture()
    const member = await invoke(serverContext.getServerContext, ctx, {
        secret,
        userId: MEMBER,
        serverId: "guilds:a",
    })
    assert.equal(member.canAdmin, false)
    assert.deepEqual(member.rosters, [])
    assert.equal(member.discordConfig.calendarFeedToken, undefined)
    assert.equal(member.discordConfig.playerStatsServers, undefined)
    assert.equal(
        member.discordConfig.gameOverrides.wardogs.playerStatsServers,
        undefined
    )
    const admin = await invoke(serverContext.getServerContext, ctx, {
        secret,
        userId: ADMIN,
        serverId: "guilds:a",
    })
    assert.equal(admin.rosters.length, 1)
    assert.equal(admin.discordConfig.playerStatsServers.length, 1)
})

test("stratmap edits need a grant for that stratmap from an administrator", async () => {
    const ctx = fixture()
    const create = (discordId: string) =>
        invoke(stratmaps.create, ctx, {
            grant: issueClientGrant(
                session(discordId),
                clientGrantScopes.stratmapCreate("guilds:a")
            ),
            serverId: "guilds:a",
            title: "Foy",
            baseMapId: "foy",
        })
    await assert.rejects(create(MEMBER), /Only admins/)
    const stratmapId = await create(ADMIN)
    await assert.rejects(
        invoke(stratmaps.updateState, ctx, {
            grant: issueClientGrant(
                session(ADMIN),
                clientGrantScopes.stratmap("stratmaps:other")
            ),
            stratmapId,
            state: "{}",
        }),
        /Unauthorized/
    )
    await invoke(stratmaps.updateState, ctx, {
        grant: issueClientGrant(
            session(ADMIN),
            clientGrantScopes.stratmap(stratmapId)
        ),
        stratmapId,
        state: "{}",
    })
    const stored = ctx.db.tables.stratmaps.find((row) => row._id === stratmapId)
    assert.equal(stored?.state, "{}")
    assert.equal(stored?.createdBy, ADMIN)
})

test("an assignment from another clan cannot be edited through this clan", async () => {
    const ctx = fixture()
    await assert.rejects(
        invoke(assignments.upsert, ctx, {
            secret,
            serverId: "guilds:a",
            assignmentId: "userAssignments:foreign",
            userId: MEMBER,
            type: "member",
            status: "active",
            secondaryGroupIds: [],
            paused: false,
        }),
        /Assignment guild mismatch/
    )
    assert.equal(ctx.db.tables.userAssignments[0].serverId, OTHER_GUILD)
})
