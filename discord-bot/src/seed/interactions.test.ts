import assert from "node:assert/strict"
import test from "node:test"

import type { ButtonInteraction } from "discord.js"

import {
    fakeInteraction,
    TEST_CHANNEL,
    TEST_GUILD,
    TEST_USER,
} from "../commands/fake-interaction"
import { boardSeedSettings } from "../../../src/infrastructure/testing/in-memory-seed"
import { seedInteractionFeature, type SeedButtonPorts } from "./interactions"
import type { SeedDeliveryState } from "../../../convex/discordSeedBot"
import { createInteractionRegistry } from "../interactions/registry"

const CONNECTION = "gameDataConnections:vlci1"
const ROLE = "333333333333333333"
const SEED = "111111111111111111"
const NOW = Date.parse("2026-10-10T17:05:00Z")

const state: SeedDeliveryState = {
    servers: [
        {
            connectionId: CONNECTION,
            settings: boardSeedSettings({
                seedChannelId: SEED,
                seedRoleId: ROLE,
            }),
            revision: 1,
            name: "Vlci #1",
            gameId: "hell_let_loose",
            reading: null,
            snapshot: null,
            status: "below_start",
            activeRun: null,
            joinUrl: null,
            panel: {
                channelId: "555555555555555555",
                paused: false,
                sent: true,
            },
            control: { outbox: null, message: null },
        },
    ],
    calls: [],
    intros: [],
}

function ports(overrides: Partial<SeedButtonPorts> = {}) {
    const calls: unknown[] = []
    const value: SeedButtonPorts = {
        language: async () => "cs",
        context: async () => ({
            language: "cs",
            timeZone: "Europe/Prague",
            clanName: "Vlci",
            messageStyle: null,
            siteUrl: "https://logi.app",
        }),
        isAdmin: async () => true,
        state: async () => state,
        start: async (input) => {
            calls.push({ start: input })
            return {
                status: "started",
                runId: "run-1",
                startedAt: new Date(NOW).toISOString(),
                channelId: SEED,
                pinged: true,
            }
        },
        stop: async (input) => {
            calls.push({ stop: input })
            return { status: "stopped", runId: "run-1" }
        },
        panel: async (input) => {
            calls.push({ panel: input })
            return { status: "accepted" }
        },
        refresh: async () => {
            calls.push("refresh")
            return { calls: new Map([["run-1", "999999999999999999"]]) }
        },
        planUrl: async () =>
            "https://logi.app/cs/dashboard/servers/s/settings/discord-seed",
        roleOffer: async () => ({ offered: true, seedChannelId: SEED }),
        now: () => NOW,
        ...overrides,
    }
    return { value, calls }
}

function member(initial: string[]) {
    const roles = new Map(initial.map((id) => [id, {}]))
    const changes: string[] = []
    return {
        changes,
        guild: {
            members: {
                fetch: async () => ({
                    roles: {
                        cache: roles,
                        add: async (id: string) => {
                            changes.push(`add:${id}`)
                            roles.set(id, {})
                        },
                        remove: async (id: string) => {
                            changes.push(`remove:${id}`)
                            roles.delete(id)
                        },
                    },
                }),
            },
        },
    }
}

async function click(
    customId: string,
    seedPorts: SeedButtonPorts,
    fields: Record<string, unknown> = {}
) {
    const fake = fakeInteraction<ButtonInteraction>({
        customId,
        id: "123456789012345678",
        member: { displayName: "Kowalski" },
        ...fields,
    })
    const registry = createInteractionRegistry(
        [seedInteractionFeature(seedPorts)],
        { enqueueEventSync: () => {}, triggerPollSoon: () => {} }
    )
    assert.ok(registry.routes().includes("button:seed:"))
    assert.equal(await registry.routeButton(fake.interaction), true)
    return fake
}

