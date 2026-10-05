import assert from "node:assert/strict"
import test from "node:test"

import {
    SETTINGS_SECTIONS,
    isSettingsSectionId,
    mergedSettingsSection,
    settingsSectionForRequirement,
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
    assert.equal(settingsSectionStatus("stats", configured).state, "ready")
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
