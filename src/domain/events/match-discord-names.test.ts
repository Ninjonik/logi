import assert from "node:assert/strict"
import test from "node:test"

import { getAnnouncementMessages } from "@/lib/clan-language/announcements"

import {
    matchRoleNames,
    squadCategoryName,
    squadKindOf,
    squadVoiceChannelName,
} from "./match-discord-names"

const cs = getAnnouncementMessages("cs")

test("match roles carry the clan-language suffix (L1-145)", () => {
    assert.deepEqual(matchRoleNames("VLK vs ROG", cs), {
        players: "VLK vs ROG · Hráči",
        reserves: "VLK vs ROG · Zálohy",
    })
    assert.deepEqual(
        matchRoleNames("VLK vs ROG", getAnnouncementMessages("en")),
        {
            players: "VLK vs ROG · Players",
            reserves: "VLK vs ROG · Reserves",
        }
    )
    assert.equal(matchRoleNames("x".repeat(200), cs).players.length, 100)
})

test("squad voice channels sit in the match's own category (L1-144)", () => {
    assert.equal(squadCategoryName("VLK vs ROG", cs), "Čety · VLK vs ROG")
    assert.equal(
        squadCategoryName("VLK vs ROG", getAnnouncementMessages("en")),
        "Squads · VLK vs ROG"
    )
    assert.equal(
        squadCategoryName("VLK vs ROG", getAnnouncementMessages("de")),
        "Trupps · VLK vs ROG"
    )
    assert.equal(squadCategoryName("Liga\n kolo 3", cs), "Čety · Liga kolo 3")
    assert.equal(squadCategoryName("x".repeat(200), cs).length, 100)
})

test("squad voice channels say what the squad is (L1-144)", () => {
    assert.equal(
        squadVoiceChannelName({ name: "F1", group: "Infantry" }, cs),
        "F1 · Pěchota"
    )
    assert.equal(
        squadVoiceChannelName({ name: "T2", group: "Armor" }, cs),
        "T2 · Tanky"
    )
    assert.equal(
        squadVoiceChannelName({ name: "R1", group: "Recon" }, cs),
        "R1 · Průzkum"
    )
    assert.equal(
        squadVoiceChannelName({ name: "CMD", group: "Command" }, cs),
        "CMD · Velení"
    )
    assert.equal(
        squadVoiceChannelName({ name: "Alfa", group: "Speciál" }, cs),
        "Alfa · Speciál"
    )
    assert.equal(squadVoiceChannelName({ name: "Alfa", group: "" }, cs), "Alfa")
})

test("a squad's kind comes from its group, else its name", () => {
    assert.equal(squadKindOf({ name: "F1", group: "INF" }), "infantry")
    assert.equal(squadKindOf({ name: "Arty", group: "" }), "artillery")
    assert.equal(squadKindOf({ name: "CMD", group: null }), "command")
    assert.equal(squadKindOf({ name: "T1", group: "Tanky" }), "armor")
    assert.equal(squadKindOf({ name: "X", group: "Ostatní" }), null)
})
