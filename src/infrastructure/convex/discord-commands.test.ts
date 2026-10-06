import assert from "node:assert/strict"
import test from "node:test"

import { actorFixture, seedDashboardActor } from "./testing/dashboard-actor"
import * as discordCommands from "../../../convex/discordCommands"
import { invoke, testContext } from "./testing/database"

process.env.INTERNAL_AUTH_SECRET = "dev-internal-auth-secret"
const secret = process.env.INTERNAL_AUTH_SECRET
const guildId = "100000000000000000"
const access = { secret, guildId, actor: actorFixture }

function setup() {
    const ctx = testContext()
    seedDashboardActor(ctx.db, guildId)
    ctx.db.seed("discordConfigs", {
        _id: "discordConfigs:a",
        guildId,
        timezone: "Europe/Prague",
        defaultLanguage: "cs",
        calendarCategories: [],
        dashboardAdminRoleId: "100000000000000001",
        statsSettings: {
            enabled: true,
            games: { hell_let_loose: true, wardogs: true },
        },
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-01T00:00:00.000Z",
    })
    return ctx
}

test("the bot reads every server's command settings with the internal secret only", async () => {
    const ctx = setup()
    await assert.rejects(
        invoke(discordCommands.listGuildConfigs, ctx, { secret: "wrong" })
    )
    const [config] = await invoke(discordCommands.listGuildConfigs, ctx, {
        secret,
    })
    assert.equal(config.guildId, guildId)
    assert.equal(config.language, "cs")
    assert.equal(config.dashboardAdminRoleId, "100000000000000001")
    assert.deepEqual(config.registration, {
        requestedAt: null,
        requestKind: null,
        registeredAt: null,
        signature: null,
    })
})

test("a re-registration request is recorded, answered by the bot and debounced (N3-B03)", async (t) => {
    const ctx = setup()
    let now = Date.parse("2026-10-05T12:00:00Z")
    t.mock.method(Date, "now", () => now)
    const first = await invoke(discordCommands.requestRegistration, ctx, access)
    now += 2_000
    const again = await invoke(discordCommands.requestRegistration, ctx, access)
    assert.equal(
        again.requestedAt,
        first.requestedAt,
        "a double click asks once"
    )
    let [config] = await invoke(discordCommands.listGuildConfigs, ctx, {
        secret,
    })
    assert.equal(config.registration.requestedAt, first.requestedAt)
    assert.equal(config.registration.requestKind, "manual")

    await invoke(discordCommands.recordRegistration, ctx, {
        secret,
        guildId,
        at: now,
        handledRequestAt: first.requestedAt,
        result: { ok: true, commandCount: 8, language: "cs", signature: "s1" },
    })
    ;[config] = await invoke(discordCommands.listGuildConfigs, ctx, { secret })
    assert.deepEqual(config.registration, {
        requestedAt: null,
        requestKind: null,
        registeredAt: now,
        signature: "s1",
    })
    const card = await invoke(
        discordCommands.registrationForDashboard,
        ctx,
        access
    )
    assert.equal(card.commandCount, 8)
    assert.equal(card.failure, null)

    await invoke(discordCommands.recordRegistration, ctx, {
        secret,
        guildId,
        at: now + 1,
        result: { ok: false, failure: "forbidden" },
    })
    const failed = await invoke(
        discordCommands.registrationForDashboard,
        ctx,
        access
    )
    assert.equal(failed.failure, "forbidden")
    assert.equal(failed.registeredAt, now, "the last success stays visible")
})

test("the dashboard functions need a live clan-admin session", async () => {
    const ctx = setup()
    const stranger = {
        ...access,
        actor: { ...actorFixture, sid: "b".repeat(43) },
    }
    await assert.rejects(
        invoke(discordCommands.requestRegistration, ctx, stranger)
    )
    await assert.rejects(
        invoke(discordCommands.registrationForDashboard, ctx, stranger)
    )
    await assert.rejects(
        invoke(discordCommands.saveSettings, ctx, {
            ...stranger,
            commandSettings: {},
            statsSettings: {
                enabled: true,
                games: { hell_let_loose: true, wardogs: true },
            },
        })
    )
})

