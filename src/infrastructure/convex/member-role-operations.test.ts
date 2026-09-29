import { syncDashboardAdminOverrides } from "../../../convex/discordMemberAccessStore"
import type { MutationCtx } from "../../../convex/_generated/server"
import * as operations from "../../../convex/memberRoleOperations"
import * as observations from "../../../convex/memberObservations"
import * as assignments from "../../../convex/userAssignments"
import * as configuration from "../../../convex/discordConfig"
import { invoke, testContext } from "./testing/database"
import * as publicApi from "../../../convex/publicApi"
import * as guilds from "../../../convex/guilds"
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
        dashboardAdminRoleId: "dashboard",
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
    actorRoleIds: ["dashboard"],
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
    args.evidence.actorRoleIds = []
    assert.equal(
        (await invoke(operations.prepare, ctx, args)).verdict,
        "denied"
    )
    args.evidence.actorRoleIds = ["dashboard"]
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
    ctx.db.tables.users[0].id = "imported-player"
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
        userId: "imported-player",
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

for (const cache of ["OAuth admin", "role-derived override"])
    test(`freshly revoked Discord authority overrides the ${cache} cache`, async () => {
        const ctx = fixture(),
            claim = await queued(ctx)
        const args = {
            secret,
            ...claim,
            evidence: { ...evidence(), actorRoleIds: [] },
        }
        if (cache === "role-derived override") {
            ctx.db.tables.guilds[0].adminIds = []
            await syncDashboardAdminOverrides(
                ctx as unknown as MutationCtx,
                save.serverDiscordId,
                [{ userId: actor.userId, roleIds: ["dashboard"] }]
            )
            assert.equal(
                ctx.db.tables.guilds[0].adminAccessOverrides[actor.userId],
                true
            )
        }
        assert.equal(
            (await invoke(operations.prepare, ctx, args)).verdict,
            "denied",
            "cached grant must not authorize"
        )
    })

test("explicit dashboard role grants require fresh Discord confirmation and explicit denials still veto the role", async () => {
    const ctx = fixture(),
        claim = await queued(ctx)
    ctx.db.seed("users", { _id: "users:actor", discordId: actor.userId })
    const args = { secret, ...claim, evidence: evidence() }
    await invoke(guilds.setPlayerAdminAccessInternal, ctx, {
        secret,
        serverId: "guilds:a",
        playerId: actor.userId,
        isAdmin: true,
    })
    assert.equal(
        (await invoke(operations.prepare, ctx, args)).verdict,
        "ready",
        "confirmed explicit dashboard role grant works"
    )
    assert.equal(
        (
            await invoke(operations.prepare, ctx, {
                ...args,
                evidence: { ...evidence(), actorRoleIds: [] },
            })
        ).verdict,
        "denied",
        "desired role is not authority until Discord confirms it"
    )
    await invoke(guilds.setPlayerAdminAccessInternal, ctx, {
        secret,
        serverId: "guilds:a",
        playerId: actor.userId,
        isAdmin: false,
    })
    assert.equal(
        (await invoke(operations.prepare, ctx, args)).verdict,
        "denied"
    )
    assert.equal(
        (
            await invoke(operations.prepare, ctx, {
                ...args,
                evidence: { ...evidence(), actorAdministrator: true },
            })
        ).verdict,
        "ready",
        "fresh Discord Administrator retains bootstrap authority"
    )
})

test("linked imported identity keeps its stable assignment key and targets only its explicit Discord account", async () => {
    const ctx = fixture()
    ctx.db.tables.users[0].id = "imported-player"
    await invoke(assignments.upsertByServerDiscordId, ctx, {
        ...save,
        userId: "imported-player",
        roleActor: actor,
    })
    const [operation] = ctx.db.tables.memberRoleOperations
    assert.equal(operation.status, "pending")
    assert.equal(operation.userId, "imported-player")
    assert.equal(operation.discordUserId, save.userId)
    assert.equal(operation.userRecordId, "users:target")
    const claim = await invoke(operations.claimNext, ctx, {
        secret,
        guildId: save.serverDiscordId,
    })
    const work = await invoke(operations.prepare, ctx, {
        secret,
        ...claim,
        evidence: evidence(),
    })
    assert.equal(work.verdict, "ready")
    assert.equal(work.discordUserId, save.userId)
    assert.equal(
        "userId" in work,
        false,
        "provider work must not expose an ambiguous subject"
    )
    const [dto] = await invoke(operations.listForGuild, ctx, {
        secret,
        guildId: save.serverDiscordId,
    })
    assert.equal(dto.userId, "imported-player")
    assert.equal(dto.discordUserId, save.userId)
})

