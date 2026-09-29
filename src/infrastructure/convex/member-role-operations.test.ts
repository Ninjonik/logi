import * as operations from "../../../convex/memberRoleOperations"
import * as observations from "../../../convex/memberObservations"
import * as assignments from "../../../convex/userAssignments"
import * as configuration from "../../../convex/discordConfig"
import { invoke, testContext } from "./testing/database"
import * as publicApi from "../../../convex/publicApi"
import * as groups from "../../../convex/groups"
import assert from "node:assert/strict"
import test from "node:test"

const secret = (process.env.INTERNAL_AUTH_SECRET = "dev-internal-auth-secret")
function fixture() {
    const ctx = testContext()
    ctx.db.seed("guilds", {
        _id: "guilds:a",
        discordId: "111111111111111111",
        adminIds: ["333333333333333333"],
        adminAccessOverrides: {},
    })
    ctx.db.seed("users", {
        _id: "users:target",
        discordId: "222222222222222222",
    })
    ctx.db.seed("discordConfigs", {
        _id: "discordConfigs:a",
        guildId: "111111111111111111",
        clanRoleId: "clan",
        membershipSettings: {
            enabled: true,
            autoAssignRecruitOnApply: true,
            categories: [
                {
                    id: "members",
                    supportRoleIds: ["support"],
                    recruitRoleIds: ["recruit"],
                    finalRoleIds: ["member"],
                },
            ],
        },
    })
    return ctx
}
const save = {
    secret,
    serverDiscordId: "111111111111111111",
    userId: "222222222222222222",
    gameId: "hell_let_loose",
    type: "member",
    status: "recruit",
    membershipCategoryId: "members",
    secondaryGroupIds: [],
    paused: false,
}
const actor = { userId: "333333333333333333", kind: "dashboard" }
const evidence = () => ({
    actorPresent: true,
    actorAdministrator: false,
    actorRoleIds: [],
    targetRoleIds: [],
    observedAt: Date.now(),
})
async function queued(ctx: ReturnType<typeof fixture>) {
    await invoke(assignments.upsertByServerDiscordId, ctx, {
        ...save,
        roleActor: actor,
    })
    return invoke(operations.claimNext, ctx, {
        secret,
        guildId: "111111111111111111",
    })
}
test("actual staff assignment queues atomically while legacy service and import paths do not", async () => {
    const ctx = fixture()
    await invoke(assignments.upsertByServerDiscordId, ctx, save)
    assert.equal(ctx.db.tables.memberRoleOperations?.length ?? 0, 0)
    await invoke(assignments.upsertByServerDiscordId, ctx, {
        ...save,
        assignmentId: ctx.db.tables.userAssignments[0]._id,
        status: "active",
        roleActor: actor,
    })
    const [operation] = ctx.db.tables.memberRoleOperations
    assert.equal(operation.actorId, "333333333333333333")
    assert.deepEqual(operation.desiredRoleIds, ["clan", "member"])
    assert.equal(operation.status, "pending")
    const broken = fixture()
    broken.db.tables.discordConfigs[0].dashboardAdminRoleId = "member"
    await assert.rejects(
        invoke(assignments.upsertByServerDiscordId, broken, {
            ...save,
            roleActor: actor,
        }),
        /owner/
    )
    assert.equal(broken.db.tables.userAssignments?.length ?? 0, 0)
})
test("execution rechecks current actor authority, assignment version, policy and lease", async () => {
    const ctx = fixture(),
        claim = await queued(ctx)
    const args = {
        secret,
        operationId: claim.operationId,
        fence: claim.fence,
        evidence: evidence(),
    }
    assert.equal((await invoke(operations.prepare, ctx, args)).verdict, "ready")
    ctx.db.tables.guilds[0].adminIds = []
    assert.equal(
        (await invoke(operations.prepare, ctx, args)).verdict,
        "denied"
    )
    ctx.db.tables.guilds[0].adminIds = ["333333333333333333"]
    await invoke(assignments.upsertByServerDiscordId, ctx, {
        ...save,
        assignmentId: ctx.db.tables.userAssignments[0]._id,
        status: "active",
    })
    assert.equal(
        (await invoke(operations.prepare, ctx, args)).verdict,
        "superseded"
    )
    assert.equal(
        await invoke(operations.finish, ctx, {
            ...args,
            evidence: undefined,
            outcome: "applied",
            reason: "verified",
        }),
        false
    )
})
test("expired leases are reclaimed and stale completion cannot claim success", async () => {
    const ctx = fixture(),
        first = await queued(ctx)
    assert.equal(
        await invoke(operations.claimNext, ctx, {
            secret,
            guildId: "111111111111111111",
        }),
        null
    )
    ctx.db.tables.memberRoleOperations[0].nextAttemptAt = 0
    ctx.db.tables.memberRoleOperations[0].leaseUntil = 0
    ctx.db.tables.memberRoleLocks[0].leaseUntil = 0
    const second = await invoke(operations.claimNext, ctx, {
        secret,
        guildId: "111111111111111111",
    })
    assert.ok(second.fence > first.fence)
    assert.equal(
        await invoke(operations.finish, ctx, {
            secret,
            ...first,
            outcome: "applied",
            reason: "verified",
        }),
        false
    )
    assert.equal(
        await invoke(operations.finish, ctx, {
            secret,
            ...second,
            outcome: "retry_scheduled",
            reason: "rate_limited",
            retryAfterMs: 120_000,
        }),
        true
    )
    assert.ok(
        ctx.db.tables.memberRoleOperations[0].nextAttemptAt >=
            Date.now() + 119_000
    )
})
test("departure and rejoin cannot revive a previously queued grant", async () => {
    const ctx = fixture(),
        claim = await queued(ctx)
    const epoch = await invoke(observations.ensureGuild, ctx, {
        secret,
        guildId: "111111111111111111",
    })
    for (const state of ["left", "present"])
        await invoke(observations.applyGateway, ctx, {
            secret,
            guildId: "111111111111111111",
            discordUserId: "222222222222222222",
            epoch,
            state,
            roleIds: [],
            observedAt: new Date().toISOString(),
        })
    assert.equal(
        (
            await invoke(operations.prepare, ctx, {
                secret,
                ...claim,
                evidence: evidence(),
            })
        ).verdict,
        "denied"
    )
})
test("removal has a durable empty desired state and remains tenant bound", async () => {
    const ctx = fixture()
    await queued(ctx)
    await invoke(assignments.remove, ctx, {
        secret,
        assignmentId: ctx.db.tables.userAssignments[0]._id,
        roleActor: actor,
        roleGuildId: "111111111111111111",
    })
    const last = ctx.db.tables.memberRoleOperations.at(-1)!
    assert.deepEqual(last.desiredRoleIds, [])
    assert.equal(ctx.db.tables.memberRoleOperations[0].status, "superseded")
    assert.deepEqual(
        await invoke(operations.listForGuild, ctx, {
            secret,
            guildId: "other",
        }),
        []
    )
})

