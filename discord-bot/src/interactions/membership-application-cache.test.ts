import assert from "node:assert/strict"
import test from "node:test"

import {
    APPLICANT_STATE_TTL_MS,
    ApplicationStateCache,
} from "./membership-application-cache"
import type { ApplicationState } from "./membership-application-store"

const definition = {
    guildId: "123456789012345678",
    enabled: true,
    webFormEnabled: false,
    language: "cs",
    timeZone: "Europe/Prague",
    clanName: "Vlci",
    guildRecordId: "guild-record",
    panelChannelId: "555",
    parentChannelId: "666",
    ticketChannelId: null,
    form: { about: [], accounts: [], questionWindows: [] },
    categories: [],
    messageStyle: null,
}

const applicant = {
    openApplication: null,
    assignedGames: [],
    draft: null,
    verifiedSteamId: "76561198000000017",
    previousPlayers: [],
    linkedPlatformIds: ["xbox:Hrac17CZ"],
}

test("the live definitions open a window without a read; unknown applicants start empty", () => {
    const cache = new ApplicationStateCache(() => 0)
    assert.equal(cache.peek(definition.guildId, "1"), undefined)
    cache.applyDefinitions([definition, { guildId: 7 }, null])
    const peeked = cache.peek(definition.guildId, "1")
    assert.equal(peeked?.known, false)
    assert.equal(peeked?.state.enabled, true)
    assert.equal(peeked?.state.draft, null)
    assert.deepEqual(peeked?.state.linkedPlatformIds, [])
    // A settings change replaces the definition (switched off here).
    cache.applyDefinitions([{ ...definition, enabled: false }])
    assert.equal(cache.peek(definition.guildId, "1")?.state.enabled, false)
    cache.applyDefinitions([])
    assert.equal(cache.peek(definition.guildId, "1"), undefined)
})

test("a read remembers the applicant; old entries are not trusted", () => {
    let now = 1_000
    const cache = new ApplicationStateCache(() => now)
    const { guildId, ...clan } = definition
    const state = { ...clan, ...applicant } as ApplicationState
    cache.remember(guildId, "1", state)
    const peeked = cache.peek(guildId, "1")
    assert.equal(peeked?.known, true)
    assert.equal(peeked?.state.verifiedSteamId, "76561198000000017")
    cache.update(guildId, "1", {
        openApplication: { number: 42, threadId: "999" },
    })
    assert.deepEqual(cache.applicant(guildId, "1")?.openApplication, {
        number: 42,
        threadId: "999",
    })
    now += APPLICANT_STATE_TTL_MS + 1
    assert.equal(cache.applicant(guildId, "1"), undefined)
    assert.equal(cache.peek(guildId, "1")?.known, false)
    // A clan without membership settings has no definition.
    cache.remember(guildId, "1", null)
    assert.equal(cache.peek(guildId, "1"), undefined)
})

test("the subscription feeds the definitions", () => {
    const cache = new ApplicationStateCache(() => 0)
    let push: (rows: unknown) => void = () => {}
    let stopped = false
    cache.start({
        watch: (onRows) => {
            push = onRows
            return () => {
                stopped = true
            }
        },
    })
    push([definition])
    assert.ok(cache.definition(definition.guildId))
    cache.stop()
    assert.equal(stopped, true)
})
