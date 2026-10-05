import {
    candidateWhen,
    fixtureTitle,
    fixtureWhen,
    roundDays,
    sideLabel,
} from "./fixture-format"
import assert from "node:assert/strict"
import test from "node:test"

const zone = "Europe/Prague"
const team = (name: string, shortCode: string | null = null) => ({
    id: name,
    name,
    shortCode,
    logoUrl: null,
    archived: false,
    legacy: false,
})

test("sides show their short code, else their name, and the score once both are known", () => {
    assert.equal(sideLabel(team("Valkyria", "VLK")), "VLK")
    assert.equal(sideLabel(team("Omen")), "Omen")
    assert.deepEqual(
        fixtureTitle({
            sideA: team("Valkyria", "VLK"),
            sideB: team("Defenders", "DEF"),
            scoreA: 3,
            scoreB: 2,
        }),
        { a: "VLK", b: "DEF", score: "3 : 2" }
    )
    assert.equal(
        fixtureTitle({
            sideA: team("A"),
            sideB: team("B"),
            scoreA: 3,
            scoreB: null,
        }).score,
        null
    )
})

test("upcoming fixtures show weekday and time, played ones weekday and date", () => {
    assert.equal(
        fixtureWhen("2026-10-17T16:00:00.000Z", false, "cs", zone),
        "so 18:00"
    )
    assert.equal(
        fixtureWhen("2026-10-04T16:00:00.000Z", true, "cs", zone),
        "ne 4. 10."
    )
    assert.equal(fixtureWhen(null, false, "cs", zone), null)
    assert.equal(fixtureWhen("soon", false, "cs", zone), null)
})

test("a round spans its first to last day, one day stays one date", () => {
    assert.equal(
        roundDays(
            "2026-10-17T16:00:00.000Z",
            "2026-10-18T18:00:00.000Z",
            "cs",
            zone
        )?.replace(/\s/g, " "),
        "17. 10. – 18. 10."
    )
    assert.equal(
        roundDays("2026-10-17T16:00:00.000Z", null, "cs", zone),
        "17. 10."
    )
    assert.equal(roundDays(null, null, "cs", zone), null)
})

test("candidates show weekday, date and time", () => {
    assert.equal(
        candidateWhen("2026-10-18T18:00:00.000Z", "cs", zone),
        "ne 18. 10. 20:00"
    )
    assert.equal(candidateWhen("bad", "cs", zone), "bad")
})
