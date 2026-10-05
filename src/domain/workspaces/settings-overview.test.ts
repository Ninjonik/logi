import assert from "node:assert/strict"
import test from "node:test"

import {
    settingsSetupSteps,
    settingsTileBadge,
    type SettingsOverviewFacts,
} from "./settings-overview"
import type { SettingsSnapshot } from "./settings-sections"

const snapshot: SettingsSnapshot = {
    enabledGames: ["hell_let_loose", "wardogs"],
    statsEnabled: true,
    membershipEnabled: false,
    ticketsEnabled: false,
}
const facts: SettingsOverviewFacts = {
    botInside: true,
    profile: { name: true, logo: true, description: true },
    templateCount: 3,
    collectingServers: 1,
    failingServers: 0,
    leagueEnabled: false,
}

test("the first unfinished step is next and later ones wait", () => {
    const setup = settingsSetupSteps(snapshot, facts)
    assert.deepEqual(
        setup.steps.map((step) => [step.id, step.state]),
        [
            ["bot", "done"],
            ["games", "done"],
            ["profile", "done"],
            ["channels", "next"],
            ["roles", "todo"],
            ["gameServers", "done"],
        ]
    )
    assert.equal(setup.done, 4)
    assert.equal(setup.total, 6)
    assert.equal(setup.complete, false)
    assert.equal(setup.next?.section, "channels")
})

test("game servers are optional and do not block completion", () => {
    const setup = settingsSetupSteps(
        { ...snapshot, announcementsChannelId: "1", clanRoleId: "2" },
        { ...facts, collectingServers: undefined }
    )
    assert.equal(setup.complete, true)
    assert.equal(setup.next?.id, "gameServers")
    assert.equal(setup.next?.optional, true)
})

test("a missing bot or an incomplete profile is unfinished", () => {
    const setup = settingsSetupSteps(snapshot, {
        ...facts,
        botInside: false,
        profile: { name: true, logo: false, description: true },
    })
    assert.equal(setup.next?.id, "bot")
    assert.equal(setup.next?.section, undefined)
    assert.equal(
        setup.steps.find((step) => step.id === "profile")?.state,
        "todo"
    )
})

test("tiles show counts, missing settings and on/off", () => {
    assert.deepEqual(settingsTileBadge("channels", snapshot, facts), {
        tone: "attention",
        kind: "missingChannels",
        count: 1,
    })
    assert.deepEqual(settingsTileBadge("roles", snapshot, facts), {
        tone: "attention",
        kind: "notSet",
    })
    assert.deepEqual(settingsTileBadge("games", snapshot, facts), {
        tone: "neutral",
        kind: "gamesOn",
        count: 2,
    })
    assert.deepEqual(settingsTileBadge("match-templates", snapshot, facts), {
        tone: "neutral",
        kind: "templates",
        count: 3,
    })
    assert.deepEqual(settingsTileBadge("stats", snapshot, facts), {
        tone: "neutral",
        kind: "on",
    })
    assert.deepEqual(settingsTileBadge("league", snapshot, facts), {
        tone: "neutral",
        kind: "off",
    })
    assert.deepEqual(settingsTileBadge("game-servers", snapshot, facts), {
        tone: "ready",
        kind: "collecting",
        count: 1,
    })
    assert.deepEqual(settingsTileBadge("profile", snapshot, facts), {
        tone: "ready",
        kind: "done",
    })
})

test("unknown facts show no state instead of a guess", () => {
    const unknown = {
        ...facts,
        collectingServers: undefined,
        failingServers: undefined,
        leagueEnabled: undefined,
        templateCount: 0,
    }
    assert.equal(settingsTileBadge("league", snapshot, unknown), null)
    assert.equal(settingsTileBadge("game-servers", snapshot, unknown), null)
    assert.equal(settingsTileBadge("match-templates", snapshot, unknown), null)
    assert.equal(settingsTileBadge("webhooks", snapshot, unknown), null)
})

test("a failing game server outranks the collecting count", () => {
    assert.deepEqual(
        settingsTileBadge("game-servers", snapshot, {
            ...facts,
            failingServers: 1,
        }),
        { tone: "attention", kind: "failing", count: 1 }
    )
})
