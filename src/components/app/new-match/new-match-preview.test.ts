import assert from "node:assert/strict"
import test from "node:test"

import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"

import { getDictionary } from "@/i18n/dictionaries"

import { NewMatchPreview, type NewMatchPreviewModel } from "./new-match-preview"

const dictionary = getDictionary("cs")

const model: NewMatchPreviewModel = {
    kind: "match",
    language: "cs",
    timeZone: "Europe/Prague",
    title: "Liga · kolo 3",
    categoryLabel: "Přátelák",
    categoryColor: "#3BA55C",
    teams: [
        { code: "VLK", side: "Allies" },
        { code: "ROG", side: "Axis" },
    ],
    map: { name: "Foy", time: "day" },
    mapImageUrl: "/maps/foy.webp",
    cap: null,
    meetingStart: "2026-10-11T17:30:00.000Z",
    gameStart: "2026-10-11T18:00:00.000Z",
    registrationEnd: "2026-10-10T17:30:00.000Z",
    groups: [{ name: "Pěchota" }, { name: "Tanky", max: 6 }],
    mentions: ["Klan"],
    forum: true,
    notes: "Tanky drží střed, F2 brání. Mikrofon povinný.",
    signups: { total: 17, byGroup: { Pěchota: 12, Tanky: 4 } },
}

const textOf = (html: string) =>
    html
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()

test("the new-match preview draws the bot's own announcement card", () => {
    const html = renderToStaticMarkup(
        createElement(NewMatchPreview, {
            model,
            step: "match",
            dictionary,
            copy: dictionary.newMatch.preview,
        })
    )
    const text = textOf(html)
    assert.match(text, /@Klan/)
    assert.match(text, /VLK vs ROG/)
    assert.match(text, /Přátelák/)
    assert.match(text, /Spojenci ★ vs ROG Osa ✚|Spojenci ★/)
    assert.match(text, /Foy · den/)
    assert.match(text, /Přihlášky otevřené/)
    assert.match(text, /Přihlášeno 17/)
    assert.match(text, /Tanky 4\/6/)
    assert.match(text, /Přihlásit se/)
    assert.match(text, /Upravit přihlášku/)
    assert.match(text, /Nepřijdu/)
    assert.match(text, /Zobrazit přihlášené/)
    assert.match(text, /Přidat do kalendáře/)
    assert.match(text, /Fórum zápasu/)
    assert.match(text, /Spravováno v Logi/)
    assert.match(html, /src="\/maps\/foy.webp"/)
    // One clan colour, not the category's.
    assert.match(html, /border-left-color:#e8a33d/i)
})

test("a training preview shows its server and no teams or map", () => {
    const text = textOf(
        renderToStaticMarkup(
            createElement(NewMatchPreview, {
                model: {
                    ...model,
                    kind: "training",
                    title: "komunikace a souhra",
                    teams: [],
                    server: "Vlci Trénink",
                    forum: false,
                },
                step: "match",
                dictionary,
                copy: dictionary.newMatch.preview,
            })
        )
    )
    assert.match(text, /Trénink · komunikace a souhra/)
    assert.match(text, /server Vlci Trénink/)
    assert.doesNotMatch(text, /Spojenci|Foy|Fórum zápasu/)
})
