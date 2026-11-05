import { emptyTacticalPlan } from "../../domain/events/tactical-plan"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { CLAN_SETTINGS_SLICES } from "../../domain/api/clan-settings-slices"
import * as publicApiReads from "../../../convex/publicApiReads"
import * as publicApi from "../../../convex/publicApi"

type Document = Record<string, unknown> & { _id: string }

type IndexOp = "eq" | "gt" | "gte" | "lt" | "lte"
type IndexBuilder = Record<
    IndexOp,
    (field: string, value: unknown) => IndexBuilder
>
const compare: Record<IndexOp, (left: unknown, right: unknown) => boolean> = {
    eq: (left, right) => left === right,
    gt: (left, right) => (left as number) > (right as number),
    gte: (left, right) => (left as number) >= (right as number),
    lt: (left, right) => (left as number) < (right as number),
    lte: (left, right) => (left as number) <= (right as number),
}

/** Equality and range steps of an index read, as Convex chains them. */
class FakeQuery {
    private readonly tests: Array<(document: Document) => boolean> = []

    constructor(private readonly documents: Document[]) {}

    withIndex(_index: string, callback: (query: IndexBuilder) => unknown) {
        const query = {} as IndexBuilder
        for (const op of Object.keys(compare) as IndexOp[])
            query[op] = (field, value) => {
                this.tests.push((document) =>
                    compare[op](document[field], value)
                )
                return query
            }
        callback(query)
        return this
    }

    async unique() {
        return this.matching()[0] ?? null
    }

    async collect() {
        return this.matching()
    }

    async take(limit: number) {
        return this.matching().slice(0, limit)
    }

    private matching() {
        return this.documents.filter((document) =>
            this.tests.every((test) => test(document))
        )
    }
}

class FakeDb {
    normalizeId(table: string, id: string) {
        return this.tables[table]?.has(id) ? id : null
    }
    readonly tables: Record<string, Map<string, Document>> = {
        apiKeys: new Map([
            ["key-1", { _id: "key-1", keyHash: "key", guildId: "guild-a" }],
        ]),
        apiIdempotencyKeys: new Map(),
        guilds: new Map([
            ["guild-a-record", { _id: "guild-a-record", discordId: "guild-a" }],
        ]),
        events: new Map(),
        groups: new Map([
            ["group-other", { _id: "group-other", guildId: "guild-b" }],
        ]),
        stratmaps: new Map(),
        topicPresets: new Map(),
        squadPresets: new Map(),
        webhookSubscriptions: new Map([
            [
                "hook-1",
                {
                    _id: "hook-1",
                    guildId: "guild-a",
                    enabled: true,
                    eventTypes: ["event.created", "roster.updated"],
                },
            ],
        ]),
        webhookDeliveries: new Map(),
        eventScheduleJobs: new Map(),
        discordConfigs: new Map(),
        rosters: new Map(),
        userAssignments: new Map(),
        users: new Map(),
    }
    private nextId = 1

    async get(id: string) {
        return (
            Object.values(this.tables)
                .map((table) => table.get(id))
                .find(Boolean) ?? null
        )
    }

    query(table: string) {
        return new FakeQuery([...(this.tables[table]?.values() ?? [])])
    }

    async insert(table: string, value: Record<string, unknown>) {
        const id = `${table}-${this.nextId++}`
        const document = { _id: id, ...value }
        this.tables[table] ??= new Map()
        this.tables[table].set(id, document)
        return id
    }

    async patch(id: string, value: Record<string, unknown>) {
        const document = await this.get(id)
        if (!document) throw new Error("Document not found.")
        Object.assign(document, value)
    }

    async delete(id: string) {
        for (const table of Object.values(this.tables)) table.delete(id)
    }
}

const handler =
    (value: unknown) =>
    (ctx: { db: FakeDb; scheduler?: unknown }, args: Record<string, unknown>) =>
        (
            value as {
                _handler: (
                    ctx: { db: FakeDb; scheduler?: unknown },
                    args: Record<string, unknown>
                ) => Promise<{ status: number; body: string } | null>
            }
        )._handler({ ...ctx, scheduler: { runAfter: async () => null } }, args)

function event(overrides: Record<string, unknown> = {}) {
    return {
        kind: "match",
        name: "Operation Test",
        registrationEnd: "2030-07-23T10:00:00.000Z",
        meetingStart: "2030-07-23T11:00:00.000Z",
        gameStart: "2030-07-23T12:00:00.000Z",
        gameEnd: "2030-07-23T14:00:00.000Z",
        pingClan: false,
        ...overrides,
    }
}

