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

test("an HLL result: the two-sided score row with the outcome chip, map, date, reviewer and match link (P6-33)", () => {
    const view = renderedView(resultCardView(input()))
    assert.deepEqual(view.validation, { ok: true, issues: [] })
    // The board's row "[VLK] VLK Spojenci ★ 4 : 1 Osa ✚ ROG [ROG]" on one
    // line, in the board's order, right after the label and before the chip.
    assert.match(
        view.text,
        /-# \*\*VÝSLEDEK · PŘÁTELÁK · HELL LET LOOSE\*\*\n### VLK Spojenci ★ 4 : 1 Osa ✚ ROG\n🟢 \*\*Výhra\*\*/
    )
    assert.doesNotMatch(view.text, /Spojenci ★ · Osa ✚/)
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
    assert.match(view.text, /### VLK Spojenci ★ 3 : 2 Osa ✚ ROG/)
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
    assert.match(view.text, /VÝSLEDEK · #14 LEAGUE/)
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
    assert.match(view.text, /### Spojenci ★ 4 : 1 Osa ✚\n/)
    assert.doesNotMatch(view.text, /potvrdil|Výhra|Prohra/)
})

test("the score row keeps application emoji and escapes League text; compact keeps the short title", () => {
    const emoji = renderedView(
        resultCardView(
            input(
                {
                    card: {
                        ...input().event.card!,
                        teams: [
                            { code: "V_K", side: "Allies" },
                            { code: "ROG", side: "Axis" },
                        ],
                    },
                },
                {
                    sideSign: (label) =>
                        label.toLowerCase() === "allies"
                            ? "<:allies:123456789012345678>"
                            : "<:axis:223456789012345678>",
                }
            )
        )
    )
    assert.match(
        emoji.text,
        /### V\\_K Spojenci <:allies:123456789012345678> 4 : 1 Osa <:axis:223456789012345678> ROG/
    )
    const compact = renderedView(resultCardView(input({}, { compact: true })))
    assert.match(compact.text, /### VLK 4 : 1 ROG\n/)
    assert.doesNotMatch(compact.text, /Spojenci/)
})

test("a Wardogs League result is labelled with its fixture number and type, as on the board (P6-38)", () => {
    const wardogs = (type: string | null) =>
        renderedView(
            resultCardView(
                input(
                    {
                        name: "Wardogs League #38",
                        result: {
                            status: "confirmed",
                            version: 1,
                            reviewedAt: "2026-10-10T19:50:00.000Z",
                            participants: [
                                { label: "Valkyra", score: 23 },
                                { label: "Manticore", score: 12 },
                                { label: "Lonestar", score: 7 },
                            ],
                        },
                        card: {
                            category: "Wardogs League",
                            side: "Valkyra",
                            teams: [
                                { code: "VLK", side: "Valkyra" },
                                { code: "ROG", side: "Manticore" },
                                { code: "BAMC", side: "Lonestar" },
                            ],
                            reviewer: "Kowalski",
                            publicMatch: true,
                            imported: null,
                            playedAt: "2026-10-10T18:30:00.000Z",
                            league: {
                                fixtureNumber: 38,
                                type,
                                map: "Zestafona",
                                zone: "SmallFactory",
                            },
                        },
                    },
                    { game: "wardogs", gameName: "Wardogs" }
                )
            )
        ).text
    assert.match(
        wardogs("Friendly"),
        /\*\*VÝSLEDEK · WARDOGS LEAGUE · #38 FRIENDLY\*\*\n### VLK vs ROG vs BAMC/
    )
    assert.match(
        wardogs("Friendly"),
        /1\\\. místo\*\* · Zestafona · SmallFactory · so 10\. 10\. · potvrdil Kowalski/
    )
    assert.match(wardogs(null), /VÝSLEDEK · WARDOGS LEAGUE · ZÁPAS 38/)
    assert.match(wardogs("  "), /VÝSLEDEK · WARDOGS LEAGUE · ZÁPAS 38/)
    for (const language of ["en", "de"] as const)
        assert.equal(
            getPanelMessages(language).results.fixture("38", "Friendly"),
            "#38 Friendly"
        )
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
