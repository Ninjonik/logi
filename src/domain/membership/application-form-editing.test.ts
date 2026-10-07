import assert from "node:assert/strict"
import test from "node:test"

import { getApplicationMessages } from "../../lib/clan-language/application"

import {
    addOption,
    addQuestion,
    addQuestionWindow,
    blankQuestion,
    categoryMatchesGame,
    formChangeCount,
    formWindows,
    gameFilterChoices,
    moveOption,
    moveQuestion,
    moveQuestionTo,
    normalizeApplicationForm,
    removeOption,
    removeQuestion,
    removeQuestionWindow,
    updateQuestion,
    withCategory,
    withGame,
    withType,
} from "./application-form-editing"
import {
    defaultApplicationForm,
    validateApplicationForm,
    type ApplicationCategory,
} from "./application-form"

const categories: ApplicationCategory[] = [
    {
        id: "main",
        gameId: "hell_let_loose",
        label: "Hlavní člen",
        assignmentType: "member",
    },
    {
        id: "reserve",
        gameId: "hell_let_loose",
        label: "Záloha",
        assignmentType: "reserve_member",
    },
    {
        id: "merc",
        gameId: "wardogs",
        label: "Žoldák",
        assignmentType: "mercenary",
    },
]
const form = defaultApplicationForm(
    categories,
    getApplicationMessages("cs").defaultForm
)
const optionLabel = (index: number) => `Možnost ${index}`

test("windows count the fields of the applicant who sees the most (N4-13, N4-15, N4-17)", () => {
    const windows = formWindows(form, categories)
    assert.deepEqual(
        windows.map((window) => [window.number, window.fieldCount]),
        [
            ["1", 5],
            ["2", 4],
            ["3", 5],
            ["3b", 2],
        ]
    )
    assert.equal(windows[0]!.fixedCount, 3)
    assert.equal(windows[2]!.full, true)
    assert.equal(windows[3]!.full, false)
})

test("a new question gets a stable unique ID and starter options for a select", () => {
    const question = blankQuestion(form, {
        type: "multi_select",
        label: "Které role tě baví?",
        optionLabel,
    })
    assert.equal(question.id, "question-1")
    assert.deepEqual(
        question.options?.map((option) => option.label),
        ["Možnost 1", "Možnost 2"]
    )
    assert.equal(question.minValues, 1)
    assert.equal(question.maxValues, 2)
    const next = addQuestion(form, "q2", question)
    assert.equal(
        blankQuestion(next, { type: "number", label: "x", optionLabel }).id,
        "question-2"
    )
    assert.deepEqual(validateApplicationForm(next, categories), [])
})

test("changing the type keeps or drops options; built-in questions keep theirs", () => {
    const select = blankQuestion(form, {
        type: "select",
        label: "Role",
        optionLabel,
    })
    const text = withType(select, "long_text", optionLabel)
    assert.equal(text.type, "long_text")
    assert.equal(text.options, undefined)
    const back = withType(
        { ...select, options: [{ id: "a", label: "Pěchota" }] },
        "multi_select",
        optionLabel
    )
    assert.deepEqual(back.options, [{ id: "a", label: "Pěchota" }])
    assert.equal(back.maxValues, 1)
    const specialization = form.questionWindows[0]!.questions[0]!
    assert.equal(specialization.kind, "specialization")
    assert.equal(
        withType(specialization, "short_text", optionLabel),
        specialization
    )
})

test("questions move up and down, and by dragging into another window", () => {
    const [first, second] = form.questionWindows[0]!.questions
    const moved = moveQuestion(form, second!.id, -1)
    assert.deepEqual(
        moved.questionWindows[0]!.questions.slice(0, 2).map((q) => q.id),
        [second!.id, first!.id]
    )
    assert.equal(moveQuestion(form, first!.id, -1), form)
    const dragged = moveQuestionTo(form, first!.id, { window: "q2" })
    assert.equal(dragged.questionWindows[0]!.questions.length, 4)
    const last = dragged.questionWindows[1]!.questions
    assert.equal(last[last.length - 1]!.id, first!.id)
    const before = moveQuestionTo(form, first!.id, {
        window: "about",
        beforeId: "source",
    })
    assert.equal(before.about[0]!.id, first!.id)
})