function request(overrides: Record<string, unknown> = {}) {
    return {
        secret: "dev-internal-auth-secret",
        keyHash: "key",
        idempotencyKey: "event-key",
        bodyHash: "body-a",
        methodPath: "POST /clan/events",
        operation: "create",
        event: event(),
        ...overrides,
    }
}

function deliveryPayload(db: FakeDb) {
    const delivery = [...db.tables.webhookDeliveries.values()][0]
    return JSON.parse(delivery?.payload as string) as Record<string, unknown>
}

test("generic event mutation responses and webhook payloads exclude review storage", async () => {
    const db = new FakeDb()
    const created = await handler(publicApi.mutateClanEvent)({ db }, request())
    const eventId = JSON.parse(created!.body).data.id
    const reviewedResult = JSON.parse(
        readFileSync(
            new URL(
                "../../../docs/integrations/website/v0.10/fixtures/confirmed.json",
                import.meta.url
            ),
            "utf8"
        )
    ).data.result
    await db.patch(eventId, {
        reviewedResult,
        reviewedResultGameId: "hell_let_loose",
    })
    db.tables.webhookSubscriptions.get("hook-1")!.eventTypes = ["event.updated"]
    for (const operation of ["update", "conclude"]) {
        db.tables.webhookDeliveries.clear()
        if (operation === "conclude")
            await db.patch(eventId, {
                meetingStart: new Date(Date.now() - 60_000).toISOString(),
            })
        const result = await handler(publicApi.mutateClanEvent)(
            { db },
            request({
                eventId,
                operation,
                idempotencyKey: operation,
                bodyHash: operation,
                methodPath: operation,
                event: event({ name: "Reviewed event" }),
            })
        )
        assert.equal(result?.status, 200)
        for (const document of [
            JSON.parse(result!.body).data,
            deliveryPayload(db).resource as Record<string, unknown>,
        ]) {
            assert.equal("reviewedResult" in document, false)
            assert.equal("reviewedResultGameId" in document, false)
        }
    }
    assert.deepEqual((await db.get(eventId))?.reviewedResult, reviewedResult)
})

test("event API rejects cross-guild references without creating an event", async () => {
    const db = new FakeDb()
    const result = await handler(publicApi.mutateClanEvent)(
        { db },
        request({ event: event({ signupGroupIds: ["group-other"] }) })
    )

    assert.equal(result?.status, 400)
    assert.equal(db.tables.events.size, 0)
    assert.match(result?.body ?? "", /Referenced signup group was not found/)
})

test("event API stores a Wardogs plan and clears it when the map changes", async () => {
    const db = new FakeDb()
    const plan = emptyTacticalPlan("bakurani")
    const first = await handler(publicApi.mutateClanEvent)(
        { db },
        request({
            event: event({
                gameId: "wardogs",
                map: "bakurani",
                timeOfDay: "night",
                tacticalPlan: plan,
            }),
        })
    )
    assert.equal(first?.status, 201)
    const saved = [...db.tables.events.values()][0]
    assert.deepEqual(saved.tacticalPlan, plan)
    assert.equal(saved.timeOfDay, "night")
    const updated = await handler(publicApi.mutateClanEvent)(
        { db },
        request({
            operation: "update",
            methodPath: `PATCH /clan/events/${saved._id}`,
            eventId: saved._id,
            idempotencyKey: "map-change",
            bodyHash: "map-change",
            event: event({ gameId: "wardogs", map: "ozeti" }),
        })
    )
    assert.equal(updated?.status, 200)
    assert.equal(db.tables.events.get(saved._id)?.tacticalPlan, undefined)
    assert.equal(db.tables.events.get(saved._id)?.timeOfDay, "night")
})

test("event API replays an idempotent create once and queues one webhook", async () => {
    const db = new FakeDb()
    const first = await handler(publicApi.mutateClanEvent)({ db }, request())
    const replay = await handler(publicApi.mutateClanEvent)({ db }, request())

    assert.equal(first?.status, 201)
    assert.deepEqual(replay, first)
    assert.equal(db.tables.events.size, 1)
    assert.equal(db.tables.webhookDeliveries.size, 1)
    assert.deepEqual(Object.keys(deliveryPayload(db)).sort(), [
        "createdAt",
        "guildId",
        "id",
        "resource",
        "type",
    ])
})

