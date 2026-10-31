import * as calendarItems from "../../../convex/calendarItems"
import { seedDashboardActor } from "./testing/dashboard-actor"
import * as topicPresets from "../../../convex/topicPresets"
import * as squadPresets from "../../../convex/squadPresets"
import { invoke, testContext } from "./testing/database"
import * as publicApi from "../../../convex/publicApi"
import * as articles from "../../../convex/articles"
import * as guilds from "../../../convex/guilds"
import * as groups from "../../../convex/groups"
import assert from "node:assert/strict"
import test from "node:test"

const secret = "synthetic-shared-management"
const guildId = "100000000000000100"
function fixture() {
    process.env.INTERNAL_AUTH_SECRET = secret
    const ctx = testContext()
    const actor = seedDashboardActor(ctx.db, guildId)
    ctx.db.seed("apiKeys", { _id: "apiKeys:one", guildId, keyHash: "hash" })
    return { ctx, actor }
}
const api = (key: string) => ({
    secret,
    keyHash: "hash",
    idempotencyKey: key,
    bodyHash: key,
    methodPath: key,
})
const squad = {
    name: "Alpha",
    group: "Infantry",
    order: 17,
    color: "#123456",
    icon: "A",
    roles: [{ name: "Leader", color: "#123456", icon: "L", count: 1 }],
}

test("dashboard and v1 preserve submitted squad order on create and update", async () => {
    const { ctx } = fixture()
    const payload = {
        gameId: "wardogs",
        name: "Layout",
        squads: [squad, { ...squad, name: "Bravo", order: 3 }],
    }
    const nativeId = await invoke(squadPresets.upsert, ctx, {
        secret,
        serverId: "guilds:admin",
        ...payload,
    })
    const result = await invoke(publicApi.mutateClanPreset, ctx, {
        ...api("create"),
        resource: "squad-presets",
        operation: "create",
        payload,
    })
    assert.equal(result.status, 201)
    const data = JSON.parse(result.body).data
    assert.deepEqual((await ctx.db.get(nativeId))?.squads, data.squads)
    assert.deepEqual(
        data.squads.map((item: { order: number }) => item.order),
        [17, 3]
    )
    const updated = { ...payload, squads: [{ ...squad, order: 42 }] }
    await invoke(squadPresets.upsert, ctx, {
        secret,
        serverId: "guilds:admin",
        presetId: nativeId,
        ...updated,
    })
    const response = await invoke(publicApi.mutateClanPreset, ctx, {
        ...api("update"),
        resource: "squad-presets",
        operation: "update",
        presetId: data.id,
        payload: updated,
    })
    assert.equal(response.status, 200)
    assert.deepEqual(
        (await ctx.db.get(nativeId))?.squads,
        JSON.parse(response.body).data.squads
    )
    const rejected = await invoke(publicApi.mutateClanPreset, ctx, {
        ...api("game-change"),
        resource: "squad-presets",
        operation: "update",
        presetId: data.id,
        payload: { ...payload, gameId: "hell_let_loose" },
    })
    assert.equal(rejected.status, 400)
})

test("dashboard and v1 do not synthesize topic IDs or default messages", async () => {
    const { ctx } = fixture()
    const payload = {
        name: "Forum",
        topics: [
            { title: "Briefing", body: "Details", attachments: [] },
            {
                id: "existing",
                title: "Orders",
                attachments: [],
                messages: [
                    { id: "message", body: "Keep this", attachments: [] },
                ],
            },
        ],
    }
    const id = await invoke(topicPresets.upsert, ctx, {
        secret,
        serverId: "guilds:admin",
        ...payload,
    })
    const result = await invoke(publicApi.mutateClanPreset, ctx, {
        ...api("topic-create"),
        resource: "topic-presets",
        operation: "create",
        payload,
    })
    assert.equal(result.status, 201)
    assert.deepEqual((await ctx.db.get(id))?.topics, payload.topics)
    assert.deepEqual(JSON.parse(result.body).data.topics, payload.topics)
    await invoke(topicPresets.upsert, ctx, {
        secret,
        serverId: "guilds:admin",
        presetId: id,
        ...payload,
    })
    assert.deepEqual((await ctx.db.get(id))?.topics, payload.topics)
})

