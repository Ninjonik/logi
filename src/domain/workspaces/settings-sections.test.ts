import assert from "node:assert/strict"
import test from "node:test"

import {
    SETTINGS_SECTIONS,
    isSettingsSectionId,
    mergedSettingsSection,
    settingsMenuSection,
    settingsSectionForRequirement,
    settingsSectionParent,
    settingsSectionStatus,
    settingsSetupProgress,
    visibleSettingsSections,
    type SettingsSnapshot,
} from "./settings-sections"

const empty: SettingsSnapshot = {
    enabledGames: [],
    statsEnabled: false,
    membershipEnabled: false,
    ticketsEnabled: false,
}
const configured: SettingsSnapshot = {
    enabledGames: ["hell_let_loose"],
    announcementsChannelId: "1",
    clanRoleId: "2",
    statsEnabled: true,
    membershipEnabled: true,
    ticketsEnabled: false,
}

test("section ids are unique and recognised", () => {
    const ids = SETTINGS_SECTIONS.map((section) => section.id)
    assert.equal(new Set(ids).size, ids.length)
    assert.ok(isSettingsSectionId("channels"))
    assert.ok(!isSettingsSectionId("system"))
    assert.ok(!isSettingsSectionId("__proto__"))
})

test("sign-in settings live on the website page and old links redirect there", () => {
    assert.ok(!isSettingsSectionId("login"))
    assert.equal(mergedSettingsSection("login"), "website")
    // The /stats page became the commands page (N3).
    assert.equal(mergedSettingsSection("stats"), "commands")
    assert.equal(mergedSettingsSection("website"), undefined)
    assert.equal(mergedSettingsSection("constructor"), undefined)
})

test("the Wardogs League page appears only for Wardogs clans", () => {
    const ids = (games: SettingsSnapshot["enabledGames"]) =>
        visibleSettingsSections(games).map((section) => section.id)
    assert.ok(!ids(["hell_let_loose"]).includes("league"))
    assert.ok(ids(["hell_let_loose", "wardogs"]).includes("league"))
})

test("a new clan sees every required setting as missing", () => {
    assert.deepEqual(settingsSectionStatus("games", empty), {
        state: "attention",
        missing: ["enabledGames"],
    })
    assert.deepEqual(settingsSectionStatus("channels", empty).missing, [
        "announcements",
    ])
    assert.deepEqual(settingsSectionStatus("roles", empty).missing, [
        "clanRole",
    ])
    assert.deepEqual(settingsSetupProgress(empty), {
        done: 0,
        total: 3,
        next: "enabledGames",
    })
})

test("optional features read as on or off and tools have no state", () => {
    assert.equal(settingsSectionStatus("commands", configured).state, "none")
    assert.equal(settingsSectionStatus("tickets", configured).state, "off")
    assert.equal(settingsSectionStatus("imports", configured).state, "none")
})

test("a configured clan has finished setup", () => {
    assert.deepEqual(settingsSetupProgress(configured), {
        done: 3,
        total: 3,
        next: undefined,
    })
})

test("each requirement points at the page that fixes it", () => {
    assert.equal(settingsSectionForRequirement("announcements"), "channels")
    assert.equal(settingsSectionForRequirement("clanRole"), "roles")
    assert.equal(settingsSectionForRequirement("enabledGames"), "games")
})

test("the Matches group holds templates, presets and Discord messages in menu order", () => {
    assert.deepEqual(
        SETTINGS_SECTIONS.filter((section) => section.group === "matches").map(
            (section) => section.id
        ),
        ["match-templates", "presets", "messages"]
    )
    assert.ok(isSettingsSectionId("event-categories"))
    assert.equal(
        SETTINGS_SECTIONS.find((section) => section.id === "event-categories")
            ?.group,
        "clan"
    )
    assert.equal(
        settingsSectionStatus("match-templates", configured).state,
        "none"
    )
})

test("Panely v Discordu sits in the Discord group with Grafika panelů and Seed under it (P1-01, P3-01, P8-01)", () => {
    const ids = SETTINGS_SECTIONS.filter(
        (section) => section.group === "discord"
    ).map((section) => section.id)
    assert.ok(ids.indexOf("discord-panels") < ids.indexOf("commands"))
    assert.equal(settingsSectionParent("panel-graphics"), "discord-panels")
    assert.equal(settingsSectionParent("discord-seed"), "discord-panels")
    assert.equal(settingsSectionParent("discord-panels"), undefined)
    assert.equal(settingsMenuSection("panel-graphics"), "discord-panels")
    assert.equal(settingsMenuSection("commands"), "commands")
    assert.ok(isSettingsSectionId("discord-panels"))
    assert.ok(isSettingsSectionId("discord-seed"))
})