test("article API queues only subscriptions for its event type", async () => {
    const db = new FakeDb()
    const input = {
        secret: "dev-internal-auth-secret",
        keyHash: "key",
        idempotencyKey: "article-key",
        bodyHash: "article-body",
        methodPath: "POST /clan/articles",
        operation: "create",
        title: "Update",
        description: "A clan update",
        body: "Published article body",
    }

    const unsubscribed = await handler(publicApi.mutateClanArticle)(
        { db },
        input
    )
    assert.equal(unsubscribed?.status, 201)
    assert.equal(db.tables.webhookDeliveries.size, 0)

    db.tables.webhookSubscriptions.get("hook-1")!.eventTypes = [
        "article.created",
    ]
    const subscribed = await handler(publicApi.mutateClanArticle)(
        { db },
        { ...input, idempotencyKey: "article-key-2" }
    )
    assert.equal(subscribed?.status, 201)
    assert.equal(db.tables.webhookDeliveries.size, 1)
    assert.equal(deliveryPayload(db).type, "article.created")
})

test("settings API queues the documented settings payload", async () => {
    const db = new FakeDb()
    db.tables.webhookSubscriptions.get("hook-1")!.eventTypes = [
        "settings.updated",
    ]

    const result = await handler(publicApi.mutateClanSettings)(
        { db },
        {
            secret: "dev-internal-auth-secret",
            keyHash: "key",
            idempotencyKey: "settings-key",
            bodyHash: "settings-body",
            methodPath: "PATCH /clan/settings",
            name: "Updated Guild",
        }
    )

    assert.equal(result?.status, 200)
    assert.equal(db.tables.webhookDeliveries.size, 1)
    const payload = deliveryPayload(db)
    assert.equal(payload.type, "settings.updated")
    assert.equal(payload.guildId, "guild-a")
    assert.ok(payload.id)
    assert.ok(payload.createdAt)
})

const PANEL_GRAPHICS_DEFAULT = {
    defaultStyle: "a",
    revision: 0,
    servers: [],
    maps: [],
}

test("settings responses carry the feature slices and refuse unknown slices", async () => {
    const sliceKeys = CLAN_SETTINGS_SLICES.map((slice) => slice.key).sort()
    const db = new FakeDb()
    db.tables.discordConfigs.set("config-a", {
        _id: "config-a",
        guildId: "guild-a",
        playerStatsServers: [{ token: "secret" }],
    })
    const read = (await (
        publicApiReads.getClanSettings as unknown as {
            _handler: (
                ctx: { db: FakeDb },
                args: Record<string, unknown>
            ) => Promise<Record<string, unknown> | null>
        }
    )._handler(
        { db },
        { secret: "dev-internal-auth-secret", keyHash: "key" }
    )) as {
        slices: Record<string, unknown>
        discordConfig: Record<string, unknown>
    }
    // Every registered slice answers, also for a clan that saved nothing.
    assert.deepEqual(Object.keys(read.slices).sort(), sliceKeys)
    // Panel graphics defaults to style A.
    assert.deepEqual(read.slices.panelGraphics, PANEL_GRAPHICS_DEFAULT)
    assert.deepEqual(read.slices.matchMessages, {
        rosterMessageVariant: "photo_text",
        rosterChangesPost: true,
        rosterChangesDm: true,
        attendanceNoticesInThread: false,
    })
    assert.equal("playerStatsServers" in read.discordConfig, false)

    const refused = await handler(publicApi.mutateClanSettings)(
        { db },
        {
            secret: "dev-internal-auth-secret",
            keyHash: "key",
            idempotencyKey: "slice-key",
            bodyHash: "slice-body",
            methodPath: "PATCH /clan/settings",
            slices: { notASlice: { enabled: true } },
        }
    )
    assert.equal(refused?.status, 400)
    assert.equal(
        JSON.parse(refused!.body).error.message,
        "Settings patch contains an unsupported field."
    )
    assert.equal(db.tables.discordConfigs.get("config-a")!.notASlice, undefined)

    const updated = await handler(publicApi.mutateClanSettings)(
        { db },
        {
            secret: "dev-internal-auth-secret",
            keyHash: "key",
            idempotencyKey: "slice-key-2",
            bodyHash: "slice-body-2",
            methodPath: "PATCH /clan/settings",
            timezone: "Europe/Prague",
            slices: { matchMessages: { rosterMessageVariant: "photo" } },
        }
    )
    assert.equal(updated?.status, 200)
    const slices = JSON.parse(updated!.body).data.slices
    assert.deepEqual(Object.keys(slices).sort(), sliceKeys)
    assert.deepEqual(slices.panelGraphics, PANEL_GRAPHICS_DEFAULT)
    assert.equal(slices.matchMessages.rosterMessageVariant, "photo")
    assert.equal(slices.matchMessages.rosterChangesDm, true)
    const stored = db.tables.discordConfigs.get("config-a")!
    assert.equal(stored.rosterMessageVariant, "photo")
    assert.equal(stored.rosterChangesDmDefault, undefined)
})