test("Spustit seed starts it, draws the call and links it (P5-26, P5-30)", async () => {
    const env = ports()
    const fake = await click(`seed:start:${CONNECTION}`, env.value)
    assert.deepEqual(env.calls[0], {
        start: {
            guildId: TEST_GUILD,
            connectionId: CONNECTION,
            discordUserId: TEST_USER,
            displayName: "Kowalski",
            channelId: TEST_CHANNEL,
            interactionId: "123456789012345678",
        },
    })
    assert.equal(env.calls[1], "refresh")
    const reply = fake.text()
    assert.match(reply, /Seed na Vlci #1 běží/)
    assert.match(reply, /role Seed dostala ping/)
    assert.match(reply, /Otevřít výzvu/)
    assert.match(
        reply,
        /https:\/\/discord.com\/channels\/100000000000000000\/111111111111111111\/999999999999999999/
    )
    assert.equal(
        fake.sent[0]?.kind,
        "edit",
        "a private deferral completed in place"
    )
})

test("a member without the admin role gets the private refusal and nothing runs (P5-29)", async () => {
    for (const admin of [false, null]) {
        const env = ports({ isAdmin: async () => admin })
        const fake = await click(`seed:start:${CONNECTION}`, env.value)
        assert.match(fake.text(), /Na tohle nemáš oprávnění/)
        assert.deepEqual(env.calls, [])
    }
})

test("the cooldown reply names the wait and links the plan (P5-31)", async () => {
    const env = ports({
        start: async () => ({
            status: "cooldown",
            retryAt: "2026-10-10T18:25:00.000Z",
        }),
    })
    const fake = await click(`seed:start:${CONNECTION}`, env.value)
    assert.match(
        fake.text(),
        /Seed lze znovu spustit za 1 h 20 min, ve 20:25\. Mezi seedy jsou aspoň 2 hodiny/
    )
    assert.match(fake.text(), /Naplánovat v Logi/)
})

test("Ukončit seed ends it and redraws", async () => {
    const env = ports()
    const fake = await click(`seed:stop:${CONNECTION}`, env.value)
    assert.equal((env.calls[0] as { stop: unknown }).stop !== undefined, true)
    assert.match(fake.text(), /Seed na Vlci #1 ukončen/)
})

test("Pozastavit panel asks the panels and redraws the control message (P5-32)", async () => {
    const env = ports()
    const fake = await click(`seed:pause:${CONNECTION}`, env.value)
    assert.deepEqual(env.calls[0], {
        panel: {
            guildId: TEST_GUILD,
            actorId: TEST_USER,
            action: "pause",
            connectionId: CONNECTION,
        },
    })
    assert.equal(env.calls[1], "refresh")
    assert.match(fake.text(), /Panel Vlci #1 je pozastavený/)
    assert.match(fake.text(), /Tlačítko se změnilo na Pokračovat/)
    const missing = ports({ panel: async () => ({ status: "not_found" }) })
    assert.match(
        (await click(`seed:refresh:${CONNECTION}`, missing.value)).text(),
        /Server nemá panel/
    )
    const draft = ports({
        panel: async () => ({ status: "rejected", reason: "not_sent" }),
    })
    assert.match(
        (await click(`seed:resume:${CONNECTION}`, draft.value)).text(),
        /Panel ještě není v Discordu/
    )
})

test("Zvát mě na seed toggles the role with a private reply (P5-23, P5-24)", async () => {
    const on = member([])
    const first = await click(`seed:role:${ROLE}`, ports().value, {
        guild: on.guild,
    })
    assert.match(first.text(), /Roli Seed máš zapnutou/)
    assert.deepEqual(on.changes, [`add:${ROLE}`])
    const second = await click(`seed:role:${ROLE}`, ports().value, {
        guild: on.guild,
    })
    assert.match(second.text(), /Roli Seed máš vypnutou/)
    assert.match(second.text(), /Výzvy v <#111111111111111111> uvidíš dál/)
    assert.deepEqual(on.changes, [`add:${ROLE}`, `remove:${ROLE}`])
    const offer = ports({
        roleOffer: async () => ({ offered: false, seedChannelId: null }),
    })
    const stale = await click(`seed:role:${ROLE}`, offer.value, {
        guild: member([]).guild,
    })
    assert.match(stale.text(), /Tohle tlačítko už nefunguje/)
})
