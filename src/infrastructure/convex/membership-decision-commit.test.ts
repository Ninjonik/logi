import { commit } from "../../../convex/membershipDecisions"
import { invoke, testContext } from "./testing/database"
import test, { type TestContext } from "node:test"
import assert from "node:assert/strict"

const secret = "decision-commit-test",
    guildId = "111111111111111111",
    userId = "222222222222222222",
    actorId = "333333333333333333"
function fixture(t: TestContext) {
    const previous = process.env.INTERNAL_AUTH_SECRET
    process.env.INTERNAL_AUTH_SECRET = secret
    t.after(() => {
        if (previous === undefined) delete process.env.INTERNAL_AUTH_SECRET
        else process.env.INTERNAL_AUTH_SECRET = previous
    })
    const ctx = testContext()
    ctx.db.seed("guilds", { _id: "guilds:one", discordId: guildId })
    ctx.db.seed("users", { _id: "users:one", discordId: userId })
    ctx.db.seed("discordConfigs", {
        _id: "discordConfigs:one",
        guildId,
        membershipSettings: {
            enabled: true,
            categories: [
                {
                    id: "member",
                    gameId: "hell_let_loose",
                    assignmentType: "member",
                    recruitRoleIds: [],
                    finalRoleIds: [],
                    supportRoleIds: [],
                },
                {
                    id: "merc",
                    gameId: "wardogs",
                    assignmentType: "mercenary",
                    recruitRoleIds: [],
                    finalRoleIds: [],
                    supportRoleIds: [],
                },
            ],
        },
    })
    ctx.db.seed("userAssignments", {
        _id: "userAssignments:one",
        serverId: guildId,
        userId,
        gameId: "hell_let_loose",
        type: "member",
        status: "pending",
        membershipCategoryId: "member",
        secondaryGroupIds: [],
        paused: false,
        createdAt: "2026-01-01T00:00:00Z",
    })
    ctx.db.seed("membershipApplicationThreads", {
        _id: "membershipApplicationThreads:one",
        guildId,
        creatorId: userId,
        threadId: "thread",
        gameId: "hell_let_loose",
        categoryId: "member",
        assignmentType: "member",
        assignmentId: "userAssignments:one",
        status: "open",
        decisionClaimToken: "claim",
        decisionLeaseUntil: Date.now() + 300_000,
    })
    return ctx
}
const args = {
    secret,
    threadId: "thread",
    claimToken: "claim",
    actorId,
    outcome: "mercenary",
}

test("a cross-game decision commits membership, projections, roles, closure and recovery intent together and replays without new writes", async (t) => {
    const ctx = fixture(t)
    const result = await invoke(commit, ctx, args)
    assert.equal(result.gameId, "wardogs")
    assert.equal(await ctx.db.get("userAssignments:one"), null)
    const application = await ctx.db.get("membershipApplicationThreads:one")
    assert.equal(application?.status, "closed")
    assert.equal(
        application?.gameId,
        "hell_let_loose",
        "original application game remains historical"
    )
    assert.equal(application?.decisionGameId, "wardogs")
    assert.equal(ctx.db.tables.discordMembershipOperations.length, 1)
    const snapshot = structuredClone(ctx.db.tables)
    assert.deepEqual(await invoke(commit, ctx, args), result)
    assert.deepEqual(ctx.db.tables, snapshot)
})

test("a closure failure rolls back the membership move and every dependent write", async (t) => {
    const ctx = fixture(t),
        snapshot = structuredClone(ctx.db.tables)
    const patch = ctx.db.patch.bind(ctx.db)
    t.mock.method(
        ctx.db,
        "patch",
        async (id: string, value: Record<string, unknown>) => {
            if (
                id === "membershipApplicationThreads:one" &&
                value.status === "closed"
            )
                throw new Error("closure write failed")
            return patch(id, value)
        }
    )
    await assert.rejects(invoke(commit, ctx, args), /closure write failed/)
    assert.deepEqual(ctx.db.tables, snapshot)
})

test("stale claims and cross-tenant assignment IDs are rejected before membership writes", async (t) => {
    const ctx = fixture(t)
    await assert.rejects(
        invoke(commit, ctx, { ...args, claimToken: "stale" }),
        /ownership lost/
    )
    await ctx.db.patch("userAssignments:one", { serverId: "other" })
    const snapshot = structuredClone(ctx.db.tables)
    await assert.rejects(invoke(commit, ctx, args), /scope mismatch/)
    assert.deepEqual(ctx.db.tables, snapshot)
})
