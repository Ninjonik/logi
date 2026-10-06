import * as eventAnnouncements from "../../../convex/eventAnnouncements"
import { invoke, testContext } from "./testing/database"
import assert from "node:assert/strict"
import test from "node:test"

/**
 * The announcement's bot-facing reads: the one-time redraw's scope
 * (L1-147, L1-B20) and the dashboard link of "Zobrazit přihlášené" (L1-85).
 */

const secret = ["synthetic", "announcement", "secret"].join("-")
const guildId = "910000000000000001"
const version = "l1-test"
const now = "2026-10-20T12:00:00.000Z"

function fixture() {
    process.env.INTERNAL_AUTH_SECRET = secret
    const ctx = testContext()
    const match = (id: string, gameEnd: string, extra = {}) =>
        ctx.db.seed("events", {
            _id: `events:${id}`,
            guildId,
            kind: "match",
            name: id,
            status: "registration",
            registrationEnd: "2026-10-24T17:00:00.000Z",
            meetingStart: "2026-10-25T17:30:00.000Z",
            gameStart: "2026-10-25T18:00:00.000Z",
            gameEnd,
            participants: [],
            ...extra,
        })
    const sync = (id: string, fields: Record<string, string>) =>
        ctx.db.seed("discordEventSyncs", {
            _id: `discordEventSyncs:${id}`,
            eventId: `events:${id}`,
            guildId,
            topicMessageIds: [],
            ...fields,
        })
    const upcoming = "2026-10-25T20:00:00.000Z"
    match("card", upcoming)
    sync("card", { announcementMessageId: "1" })
    // The old bot removed the announcement once sign-ups closed.
    match("roster-card", upcoming)
    sync("roster-card", { eventInfoMessageId: "2" })
    match("forum-only", upcoming)
    sync("forum-only", { infoMessageId: "3" })
    match("nothing", upcoming)
    sync("nothing", {})
    match("old", "2026-10-01T20:00:00.000Z")
    sync("old", { eventInfoMessageId: "4" })
    match("draft", upcoming, { isDraft: true })
    sync("draft", { eventInfoMessageId: "5" })
    return ctx
}

const listDue = async (ctx: ReturnType<typeof testContext>) =>
    (
        (await invoke(eventAnnouncements.listMigrationDue, ctx, {
            secret,
            version,
            now,
        })) as Array<{ eventId: string }>
    ).map((item) => item.eventId)

test("the one-time redraw also covers matches with only a roster card or forum post (L1-147, L1-B20)", async () => {
    const ctx = fixture()
    assert.deepEqual(await listDue(ctx), [
        "events:card",
        "events:roster-card",
        "events:forum-only",
    ])
})

test("each match is redrawn once: the card's layout or the migration marker takes it off the list", async () => {
    const ctx = fixture()
    await invoke(eventAnnouncements.record, ctx, {
        secret,
        eventId: "events:card",
        guildId,
        layoutVersion: version,
    })
    await invoke(eventAnnouncements.record, ctx, {
        secret,
        eventId: "events:roster-card",
        guildId,
        migrationVersion: version,
    })
    assert.deepEqual(await listDue(ctx), ["events:forum-only"])
    // The marker is not a card layout: the bot never reads it as a posted
    // card and so never posts a new announcement for this match.
    const row = ctx.db.tables.discordAnnouncements.find(
        (item) => item.eventId === "events:roster-card"
    )
    assert.equal(row?.layoutVersion, undefined)
    assert.equal(row?.migrationVersion, version)
    assert.equal(row?.pingedAt, undefined)
})

test("the list and the records need the internal secret", async () => {
    const ctx = fixture()
    await assert.rejects(
        invoke(eventAnnouncements.listMigrationDue, ctx, {
            secret: "wrong",
            version,
            now,
        })
    )
    await assert.rejects(
        invoke(eventAnnouncements.record, ctx, {
            secret: "wrong",
            eventId: "events:card",
            guildId,
            migrationVersion: version,
        })
    )
    assert.equal((ctx.db.tables.discordAnnouncements ?? []).length, 0)
})

test("Zobrazit přihlášené names the clan's dashboard record for its web link (L1-85)", async () => {
    const ctx = fixture()
    ctx.db.seed("guilds", { _id: "guilds:vlci", discordId: guildId })
    ctx.db.seed("discordConfigs", {
        _id: "discordConfigs:vlci",
        guildId,
        defaultLanguage: "cs",
    })
    const data = await invoke(eventAnnouncements.getAttendees, ctx, {
        secret,
        eventId: "events:card",
        guildId,
    })
    assert.equal(data.serverId, "guilds:vlci")
    assert.equal(data.event.guildId, guildId)
})
