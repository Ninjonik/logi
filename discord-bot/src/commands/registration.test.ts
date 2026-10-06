import assert from "node:assert/strict"
import test from "node:test"

import {
    createCommandRegistration,
    type RegistrationGuild,
    type RegistrationRecord,
} from "./registration"
import { guildCommandConfigFromStored } from "../../../src/domain/discord-commands/guild-config"
import type { CommandDefinition } from "./definitions"
import { GuildCommandConfigs } from "./guild-configs"

const GUILD = "100000000000000000"
const OTHER = "200000000000000000"

function row(
    guildId: string,
    stored: Record<string, unknown> = {},
    registration: {
        requestedAt?: number
        requestKind?: "save" | "manual"
        signature?: string
    } = {}
) {
    return guildCommandConfigFromStored({
        config: { guildId, defaultLanguage: "cs", ...stored },
        registration,
    })
}

function setup(initialRows: unknown[] = [row(GUILD)]) {
    let watcher: ((rows: unknown) => void) | undefined
    const configs = new GuildCommandConfigs({
        list: async () => initialRows,
        watch: (onRows) => {
            watcher = onRows
            return () => {}
        },
    })
    const sets: Array<{ guildId: string; commands: CommandDefinition[] }> = []
    const records: RegistrationRecord[] = []
    const scheduled: Array<() => void> = []
    let fail: unknown = null
    const guild = (
        id: string,
        preferredLocale = "en-US"
    ): RegistrationGuild => ({
        id,
        preferredLocale,
        commands: {
            set: async (commands) => {
                if (fail) throw fail
                sets.push({ guildId: id, commands })
            },
        },
    })
    const guilds = new Map([
        [GUILD, guild(GUILD)],
        [OTHER, guild(OTHER, "de")],
    ])
    let now = 1_000
    const registration = createCommandRegistration({
        configs,
        guild: (id) => guilds.get(id),
        record: async (record) => {
            records.push(record)
        },
        now: () => now++,
        log: () => {},
        schedule: (callback) => {
            scheduled.push(callback)
            return scheduled.length
        },
        cancel: () => {},
    })
    return {
        configs,
        registration,
        sets,
        records,
        guilds,
        start: () => configs.start((ids) => registration.configsChanged(ids)),
        push: (rows: unknown[]) => watcher?.(rows),
        runScheduled: async () => {
            for (const callback of scheduled.splice(0)) callback()
            await new Promise((resolve) => setImmediate(resolve))
        },
        failWith: (error: unknown) => {
            fail = error
        },
    }
}

test("on ready every server gets its commands in its own language, recorded for the page (M1-17, N3-03)", async () => {
    const f = setup()
    await f.registration.registerAll(f.guilds.values())
    assert.deepEqual(
        f.sets.map((set) => [set.guildId, set.commands.length]),
        [
            [GUILD, 8],
            [OTHER, 8],
        ]
    )
    assert.equal(
        f.sets[0]!.commands.find((command) => command.name === "help")!
            .description,
        "Příkazy, které můžeš použít, a odkaz na návod"
    )
    assert.equal(
        f.sets[1]!.commands.find((command) => command.name === "help")!
            .description,
        "Befehle, die du nutzen kannst, und ein Link zur Anleitung",
        "a server without Logi uses its community language"
    )
    assert.equal(f.records.length, 1, "only connected servers are recorded")
    assert.deepEqual(f.records[0]!.result, {
        ok: true,
        commandCount: 8,
        language: "cs",
        signature: f.records[0]!.result.ok
            ? f.records[0]!.result.signature
            : "",
    })
})

test("a server that adds the bot is registered at once (M1-18)", async () => {
    const f = setup()
    await f.registration.registerGuild(f.guilds.get(OTHER)!, "guildCreate")
    assert.deepEqual(
        f.sets.map((set) => set.guildId),
        [OTHER]
    )
})

test("a clan language change registers again; an unrelated change does not (M1-19, M1-B01)", async () => {
    const f = setup()
    await f.registration.registerAll([f.guilds.get(GUILD)!])
    f.start()
    f.push([row(GUILD, { announcementsChannelId: "300000000000000001" })])
    await f.runScheduled()
    assert.equal(f.sets.length, 1, "the definitions did not change")
    f.push([row(GUILD, { defaultLanguage: "de" })])
    await f.runScheduled()
    assert.equal(f.sets.length, 2)
    assert.equal(
        f.sets[1]!.commands.find((command) => command.name === "help")!
            .description,
        "Befehle, die du nutzen kannst, und ein Link zur Anleitung"
    )
    f.push([
        row(GUILD, {
            defaultLanguage: "de",
            commandSettings: { player: { audience: "logiAdmins" } },
        }),
    ])
    await f.runScheduled()
    assert.equal(f.sets.length, 3, "saved settings change a description")
})

