import assert from "node:assert/strict"
import test from "node:test"

import {
    buildAttendanceDeclineModal,
    declineRefusal,
    declineReply,
} from "./attendance-decline"
import { getDirectMessages } from "../../../src/lib/clan-language/direct-messages"
import type { DiscordConfig, EventRecord, Roster } from "../types"

const copy = getDirectMessages("cs")
const frame = {
    clanName: "Vlci",
    settingsUrl: "https://logi.example/cs/dashboard/settings/user",
    timeZone: "Europe/Prague",
}
const dm = { dm: true, frame }
const roster: Roster = {
    id: "roster-1",
    eventId: "event-1",
    published: true,
    reservePlayerIds: ["reserve"],
    updatedAt: "2026-10-10T10:00:00.000Z",
    squads: [
        {
            name: "Able",
            group: "inf",
            color: "#000",
            order: 1,
            players: [{ id: "medic", ack: false, roleName: "Medic" }],
        },
    ],
}
const event = {
    id: "event-1",
    name: "Liga",
    status: "starting",
    gameStart: "2026-10-11T18:00:00.000Z",
    matchTeams: [
        {
            teamId: "a",
            slot: "a",
            side: "Allies",
            snapshot: { name: "Vlci", shortCode: "VLK" },
        },
        {
            teamId: "b",
            slot: "b",
            side: "Axis",
            snapshot: { name: "Rogue", shortCode: "ROG" },
        },
    ],
} as unknown as EventRecord
const config = { defaultLanguage: "cs" } as DiscordConfig
const before = Date.parse("2026-10-11T17:00:00.000Z")

test("only rostered players can open the decline form before the game starts", () => {
    assert.equal(
        declineRefusal({ event, roster }, "medic", copy, dm, before),
        null
    )
    assert.equal(
        declineRefusal({ event, roster }, "reserve", copy, dm, before),
        null
    )
    assert.equal(
        declineRefusal({ event, roster }, "stranger", copy, dm, before)?.header
            ?.title,
        "Na soupisce nejsi"
    )
    assert.equal(
        declineRefusal(
            { event, roster: { ...roster, published: false } },
            "medic",
            copy,
            dm,
            before
        )?.header?.title,
        "Soupiska ještě není zveřejněná"
    )
    const late = declineRefusal(
        { event, roster },
        "medic",
        copy,
        dm,
        Date.parse(event.gameStart)
    )
    assert.equal(late?.header?.title, "Zápas už začal")
    assert.equal(late?.footer?.kind, "dm")
})

test("the reply card tells the player what happened in the clan language", () => {
    const saved = declineReply(
        { ok: true, changed: true, rejected: null },
        copy,
        {
            ...dm,
            squad: "F1",
        }
    )
    assert.equal(saved.header?.title, "Velení ví, že nedorazíš")
    assert.deepEqual(saved.blocks, [
        {
            kind: "text",
            markdown:
                "Tvoje místo v F1 obsadí někdo ze záloh. Díky, že dáváš vědět včas.",
        },
        // The board's divider above the DM footer (L2-34).
        { kind: "separator", divider: true, spacing: "small" },
    ])
    assert.equal(saved.ephemeral, undefined)
    assert.equal(
        declineReply({ ok: true, changed: false, rejected: null }, copy, dm)
            .header?.title,
        "Velení už ví, že nedorazíš"
    )
    assert.equal(
        declineReply(
            { ok: false, changed: false, rejected: "too_late" },
            copy,
            dm
        ).header?.title,
        "Zápas už začal"
    )
    // In the server the reply is private and has no DM footer.
    const inGuild = declineReply(
        { ok: false, changed: false, rejected: "not_on_roster" },
        copy,
        { dm: false }
    )
    assert.equal(inGuild.ephemeral, true)
    assert.equal(inGuild.footer, undefined)
})

test("the decline form names the match and asks for an optional reason", () => {
    const modal = buildAttendanceDeclineModal({ config, event }).toJSON()
    assert.equal(modal.custom_id, "attendance-decline-modal:event-1")
    assert.equal(modal.title, "Nemůžu přijít · VLK vs ROG")
    const row = modal.components[0]
    const input = row && "components" in row ? row.components[0] : undefined
    assert.ok(input && "custom_id" in input)
    assert.equal(input.custom_id, "reason")
    assert.equal(input.required, false)
    assert.equal(input.max_length, 500)
    assert.equal(
        "placeholder" in input ? input.placeholder : undefined,
        "Např. nemoc, práce"
    )
    assert.equal(
        "label" in input ? input.label : undefined,
        "Důvod, uvidí ho jen velení"
    )
    for (const language of ["en", "de"] as const) {
        const replies = getDirectMessages(language).replies
        assert.ok(replies.declineLabel.length <= 45)
        assert.ok(replies.lateLabel.length <= 45)
    }
})