test("questions are updated and removed by ID", () => {
    const question = form.about[0]!
    const renamed = updateQuestion(form, { ...question, label: "Odkud jsi?" })
    assert.equal(renamed.about[0]!.label, "Odkud jsi?")
    const removed = removeQuestion(renamed, question.id)
    assert.equal(
        removed.about.some((item) => item.id === question.id),
        false
    )
})

test("Přidat okno adds windows up to 3c; only an empty window can be removed (N4-24)", () => {
    const one = addQuestionWindow(form)
    assert.equal(one.windowId, "q3")
    const two = addQuestionWindow(one.form)
    assert.equal(two.windowId, null)
    assert.equal(two.form.questionWindows.length, 3)
    assert.equal(removeQuestionWindow(one.form, "q3").questionWindows.length, 2)
    assert.equal(removeQuestionWindow(one.form, "q1"), one.form)
})

test("options are added up to 25, removed and reordered; bounds follow (N4-20, N4-21)", () => {
    let question = blankQuestion(form, {
        type: "multi_select",
        label: "Role",
        optionLabel,
    })
    for (let index = 0; index < 30; index += 1)
        question = addOption(question, `Role ${index}`)
    assert.equal(question.options?.length, 25)
    question = { ...question, maxValues: 25 }
    const fewer = removeOption(question, "option-1")
    assert.equal(fewer.options?.length, 24)
    assert.equal(fewer.maxValues, 24)
    const reordered = moveOption(fewer, "option-2", 1)
    assert.equal(reordered.options?.[1]?.id, "option-2")
})

test("game and category filters (N4-22, N4-23)", () => {
    assert.deepEqual(gameFilterChoices(categories), [
        "hell_let_loose",
        "wardogs",
    ])
    const question = blankQuestion(form, {
        type: "short_text",
        label: "x",
        optionLabel,
    })
    const hll = withGame(question, "hell_let_loose")
    assert.equal(hll.game, "hell_let_loose")
    assert.equal(withGame(hll, null).game, undefined)
    const limited = withCategory(
        withCategory(hll, "main", true),
        "reserve",
        true
    )
    assert.deepEqual(limited.categoryIds, ["main", "reserve"])
    assert.equal(
        withCategory(withCategory(limited, "main", false), "reserve", false)
            .categoryIds,
        undefined
    )
    assert.equal(categoryMatchesGame(hll, categories[2]!), false)
    assert.equal(
        categoryMatchesGame(hll, { gameId: "hell_let_loose_vietnam" }),
        true
    )
})

test("the save bar counts changed questions and windows", () => {
    assert.equal(formChangeCount(form, form), 0)
    const renamed = updateQuestion(form, { ...form.about[0]!, label: "Jinak" })
    const added = addQuestionWindow(renamed).form
    assert.equal(formChangeCount(form, added), 2)
    assert.equal(
        formChangeCount(form, { ...form, requireVerifiedSteam: true }),
        1
    )
})

test("the saved form drops empty texts and stale category filters", () => {
    const question = {
        ...blankQuestion(form, {
            type: "short_text",
            label: "  Hraješ?  ",
            optionLabel,
        }),
        help: "  ",
        placeholder: " např. ano ",
        game: "hell_let_loose" as const,
        categoryIds: ["main", "gone", "merc"],
    }
    const saved = normalizeApplicationForm(
        addQuestion(form, "q2", question),
        categories
    )
    const result = saved.questionWindows[1]!.questions.find(
        (item) => item.id === question.id
    )!
    assert.equal(result.label, "Hraješ?")
    assert.equal(result.help, undefined)
    assert.equal(result.placeholder, "např. ano")
    // "gone" no longer exists; the Wardogs category never sees an HLL question.
    assert.deepEqual(result.categoryIds, ["main"])
    assert.deepEqual(validateApplicationForm(saved, categories), [])
})
