import assert from "node:assert/strict"
import test from "node:test"

import { invoke, testContext } from "./testing/database"
import * as players from "../../../convex/players"
import * as events from "../../../convex/events"

process.env.INTERNAL_AUTH_SECRET = "dev-internal-auth-secret"
const secret = process.env.INTERNAL_AUTH_SECRET
const GUILD = "100000000000000000"
const MEMBER = "100000000000000017"

test("/notice's choices carry the match category (M3-15)", async (t) => {
    t.mock.method(Date, "now", () => Date.parse("2026-10-05T12:00:00Z"))
    const ctx = testContext()
    ctx.db.seed("guilds", {
        _id: "guilds:a",
        discordId: GUILD,
        name: "Vlci",
        adminIds: [],
        eventCategories: [{ id: "friendly", label: "Přátelák", color: "#fff" }],
    })
    const event = (id: string, name: string, extra: Record<string, unknown>) =>
        ctx.db.seed("events", {
            _id: `events:${id}`,
            guildId: GUILD,
            name,
            gameStart: "2026-10-11T18:00:00.000Z",
            gameEnd: "2026-10-11T20:00:00.000Z",
            meetingStart: "2026-10-11T17:30:00.000Z",
            participants: [{ userId: MEMBER, status: "attending" }],
            signUps: [],
            ...extra,
        })
    event("m", "VLK vs ROG", { kind: "match", matchType: "friendly" })
    event("t", "Trénink obrany", { kind: "training", matchType: "friendly" })
    const targets = await invoke(events.findNoticeTarget, ctx, {
        secret,
        guildId: GUILD,
        userId: MEMBER,
        query: "",
    })
    const byName = Object.fromEntries(
        targets.map((target: { name: string; categoryLabel?: string }) => [
            target.name,
            target.categoryLabel,
        ])
    )
    assert.deepEqual(byName, {
        "VLK vs ROG": "Přátelák",
        "Trénink obrany": undefined,
    })
})

test("/player's profile names the oldest imported match (M2-41)", async () => {
    const ctx = testContext()
    ctx.db.seed("users", {
        _id: "users:p",
        discordId: MEMBER,
        id: MEMBER,
        name: "Hráč 17",
        nicknames: {},
        avatar: "",
        managedGuildIds: [],
        mercenaryGuildIds: [],
        scores: {},
        score: 0,
    })
    ctx.db.seed("userAssignments", {
        _id: "userAssignments:a",
        userId: MEMBER,
        serverId: GUILD,
        type: "member",
        status: "active",
        paused: false,
    })
    const match = (endedAt: string) => ({
        sourceUrl: "https://crcon.test",
        importedAt: endedAt,
        endedAt,
        mapId: "foy",
        playerName: "Hráč 17",
        team: "allies",
        kills: 1,
        killDeathRatio: 1,
        deaths: 1,
        offense: 1,
        defense: 1,
        support: 1,
    })
    ctx.db.seed("playerStats", {
        _id: "playerStats:a",
        id: "steam-a",
        userId: MEMBER,
        updatedAt: "2026-10-03T00:00:00.000Z",
        matches: {
            a: match("2026-10-03T19:00:00.000Z"),
            b: match("2026-06-02T19:00:00.000Z"),
        },
    })
    const profile = await invoke(players.getClanPlayerProfile, ctx, {
        secret,
        guildId: GUILD,
        userId: MEMBER,
    })
    assert.equal(profile.firstMatchAt, "2026-06-02T19:00:00.000Z")
    const [option] = await invoke(players.searchClanPlayers, ctx, {
        secret,
        guildId: GUILD,
        query: "",
    })
    assert.equal(option.assignmentPaused, false)
})
