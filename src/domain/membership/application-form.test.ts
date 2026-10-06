import assert from "node:assert/strict"
import test from "node:test"

import { getApplicationMessages } from "../../lib/clan-language/application"

import {
    APPLICATION_LIMITS,
    applicationGames,
    categoryAsksSpecialization,
    defaultApplicationForm,
    maxVisibleQuestionCount,
    parseApplicationForm,
    questionVisible,
    resolveApplicationForm,
    validateApplicationForm,
    windowFieldCounts,
    type ApplicationCategory,
    type ApplicationForm,
    type ApplicationQuestion,
} from "./application-form"

const cs = getApplicationMessages("cs").defaultForm

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

const text = (
    id: string,
    extra: Partial<ApplicationQuestion> = {}
): ApplicationQuestion => ({
    id,
    kind: "custom",
    type: "short_text",
    label: `Otázka ${id}`,
    required: true,
    ...extra,
})

test("the default form is the board's example in the clan language", () => {
    const form = defaultApplicationForm(categories, cs)
    assert.deepEqual(
        form.about.map((question) => question.label),
        ["Odkud o nás víš?", "Věk"]
    )
    assert.equal(form.about[1]!.required, false)
    assert.deepEqual(
        form.questionWindows[0]!.questions.map((question) => question.label),
        [
            "Specializace",
            "Kolik hodin týdně hraješ?",
            "Proč chceš hrát s námi?",
            "Kdy obvykle hraješ?",
            "Máš mikrofon?",
        ]
    )
    assert.deepEqual(
        form.questionWindows[1]!.questions.map((question) => question.type),
        ["short_text", "member"]
    )
    assert.deepEqual(validateApplicationForm(form, categories), [])
})

test("legacy category questions become category questions of the default form", () => {
    const legacy: ApplicationCategory[] = [
        {
            ...categories[0]!,
            modalQuestions: [
                {
                    id: "hours",
                    label: "Kolik hodin týdně hraješ?",
                    style: "short",
                    required: true,
                    placeholder: "Např. 10–15 hodin",
                },
                {
                    id: "why",
                    label: "Proč chceš hrát s námi?",
                    style: "paragraph",
                    required: true,
                },
            ],
        },
        categories[2]!,
    ]
    const form = defaultApplicationForm(legacy, cs)
    const questions = form.questionWindows.flatMap((window) => window.questions)
    const hours = questions.find((question) =>
        question.label.startsWith("Kolik")
    )
    assert.deepEqual(hours?.categoryIds, ["main"])
    assert.equal(hours?.type, "short_text")
    assert.equal(
        questions.find((question) => question.label.startsWith("Proč"))?.type,
        "long_text"
    )
    assert.deepEqual(validateApplicationForm(form, legacy), [])
})

test("specialization is asked only in Hell Let Loose categories that want it", () => {
    assert.equal(categoryAsksSpecialization(categories[0]!), true)
    assert.equal(
        categoryAsksSpecialization({
            ...categories[0]!,
            askSpecialization: false,
        }),
        false
    )
    // Wardogs never asks, whatever the switch says (N4-B05).
    assert.equal(
        categoryAsksSpecialization({
            ...categories[2]!,
            askSpecialization: true,
        }),
        false
    )
    const specialization: ApplicationQuestion = {
        ...text("spec"),
        kind: "specialization",
        type: "select",
        options: [{ id: "a", label: "Pěchota" }],
    }
    const input = {
        games: ["hell_let_loose" as const, "wardogs" as const],
        categories,
    }
    assert.equal(
        questionVisible(specialization, { ...input, categoryId: "main" }),
        true
    )
    assert.equal(
        questionVisible(specialization, { ...input, categoryId: "merc" }),
        false
    )
})

test("game and category filters decide who sees a question", () => {
    const hll = text("hll", { game: "hell_let_loose" })
    const mainOnly = text("main", { categoryIds: ["main"] })
    const base = { categories }
    assert.equal(
        questionVisible(hll, {
            ...base,
            games: ["wardogs"],
            categoryId: "merc",
        }),
        false
    )
    assert.equal(
        questionVisible(hll, {
            ...base,
            games: ["hell_let_loose_vietnam"],
            categoryId: "main",
        }),
        true
    )
    assert.equal(
        questionVisible(mainOnly, {
            ...base,
            games: ["hell_let_loose"],
            categoryId: "reserve",
        }),
        false
    )
    assert.equal(
        questionVisible(mainOnly, { ...base, games: ["hell_let_loose"] }),
        true
    )
})

test("the field count is the one of the applicant who sees the most (N4-B03)", () => {
    const questions = [
        text("a"),
        text("b", { categoryIds: ["main"] }),
        text("c", { categoryIds: ["reserve"] }),
        text("d", { game: "wardogs" }),
    ]
    // main: a, b, d; reserve: a, c, d; merc: a, d.
    assert.equal(maxVisibleQuestionCount(questions, categories), 3)
    const form: ApplicationForm = {
        about: [text("source")],
        accounts: [],
        questionWindows: [{ id: "q1", questions }],
    }
    assert.deepEqual(windowFieldCounts(form, categories), {
        // Hry, Kategorie, Herní jméno and one question.
        about: 4,
        // Steam, Epic, Xbox, PlayStation.
        accounts: 4,
        questionWindows: [3],
    })
    assert.deepEqual(applicationGames(categories), [
        "hell_let_loose",
        "wardogs",
    ])
})

test("a full window, a long label and too many options are refused", () => {
    const form: ApplicationForm = {
        about: [text("a"), text("b"), text("c")],
        accounts: [],
        questionWindows: [
            {
                id: "q1",
                questions: [
                    text("x", {
                        label: "x".repeat(APPLICATION_LIMITS.label + 1),
                    }),
                    {
                        ...text("y"),
                        type: "select",
                        options: Array.from({ length: 26 }, (_, index) => ({
                            id: `o${index}`,
                            label: `Možnost ${index}`,
                        })),
                    },
                    { ...text("z"), type: "multi_select", options: [] },
                ],
            },
        ],
    }
    const codes = validateApplicationForm(form, categories).map(
        (issue) => `${issue.window}:${issue.code}`
    )
    assert.ok(codes.includes("about:window-full"))
    assert.ok(codes.includes("q1:label-too-long"))
    assert.ok(codes.includes("q1:options-too-many"))
    assert.ok(codes.includes("q1:options-missing"))
})

test("the member type belongs to the referrer question only", () => {
    const form: ApplicationForm = {
        about: [],
        accounts: [],
        questionWindows: [
            { id: "q1", questions: [{ ...text("who"), type: "member" }] },
        ],
    }
    assert.deepEqual(
        validateApplicationForm(form, categories).map((issue) => issue.code),
        ["type-invalid"]
    )
})

test("a stored form is used when valid, else the default", () => {
    const stored: ApplicationForm = {
        about: [],
        accounts: [],
        questionWindows: [{ id: "q1", questions: [text("one")] }],
    }
    assert.deepEqual(parseApplicationForm(stored), stored)
    assert.equal(parseApplicationForm({ about: "nope" }), null)
    assert.equal(
        resolveApplicationForm(undefined, categories, cs).about[0]!.label,
        "Odkud o nás víš?"
    )
    assert.equal(
        resolveApplicationForm(stored, categories, cs).questionWindows[0]!
            .questions[0]!.id,
        "one"
    )
})
