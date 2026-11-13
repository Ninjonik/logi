import { MembershipEffects } from "../../../discord-bot/src/runtime/membership-effects"
import * as journal from "../../../convex/discordMembershipEffects"
import { invoke, spyReads, testContext } from "./testing/database"
import test, { type TestContext } from "node:test"
import assert from "node:assert/strict"

const now = Date.parse("2026-11-13T12:00:00Z")
const secret = "membership-effects-test"
function fixture(t: TestContext) {
    const previous = process.env.INTERNAL_AUTH_SECRET
    process.env.INTERNAL_AUTH_SECRET = secret
    t.after(() => {
        if (previous === undefined) delete process.env.INTERNAL_AUTH_SECRET
        else process.env.INTERNAL_AUTH_SECRET = previous
    })
    t.mock.timers.enable({ apis: ["Date"], now })
    return testContext()
}
const operation = {
    key: "ticket-open:interaction",
    guildId: "guild",
    kind: "ticket-open" as const,
    subjectId: "interaction",
    actorId: "actor",
    expectedKeys: ["thread"],
}

test("accepted create with a lost receipt is quarantined across restart until an operator supplies evidence", async (t) => {
    const ctx = fixture(t)
    let sends = 0,
        loseReceipt = true
    const call = async (name: string, args: Record<string, unknown>) => {
        if (name === "finish" && loseReceipt) {
            loseReceipt = false
            throw new Error("receipt response lost")
        }
        const fn = Object.entries({
            open: journal.open,
            begin: journal.begin,
            finish: journal.finish,
            complete: journal.complete,
            heartbeat: journal.heartbeat,
        }).find(([key]) => key === name)?.[1]
        if (!fn) throw new Error("Unexpected journal call")
        return invoke(fn, ctx, { secret, ...args })
    }
    const execute = async () => {
        sends++
        return { id: "123456789012345678" }
    }
    await assert.rejects(
        new MembershipEffects(operation, call).effect(
            "thread",
            "send",
            execute
        ),
        /receipt response lost/
    )
    await assert.rejects(
        new MembershipEffects(operation, call).effect(
            "thread",
            "send",
            execute
        ),
        /busy/
    )
    t.mock.timers.setTime(now + 300_001)
    await invoke(journal.claimRepair, ctx, { secret })
    await assert.rejects(
        new MembershipEffects(operation, call).effect(
            "thread",
            "send",
            execute
        ),
        /uncertain/
    )
    assert.equal(sends, 1)
    const effect = ctx.db.tables.discordMembershipEffects[0]
    await invoke(journal.reconcile, ctx, {
        secret,
        operationId: effect.operationId,
        effectId: effect._id,
        action: "confirm",
        operator: "operator",
        evidence: "Verified bot-owned private thread in Discord",
        resourceId: "123456789012345678",
    })
    assert.deepEqual(
        await new MembershipEffects(operation, call).effect(
            "thread",
            "send",
            execute
        ),
        { state: "confirmed", resourceId: "123456789012345678" }
    )
    assert.equal(sends, 1)
    assert.equal(ctx.db.tables.discordMembershipReconciliations.length, 1)
})

test("desired-state repair backs off, fences expired owners and stops after five attempts", async (t) => {
    const ctx = fixture(t)
    const operationId = await invoke(journal.open, ctx, {
        secret,
        ...operation,
        expectedKeys: ["lock"],
    })
    const first = await invoke(journal.begin, ctx, {
        secret,
        operationId,
        key: "lock",
        mode: "reconcile",
        repair: { threadId: "thread", action: "lock" },
    })
    await invoke(journal.finish, ctx, {
        secret,
        operationId,
        key: "lock",
        token: first.token,
        state: "retry",
    })
    assert.equal(await invoke(journal.claimRepair, ctx, { secret }), null)
    for (let attempt = 2; attempt <= 5; attempt++) {
        t.mock.timers.setTime(now + attempt * 1_000_000)
        const claim = await invoke(journal.claimRepair, ctx, { secret })
        assert.ok(claim)
        await assert.rejects(
            invoke(journal.finish, ctx, {
                secret,
                operationId,
                key: "lock",
                token: first.token,
                state: "confirmed",
            }),
            /ownership lost/
        )
        await invoke(journal.finish, ctx, {
            secret,
            operationId,
            key: "lock",
            token: claim.token,
            state: "retry",
        })
    }
    assert.equal(ctx.db.tables.discordMembershipEffects[0].state, "failed")
    assert.equal(await invoke(journal.claimRepair, ctx, { secret }), null)
    assert.equal(
        await invoke(journal.complete, ctx, { secret, operationId }),
        false
    )
})

