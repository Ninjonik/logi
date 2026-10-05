import assert from "node:assert/strict"
import test from "node:test"

import {
    REPORT_FAILURES,
    reportFailureView,
    reportPickerView,
    reportSentView,
    reportThreadName,
    reportThreadView,
} from "./report-views"
import { renderedView } from "../../infrastructure/testing/message-views"
import { getSystemMessages } from "../../lib/clan-language/system"
import { getPanelMessages } from "../../lib/clan-language/panels"

const copy = getPanelMessages("cs").report

test("the picker is private, in the clan language, with Jiný hráč last", () => {
    const view = reportPickerView({
        copy,
        draftId: "draft",
        serverTitle: "Vlci #1",
        observation: {
            map: "Foy",
            observedAt: "2026-10-05T18:00:00.000Z",
            serverName: "Vlci #1",
            players: [{ name: "Hans_88", playerId: null, team: "axis" }],
        },
        page: 0,
        sideName: (team) => (team === "axis" ? "Osa" : null),
    })
    assert.equal(view.ephemeral, true)
    const out = renderedView(view)
    assert.deepEqual(out.validation, { ok: true, issues: [] })
    assert.match(out.text, /Koho chceš nahlásit\?/)
    // A single page needs no paging buttons.
    assert.equal(out.buttons.length, 0)
})

test("Hlášení odesláno links the private thread", () => {
    const out = renderedView(
        reportSentView({
            copy,
            threadName: "Hlášení #17 · Hans_88",
            threadUrl: "https://discord.com/channels/1/2",
        })
    )
    assert.match(out.text, /Hlášení #17 · Hans\\_88/)
    assert.equal(out.buttons[0]?.kind, "link")
})

test("each failure has its own sentence; admin causes only say the admins were told", () => {
    const adminNotified = getSystemMessages("cs").errors.adminNotified
    const texts = new Set<string>()
    for (const failure of REPORT_FAILURES) {
        const out = renderedView(
            reportFailureView(copy, failure, adminNotified)
        )
        assert.deepEqual(out.validation, { ok: true, issues: [] })
        texts.add(out.text)
    }
    assert.equal(texts.size, REPORT_FAILURES.length)
    const admin = renderedView(reportFailureView(copy, "admin", adminNotified))
    assert.match(admin.text, new RegExp(adminNotified.replace(/\./g, "\\.")))
})

test("thread names use the number and the player, bounded by Discord's limit", () => {
    assert.equal(reportThreadName(copy, 17, "Hans_88"), "Hlášení #17 · Hans_88")
    assert.ok(reportThreadName(copy, 1, "x".repeat(300)).length <= 100)
    assert.equal(reportThreadName(copy, 2, " a\n b "), "Hlášení #2 · a b")
})

test("the thread card escapes the report text and encodes the evidence link", () => {
    const out = renderedView(
        reportThreadView({
            copy,
            number: 17,
            context: {
                gameId: "hell_let_loose",
                serverName: "Vlci #1",
                map: "Foy",
                observedAt: "2026-10-05T18:00:00.000Z",
                player: {
                    name: "Hans_88",
                    playerId: "76561198000000000",
                    team: "axis",
                    provenance: "observed",
                },
                reason: "**teamkill** @everyone",
                incident: "20:40",
                evidence: "https://example.com/clip (1)",
            },
            reporterId: "111111111111111111",
            sideName: "Osa",
            observedText: "<t:1791223080:f>",
            serverTitle: "Vlci #1",
        })
    )
    assert.deepEqual(out.validation, { ok: true, issues: [] })
    assert.match(out.text, /HLÁŠENÍ HRÁČE #17/)
    assert.match(out.text, /\\\*\\\*teamkill\\\*\\\*/)
    assert.match(out.text, /\(https:\/\/example\.com\/clip%20%281%29\)/)
    assert.match(out.text, /Vlci #1 · Foy · <t:1791223080:f>/)
    assert.doesNotMatch(out.text, /76561198000000000/)
})
