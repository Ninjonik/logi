import assert from "node:assert/strict"
import test from "node:test"

import {
    firstUnfinishedGuidedStep,
    guidedSetupView,
    isGuidedSetupPosition,
    openingGuidedSetupStep,
    parseGuidedSetupStep,
} from "./guided-setup"
import {
    settingsSetupSteps,
    type SettingsOverviewFacts,
} from "./settings-overview"
import type { SettingsSnapshot } from "./settings-sections"

const snapshot: SettingsSnapshot = {
    enabledGames: ["hell_let_loose", "wardogs"],
    statsEnabled: false,
    membershipEnabled: false,
    ticketsEnabled: false,
}
const facts: SettingsOverviewFacts = {
    botInside: true,
    profile: { name: true, logo: true, description: false },
    templateCount: 0,
}
/** Bot, games and profile done; channels, roles and game servers open (design B, step 4). */
const steps = settingsSetupSteps(snapshot, facts).steps

test("the step address accepts step IDs and the closing screen", () => {
    assert.equal(parseGuidedSetupStep("channels"), "channels")
    assert.equal(parseGuidedSetupStep(" gameServers "), "gameServers")
    assert.equal(parseGuidedSetupStep("gameservers"), "gameServers")
    assert.equal(parseGuidedSetupStep("roles"), "roles")
    assert.equal(parseGuidedSetupStep("ROLES"), "roles")
    assert.equal(parseGuidedSetupStep("done"), "done")
    assert.equal(isGuidedSetupPosition("bot"), true)
    assert.equal(isGuidedSetupPosition("game-servers"), false)
})

test("an unknown, empty or repeated step address is no position", () => {
    assert.equal(parseGuidedSetupStep(undefined), undefined)
    assert.equal(parseGuidedSetupStep(null), undefined)
    assert.equal(parseGuidedSetupStep(""), undefined)
    assert.equal(parseGuidedSetupStep("4"), undefined)
    assert.equal(parseGuidedSetupStep("settings"), undefined)
    assert.equal(parseGuidedSetupStep(["bot", "games"]), undefined)
})

test("the guide opens on the first unfinished step", () => {
    assert.equal(firstUnfinishedGuidedStep(steps), "channels")
    assert.equal(openingGuidedSetupStep(undefined, steps), "channels")
    assert.equal(openingGuidedSetupStep("nonsense", steps), "channels")
})

test("an explicit step wins, even a finished one", () => {
    assert.equal(openingGuidedSetupStep("bot", steps), "bot")
    assert.equal(openingGuidedSetupStep("done", steps), "done")
})

test("an unfinished optional step still counts as unfinished", () => {
    const required = settingsSetupSteps(
        { ...snapshot, announcementsChannelId: "1", clanRoleId: "2" },
        facts
    ).steps
    assert.equal(firstUnfinishedGuidedStep(required), "gameServers")
})

test("with every step finished the guide opens on the closing screen", () => {
    const all = settingsSetupSteps(
        { ...snapshot, announcementsChannelId: "1", clanRoleId: "2" },
        { ...facts, collectingServers: 1 }
    ).steps
    assert.equal(firstUnfinishedGuidedStep(all), "done")
    assert.equal(openingGuidedSetupStep(undefined, all), "done")
})

test("the step list marks finished, open and waiting steps", () => {
    const view = guidedSetupView(steps, "channels")
    assert.deepEqual(
        view.items.map((item) => [item.id, item.number, item.marker]),
        [
            ["bot", 1, "done"],
            ["games", 2, "done"],
            ["profile", 3, "done"],
            ["channels", 4, "current"],
            ["roles", 5, "todo"],
            ["gameServers", 6, "todo"],
        ]
    )
    assert.equal(view.done, 3)
    assert.equal(view.total, 6)
    assert.equal(view.current?.number, 4)
    assert.equal(view.current?.last, false)
    assert.equal(view.previous, "profile")
    assert.equal(view.next, "roles")
})

test("a reopened finished step shows its number, later finished steps their check", () => {
    const withServers = settingsSetupSteps(snapshot, {
        ...facts,
        collectingServers: 2,
    }).steps
    const view = guidedSetupView(withServers, "games")
    assert.equal(view.items[1]?.marker, "current")
    assert.equal(view.items[5]?.marker, "done")
    assert.equal(view.done, 4)
    assert.equal(view.previous, "bot")
})

test("the first step has no way back and the last leads to the closing screen", () => {
    const first = guidedSetupView(steps, "bot")
    assert.equal(first.previous, undefined)
    assert.equal(first.next, "games")
    const last = guidedSetupView(steps, "gameServers")
    assert.equal(last.current?.last, true)
    assert.equal(last.current?.optional, true)
    assert.equal(last.next, "done")
})

test("the closing screen has no open step", () => {
    const view = guidedSetupView(steps, "done")
    assert.equal(view.current, undefined)
    assert.equal(view.previous, undefined)
    assert.equal(view.next, undefined)
    assert.ok(view.items.every((item) => item.marker !== "current"))
})