test("saving stores the command settings and /stats's switches (N3-B01)", async () => {
    const ctx = setup()
    await invoke(discordCommands.saveSettings, ctx, {
        ...access,
        commandSettings: {
            player: {
                audience: "clanMembers",
                roleIds: ["100000000000000005"],
            },
            serverStatus: { channelIds: ["300000000000000001"] },
        },
        statsSettings: {
            enabled: false,
            games: { hell_let_loose: true, wardogs: false },
        },
    })
    const stored = ctx.db.tables.discordConfigs![0]!
    assert.deepEqual(
        (stored.commandSettings as Record<string, unknown>).player,
        { audience: "clanMembers", roleIds: ["100000000000000005"] }
    )
    assert.equal((stored.statsSettings as { enabled: boolean }).enabled, false)
    await assert.rejects(
        invoke(discordCommands.saveSettings, ctx, {
            ...access,
            commandSettings: { stats: { enabled: true } },
            statsSettings: {
                enabled: true,
                games: { hell_let_loose: true, wardogs: true },
            },
        }),
        "/stats's switch lives in statsSettings"
    )
})

test("every save asks the bot for a registration, so the card's time moves (M1-B01, N3-B02)", async (t) => {
    const ctx = setup()
    let now = Date.parse("2026-10-05T12:00:00Z")
    t.mock.method(Date, "now", () => now)
    const save = () =>
        invoke(discordCommands.saveSettings, ctx, {
            ...access,
            // Only a channel: Discord's commands stay the same.
            commandSettings: { stats: { channelIds: ["300000000000000001"] } },
            statsSettings: {
                enabled: true,
                games: { hell_let_loose: true, wardogs: true },
            },
        })
    await save()
    let [config] = await invoke(discordCommands.listGuildConfigs, ctx, {
        secret,
    })
    assert.equal(config.registration.requestedAt, now)
    assert.equal(config.registration.requestKind, "save")
    const card = await invoke(
        discordCommands.registrationForDashboard,
        ctx,
        access
    )
    assert.equal(card.requestedAt, now, "the card shows it as pending")

    // The bot records it; the request is answered and the time moves.
    await invoke(discordCommands.recordRegistration, ctx, {
        secret,
        guildId,
        at: now + 1_000,
        handledRequestAt: now,
        result: { ok: true, commandCount: 8, language: "cs", signature: "s1" },
    })
    ;[config] = await invoke(discordCommands.listGuildConfigs, ctx, { secret })
    assert.equal(config.registration.requestedAt, null)
    assert.equal(config.registration.requestKind, null)
    assert.equal(config.registration.registeredAt, now + 1_000)

    // A second save right after asks again; no debounce swallows it.
    now += 2_000
    await save()
    ;[config] = await invoke(discordCommands.listGuildConfigs, ctx, { secret })
    assert.equal(config.registration.requestedAt, now)
    assert.equal(config.registration.requestKind, "save")
})

test("Znovu zaregistrovat is never weakened by a save, and upgrades a pending save", async (t) => {
    const ctx = setup()
    let now = Date.parse("2026-10-05T12:00:00Z")
    t.mock.method(Date, "now", () => now)
    const save = () =>
        invoke(discordCommands.saveSettings, ctx, {
            ...access,
            commandSettings: {},
            statsSettings: {
                enabled: true,
                games: { hell_let_loose: true, wardogs: true },
            },
        })
    await save()
    now += 1_000
    // Inside the debounce window, but the pending request was a save.
    await invoke(discordCommands.requestRegistration, ctx, access)
    let [config] = await invoke(discordCommands.listGuildConfigs, ctx, {
        secret,
    })
    assert.equal(config.registration.requestKind, "manual")
    assert.equal(config.registration.requestedAt, now)
    now += 1_000
    await save()
    ;[config] = await invoke(discordCommands.listGuildConfigs, ctx, { secret })
    assert.equal(config.registration.requestKind, "manual")
    assert.equal(config.registration.requestedAt, now)
})

test("the workspace of a server is read with the internal secret", async () => {
    const ctx = setup()
    assert.deepEqual(
        await invoke(discordCommands.workspaceOf, ctx, { secret, guildId }),
        { workspaceId: "guilds:admin", name: undefined }
    )
    assert.equal(
        await invoke(discordCommands.workspaceOf, ctx, {
            secret,
            guildId: "200000000000000000",
        }),
        null
    )
})
