import assert from "node:assert/strict"
import test from "node:test"

import {
    formatAnswer,
    parseQuestionAnswer,
    parseSteamId,
} from "./application-answers"
import type { ApplicationQuestion } from "./application-form"

const question = (
    extra: Partial<ApplicationQuestion> = {}
): ApplicationQuestion => ({
    id: "q",
    kind: "custom",
    type: "short_text",
    label: "Otázka",
    required: true,
    ...extra,
})
const words = { yes: "Ano", no: "Ne" }

test("a Steam ID is 17 digits starting 7656119 or a profile link (L6-B07)", () => {
    assert.equal(parseSteamId(" 76561198000000017 "), "76561198000000017")
    assert.equal(
        parseSteamId("https://steamcommunity.com/profiles/76561198000000017/"),
        "76561198000000017"
    )
    assert.equal(
        parseSteamId("steamcommunity.com/profiles/76561198000000017"),
        "76561198000000017"
    )
    assert.equal(parseSteamId("7656119800000001"), null)
    assert.equal(parseSteamId("86561198000000017"), null)
    assert.equal(parseSteamId("https://steamcommunity.com/id/hrac17"), null)
    assert.equal(parseSteamId(""), null)
})

test("required and optional answers", () => {
    assert.deepEqual(parseQuestionAnswer(question(), ["  "]), {
        ok: false,
        issue: "required",
    })
    assert.deepEqual(parseQuestionAnswer(question({ required: false }), []), {
        ok: true,
        values: [],
    })
    assert.deepEqual(parseQuestionAnswer(question(), [" 10–15 hodin "]), {
        ok: true,
        values: ["10–15 hodin"],
    })
    assert.deepEqual(parseQuestionAnswer(question(), ["x".repeat(401)]), {
        ok: false,
        issue: "too-long",
    })
})

test("numbers accept a decimal comma", () => {
    const number = question({ type: "number" })
    assert.deepEqual(parseQuestionAnswer(number, ["24"]), {
        ok: true,
        values: ["24"],
    })
    assert.deepEqual(parseQuestionAnswer(number, ["10,5"]), {
        ok: true,
        values: ["10.5"],
    })
    assert.deepEqual(parseQuestionAnswer(number, ["deset"]), {
        ok: false,
        issue: "number",
    })
})

test("selects accept only their options and respect the bounds", () => {
    const options = [
        { id: "a", label: "Pěchota" },
        { id: "b", label: "Medik" },
        { id: "c", label: "Velitel čety" },
    ]
    const single = question({ type: "select", options })
    assert.deepEqual(parseQuestionAnswer(single, ["b"]), {
        ok: true,
        values: ["b"],
    })
    assert.deepEqual(parseQuestionAnswer(single, ["x"]), {
        ok: false,
        issue: "choice",
    })
    const multi = question({
        type: "multi_select",
        options,
        minValues: 1,
        maxValues: 2,
    })
    assert.deepEqual(parseQuestionAnswer(multi, ["a", "b", "c"]), {
        ok: false,
        issue: "too-many",
    })
    assert.deepEqual(parseQuestionAnswer(multi, ["a", "a", "c"]), {
        ok: true,
        values: ["a", "c"],
    })
    assert.equal(formatAnswer(multi, ["b", "c"], words), "Medik, Velitel čety")
})

test("yes/no and member answers", () => {
    const yesNo = question({ type: "yes_no" })
    assert.deepEqual(parseQuestionAnswer(yesNo, ["no"]), {
        ok: true,
        values: ["no"],
    })
    assert.deepEqual(parseQuestionAnswer(yesNo, ["maybe"]), {
        ok: false,
        issue: "choice",
    })
    assert.equal(formatAnswer(yesNo, ["yes"], words), "Ano")
    const member = question({ type: "member", kind: "referrer" })
    assert.deepEqual(parseQuestionAnswer(member, ["222222222222222222"]), {
        ok: true,
        values: ["222222222222222222"],
    })
    assert.deepEqual(parseQuestionAnswer(member, ["@someone"]), {
        ok: false,
        issue: "member",
    })
    assert.equal(
        formatAnswer(member, ["222222222222222222"], words),
        "<@222222222222222222>"
    )
})