test("success requires fresh evidence of convergence within the managed role set", async () => {
    const ctx = fixture(),
        claim = await queued(ctx)
    const args = { secret, ...claim, outcome: "applied", reason: "verified" }
    assert.equal(
        await invoke(operations.finish, ctx, { ...args, evidence: evidence() }),
        false
    )
    assert.equal(ctx.db.tables.memberRoleOperations[0].status, "running")
    assert.equal(
        await invoke(operations.finish, ctx, {
            ...args,
            evidence: {
                ...evidence(),
                targetRoleIds: ["clan", "recruit", "unmanaged"],
            },
        }),
        true
    )
    assert.equal(ctx.db.tables.memberRoleOperations[0].status, "applied")
})

test("one game preserves an existing shared clan role but cannot grant on another actor's authority", async () => {
    const ctx = fixture()
    ctx.db.tables.discordConfigs[0].gameOverrides = {
        wardogs: {
            membershipSettings: {
                enabled: true,
                autoAssignRecruitOnApply: false,
                categories: [
                    {
                        id: "members",
                        supportRoleIds: [],
                        recruitRoleIds: [],
                        finalRoleIds: ["wardogs-member"],
                    },
                ],
            },
        },
    }
    await invoke(assignments.upsertByServerDiscordId, ctx, {
        ...save,
        gameId: "wardogs",
        status: "active",
        roleActor: actor,
    })
    const wardogs = await invoke(operations.claimNext, ctx, {
        secret,
        guildId: "111111111111111111",
    })
    assert.equal(
        await invoke(operations.finish, ctx, {
            secret,
            ...wardogs,
            outcome: "applied",
            reason: "verified",
            evidence: {
                ...evidence(),
                targetRoleIds: ["clan", "wardogs-member"],
            },
        }),
        true
    )
    await invoke(assignments.upsertByServerDiscordId, ctx, {
        ...save,
        status: "pending",
        roleActor: actor,
    })
    const hll = await invoke(operations.claimNext, ctx, {
        secret,
        guildId: "111111111111111111",
    })
    const prepare = (roles: string[]) =>
        invoke(operations.prepare, ctx, {
            secret,
            ...hll,
            evidence: { ...evidence(), targetRoleIds: roles },
        })
    assert.deepEqual(
        (await prepare(["clan", "wardogs-member"])).desiredRoleIds,
        ["clan"]
    )
    assert.deepEqual((await prepare(["wardogs-member"])).desiredRoleIds, [])
    assert.deepEqual(
        (await prepare(["clan", "wardogs-member"])).allowedRoleIds,
        ["clan", "member", "recruit"]
    )
    assert.equal(
        await invoke(operations.finish, ctx, {
            secret,
            ...hll,
            outcome: "applied",
            reason: "verified",
            evidence: {
                ...evidence(),
                targetRoleIds: ["clan", "wardogs-member"],
            },
        }),
        true
    )
})

