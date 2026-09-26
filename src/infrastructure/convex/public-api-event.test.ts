import assert from "node:assert/strict"
import test from "node:test"

import * as publicApi from "../../../convex/publicApi"

type Document = Record<string, unknown> & { _id: string }

class FakeQuery {
    private field?: string
    private value?: unknown

    constructor(private readonly documents: Document[]) {}

    withIndex(
        _index: string,
        callback: (query: {
            eq: (field: string, value: unknown) => unknown
        }) => unknown
    ) {
        const query = {
            eq: (field: string, value: unknown) => {
                this.field = field
                this.value = value
                return query
            },
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

    private matching() {
        return this.documents.filter(
            (document) => !this.field || document[this.field] === this.value
        )
    }
}

class FakeDb {
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

const handler = (value: unknown) =>
    (
        value as {
            _handler: (
                ctx: { db: FakeDb },
                args: Record<string, unknown>
            ) => Promise<{ status: number; body: string } | null>
        }
    )._handler

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

test("event signup queues a roster update through the shared queue", async () => {
    const db = new FakeDb()
    db.tables.webhookSubscriptions.get("hook-1")!.eventTypes = [
        "roster.updated",
    ]
    db.tables.events.set("event-signup", {
        _id: "event-signup",
        guildId: "guild-a",
        ...event({ kind: "training" }),
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
