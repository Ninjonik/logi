import assert from "node:assert/strict"
import test from "node:test"

import {
    SEED_TEMPLATE_TOKENS,
    renderSeedTemplate,
    unknownSeedTemplatePlaceholders,
} from "./template"

const values = {
    server: "Vlci #1 · Public",
    players: 12,
    missing: 28,
    threshold: 40,
}

test("the board's call text fills the threshold (P3-16, P3-19)", () => {
    assert.equal(
        renderSeedTemplate(
            "Server se rozjíždí. Připoj se a pomoz ho naplnit; jakmile bude {hranice} hráčů, hraje se naostro.",
            values
        ),
        "Server se rozjíždí. Připoj se a pomoz ho naplnit; jakmile bude 40 hráčů, hraje se naostro."
    )
})

test("every insert chip of every clan language renders", () => {
    for (const tokens of Object.values(SEED_TEMPLATE_TOKENS))
        assert.equal(
            renderSeedTemplate(
                `${tokens.server}|${tokens.players}|${tokens.missing}|${tokens.threshold}`,
                values
            ),
            "Vlci #1 · Public|12|28|40"
        )
    assert.equal(
        renderSeedTemplate("{hraci}/{chybi}/{HRÁČI}", values),
        "12/28/12",
        "ASCII and upper-case spellings work"
    )
})

test("unknown counts read as a question mark", () => {
    assert.equal(
        renderSeedTemplate("{hráči} / {chybí}", {
            ...values,
            players: null,
            missing: null,
        }),
        "? / ?"
    )
})

test("unknown placeholders are listed once and left as written", () => {
    const text = "{hrac} {hrac} {server} {foo} {} {a b}"
    assert.deepEqual(unknownSeedTemplatePlaceholders(text), ["{hrac}", "{foo}"])
    assert.equal(
        renderSeedTemplate(text, values),
        "{hrac} {hrac} Vlci #1 · Public {foo} {} {a b}"
    )
    assert.deepEqual(unknownSeedTemplatePlaceholders("Bez zástupců."), [])
})
