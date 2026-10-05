import assert from "node:assert/strict"
import test from "node:test"

import { hllLiveFixture } from "../../infrastructure/testing/hll-live"
import { warconLive } from "../../infrastructure/testing/warcon"
import { hllLiveFacts, wardogsLiveFacts } from "./live-panel"
import { panelScoreImageSchema } from "./panel-image-model"
import { liveScoreImageModel } from "./live-panel-image"

const base = {
    language: "cs",
    timeZone: "Europe/Prague",
    renderedAt: Date.parse("2026-10-04T00:00:30.000Z"),
    accentColor: "#E8A33D",
    serverName: "Vlci #1 · Public",
    newMap: false,
    background: null,
    showQueue: true,
    showNextMap: true,
    joinCode: null,
}

test("the HLL score image carries the same facts as the text and validates", () => {
    const live = hllLiveFixture()
    live.status!.queueCount = 3
    const model = liveScoreImageModel({
        ...base,
        facts: hllLiveFacts(live),
        state: "live",
    })
    assert.ok(model)
    assert.equal(panelScoreImageSchema.safeParse(model).success, true)
    assert.equal(model.game, "hell_let_loose")
    assert.equal(model.accentColor, "#e8a33d")
    assert.deepEqual(model.players, { count: 2, capacity: 100, queue: 3 })
    if (model.game === "hell_let_loose") {
        assert.equal(model.allies.score, 3)
        assert.equal(model.leaders[0]?.name, "Synthetic Allied")
    }
    assert.doesNotMatch(JSON.stringify(model), /76561198/)
})

test("a paused panel draws no image; switched-off facts are left out", () => {
    const facts = hllLiveFacts(hllLiveFixture())
    assert.equal(liveScoreImageModel({ ...base, facts, state: "paused" }), null)
    const model = liveScoreImageModel({
        ...base,
        facts: { ...facts, queue: 4 },
        state: "live",
        showQueue: false,
    })
    assert.equal(model?.players?.queue, null)
})

test("Wardogs: factions with points, the join code and the richest player", () => {
    const fixture = warconLive()
    const names = ["Valkyra", "Manticore", "Lonestar"]
    fixture.status.scores = fixture.status.scores.map((score, index) => ({
        ...score,
        name: names[index]!,
    }))
    const data = {
        ...fixture,
        freshness: "fresh" as const,
        playersFreshness: "fresh" as const,
    }
    const model = liveScoreImageModel({
        ...base,
        facts: wardogsLiveFacts(data),
        state: "live",
        joinCode: "WD-4821",
    })
    assert.ok(model && model.game === "wardogs")
    assert.equal(panelScoreImageSchema.safeParse(model).success, true)
    assert.equal(model.joinCode, "WD-4821")
    assert.deepEqual(
        model.factions.map((faction) => [faction.faction, faction.points]),
        [
            ["valkyra", 0],
            ["manticore", 12],
            ["lonestar", 7],
        ]
    )
    assert.equal(model.topCash?.value, 350)
    const bad = liveScoreImageModel({
        ...base,
        facts: wardogsLiveFacts(data),
        state: "live",
        joinCode: "not a code",
    })
    assert.equal(bad && bad.game === "wardogs" ? bad.joinCode : "x", null)
})