test("event signup queues a roster update through the shared queue", async () => {
    const db = new FakeDb()
    db.tables.webhookSubscriptions.get("hook-1")!.eventTypes = [
        "roster.updated",
    ]
    db.tables.events.set("event-signup", {
        _id: "event-signup",
        guildId: "guild-a",
        ...event({ kind: "training", allowNonMembersSignup: true }),
        participants: [],
        signUps: [],
        absenceNotices: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
    })

    const result = await handler(publicApi.mutateClanEventSignup)(
        { db },
        {
            secret: "dev-internal-auth-secret",
            keyHash: "key",
            eventId: "event-signup",
            idempotencyKey: "signup-key",
            bodyHash: "signup-body",
            methodPath: "POST /clan/events/{eventId}/signup",
            userId: "user-a",
            group: null,
        }
    )

    assert.equal(result?.status, 200)
    assert.equal(db.tables.webhookDeliveries.size, 1)
    assert.equal(deliveryPayload(db).type, "roster.updated")
})

test("event API rejects a reused idempotency key for another event request", async () => {
    const db = new FakeDb()
    await handler(publicApi.mutateClanEvent)({ db }, request())
    const conflict = await handler(publicApi.mutateClanEvent)(
        { db },
        request({ bodyHash: "body-b" })
    )

    assert.equal(conflict?.status, 409)
    assert.match(conflict?.body ?? "", /idempotency_conflict/)
    assert.equal(db.tables.events.size, 1)
})

test("event API replaces an expired idempotency record", async () => {
    const db = new FakeDb()
    db.tables.apiIdempotencyKeys.set("expired-key", {
        _id: "expired-key",
        guildId: "guild-a",
        key: "event-key",
        methodPath: "POST /clan/events",
        bodyHash: "old-body",
        status: 201,
        responseBody: '{"data":{"id":"old"}}',
        createdAt: "2020-01-01T00:00:00.000Z",
        expiresAt: 0,
    })

    const result = await handler(publicApi.mutateClanEvent)({ db }, request())

    assert.equal(result?.status, 201)
    assert.equal(db.tables.events.size, 1)
    assert.equal(db.tables.apiIdempotencyKeys.size, 1)
})

test("event API rejects a revoked API key before reserving idempotency", async () => {
    const db = new FakeDb()
    db.tables.apiKeys.get("key-1")!.revokedAt = "2026-01-01T00:00:00.000Z"

    const result = await handler(publicApi.mutateClanEvent)({ db }, request())

    assert.equal(result, null)
    assert.equal(db.tables.events.size, 0)
    assert.equal(db.tables.apiIdempotencyKeys.size, 0)
})

function presetRequest(overrides: Record<string, unknown> = {}) {
    return {
        secret: "dev-internal-auth-secret",
        keyHash: "key",
        idempotencyKey: "preset-key",
        bodyHash: "preset-body-a",
        methodPath: "POST /clan/topic-presets",
        resource: "topic-presets",
        operation: "create",
        payload: {
            name: "Match briefing",
            topics: [
                {
                    id: "topic-1",
                    title: "Plan",
                    attachments: [],
                    messages: [],
                },
            ],
        },
        ...overrides,
    }
}

test("preset API rejects a cross-guild update", async () => {
    const db = new FakeDb()
    db.tables.topicPresets.set("preset-other", {
        _id: "preset-other",
        guildId: "guild-b",
        name: "Other clan",
        topics: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
    })

    const result = await handler(publicApi.mutateClanPreset)(
        { db },
        presetRequest({
            operation: "update",
            presetId: "preset-other",
            methodPath: "PATCH /clan/topic-presets/{id}",
        })
    )

    assert.equal(result?.status, 404)
    assert.equal(db.tables.topicPresets.get("preset-other")?.name, "Other clan")
})

test("preset API rejects an ID from another preset resource", async () => {
    const db = new FakeDb()
    db.tables.stratmaps.set("stratmap-1", {
        _id: "stratmap-1",
        guildId: "guild-a",
        title: "Attack",
        state: "{}",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
    })

    const result = await handler(publicApi.mutateClanPreset)(
        { db },
        presetRequest({
            operation: "update",
            presetId: "stratmap-1",
            methodPath: "PATCH /clan/topic-presets/{id}",
        })
    )

    assert.equal(result?.status, 404)
    assert.equal(db.tables.stratmaps.get("stratmap-1")?.title, "Attack")
})

