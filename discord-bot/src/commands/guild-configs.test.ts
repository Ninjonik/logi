import { guildCommandConfigFromStored } from "../../../src/domain/discord-commands/guild-config"
import { GuildCommandConfigs } from "./guild-configs"
import assert from "node:assert/strict"
import test from "node:test"

test("cold command reads share one actual request and cannot overwrite a newer subscription", async () => {
    let reads = 0,
        release!: (rows: unknown) => void
    const source = new Promise((resolve) => {
        release = resolve
    })
    const cache = new GuildCommandConfigs({
        list: () => {
            reads++
            return source
        },
        watch: () => () => {},
    })
    const requests = Array.from({ length: 20 }, () => cache.get("guild"))
    await Promise.resolve()
    assert.equal(reads, 1)
    cache.apply([
        guildCommandConfigFromStored({
            config: { guildId: "guild", defaultLanguage: "de" },
        }),
    ])
    release([
        guildCommandConfigFromStored({
            config: { guildId: "guild", defaultLanguage: "cs" },
        }),
    ])
    const values = await Promise.all(requests)
    assert.ok(values.every((value) => value?.language === "de"))
    assert.equal(reads, 1)
})

test("failure backoff prevents repeated global reads", async () => {
    let reads = 0
    const cache = new GuildCommandConfigs({
        list: async () => {
            reads++
            throw Error("offline")
        },
        watch: () => () => {},
    })
    for (let i = 0; i < 20; i++) assert.equal(await cache.get("guild"), null)
    assert.equal(reads, 1)
})

test("a timed-out request keeps ownership until the backend actually settles", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] })
    let reads = 0,
        release!: (value: unknown) => void
    const pending = new Promise((resolve) => {
        release = resolve
    })
    const cache = new GuildCommandConfigs({
        list: () => {
            reads++
            return pending
        },
        watch: () => () => {},
    })
    const first = cache.get("guild")
    await Promise.resolve()
    t.mock.timers.tick(1500)
    assert.equal(await first, null)
    const next = cache.get("guild")
    await Promise.resolve()
    assert.equal(reads, 1)
    release([])
    assert.equal(await next, null)
})