test("workflow completion cannot hide an untouched planned send, and stale workflow release cannot clear a successor", async (t) => {
    const ctx = fixture(t)
    const operationId = await invoke(journal.open, ctx, {
        secret,
        ...operation,
    })
    assert.equal(
        await invoke(journal.complete, ctx, { secret, operationId }),
        false
    )
    t.mock.timers.setTime(now + 300_001)
    const first = await invoke(journal.claimWorkflow, ctx, { secret })
    t.mock.timers.setTime(now + 600_002)
    const second = await invoke(journal.claimWorkflow, ctx, { secret })
    assert.notEqual(first.token, second.token)
    await assert.rejects(
        invoke(journal.finishWorkflow, ctx, {
            secret,
            operationId,
            token: first.token,
        }),
        /ownership lost/
    )
    assert.equal(
        await invoke(journal.workflowHeartbeat, ctx, {
            secret,
            operationId,
            token: first.token,
        }),
        false
    )
    assert.equal(
        await invoke(journal.workflowHeartbeat, ctx, {
            secret,
            operationId,
            token: second.token,
        }),
        true
    )
})

test("journal authentication precedes reads and operation identity cannot cross tenants", async (t) => {
    const ctx = fixture(t)
    const reads = spyReads(ctx)
    await assert.rejects(
        invoke(journal.open, ctx, { secret: "invalid", ...operation })
    )
    assert.equal(reads.length, 0)
    await invoke(journal.open, ctx, { secret, ...operation })
    await assert.rejects(
        invoke(journal.open, ctx, { secret, ...operation, guildId: "other" }),
        /scope mismatch/
    )
})

test("operator inspection omits private recovery input and resume never erases send receipts", async (t) => {
    const ctx = fixture(t)
    const operationId = await invoke(journal.open, ctx, {
        secret,
        ...operation,
        requestJson: "private applicant answers",
    })
    ctx.db.seed("discordMembershipEffects", {
        _id: "discordMembershipEffects:unknown",
        operationId,
        key: "thread",
        mode: "send",
        state: "uncertain",
        attempts: 1,
        token: "old",
        leaseUntil: 0,
        retryAt: 0,
    })
    const page = await invoke(journal.inspect, ctx, {
        secret,
        guildId: "guild",
        state: "pending",
        cursor: null,
    })
    assert.equal(
        JSON.stringify(page).includes("private applicant answers"),
        false
    )
    await invoke(journal.resume, ctx, {
        secret,
        operationId,
        operator: "operator",
        evidence: "Permissions fixed and prior workers stopped",
    })
    assert.equal(ctx.db.tables.discordMembershipEffects[0].state, "uncertain")
    assert.equal(
        ctx.db.tables.discordMembershipReconciliations[0].action,
        "resume"
    )
})

test("a fresh opt-out records an untouched DM as skipped without settling an uncertain send", async (t) => {
    const ctx = fixture(t)
    ctx.db.seed("discordConfigs", {
        _id: "discordConfigs:one",
        guildId: "guild",
        applicationCloseDmEnabled: false,
    })
    const operationId = await invoke(journal.open, ctx, {
        secret,
        key: "application-close:one",
        kind: "application-close",
        guildId: "guild",
        subjectId: "one",
        actorId: "actor",
        expectedKeys: ["dm:user"],
    })
    assert.deepEqual(
        await invoke(journal.skip, ctx, {
            secret,
            operationId,
            key: "dm:user",
        }),
        { state: "skipped" }
    )
    assert.equal(
        await invoke(journal.complete, ctx, { secret, operationId }),
        true
    )
    const uncertainId = await invoke(journal.open, ctx, {
        secret,
        key: "application-close:two",
        kind: "application-close",
        guildId: "guild",
        subjectId: "two",
        actorId: "actor",
        expectedKeys: ["dm:user"],
    })
    ctx.db.seed("discordMembershipEffects", {
        _id: "discordMembershipEffects:uncertain",
        operationId: uncertainId,
        key: "dm:user",
        mode: "send",
        state: "uncertain",
        attempts: 1,
        token: "old",
        leaseUntil: 0,
        retryAt: 0,
    })
    assert.deepEqual(
        await invoke(journal.skip, ctx, {
            secret,
            operationId: uncertainId,
            key: "dm:user",
        }),
        { state: "uncertain" }
    )
    assert.equal(
        await invoke(journal.complete, ctx, {
            secret,
            operationId: uncertainId,
        }),
        false
    )
    await ctx.db.patch("discordConfigs:one", {
        applicationCloseDmEnabled: true,
    })
    await assert.rejects(
        invoke(journal.skip, ctx, {
            secret,
            operationId: uncertainId,
            key: "dm:user",
        }),
        /not disabled/
    )
})