test("preset API replays creates and rejects conflicting idempotency keys", async () => {
    const db = new FakeDb()
    const first = await handler(publicApi.mutateClanPreset)(
        { db },
        presetRequest()
    )
    const replay = await handler(publicApi.mutateClanPreset)(
        { db },
        presetRequest()
    )
    const conflict = await handler(publicApi.mutateClanPreset)(
        { db },
        presetRequest({ bodyHash: "preset-body-b" })
    )

    assert.equal(first?.status, 201)
    assert.deepEqual(replay, first)
    assert.equal(conflict?.status, 409)
    assert.equal(db.tables.topicPresets.size, 1)
})

function assignmentRequest(overrides: Record<string, unknown> = {}) {
    return {
        secret: "dev-internal-auth-secret",
        keyHash: "key",
        idempotencyKey: "assignment-key",
        bodyHash: "assignment-body-a",
        methodPath: "POST /clan/assignments",
        operation: "create",
        userId: "user-a",
        type: "member",
        status: "active",
        secondaryGroupIds: [],
        paused: false,
        ...overrides,
    }
}

test("assignment API preserves membership rebuilding and replays a write once", async () => {
    const db = new FakeDb()
    db.tables.users.set("user-a-record", {
        _id: "user-a-record",
        discordId: "user-a",
        id: "user-a",
        managedGuildIds: [],
        mercenaryGuildIds: [],
    })
    const first = await handler(publicApi.mutateClanAssignment)(
        { db },
        assignmentRequest()
    )
    const replay = await handler(publicApi.mutateClanAssignment)(
        { db },
        assignmentRequest()
    )
    const conflict = await handler(publicApi.mutateClanAssignment)(
        { db },
        assignmentRequest({ bodyHash: "assignment-body-b" })
    )

    assert.equal(first?.status, 201)
    assert.deepEqual(replay, first)
    assert.equal(conflict?.status, 409)
    assert.equal(db.tables.userAssignments.size, 1)
    assert.deepEqual(db.tables.guilds.get("guild-a-record")?.memberIds, [
        "user-a",
    ])
})

test("assignment API queues a roster update when an open roster is affected", async () => {
    const db = new FakeDb()
    db.tables.users.set("user-a-record", {
        _id: "user-a-record",
        discordId: "user-a",
        id: "user-a",
        managedGuildIds: [],
        mercenaryGuildIds: [],
    })
    db.tables.events.set("event-a", {
        _id: "event-a",
        guildId: "guild-a",
        ...event(),
        participants: [],
        signUps: [],
        absenceNotices: [],
    })
    db.tables.rosters.set("roster-a", {
        _id: "roster-a",
        eventId: "event-a",
        squads: [],
        reservePlayerIds: [],
        reserveAttendances: [],
        notAttendingPlayerIds: [],
        published: false,
    })

    const result = await handler(publicApi.mutateClanAssignment)(
        { db },
        assignmentRequest({ idempotencyKey: "assignment-roster-key" })
    )

    assert.equal(result?.status, 201)
    assert.equal(db.tables.webhookDeliveries.size, 1)
    assert.equal(deliveryPayload(db).type, "roster.updated")
})

test("assignment API rejects a cross-guild assignment ID", async () => {
    const db = new FakeDb()
    db.tables.userAssignments.set("assignment-other", {
        _id: "assignment-other",
        serverId: "guild-b",
        userId: "user-b",
    })
    const result = await handler(publicApi.mutateClanAssignment)(
        { db },
        assignmentRequest({
            operation: "delete",
            assignmentId: "assignment-other",
            methodPath: "DELETE /clan/assignments/{assignmentId}",
        })
    )

    assert.equal(result?.status, 404)
    assert.equal(db.tables.userAssignments.size, 1)
})

test("roster API verifies its parent event and queues one roster webhook", async () => {
    const db = new FakeDb()
    db.tables.events.set("event-a", { _id: "event-a", guildId: "guild-a" })
    db.tables.rosters.set("roster-a", {
        _id: "roster-a",
        eventId: "event-a",
        published: false,
    })
    const result = await handler(publicApi.mutateClanRoster)(
        { db },
        {
            secret: "dev-internal-auth-secret",
            keyHash: "key",
            idempotencyKey: "roster-key",
            bodyHash: "",
            methodPath: "DELETE /clan/rosters/{rosterId}",
            operation: "delete",
            rosterId: "roster-a",
        }
    )

    assert.equal(result?.status, 200)
    assert.equal(db.tables.rosters.size, 0)
    assert.equal(db.tables.webhookDeliveries.size, 1)
})

