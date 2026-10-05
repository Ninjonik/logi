import assert from "node:assert/strict"
import test from "node:test"

import {
    requestPanelAction,
    type PanelActionPanel,
    type PanelActionStore,
} from "./panel-actions"
import type { PanelActionPatch } from "@/domain/discord-publications/panel-delivery"

function store(panels: PanelActionPanel[]) {
    const patches: Array<[string, PanelActionPatch]> = []
    const resets: Array<[string, string, boolean]> = []
    const value: PanelActionStore = {
        panel: async (guildId, panelId) =>
            panels.find(
                (panel) => panel.id === panelId && panel.guildId === guildId
            ) ?? null,
        patch: async (panelId, patch) => {
            patches.push([panelId, patch])
        },
        resetDelivery: async (guildId, panelId, options) => {
            resets.push([guildId, panelId, options.abandonPending])
        },
    }
    return { value, patches, resets }
}

const panel: PanelActionPanel = {
    id: "p1",
    guildId: "g1",
    draft: true,
    paused: false,
    removing: false,
}
const input = {
    guildId: "g1",
    panelId: "p1",
    actorId: "100000000000000001",
    now: 1_000,
}

test("Odeslat do kanálu stamps the request and clears the retry wait", async () => {
    const fake = store([panel])
    const result = await requestPanelAction(fake.value, {
        ...input,
        action: "publish",
    })
    assert.deepEqual(result, {
        status: "accepted",
        action: "publish",
        requestedAt: 1_000,
    })
    assert.equal(fake.patches[0]?.[1].draft, false)
    assert.deepEqual(fake.resets, [["g1", "p1", false]])
})

test("Pozastavit writes the real flag and does not touch delivery", async () => {
    const fake = store([{ ...panel, draft: false }])
    await requestPanelAction(fake.value, { ...input, action: "pause" })
    assert.equal(fake.patches[0]?.[1].paused, true)
    assert.equal(fake.patches[0]?.[1].pausedBy, input.actorId)
    assert.deepEqual(fake.resets, [])
})

test("Zkusit znovu abandons an unconfirmed create", async () => {
    const fake = store([{ ...panel, draft: false }])
    await requestPanelAction(fake.value, { ...input, action: "retry" })
    assert.deepEqual(fake.resets, [["g1", "p1", true]])
})

test("another workspace's panel is not found and nothing is written", async () => {
    const fake = store([panel])
    assert.deepEqual(
        await requestPanelAction(fake.value, {
            ...input,
            guildId: "g2",
            action: "publish",
        }),
        { status: "not_found" }
    )
    assert.equal(fake.patches.length, 0)
})

test("a refresh of an unsent panel is rejected with its reason", async () => {
    const fake = store([panel])
    assert.deepEqual(
        await requestPanelAction(fake.value, { ...input, action: "refresh" }),
        { status: "rejected", reason: "not_sent" }
    )
    assert.equal(fake.patches.length, 0)
})
