import * as messageSettings from "../../../convex/discordMessageSettings"
import * as errorReports from "../../../convex/discordErrorReports"
import { invoke, testContext } from "./testing/database"
import assert from "node:assert/strict"
import test from "node:test"

const secret = (process.env.INTERNAL_AUTH_SECRET = "dev-internal-auth-secret")
const GUILD = "111111111111111111"

function fixture() {
    const ctx = testContext()
    ctx.db.seed("guilds", {
        _id: "guilds:a",
        discordId: GUILD,
        name: "Vlci",
        adminIds: [],
        eventCategories: [
            { id: "friendly", label: "Přátelák", color: "#00ff00" },
        ],
    })
    ctx.db.seed("discordConfigs", {
        _id: "discordConfigs:a",
        guildId: GUILD,
        timezone: "Europe/Prague",
        defaultLanguage: "cs",
        announcementsChannelId: "201",
        errorsChannelId: "203",
        calendarCategories: [],
        messageStyle: { accentColor: "#E8A33D", iconDensity: "sparse" },
        ticketSettings: {
            enabled: true,
            submitChannelId: "301",
            ticketParentChannelId: "302",
            panelTitle: "T",
            panelDescription: "D",
            categories: [],
        },
    })
    ctx.db.seed("events", {
        _id: "events:a",
        guildId: GUILD,
        kind: "match",
        name: "Přátelák s ROG",
        matchType: "friendly",
        gameStart: "2026-10-11T18:00:00.000Z",
        matchTeams: [
            { slot: "a", snapshot: { name: "Vlci", shortCode: "VLK" } },
            { slot: "b", snapshot: { name: "Rogue", shortCode: "ROG" } },
        ],
    })
    ctx.db.seed("events", {
        _id: "events:other",
        guildId: "999999999999999999",
        kind: "match",
        name: "Cizí zápas",
        gameStart: "2026-10-11T18:00:00.000Z",
    })
    return ctx
}

test("the message settings save only what the page sends, under the stored names", async () => {
    const ctx = fixture()
    await assert.rejects(
        invoke(messageSettings.save, ctx, {
            secret: "wrong",
            guildId: "guilds:a",
            settings: {},
        }),
        /Unauthorized/
    )
    await invoke(messageSettings.save, ctx, {
        secret,
        guildId: "guilds:a",
        settings: {
            rosterMessageVariant: "photo",
            attendanceNoticesInThread: true,
            debriefPost: false,
            ticketCloseDm: false,
        },
    })
    const [config] = ctx.db.tables.discordConfigs
    assert.equal(config.rosterMessageVariant, "photo")
    assert.equal(config.attendanceNoticesInThread, true)
    assert.equal(config.debriefPostEnabled, false)
    assert.equal(config.ticketCloseDmEnabled, false)
    assert.equal(config.matchRecapDmEnabled, undefined)
    assert.equal(config.errorsChannelId, "203")
    assert.equal(config.announcementsChannelId, "201")
})

test("the errors-channel context gives the clan's channel, links and its own match only", async () => {
    const ctx = fixture()
    await assert.rejects(
        invoke(errorReports.context, ctx, { secret: "wrong", guildId: GUILD }),
        /Unauthorized/
    )
    const found = await invoke(errorReports.context, ctx, {
        secret,
        guildId: GUILD,
        eventId: "events:a",
    })
    assert.equal(found.errorsChannelId, "203")
    assert.equal(found.language, "cs")
    assert.equal(found.timeZone, "Europe/Prague")
    assert.equal(found.serverId, "guilds:a")
    assert.equal(found.channels.announcements, "201")
    assert.equal(found.channels.ticketPanel, "301")
    assert.equal(found.channels.ticketThreads, "302")
    assert.deepEqual(found.event, {
        id: "events:a",
        kind: "match",
        title: "VLK vs ROG",
        category: "Přátelák",
        gameStart: "2026-10-11T18:00:00.000Z",
        announcementChannelId: null,
        meetingChannelId: null,
    })
    const foreign = await invoke(errorReports.context, ctx, {
        secret,
        guildId: GUILD,
        eventId: "events:other",
    })
    assert.equal(foreign.event, null)
    ctx.db.tables.discordConfigs[0].errorsChannelId = undefined
    assert.equal(
        await invoke(errorReports.context, ctx, { secret, guildId: GUILD }),
        null
    )
})