test("periodic checks retain a bounded audit and expose only tenant-scoped operator details", async () => {
    const ctx = fixture()
    let claim = await queued(ctx)
    for (let i = 0; i < 25; i++) {
        assert.equal(
            await invoke(operations.finish, ctx, {
                secret,
                ...claim,
                outcome: "applied",
                reason: "verified",
                evidence: { ...evidence(), targetRoleIds: ["clan", "recruit"] },
            }),
            true
        )
        if (i < 24) {
            ctx.db.tables.memberRoleOperations[0].nextAttemptAt = 0
            claim = await invoke(operations.claimNext, ctx, {
                secret,
                guildId: "111111111111111111",
            })
        }
    }
    assert.equal(ctx.db.tables.memberRoleAudits.length, 20)
    const [row] = await invoke(operations.listForGuild, ctx, {
        secret,
        guildId: "111111111111111111",
    })
    assert.equal(row.attempts, 25)
    assert.deepEqual(
        row.audit.map((entry: { attempt: number }) => entry.attempt),
        [25, 24, 23, 22, 21]
    )
    assert.equal("policyFingerprint" in row, false)
    assert.equal("allowedRoleIds" in row, false)
})

test("dashboard and legacy group writers reject a second owner for membership roles", async () => {
    const ctx = fixture()
    const group = {
        name: "Conflicting group",
        color: "#ffffff",
        order: 0,
        discordRoleId: "member",
    }
    await assert.rejects(
        invoke(groups.upsert, ctx, { secret, guildId: "guilds:a", ...group }),
        /owner/
    )
    ctx.db.seed("apiKeys", {
        _id: "apiKeys:legacy",
        guildId: "111111111111111111",
        keyHash: "hash",
    })
    const args = {
        secret,
        keyHash: "hash",
        idempotencyKey: "request-one",
        bodyHash: "body",
        methodPath: "POST /groups",
        operation: "create",
        ...group,
    }
    const result = await invoke(publicApi.mutateClanGroup, ctx, args)
    assert.equal(result.status, 400)
    assert.equal(JSON.parse(result.body).error.code, "validation_error")
    assert.deepEqual(await invoke(publicApi.mutateClanGroup, ctx, args), result)
    assert.equal(ctx.db.tables.groups?.length ?? 0, 0)
})

test("configuration rejects shared category roles across games before persisting", async () => {
    const ctx = fixture(),
        policy = structuredClone(
            ctx.db.tables.discordConfigs[0].membershipSettings
        )
    await assert.rejects(
        invoke(configuration.upsertConfig, ctx, {
            secret,
            guildId: "guilds:a",
            timezone: "UTC",
            defaultLanguage: "en",
            membershipSettings: policy,
            gameOverrides: { wardogs: { membershipSettings: policy } },
        }),
        /owner/
    )
    assert.equal(ctx.db.tables.discordConfigs[0].gameOverrides, undefined)
})

test("unlinked player assignments remain editable but cannot queue Discord grants", async () => {
    const ctx = fixture()
    ctx.db.seed("users", {
        _id: "users:imported",
        id: "imported-unlinked-player",
    })
    await invoke(assignments.upsertByServerDiscordId, ctx, {
        ...save,
        userId: "imported-unlinked-player",
        roleActor: actor,
    })
    assert.equal(
        ctx.db.tables.userAssignments[0].userId,
        "imported-unlinked-player"
    )
    assert.equal(ctx.db.tables.memberRoleOperations[0].status, "denied")
    assert.equal(
        ctx.db.tables.memberRoleOperations[0].reason,
        "target_not_linked"
    )
    assert.equal(
        await invoke(operations.claimNext, ctx, {
            secret,
            guildId: save.serverDiscordId,
        }),
        null
    )
})

test("real legacy bearer assignment mutation remains a data-only write", async () => {
    const ctx = fixture()
    ctx.db.seed("apiKeys", {
        _id: "apiKeys:legacy",
        guildId: save.serverDiscordId,
        keyHash: "hash",
    })
    const result = await invoke(publicApi.mutateClanAssignment, ctx, {
        secret,
        keyHash: "hash",
        idempotencyKey: "assignment-one",
        bodyHash: "body",
        methodPath: "POST /assignments",
        operation: "create",
        userId: save.userId,
        type: "member",
        status: "active",
        paused: false,
        gameId: "hell_let_loose",
        secondaryGroupIds: [],
    })
    assert.equal(result.status, 201)
    assert.equal(ctx.db.tables.memberRoleOperations?.length ?? 0, 0)
})
