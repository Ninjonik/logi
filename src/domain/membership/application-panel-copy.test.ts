import assert from "node:assert/strict"
import test from "node:test"

import {
    applicationPanelDefaults,
    getApplicationMessages,
} from "../../lib/clan-language/application"

import {
    defaultPanelText,
    defaultPanelTitle,
    effectivePanelCopy,
    isDefaultPanelText,
    isDefaultPanelTitle,
} from "./application-panel-copy"

const cs = getApplicationMessages("cs").panel
const en = getApplicationMessages("en").panel
const de = getApplicationMessages("de").panel

test("the default is the board copy in the clan language, with 'ty' (N4-07, N4-08)", () => {
    assert.equal(defaultPanelTitle(cs, "Vlci"), "Přidej se ke klanu Vlci")
    assert.equal(defaultPanelTitle(cs, "  "), "Přidej se k nám")
    assert.equal(
        defaultPanelText(cs, 3),
        "Vyber, jak s námi chceš hrát. Přihláška má tři krátká okna a zabere pár minut."
    )
    assert.match(defaultPanelText(cs, 2), /dvě krátká okna/)
    assert.equal(defaultPanelTitle(en, "Vlci"), "Join the Vlci clan")
    assert.equal(defaultPanelTitle(de, "Vlci"), "Werde Teil des Clans Vlci")
    assert.match(defaultPanelText(de, 3), /^Wähl aus, wie du mit uns/)
})

test("old and other-language defaults are recognised; custom text is not", () => {
    for (const title of [
        "",
        "Přihlásit se do klanu",
        "Apply to the clan",
        "Bewirb dich beim Clan",
        "Join the Vlci clan",
        "Přidej se k nám",
    ])
        assert.equal(
            isDefaultPanelTitle(title, "Vlci", applicationPanelDefaults),
            true,
            title
        )
    assert.equal(
        isDefaultPanelTitle(
            "Přidej se ke klanu Vlci CZ",
            "Vlci",
            applicationPanelDefaults
        ),
        false
    )
    assert.equal(
        isDefaultPanelText(
            "Wähle die Bewerbungsart, die zu dir passt. Wenn uns deine Plattform-ID noch fehlt, führen wir dich zuerst hindurch.",
            applicationPanelDefaults
        ),
        true
    )
    assert.equal(
        isDefaultPanelText(en.defaultText.two, applicationPanelDefaults),
        true
    )
    assert.equal(
        isDefaultPanelText(
            "Hrajeme HLL každý týden.",
            applicationPanelDefaults
        ),
        false
    )
})

test("the panel shows the default for the current windows, or the clan's own text", () => {
    assert.deepEqual(
        effectivePanelCopy(
            {
                title: "Přihlásit se do klanu",
                text: cs.defaultText.three,
                clanName: "Vlci",
                windows: 2,
            },
            cs,
            applicationPanelDefaults
        ),
        {
            title: "Přidej se ke klanu Vlci",
            text: cs.defaultText.two,
            defaultText: true,
        }
    )
    assert.deepEqual(
        effectivePanelCopy(
            {
                title: "Nábor otevřen",
                text: "Hrajeme Hell Let Loose a Wardogs.",
                clanName: "Vlci",
                windows: 3,
            },
            cs,
            applicationPanelDefaults
        ),
        {
            title: "Nábor otevřen",
            text: "Hrajeme Hell Let Loose a Wardogs.",
            defaultText: false,
        }
    )
})
