import {
    createEventResource,
    type EventResourceStore,
} from "../../application/discord-publications/create-event-resource"
import { queueEventDiscordDeletion } from "../../../convex/eventDeletionQueue"
import type { MutationCtx } from "../../../convex/_generated/server"
import * as resources from "../../../convex/discordEventResources"
import { invoke, testContext } from "./testing/database"
import test, { type TestContext } from "node:test"
import assert from "node:assert/strict"

const secret = "event-resource-tests"
const now = Date.parse("2026-11-13T12:00:00Z")
const scope = {
    secret,
    guildId: "guild",
    eventId: "events:one",
    key: "scheduled-event",
}
function fixture(t: TestContext, key = scope.key) {
    const previous = process.env.INTERNAL_AUTH_SECRET
    process.env.INTERNAL_AUTH_SECRET = secret
    t.after(() => {
        if (previous === undefined) delete process.env.INTERNAL_AUTH_SECRET
        else process.env.INTERNAL_AUTH_SECRET = previous
    })
    t.mock.timers.enable({ apis: ["Date"], now })
    const ctx = testContext()
    ctx.db.seed("events", {
        _id: scope.eventId,
        guildId: scope.guildId,
        status: "starting",
    })
    const store: EventResourceStore = {
        claim: async () => {
            const claim = await invoke(resources.claim, ctx, { ...scope, key })
            if (claim.blocked) throw new Error("uncertain")
            if (claim.rejected) throw new Error("rejected")
            return claim
        },
        begin: (claim) =>
            invoke(resources.begin, ctx, { ...scope, key, ...claim }),
        finish: (claim, resourceId) =>
            invoke(resources.finish, ctx, {
                ...scope,
                key,
                ...claim,
                resourceId,
            }),
        fail: (claim, rejected) =>
            invoke(resources.fail, ctx, { ...scope, key, ...claim, rejected }),
    }
    return { ctx, store }
}
test("an expired started create is withheld and stale owners cannot commit", async (t) => {
    const { ctx, store } = fixture(t)
    const claim = await store.claim()
    await store.begin(claim)
    await assert.rejects(store.claim(), /busy/)
    t.mock.timers.setTime(now + 120001)
    await assert.rejects(store.claim(), /uncertain/)
    await assert.rejects(store.finish(claim, "accepted"), /expired/)
    assert.equal(ctx.db.tables.discordEventResources[0].state, "uncertain")
})
test("a pre-upgrade sync without resource receipts is withheld until evidence is supplied", async (t) => {
    const { ctx, store } = fixture(t)
    ctx.db.seed("discordEventSyncs", {
        _id: "discordEventSyncs:old",
        eventId: scope.eventId,
        guildId: "guild",
    })
    await assert.rejects(store.claim(), /uncertain/)
    assert.equal(ctx.db.tables.discordEventResources[0].attempts, 0)
    await invoke(resources.reconcile, ctx, {
        ...scope,
        action: "proven_absent",
        operator: "maintainer",
        evidence: "Verified no Discord resource exists for this event",
    })
    assert.equal((await store.claim()).resourceId, null)
})
for (const key of [
    "signup-thread:parent",
    "scheduled-event",
    "voice-category",
    "voice-squad:F1",
]) {
    test(`${key}: a lost receipt response never authorizes a second create`, async (t) => {
        const { store } = fixture(t, key)
        let creates = 0
        const transport = {
            find: async () => null,
            create: async () => {
                creates++
                return { id: "accepted" }
            },
            rejected: () => false,
        }
        await assert.rejects(
            createEventResource(
                {
                    ...store,
                    finish: async () => {
                        throw new Error("receipt unavailable")
                    },
                },
                transport
            ),
            /receipt unavailable/
        )
        t.mock.timers.setTime(now + 120001)
        await assert.rejects(createEventResource(store, transport), /uncertain/)
        assert.equal(creates, 1)
    })
}
test("a committed receipt survives an outer sync crash; only confirmed missing resources are replaced", async (t) => {
    const { ctx, store } = fixture(t)
    let creates = 0,
        missing = false
    const transport = {
        find: async (id: string) => (missing ? null : { id }),
        create: async () => ({ id: `resource-${++creates}` }),
        rejected: () => false,
    }
    assert.equal((await createEventResource(store, transport)).id, "resource-1")
    assert.equal(
        ctx.db.tables.discordEventSyncs[0].scheduledEventId,
        "resource-1"
    )
    assert.equal(ctx.db.tables.discordEventSyncs[0].resourceProtocol, 1)
    assert.equal((await createEventResource(store, transport)).id, "resource-1")
    await assert.rejects(
        createEventResource(store, {
            ...transport,
            find: async () => {
                throw new Error("permission denied")
            },
        }),
        /permission denied/
    )
    assert.equal(creates, 1)
    t.mock.timers.setTime(now + 60000)
    missing = true
    assert.equal((await createEventResource(store, transport)).id, "resource-2")
})
test("definite rejections use backoff and exhaust a five-attempt budget", async (t) => {
    const { store } = fixture(t)
    let creates = 0
    const transport = {
        find: async () => null,
        create: async (): Promise<{ id: string }> => {
            creates++
            throw new Error("rejected")
        },
        rejected: () => true,
    }
    for (let i = 0; i < 5; i++) {
        await assert.rejects(createEventResource(store, transport), /rejected/)
        await assert.rejects(
            createEventResource(store, transport),
            /backoff|budget/
        )
        t.mock.timers.setTime(now + (i + 1) * 600000)
    }
    await assert.rejects(createEventResource(store, transport), /budget/)
    assert.equal(creates, 5)
})
test("operator adoption is scoped, audited, fenced and does not override active work or reset budgets", async (t) => {
    const { ctx, store } = fixture(t)
    const claim = await store.claim()
    await store.begin(claim)
    const resolution = {
        ...scope,
        action: "adopt",
        discordId: "123456789012345678",
        operator: "maintainer",
        evidence: "Verified exact resource in the test guild",
    }
    await assert.rejects(invoke(resources.reconcile, ctx, resolution), /busy/)
    t.mock.timers.setTime(now + 120001)
    await assert.rejects(
        invoke(resources.reconcile, ctx, { ...resolution, guildId: "other" }),
        /scope/
    )
    await invoke(resources.reconcile, ctx, resolution)
    await assert.rejects(store.finish(claim, "stale"), /expired/)
    assert.equal((await store.claim()).resourceId, resolution.discordId)
    assert.equal(ctx.db.tables.discordEventResourceAudits.length, 1)
    assert.equal(ctx.db.tables.discordEventResources[0].attempts, 1)
})
test("cleanup includes receipts missing from outer sync; a late receipt queues cleanup after deletion", async (t) => {
    const { ctx, store } = fixture(t)
    const claim = await store.claim()
    await store.begin(claim)
    await ctx.db.delete(scope.eventId)
    await store.finish(claim, "scheduled")
    assert.deepEqual(ctx.db.tables.eventDeletionRequests[0].scheduledEventIds, [
        "scheduled",
    ])
    ctx.db.seed("discordEventResources", {
        _id: "discordEventResources:voice",
        eventId: scope.eventId,
        guildId: "guild",
        key: "voice-category",
        state: "bound",
        resourceId: "category",
    })
    await invoke(
        {
            _handler: (context: MutationCtx) =>
                queueEventDiscordDeletion(context, scope.eventId, {
                    guildId: "guild",
                    messages: [],
                    roleIds: [],
                    channelIds: [],
                    scheduledEventIds: [],
                }),
        },
        ctx
    )
    assert.deepEqual(ctx.db.tables.eventDeletionRequests[1].channelIds, [
        "category",
    ])
})
