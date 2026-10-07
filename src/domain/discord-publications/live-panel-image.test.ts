import assert from "node:assert/strict"
import test from "node:test"

import {
    panelImageFocus,
    panelImageStateWord,
    panelScoreImageAlt,
    panelScoreImageSchema,
} from "./panel-image-model"
import { hllLiveFixture } from "../../infrastructure/testing/hll-live"
import { warconLive } from "../../infrastructure/testing/warcon"
import { hllLiveFacts, wardogsLiveFacts } from "./live-panel"
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
    showScore: true,
    showLeaders: true,
    seedTarget: null,
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

test("server-status mode draws no score, no leaders and no round time (L3-33, L3-43)", () => {
    const facts = hllLiveFacts(hllLiveFixture())
    const model = liveScoreImageModel({
        ...base,
        facts,
        state: "live",
        showScore: false,
    })
    assert.ok(model && model.game === "hell_let_loose")
    assert.equal(model.scoreboard, false)
    assert.equal(panelImageFocus(model), "status")
    assert.equal(panelImageStateWord(model), "Online")
    assert.equal(model.allies.score, null)
    assert.equal(model.axis.score, null)
    assert.equal(model.timeLeftSeconds, null)
    assert.deepEqual(model.leaders, [])
    assert.ok(model.players, "the player count stays")
    assert.doesNotMatch(panelScoreImageAlt(model), /Spojenci 3 : 2/)
})

test("the leaders switch off leaves the top three and the richest player out (L3-36)", () => {
    const hll = liveScoreImageModel({
        ...base,
        facts: hllLiveFacts(hllLiveFixture()),
        state: "live",
        showLeaders: false,
    })
    assert.ok(hll && hll.game === "hell_let_loose")
    assert.deepEqual(hll.leaders, [])
    assert.equal(hll.allies.score, 3, "the score stays")
    assert.equal(panelImageFocus(hll), "score")
    const fixture = warconLive()
    const wardogs = liveScoreImageModel({
        ...base,
        facts: wardogsLiveFacts({
            ...fixture,
            freshness: "fresh" as const,
            playersFreshness: "fresh" as const,
        }),
        state: "live",
        showLeaders: false,
    })
    assert.ok(wardogs && wardogs.game === "wardogs")
    assert.deepEqual(wardogs.leaders, [])
    assert.equal(wardogs.topCash, null)
})

test("an empty server shows its empty state, without score or round time (P4-16, P4-17)", () => {
    const live = hllLiveFixture()
    live.status!.playerCount = 0
    live.players = []
    const model = liveScoreImageModel({
        ...base,
        facts: hllLiveFacts(live),
        state: "empty",
    })
    assert.ok(model && model.game === "hell_let_loose")
    assert.equal(panelImageFocus(model), "empty")
    assert.equal(model.allies.score, null)
    assert.equal(model.timeLeftSeconds, null)
    assert.deepEqual(model.leaders, [])
    assert.match(panelScoreImageAlt(model), /Na serveru teď nikdo nehraje/)
})

test("a running seed shows its progress toward the threshold (P4-18, P5-15)", () => {
    const live = hllLiveFixture()
    live.status!.playerCount = 12
    const model = liveScoreImageModel({
        ...base,
        facts: hllLiveFacts(live),
        state: "seeding",
        seedTarget: 40,
    })
    assert.ok(model && model.game === "hell_let_loose")
    assert.equal(model.seedTarget, 40)
    assert.equal(panelImageFocus(model), "seed")
    assert.equal(model.players?.count, 12)
    assert.equal(model.allies.score, null)
    assert.deepEqual(model.leaders, [])
    assert.match(panelScoreImageAlt(model), /seed do 40/)
    const live2 = liveScoreImageModel({
        ...base,
        facts: hllLiveFacts(live),
        state: "live",
        seedTarget: 40,
    })
    assert.equal(
        live2?.seedTarget,
        null,
        "only a seeding server shows the seed"
    )
})