test("Znovu zaregistrovat registers immediately and is answered once (N3-B03)", async () => {
    const f = setup()
    await f.registration.registerAll([f.guilds.get(GUILD)!])
    f.start()
    f.push([row(GUILD, {}, { requestedAt: 5_000 })])
    await f.runScheduled()
    assert.equal(f.sets.length, 2)
    assert.equal(f.records.at(-1)!.handledRequestAt, 5_000)
    f.push([
        row(
            GUILD,
            { announcementsChannelId: "300000000000000001" },
            { requestedAt: 5_000 }
        ),
    ])
    await f.runScheduled()
    assert.equal(f.sets.length, 2, "the same request is not answered twice")
})

test("every save is recorded; Discord is called only when the commands changed (M1-B01, N3-B02)", async () => {
    const f = setup()
    await f.registration.registerAll([f.guilds.get(GUILD)!])
    f.start()
    const recorded = f.records.length
    // A save that only moves a channel: Discord's commands stay the same.
    f.push([
        row(
            GUILD,
            {
                commandSettings: {
                    stats: { channelIds: ["300000000000000001"] },
                },
            },
            { requestedAt: 5_000, requestKind: "save" }
        ),
    ])
    await f.runScheduled()
    assert.equal(f.sets.length, 1, "no needless Discord call")
    assert.equal(f.records.length, recorded + 1, "but the time is recorded")
    const record = f.records.at(-1)!
    assert.equal(record.handledRequestAt, 5_000)
    assert.ok(record.result.ok && record.result.commandCount === 8)
    assert.ok(record.at > f.records[0]!.at, "the card's time moves")
    // The same request is not answered twice.
    f.push([
        row(
            GUILD,
            {
                commandSettings: {
                    stats: { channelIds: ["300000000000000001"] },
                },
                announcementsChannelId: "300000000000000002",
            },
            { requestedAt: 5_000, requestKind: "save" }
        ),
    ])
    await f.runScheduled()
    assert.equal(f.records.length, recorded + 1)
    // A save that changes a description reaches Discord.
    f.push([
        row(
            GUILD,
            { commandSettings: { player: { audience: "logiAdmins" } } },
            { requestedAt: 6_000, requestKind: "save" }
        ),
    ])
    await f.runScheduled()
    assert.equal(f.sets.length, 2)
    assert.equal(f.records.at(-1)!.handledRequestAt, 6_000)
})

test("Znovu zaregistrovat always calls Discord, even with the same commands", async () => {
    const f = setup()
    await f.registration.registerAll([f.guilds.get(GUILD)!])
    f.start()
    f.push([row(GUILD, {}, { requestedAt: 5_000, requestKind: "manual" })])
    await f.runScheduled()
    assert.equal(f.sets.length, 2)
})

test("a save before this process ever registered the server calls Discord", async () => {
    const f = setup()
    f.start()
    f.push([row(GUILD, {}, { requestedAt: 5_000, requestKind: "save" })])
    await f.runScheduled()
    assert.equal(f.sets.length, 1)
    assert.equal(f.records.at(-1)!.handledRequestAt, 5_000)
})

test("after a restart the stored signature avoids a needless registration", async () => {
    const f = setup()
    await f.registration.registerAll([f.guilds.get(GUILD)!])
    const signature = f.records[0]!.result.ok
        ? f.records[0]!.result.signature
        : ""
    const restarted = setup([row(GUILD, {}, { signature })])
    restarted.start()
    restarted.push([row(GUILD, {}, { signature })])
    await restarted.runScheduled()
    assert.equal(restarted.sets.length, 0)
})

test("a refused registration is recorded as a category, never Discord's message", async () => {
    const f = setup()
    f.failWith(
        Object.assign(new Error("Missing Access token=abc"), { status: 403 })
    )
    await f.registration.registerAll([f.guilds.get(GUILD)!])
    assert.deepEqual(f.records[0]!.result, { ok: false, failure: "forbidden" })
    assert.doesNotMatch(JSON.stringify(f.records), /Missing Access|token/)
})

test("the live configs report which servers changed and answer before the first update", async () => {
    const configs = new GuildCommandConfigs({
        list: async () => [row(GUILD)],
        watch: () => () => {},
    })
    assert.equal((await configs.get(GUILD))?.language, "cs")
    assert.equal(await configs.get(OTHER), null)
    assert.deepEqual(configs.apply([row(GUILD), row(OTHER)]), [OTHER])
    assert.deepEqual(configs.apply([row(OTHER)]), [GUILD])
    assert.deepEqual(configs.apply("broken"), [])
    const slow = new GuildCommandConfigs({
        list: () => new Promise(() => {}),
        watch: () => () => {},
    })
    const started = Date.now()
    assert.equal(await slow.get(GUILD), null)
    assert.ok(
        Date.now() - started < 2_500,
        "a slow backend never blocks a reply"
    )
})
