import assert from "node:assert/strict"
import test from "node:test"

import {
    resultCardView,
    shortDate,
    type ResultCardEvent,
    type ResultCardInput,
} from "./result-panel"
import { renderedView } from "../../infrastructure/testing/message-views"
import { getPanelMessages } from "../../lib/clan-language/panels"

const copy = getPanelMessages("cs").results
const sideNames: Record<string, string> = {
    allies: "Spojenci",
    axis: "Osa",
}

function input(
    event: Partial<ResultCardEvent> = {},
    overrides: Partial<ResultCardInput> = {}
): ResultCardInput {
    return {
        copy,
        game: "hell_let_loose",
        gameName: "Hell Let Loose",
        locale: "cs-CZ",
        timeZone: "Europe/Prague",
        event: {
            id: "event-1",
            name: "Vlci vs Rogue",
            result: {
                status: "confirmed",
                version: 1,
                reviewedAt: "2026-10-11T20:41:00.000Z",
                participants: [
                    { label: "Allies", score: 4 },
                    { label: "Axis", score: 1 },
                ],
            },
            card: {
                category: "Přátelák",
                side: "Allies",
                teams: [
                    { code: "VLK", side: "Allies" },
                    { code: "ROG", side: "Axis" },
                ],
                reviewer: "Hráč_01",
                publicMatch: true,
                imported: null,
                playedAt: "2026-10-11T18:00:00.000Z",
            },
            matchUrl: "https://logi.app/cs/matches/1",
            ...event,
        },
        mapLabel: "Foy · den",
        sideName: (label) => sideNames[label.toLowerCase()] ?? label,
        sideSign: (label) => (label.toLowerCase() === "allies" ? "★" : "✚"),
        compact: false,
        showMap: true,
        accentColor: null,
        ...overrides,
    }
}

test("an HLL result: VLK 4 : 1 ROG with the outcome chip, map, date, reviewer and match link", () => {
    const view = renderedView(resultCardView(input()))
    assert.deepEqual(view.validation, { ok: true, issues: [] })
    assert.match(view.text, /VÝSLEDEK · PŘÁTELÁK · HELL LET LOOSE/)
    assert.match(view.text, /VLK 4 : 1 ROG/)
    assert.match(view.text, /Výhra/)
    assert.match(view.text, /Spojenci ★ · Osa ✚/)
    assert.match(view.text, /Foy · den · ne 11\. 10\. · potvrdil Hráč\\_01/)
    assert.deepEqual(
        view.buttons.map((button) => button.label),
        ["Zobrazit zápas"]
    )
    assert.doesNotMatch(view.text, /obnovuje se/)
})

test("a correction edits the card and says what the score was", () => {
    const view = renderedView(
        resultCardView(
            input({
                result: {
                    status: "corrected",
                    version: 2,
                    reviewedAt: "2026-10-12T08:00:00.000Z",
                    participants: [
                        { label: "Allies", score: 3 },
                        { label: "Axis", score: 2 },
                    ],
                },
                card: {
                    ...input().event.card!,
                    previous: [
                        { label: "Allies", score: 4 },
                        { label: "Axis", score: 1 },
                    ],
                },
            })
        )
    )
    assert.match(view.text, /OPRAVENO/)
    assert.match(view.text, /VLK 3 : 2 ROG/)
    assert.match(view.text, /opraveno <t:\d+:f> · dřív 4 : 1/)
})

test("a Wardogs result lists places with points and the clan's place chip", () => {
    const view = renderedView(
        resultCardView(
            input(
                {
                    name: "WD liga · kolo 3",
                    result: {
                        status: "confirmed",
                        version: 1,
                        reviewedAt: "2026-10-11T20:41:00.000Z",
                        participants: [
                            { label: "Alpha", score: 12 },
                            { label: "Bravo", score: 23 },
                            { label: "Charlie", score: 7 },
                        ],
                    },
                    card: {
                        category: null,
                        side: "Bravo",
                        teams: [{ code: "VLK", side: "Bravo" }],
                        reviewer: null,
                        publicMatch: false,
                        imported: null,
                        league: {
                            fixtureNumber: 14,
                            type: "league",
                            map: "Zestafona",
                            zone: "*Sever*",
                        },
                    },
                    matchUrl: null,
                },
                { game: "wardogs", gameName: "Wardogs" }
            )
        )
    )
    assert.match(view.text, /VÝSLEDEK · ZÁPAS 14/)
    assert.match(view.text, /1\. \*\*VLK\*\* · ✚ Bravo · \*\*23\*\* b\./)
    assert.match(view.text, /2\. ✚ Alpha · \*\*12\*\* b\./)
    assert.match(view.text, /\*\*1\\\. místo\*\*/)
    assert.match(view.text, /Zestafona · \\\*Sever\\\*/)
    assert.equal(view.buttons.length, 0)
})

test("values the result does not record are left out", () => {
    const view = renderedView(
        resultCardView(
            input(
                { card: null, matchUrl: null },
                { mapLabel: null, showMap: true }
            )
        )
    )
    assert.match(view.text, /Spojenci 4 : 1 Osa/)
    assert.doesNotMatch(view.text, /potvrdil|Výhra|Prohra/)
})

test("short dates use the clan's zone and fall back to UTC", () => {
    assert.equal(
        shortDate("2026-10-11T22:30:00.000Z", "cs-CZ", "Europe/Prague"),
        "po 12. 10."
    )
    assert.equal(
        shortDate("2026-10-11T22:30:00.000Z", "cs-CZ", "Not/AZone"),
        "ne 11. 10."
    )
    assert.equal(shortDate(null, "cs-CZ", "UTC"), null)
})
