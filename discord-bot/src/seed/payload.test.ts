import assert from "node:assert/strict"
import test from "node:test"

import { MessageFlags } from "discord.js"

import {
    seedCallLead,
    seedCallView,
} from "../../../src/domain/discord-seed/views"
import { getSeedMessages } from "../../../src/lib/clan-language/seed"
import { publicationCreatePayload } from "../sync/publication-marker"
import { startSeedRun } from "../../../src/domain/discord-seed/run"
import { seedMessagePayload } from "./payload"

const ROLE = "333333333333333333"
const cs = getSeedMessages("cs")
const run = startSeedRun({
    trigger: { kind: "auto", below: 20 },
    now: Date.parse("2026-10-10T15:40:00Z"),
    plan: { liveFrom: 40, maxDurationMinutes: 120, endAction: "edit" },
    ping: { kind: "role", roleId: ROLE },
    observation: {
        players: 12,
        capacity: 100,
        map: "Foy",
        observedAt: Date.parse("2026-10-10T15:40:00Z"),
    },
})
const view = seedCallView({
    run,
    server: { name: "Vlci #1", gameId: "hell_let_loose" },
    mapLine: "Foy · Warfare · Den",
    template: null,
    roleButton: { roleId: ROLE },
    joinUrl: "https://logi.app/join/vlci-1",
    thumbnail: null,
    updatedAt: run.startedAt,
    timeZone: "Europe/Prague",
    locale: cs.locale,
    copy: cs,
})
const json = (value: unknown) => JSON.parse(JSON.stringify(value))

test("the call pings only the Seed role, from the line above the card (P5-07)", () => {
    const payload = seedMessagePayload(
        view,
        { language: "cs" },
        seedCallLead(run)
    )
    assert.equal(payload.flags, MessageFlags.IsComponentsV2)
    assert.deepEqual(payload.allowedMentions, { parse: [], roles: [ROLE] })
    const [lead, card] = (payload.components ?? []).map((component) =>
        json(component)
    )
    assert.equal(lead.type, 10, "a text display outside the card")
    assert.equal(lead.content, `<@&${ROLE}>`)
    assert.equal(card.type, 17, "the kit's container")
    assert.equal(card.accent_color, 0xe8a33d, "the clan accent")
    const created = publicationCreatePayload(payload, "logi:publication:x:1")
    assert.deepEqual(
        created.allowedMentions,
        { parse: [], roles: [ROLE] },
        "the managed publisher keeps the ping on create; its edits send none"
    )
})

test("messages without a ping line mention nobody", () => {
    const payload = seedMessagePayload(view, { language: "cs" })
    assert.deepEqual(payload.allowedMentions, { parse: [] })
    assert.equal(payload.components?.length, 1)
})