test("shared group deletion cleans assignments once and respects tenant boundaries", async () => {
    const { ctx } = fixture()
    const native = await invoke(groups.upsert, ctx, {
        secret,
        guildId: "guilds:admin",
        gameId: "wardogs",
        name: "Alpha",
        color: "#123456",
        order: 4,
    })
    const created = await invoke(publicApi.mutateClanGroup, ctx, {
        ...api("group"),
        operation: "create",
        gameId: "wardogs",
        name: "Bravo",
        color: "#123456",
        order: 4,
    })
    assert.equal(created.status, 201)
    const id = JSON.parse(created.body).data.id
    ctx.db.seed("userAssignments", {
        _id: "userAssignments:one",
        serverId: guildId,
        userId: "player",
        primaryGroupId: id,
        secondaryGroupIds: [native, id],
    })
    ctx.db.seed("groups", {
        _id: "groups:foreign",
        guildId: "foreign",
        name: "Foreign",
        color: "#123456",
        order: 0,
    })
    const denied = await invoke(publicApi.mutateClanGroup, ctx, {
        ...api("foreign"),
        operation: "delete",
        groupId: "groups:foreign",
    })
    assert.equal(denied.status, 404)
    const deleted = await invoke(publicApi.mutateClanGroup, ctx, {
        ...api("delete"),
        operation: "delete",
        groupId: id,
    })
    assert.equal(deleted.status, 200)
    const assignment = await ctx.db.get("userAssignments:one")
    assert.equal(assignment?.primaryGroupId, undefined)
    assert.deepEqual(assignment?.secondaryGroupIds, [native])
    await invoke(groups.remove, ctx, {
        secret,
        guildId: "guilds:admin",
        groupId: native,
    })
    assert.deepEqual(assignment?.secondaryGroupIds, [])
})

test("article writes share normalization and preserve the v1 update response fields", async () => {
    const { ctx } = fixture()
    const fields = {
        title: " Title ",
        description: " Intro ",
        body: " Body ",
        tags: [" a ", "", "b"],
        attachments: ["", " https://example.test/file "],
    }
    const id = await invoke(articles.save, ctx, {
        secret,
        guildId,
        authorId: "manager",
        ...fields,
    })
    const created = await invoke(publicApi.mutateClanArticle, ctx, {
        ...api("article"),
        operation: "create",
        ...fields,
    })
    const data = JSON.parse(created.body).data
    const native = await ctx.db.get(id)
    assert.equal(native?.title, data.title)
    assert.deepEqual(native?.tags, data.tags)
    assert.deepEqual(native?.attachments, data.attachments)
    const update = await invoke(publicApi.mutateClanArticle, ctx, {
        ...api("article-update"),
        operation: "update",
        articleId: data.id,
        ...fields,
    })
    assert.equal(update.status, 200)
    assert.deepEqual(
        Object.keys(JSON.parse(update.body).data).sort(),
        [
            "id",
            "title",
            "description",
            "body",
            "tags",
            "attachments",
            "updatedAt",
            "guildId",
            "createdAt",
        ].sort()
    )
})

test("calendar item commands preserve concurrent API additions and recheck live management access", async () => {
    const { ctx, actor } = fixture()
    const fields = {
        title: "Meeting",
        startAt: "2030-01-01T12:00:00Z",
        endAt: "2030-01-01T13:00:00Z",
        allDay: false,
    }
    const result = await invoke(publicApi.mutateClanCalendarItem, ctx, {
        ...api("calendar"),
        operation: "create",
        color: "#123456",
        ...fields,
    })
    assert.equal(result.status, 201)
    const apiId = JSON.parse(result.body).data.id
    const nativeId = await invoke(calendarItems.create, ctx, {
        secret,
        guildId,
        actor,
        ...fields,
    })
    assert.ok(await ctx.db.get(apiId))
    await invoke(calendarItems.remove, ctx, {
        secret,
        guildId,
        actor,
        itemId: nativeId,
    })
    assert.ok(await ctx.db.get(apiId))
    ctx.db.seed("calendarItems", {
        _id: "calendarItems:foreign",
        guildId: "foreign",
        ...fields,
    })
    assert.equal(
        await invoke(calendarItems.remove, ctx, {
            secret,
            guildId,
            actor,
            itemId: "calendarItems:foreign",
        }),
        false
    )
    ctx.db.tables.dashboardSessions = []
    await assert.rejects(
        invoke(calendarItems.create, ctx, {
            secret,
            guildId,
            actor,
            ...fields,
        }),
        /Forbidden/
    )
    assert.equal(ctx.db.tables.calendarItems.length, 2)
})