test("a roster published through the API keeps the published version like the dashboard (D5-B04)", async () => {
    const db = new FakeDb()
    db.tables.events.set("event-a", {
        _id: "event-a",
        guildId: "guild-a",
        registrationEnd: "2020-01-01T00:00:00.000Z",
        participants: [],
    })
    const squad = (name: string) => [
        {
            name,
            group: "Pěchota",
            order: 0,
            color: "#000000",
            players: [{ id: "910000000000000011", ack: false }],
        },
    ]
    db.tables.rosters.set("roster-a", {
        _id: "roster-a",
        eventId: "event-a",
        squads: squad("F1"),
        reservePlayerIds: [],
        notAttendingPlayerIds: [],
        published: true,
    })
    const result = await handler(publicApi.mutateClanRoster)(
        { db },
        {
            secret: "dev-internal-auth-secret",
            keyHash: "key",
            idempotencyKey: "roster-publish-key",
            bodyHash: "",
            methodPath: "PUT /clan/rosters/{rosterId}",
            operation: "update",
            rosterId: "roster-a",
            payload: {
                eventId: "event-a",
                squads: squad("F2"),
                reservePlayerIds: [],
                notAttendingPlayerIds: [],
                published: true,
            },
        }
    )

    assert.equal(result?.status, 200)
    const saved = db.tables.rosters.get("roster-a")
    assert.deepEqual(saved?.previousPublishedPlaces, [
        { userId: "910000000000000011", squad: "F1" },
    ])
    assert.deepEqual(saved?.publishedPlaces, [
        { userId: "910000000000000011", squad: "F2" },
    ])
})

test("roster API rejects a roster whose parent event belongs to another guild", async () => {
    const db = new FakeDb()
    db.tables.events.set("event-other", {
        _id: "event-other",
        guildId: "guild-b",
    })
    db.tables.rosters.set("roster-other", {
        _id: "roster-other",
        eventId: "event-other",
        published: false,
    })
    const result = await handler(publicApi.mutateClanRoster)(
        { db },
        {
            secret: "dev-internal-auth-secret",
            keyHash: "key",
            idempotencyKey: "roster-other-key",
            bodyHash: "",
            methodPath: "DELETE /clan/rosters/{rosterId}",
            operation: "delete",
            rosterId: "roster-other",
        }
    )

    assert.equal(result?.status, 404)
    assert.equal(db.tables.rosters.size, 1)
})

function seedAssignedTeam(db: FakeDb, eventId: string) {
    db.tables.teamDirectory = new Map([
        [
            "teamDirectory:alpha",
            {
                _id: "teamDirectory:alpha",
                guildId: "guild-a",
                gameId: "hell_let_loose",
                name: "Alpha",
                shortCode: null,
                logoAssetId: "imageAssets:logo",
                revision: 1,
                archivedAt: null,
            },
        ],
    ])
    db.tables.imageAssets = new Map([
        [
            "imageAssets:logo",
            {
                _id: "imageAssets:logo",
                guildId: "guild-a",
                publicUrl: "https://logi.test/logo.png",
            },
        ],
    ])
    db.tables.imageAssetReferences = new Map([
        [
            "imageAssetReferences:one",
            {
                _id: "imageAssetReferences:one",
                assetId: "imageAssets:logo",
                guildId: "guild-a",
                owner: "event",
                ownerId: eventId,
            },
        ],
    ])
    const matchTeams = [
        {
            teamId: "teamDirectory:alpha",
            slot: "a",
            side: "Allies",
            snapshot: {
                name: "Alpha",
                shortCode: null,
                logoAssetId: "imageAssets:logo",
                logoUrl: "https://logi.test/logo.png",
                teamRevision: 1,
                capturedAt: "2026-10-01T00:00:00.000Z",
            },
        },
    ]
    return matchTeams
}

function eventUpdate(eventId: string, key: string, body: object) {
    return request({
        eventId,
        operation: "update",
        idempotencyKey: key,
        bodyHash: key,
        methodPath: "PATCH /clan/events/{eventId}",
        event: event(body as Record<string, unknown>),
    })
}

test("bearer-key event writes never change team selections", async () => {
    const db = new FakeDb()
    const selection = [
        { teamId: "teamDirectory:alpha", slot: "a", side: "Allies" },
    ]
    const created = await handler(publicApi.mutateClanEvent)(
        { db },
        request({ event: event({ matchTeams: selection }) })
    )
    assert.equal(created?.status, 201)
    const eventId = JSON.parse(created!.body).data.id
    assert.equal("matchTeams" in (await db.get(eventId))!, false)

    // A concluded match keeps its selection and logo reference when a client
    // sends [] (or a changed selection) through this API.
    const matchTeams = seedAssignedTeam(db, eventId)
    await db.patch(eventId, { matchTeams, status: "concluded" })
    for (const [key, sent] of [
        ["clear", []],
        ["replace", selection],
    ] as const) {
        const result = await handler(publicApi.mutateClanEvent)(
            { db },
            eventUpdate(eventId, key, { name: key, matchTeams: sent })
        )
        assert.equal(result?.status, 200)
        assert.deepEqual((await db.get(eventId))?.matchTeams, matchTeams)
        assert.equal(db.tables.imageAssetReferences.size, 1)
    }
})

