import assert from "node:assert/strict"
import test from "node:test"

import { buildMatchRecapCopy } from "./match-recaps"

test("builds match recap copy in the configured clan language", () => {
    const recap = {
        userId: "user-1",
        eventName: "Operation Test",
        mapName: "Foy",
        kills: 28,
        deaths: 16,
        kd: 1.75,
        previousTen: { matches: 4, kills: 21.5, deaths: 18.2, kd: 1.18 },
    }

    const czech = buildMatchRecapCopy("cs", recap)

    assert.equal(czech.title, "Shrnutí zápasu - Operation Test")
    assert.match(czech.description, /28.*zabití/)
    assert.match(czech.comparisonTitle, /předchozími zápasy/)
    assert.equal(czech.viewStats, "Zobrazit veřejné statistiky zápasu")
})

test("uses localized fallback comparison copy when no history exists", () => {
    const german = buildMatchRecapCopy("de", {
        userId: "user-1",
        eventName: "Operation Test",
        kills: 28,
        deaths: 16,
        kd: 1.75,
    })

    assert.equal(german.comparisonTitle, "Vergleich mit früheren Spielen")
    assert.match(german.comparison, /keine früheren gespeicherten Spiele/)
    assert.equal(german.unsubscribe, "Zusammenfassungen abbestellen")
})
