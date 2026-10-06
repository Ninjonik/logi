import assert from "node:assert/strict"
import test from "node:test"

import { getSeedMessages } from "./seed"

const keys = (value: unknown, prefix = ""): string[] =>
    value && typeof value === "object" && !Array.isArray(value)
        ? Object.entries(value).flatMap(([key, child]) =>
              keys(child, `${prefix}${key}.`)
          )
        : [prefix.slice(0, -1)]

test("cs, en and de have the same seed copy keys", () => {
    const cs = keys(getSeedMessages("cs")).sort()
    assert.deepEqual(keys(getSeedMessages("en")).sort(), cs)
    assert.deepEqual(keys(getSeedMessages("de")).sort(), cs)
    for (const language of ["cs", "en", "de"])
        assert.equal(getSeedMessages(language).weekdays.length, 7)
})

test("the Czech copy is the board's (P5-31 cooldown, P5-13 seeders)", () => {
    const cs = getSeedMessages("cs")
    assert.equal(
        cs.replies.cooldownBody("1 h 20 min", "20:25", 120),
        "Seed lze znovu spustit za 1 h 20 min, ve 20:25. Mezi seedy jsou aspoň 2 hodiny, aby role Seed nedostávala pingy pořád."
    )
    assert.equal(
        cs.replies.cooldownBody("40 min", "18:25", 90),
        "Seed lze znovu spustit za 40 min, v 18:25. Mezi seedy jsou aspoň 90 minut, aby role Seed nedostávala pingy pořád."
    )
    assert.equal(
        cs.call.liveStatus("43", "100", 18),
        "43 / 100 hráčů · díky 18 seederům"
    )
    assert.equal(
        cs.call.liveStatus("43", "100", 1),
        "43 / 100 hráčů · díky 1 seederovi"
    )
    assert.equal(cs.call.liveStatus("43", null, null), "43 hráčů")
    assert.equal(
        cs.call.closeText(1),
        "Už jen 1 hráč do živé hry. Připoj se a dotáhni to s námi."
    )
    assert.equal(cs.call.missingLine(3), "Chybí 3 hráči do živé hry")
    assert.equal(cs.intro.days([6, 5]), "v pátek a v sobotu")
    assert.equal(cs.intro.days([0, 6]), "o víkendu")
    assert.equal(cs.intro.days([3, 1, 5]), "v pondělí, ve středu a v pátek")
    assert.equal(cs.intro.partOfDay(15 * 60), "odpoledne")
    assert.equal(cs.intro.partOfDay(20 * 60), "večer")
    assert.equal(
        cs.control.status("3", "100", "Carentan"),
        "3 / 100 hráčů · Carentan"
    )
    assert.equal(cs.control.status(null, null, null), "? hráčů")
})

test("unknown languages read English and English keeps the same facts", () => {
    const en = getSeedMessages("xx")
    assert.equal(en.locale, "en-GB")
    assert.equal(
        en.replies.cooldownBody("1 h 20 min", "20:25", 120),
        "The next seed can start in 1 h 20 min, at 20:25. Seeds are at least 2 hours apart so the Seed role is not pinged all the time."
    )
    assert.equal(getSeedMessages("de").intro.days([1, 2, 3, 4, 5]), "werktags")
})