test("bearer-key event writes re-validate a kept selection on game and kind changes", async () => {
    const db = new FakeDb()
    const created = await handler(publicApi.mutateClanEvent)({ db }, request())
    const eventId = JSON.parse(created!.body).data.id
    const matchTeams = seedAssignedTeam(db, eventId)
    await db.patch(eventId, { matchTeams })

    const moved = await handler(publicApi.mutateClanEvent)(
        { db },
        eventUpdate(eventId, "game", { gameId: "wardogs" })
    )
    assert.equal(moved?.status, 400)
    assert.match(moved!.body, /match_teams:team_game_mismatch/)
    assert.equal(
        (await db.get(eventId))?.gameId ?? "hell_let_loose",
        "hell_let_loose"
    )
    assert.deepEqual((await db.get(eventId))?.matchTeams, matchTeams)

    const training = await handler(publicApi.mutateClanEvent)(
        { db },
        eventUpdate(eventId, "training", { kind: "training" })
    )
    assert.equal(training?.status, 200)
    assert.deepEqual((await db.get(eventId))?.matchTeams, [])
    assert.equal(db.tables.imageAssetReferences.size, 0)
})

test("bearer event creation inherits discussion defaults and preserves explicit event overrides", async () => {
    const db = new FakeDb()
    await db.insert("discordConfigs", {
        guildId: "guild-a",
        eventDiscussionDefaults: {
            createForumChannel: true,
            createDebriefThread: true,
            deleteForumAfterConclusion: false,
            debriefDestination: "event_forum",
        },
    })
    const created = await handler(publicApi.mutateClanEvent)({ db }, request())
    assert.equal(created?.status, 201)
    const eventId = JSON.parse(created!.body).data.id
    assert.equal((await db.get(eventId))?.debriefDestination, "event_forum")
    assert.equal((await db.get(eventId))?.deleteForumAfterConclusion, false)
    const updated = await handler(publicApi.mutateClanEvent)(
        { db },
        eventUpdate(eventId, "discussion-update", {
            createForumChannel: false,
            debriefDestination: "results_thread",
            deleteForumAfterConclusion: true,
        })
    )
    assert.equal(updated?.status, 200)
    assert.equal((await db.get(eventId))?.createForumChannel, false)
    const replay = await handler(publicApi.mutateClanEvent)({ db }, request())
    assert.equal(replay?.status, 201)
    assert.equal(db.tables.events.size, 1)
})

test("late signup API persists reserve metadata, enforces scope and window, and replays once", async () => {
    const db = new FakeDb()
    const now = Date.now()
    db.tables.events.set("late-event", {
        _id: "late-event",
        guildId: "guild-a",
        ...event({ kind: "match" }),
        registrationEnd: new Date(now - 60_000).toISOString(),
        meetingStart: new Date(now + 3_600_000).toISOString(),
        gameEnd: new Date(now + 7_200_000).toISOString(),
        allowNonMembersSignup: true,
        participants: [],
        signUps: [],
    })
    const args = {
        secret: "dev-internal-auth-secret",
        keyHash: "key",
        eventId: "late-event",
        idempotencyKey: "late-signup",
        bodyHash: "late-body",
        methodPath: "POST /clan/events/{eventId}/signup",
        userId: "late-player",
        group: "INF",
        lateSignupReason: "  Work  ",
    }
    const execute = (overrides = {}) =>
        handler(publicApi.mutateClanEventSignup)(
            { db },
            { ...args, ...overrides }
        )
    const missing = await execute({
        lateSignupReason: undefined,
        idempotencyKey: "missing-reason",
    })
    assert.equal(missing?.status, 400)
    const result = await execute()
    assert.equal(result?.status, 200)
    assert.deepEqual(await execute(), result)
    assert.equal(db.tables.webhookDeliveries.size, 1)
    const participants = db.tables.events.get("late-event")!
        .participants as Array<{
        group: string | null
        lateSignupReason: string
        signedUpLateAt: string
    }>
    assert.equal(participants[0].group, null)
    assert.equal(participants[0].lateSignupReason, "Work")
    assert.ok(participants[0].signedUpLateAt)
    db.tables.events.get("late-event")!.guildId = "guild-b"
    assert.equal(
        (await execute({ idempotencyKey: "wrong-tenant" }))?.status,
        404
    )
    db.tables.events.get("late-event")!.guildId = "guild-a"
    db.tables.events.get("late-event")!.meetingStart = new Date(
        now - 1000
    ).toISOString()
    assert.equal(
        (await execute({ idempotencyKey: "after-meeting" }))?.status,
        400
    )
})