test("a numeric imported identifier without an explicit Discord link cannot queue a grant", async () => {
    const ctx = fixture()
    ctx.db.tables.users[0].id = save.userId
    delete ctx.db.tables.users[0].discordId
    await invoke(assignments.upsertByServerDiscordId, ctx, {
        ...save,
        roleActor: actor,
    })
    assert.equal(ctx.db.tables.userAssignments[0].userId, save.userId)
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

test("relink, unlink or replacement of the stored player invalidates queued Discord work", async () => {
    for (const change of ["relink", "unlink", "replace"] as const) {
        const ctx = fixture()
        ctx.db.tables.users[0].id = "imported-player"
        await invoke(assignments.upsertByServerDiscordId, ctx, {
            ...save,
            userId: "imported-player",
            roleActor: actor,
        })
        const claim = await invoke(operations.claimNext, ctx, {
            secret,
            guildId: save.serverDiscordId,
        })
        assert.ok(claim)
        if (change === "relink")
            ctx.db.tables.users[0].discordId = "444444444444444444"
        else if (change === "unlink") delete ctx.db.tables.users[0].discordId
        else ctx.db.tables.users[0]._id = "users:replacement"
        assert.equal(
            (
                await invoke(operations.prepare, ctx, {
                    secret,
                    ...claim,
                    evidence: evidence(),
                })
            ).verdict,
            "superseded",
            change
        )
        assert.equal(
            await invoke(operations.finish, ctx, {
                secret,
                ...claim,
                evidence: { ...evidence(), targetRoleIds: ["clan", "recruit"] },
                outcome: "applied",
                reason: "verified",
            }),
            false,
            change
        )
    }
})

test("aliases of one linked account share the desired version and Discord lock", async () => {
    const ctx = fixture()
    ctx.db.tables.users[0].id = "imported-player"
    const first = await queued(ctx)
    await invoke(assignments.upsertByServerDiscordId, ctx, {
        ...save,
        userId: "imported-player",
        status: "active",
        roleActor: actor,
    })
    const [older, newer] = ctx.db.tables.memberRoleOperations
    assert.equal(older.status, "superseded")
    assert.equal(newer.version, older.version + 1)
    assert.equal(newer.discordUserId, older.discordUserId)
    assert.equal(
        await invoke(operations.claimNext, ctx, {
            secret,
            guildId: save.serverDiscordId,
        }),
        null,
        "older worker still holds the same target lock"
    )
    ctx.db.tables.memberRoleLocks[0].leaseUntil = 0
    const second = await invoke(operations.claimNext, ctx, {
        secret,
        guildId: save.serverDiscordId,
    })
    assert.equal(second.operationId, newer._id)
    assert.ok(second.fence > first.fence)
    assert.equal(ctx.db.tables.memberRoleLocks.length, 1)
})

test("self application and leave/rejoin checks resolve a stable player to the linked Discord subject", async () => {
    const ctx = fixture()
    ctx.db.tables.users[0].id = "imported-player"
    await invoke(assignments.upsertByServerDiscordId, ctx, {
        ...save,
        userId: "imported-player",
        roleActor: { userId: save.userId, kind: "application" },
    })
    const claim = await invoke(operations.claimNext, ctx, {
        secret,
        guildId: save.serverDiscordId,
    })
    const args = {
        secret,
        ...claim,
        evidence: { ...evidence(), actorRoleIds: [] },
    }
    assert.equal((await invoke(operations.prepare, ctx, args)).verdict, "ready")
    const epoch = await invoke(observations.ensureGuild, ctx, {
        secret,
        guildId: save.serverDiscordId,
    })
    for (const state of ["left", "present"])
        await invoke(observations.applyGateway, ctx, {
            secret,
            guildId: save.serverDiscordId,
            discordUserId: save.userId,
            epoch,
            state,
            roleIds: [],
            observedAt: new Date().toISOString(),
        })
    assert.equal(
        (await invoke(operations.prepare, ctx, args)).verdict,
        "denied"
    )
})
