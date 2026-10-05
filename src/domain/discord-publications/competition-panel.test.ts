import assert from "node:assert/strict"
import test from "node:test"

import {
    competitionTableView,
    type CompetitionDivisionTable,
} from "./competition-panel"
import { renderedView } from "../../infrastructure/testing/message-views"
import { getPanelMessages } from "../../lib/clan-language/panels"

const table: CompetitionDivisionTable = {
    divisionId: "d1",
    competition: "ECL 2026",
    division: "Divize A",
    gameName: "Hell Let Loose",
    rows: [
        {
            teamId: "t1",
            code: "VLK",
            points: 12,
            wins: 4,
            matches: 5,
            ours: true,
        },
        {
            teamId: "t2",
            code: "R_O_G",
            points: 9,
            wins: 3,
            matches: 5,
            ours: false,
        },
    ],
    round: 5,
    nextMatch: {
        team: "VLK",
        title: "VLK vs ROG",
        startAt: "2026-10-11T18:00:00.000Z",
        round: 6,
    },
    url: "https://logi.app/cs/competitions/ecl-2026",
    updatedAt: Date.parse("2026-10-05T10:00:00.000Z"),
}

test("one table per division with points, wins, the clan marked and the next match", () => {
    const out = renderedView(
        competitionTableView({
            copy: getPanelMessages("cs").competition,
            locale: "cs-CZ",
            timeZone: "Europe/Prague",
            table,
            accentColor: null,
        })
    )
    assert.deepEqual(out.validation, { ok: true, issues: [] })
    assert.match(out.text, /ECL 2026 · DIVIZE A · HELL LET LOOSE/)
    assert.match(out.text, /Tabulka po 5\. kole/)
    assert.match(out.text, /1\. › \*\*VLK\*\* · \*\*12 b\.\*\*/)
    assert.match(out.text, /2\. R\\_O\\_G · \*\*9 b\.\*\*/)
    assert.match(out.text, /Další zápas VLK: .* · VLK vs ROG · 6\. kolo/)
    assert.deepEqual(
        out.buttons.map((button) => button.label),
        ["Otevřít soutěž"]
    )
})

test("before the first round the title is plain and an empty table says so", () => {
    const out = renderedView(
        competitionTableView({
            copy: getPanelMessages("cs").competition,
            locale: "cs-CZ",
            timeZone: "Europe/Prague",
            table: {
                ...table,
                rows: [],
                round: null,
                nextMatch: null,
                url: null,
            },
            accentColor: null,
        })
    )
    assert.match(out.text, /### Tabulka/)
    assert.equal(out.buttons.length, 0)
})