test("training API defaults to clan members, saves custom eligibility, and replays signups once", async () => {
    const db = new FakeDb()
    const created = await handler(publicApi.mutateClanEvent)({ db }, request({ event: event({ kind: "training" }) }))
    assert.equal(created?.status, 201)
    const eventId = JSON.parse(created!.body).data.id
    assert.deepEqual((await db.get(eventId))?.allowedSignupStatuses, ["recruit", "member", "reserve_member"])
    const signup = (key: string, overrides: Record<string, unknown> = {}) => handler(publicApi.mutateClanEventSignup)({ db }, {
        secret: "dev-internal-auth-secret", keyHash: "key", eventId,
        idempotencyKey: key, bodyHash: key, methodPath: "POST /clan/events/{eventId}/signup",
        userId: "new-player", group: null, ...overrides,
    })
    assert.equal((await signup("training-denied"))?.status, 400)
    const changed = await handler(publicApi.mutateClanEvent)({ db }, request({ operation: "update", eventId, idempotencyKey: "training-audience", bodyHash: "training-audience", methodPath: "PATCH /clan/events/{eventId}", event: event({ kind: "training", allowedSignupStatuses: ["mercenary"], allowNonMembersSignup: true }) }))
    assert.equal(changed?.status, 200)
    assert.deepEqual((await db.get(eventId))?.allowedSignupStatuses, ["mercenary"])
    const accepted = await signup("training-opted-in")
    assert.equal(accepted?.status, 200)
    const deliveries = db.tables.webhookDeliveries.size
    assert.deepEqual(await signup("training-opted-in"), accepted)
    assert.equal(db.tables.webhookDeliveries.size, deliveries)
    assert.equal((await signup("training-other-clan", { keyHash: "other-key" }))?.status ?? 401, 401)
})

test("API signup cannot bypass a future registrationStart on an imported native match", async () => {
    const db = new FakeDb()
    const now = Date.now()
    db.tables.events.set("scheduled-import", {
        _id: "scheduled-import",
        guildId: "guild-a",
        ...event({ kind: "match" }),
        gameId: "wardogs",
        status: "registration",
        allowNonMembersSignup: true,
        registrationStart: new Date(now + 86_400_000).toISOString(),
        registrationEnd: new Date(now + 2 * 86_400_000).toISOString(),
        meetingStart: new Date(now + 3 * 86_400_000).toISOString(),
        gameEnd: new Date(now + 3 * 86_400_000 + 3_600_000).toISOString(),
        participants: [],
        signUps: [],
    })
    const result = await handler(publicApi.mutateClanEventSignup)(
        { db },
        {
            secret: "dev-internal-auth-secret",
            keyHash: "key",
            eventId: "scheduled-import",
            idempotencyKey: "future-opening",
            bodyHash: "future-opening-body",
            methodPath: "POST /clan/events/{eventId}/signup",
            userId: "player",
            group: null,
        }
    )
    assert.equal(result?.status, 400)
    assert.match(result?.body ?? "", /Signups are closed/)
    assert.deepEqual(db.tables.events.get("scheduled-import")?.participants, [])
})

test("bearer event writes bind optional Wardogs fixture URLs through the shared repository", async () => {
    const db = new FakeDb()
    const url = "https://wardogsleague.net/matches/cmvjzz9tz03nvml015t5vzlpa"
    const created = await handler(publicApi.mutateClanEvent)(
        { db },
        request({
            event: event({
                gameId: "wardogs",
                kind: "match",
                wardogsFixtureUrl: `${url}/`,
            }),
        })
    )
    assert.equal(created?.status, 201)
    const id = JSON.parse(created!.body).data.id
    assert.equal((await db.get(id))?.wardogsFixtureUrl, url)
    assert.equal(db.tables.leagueAutoImportFixtures.size, 1)
    const duplicate = await handler(publicApi.mutateClanEvent)(
        { db },
        request({
            idempotencyKey: "duplicate-fixture",
            bodyHash: "duplicate-fixture",
            event: event({
                gameId: "wardogs",
                kind: "match",
                wardogsFixtureUrl: url,
            }),
        })
    )
    assert.equal(duplicate?.status, 400)
    assert.match(duplicate?.body ?? "", /already linked/)
})