test("v1 roster writes reject cross-game presets and stamp publication exactly once on replay", async () => {
    const { ctx } = fixture()
    ctx.db.seed("events", {
        _id: "events:one",
        guildId,
        gameId: "wardogs",
        registrationEnd: "2099-01-01T00:00:00Z",
        participants: [],
    })
    ctx.db.seed("rosters", {
        _id: "rosters:one",
        guildId,
        eventId: "events:one",
        squads: [],
        reservePlayerIds: [],
        notAttendingPlayerIds: [],
        published: false,
    })
    ctx.db.seed("squadPresets", {
        _id: "squadPresets:foreign-game",
        guildId,
        gameId: "hell_let_loose",
        name: "Other game",
        squads: [],
    })
    const payload = {
        eventId: "events:one",
        squads: [],
        reservePlayerIds: [],
        notAttendingPlayerIds: [],
        published: true,
    }
    const rejected = await invoke(publicApi.mutateClanRoster, ctx, {
        ...api("bad-roster"),
        operation: "update",
        rosterId: "rosters:one",
        payload: { ...payload, squadPresetId: "squadPresets:foreign-game" },
    })
    assert.equal(rejected.status, 400)
    assert.equal((await ctx.db.get("rosters:one"))?.published, false)
    const input = {
        ...api("publish"),
        operation: "update",
        rosterId: "rosters:one",
        payload,
    }
    const first = await invoke(publicApi.mutateClanRoster, ctx, input)
    const second = await invoke(publicApi.mutateClanRoster, ctx, input)
    assert.equal(first.status, 200)
    assert.equal(first.body, second.body)
    assert.ok(JSON.parse(first.body).data.publishedAt)
})

test("calendar settings replace explicitly submitted items through the same commands", async () => {
    const { ctx, actor } = fixture()
    const fields = {
        title: "Meeting",
        startAt: "2030-01-01T12:00:00Z",
        endAt: "2030-01-01T13:00:00Z",
        allDay: false,
    }
    const id = await invoke(calendarItems.create, ctx, {
        secret,
        guildId,
        actor,
        ...fields,
    })
    await invoke(guilds.updateFrontendSettings, ctx, {
        secret,
        guildId: "guilds:admin",
        name: "Clan",
        avatar: "avatar",
        calendarItems: [
            { ...fields, id, title: "Updated", color: "#123456" },
            { ...fields, id: "new-client-id", color: "#123456" },
        ],
    })
    assert.equal((await ctx.db.get(id))?.title, "Updated")
    assert.equal(ctx.db.tables.calendarItems.length, 2)
    await invoke(guilds.updateFrontendSettings, ctx, {
        secret,
        guildId: "guilds:admin",
        name: "Clan",
        avatar: "avatar",
        calendarItems: [],
    })
    assert.equal(ctx.db.tables.calendarItems.length, 0)
})

test("shared group and calendar validation rejects invalid writes without storing them", async () => {
    const { ctx, actor } = fixture()
    await assert.rejects(
        invoke(groups.upsert, ctx, {
            secret,
            guildId: "guilds:admin",
            name: "Group",
            color: "invalid",
            order: 1.5,
        }),
        /#RRGGBB/
    )
    const group = await invoke(publicApi.mutateClanGroup, ctx, {
        ...api("invalid-group"),
        operation: "create",
        name: "Group",
        color: "invalid",
        order: 1,
    })
    assert.equal(group.status, 400)
    const fields = {
        title: "Meeting",
        startAt: "2030-01-02T12:00:00Z",
        endAt: "2030-01-01T13:00:00Z",
        allDay: false,
    }
    const calendar = await invoke(publicApi.mutateClanCalendarItem, ctx, {
        ...api("invalid-calendar"),
        operation: "create",
        color: "#123456",
        ...fields,
    })
    assert.equal(calendar.status, 400)
    await assert.rejects(
        invoke(calendarItems.create, ctx, { secret, guildId, actor, ...fields })
    )
    assert.equal(ctx.db.tables.groups?.length ?? 0, 0)
    assert.equal(ctx.db.tables.calendarItems?.length ?? 0, 0)
})

test("shared stratmap saves keep state on metadata edits and reject cross-game event links", async () => {
    const { ctx } = fixture()
    const fields = {
        gameId: "wardogs",
        title: "Plan",
        baseMapId: "map",
        state: "saved-state",
    }
    const response = await invoke(publicApi.mutateClanPreset, ctx, {
        ...api("stratmap"),
        operation: "create",
        resource: "stratmaps",
        payload: fields,
    })
    assert.equal(response.status, 201)
    const id = JSON.parse(response.body).data.id
    const updated = await invoke(publicApi.mutateClanPreset, ctx, {
        ...api("stratmap-update"),
        operation: "update",
        resource: "stratmaps",
        presetId: id,
        payload: { gameId: "wardogs", title: "Renamed", baseMapId: "map" },
    })
    assert.equal(updated.status, 200)
    assert.equal(JSON.parse(updated.body).data.state, "saved-state")
    ctx.db.seed("events", {
        _id: "events:wrong-game",
        guildId,
        gameId: "hell_let_loose",
    })
    const denied = await invoke(publicApi.mutateClanPreset, ctx, {
        ...api("stratmap-wrong-game"),
        operation: "update",
        resource: "stratmaps",
        presetId: id,
        payload: { ...fields, eventId: "events:wrong-game" },
    })
    assert.equal(denied.status, 400)
    assert.equal((await ctx.db.get(id))?.title, "Renamed")
})
