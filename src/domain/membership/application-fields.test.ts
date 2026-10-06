import assert from "node:assert/strict"
import test from "node:test"

import { getApplicationMessages } from "../../lib/clan-language/application"

import {
    EMPTY_APPLICATION_ANSWERS,
    planApplication,
    type ApplicationAnswers,
} from "./application-plan"
import {
    linkedAccount,
    questionField,
    windowFieldModels,
} from "./application-fields"
import {
    defaultApplicationForm,
    type ApplicationCategory,
} from "./application-form"

const cs = getApplicationMessages("cs")
const categories: ApplicationCategory[] = [
    {
        id: "main",
        gameId: "hell_let_loose",
        label: "Hlavní člen",
        description: "zápasy každý týden",
        assignmentType: "member",
    },
    {
        id: "merc",
        gameId: "wardogs",
        label: "Žoldák",
        assignmentType: "mercenary",
    },
]
const form = defaultApplicationForm(categories, cs.defaultForm)

function fields(answers: ApplicationAnswers, windowId: string) {
    const plan = planApplication({ form, categories, answers })
    const window = plan.windows.find((item) => item.id === windowId)!
    return windowFieldModels(cs, {
        window,
        prefill: {
            answers,
            linkedPlatformIds: ["epic:vlk17"],
            verifiedSteamId: null,
        },
        timeZone: "Europe/Prague",
    })
}

test("window 1 asks Hry, Kategorie, Herní jméno and the clan's questions in the clan language", () => {
    const about = fields(EMPTY_APPLICATION_ANSWERS, "about")
    assert.deepEqual(
        about.map((field) => field.label),
        [
            cs.fields.games.label,
            cs.fields.category.label,
            cs.fields.name.label,
            "Odkud o nás víš?",
            cs.defaultForm.age.label,
        ]
    )
    const category = about[1]!.control
    assert.equal(category.kind, "select")
    if (category.kind === "select")
        assert.deepEqual(category.options[0], {
            value: "main",
            label: "Hlavní člen",
            description: "Hell Let Loose · zápasy každý týden",
        })
    const age = about[4]!
    assert.equal(age.required, false)
    assert.equal(age.control.kind === "text" && age.control.numeric, true)
})

test("saved answers and linked accounts prefill the fields (L6-09, N4-15)", () => {
    const answers: ApplicationAnswers = {
        ...EMPTY_APPLICATION_ANSWERS,
        games: ["hell_let_loose"],
        categoryId: "main",
        inGameName: "Hráč 17",
        answers: { when: ["when-1", "when-9"] },
    }
    const about = fields(answers, "about")
    assert.deepEqual(
        about[0]!.control.kind === "select" && about[0]!.control.values,
        ["hell_let_loose"]
    )
    assert.equal(
        about[2]!.control.kind === "text" && about[2]!.control.value,
        "Hráč 17"
    )
    const accounts = fields(answers, "accounts")
    const epic = accounts.find((field) => field.id === "epic")!
    assert.equal(epic.control.kind === "text" && epic.control.value, "vlk17")
    const when = fields(answers, "q1").find((field) => field.id === "q-when")!
    assert.equal(when.control.kind, "select")
    if (when.control.kind === "select") {
        assert.equal(when.control.multi, true)
        // An option that no longer exists is not shown as chosen.
        assert.deepEqual(when.control.values, ["when-1"])
    }
})

test("Ano-ne is a select of Ano and Ne, the referrer a member select", () => {
    const yesNo = questionField(
        cs,
        "q-mic",
        {
            id: "mic",
            kind: "custom",
            type: "yes_no",
            label: "Máš mikrofon?",
            required: true,
        },
        ["no"]
    )
    assert.deepEqual(yesNo.control, {
        kind: "select",
        multi: false,
        min: 1,
        max: 1,
        placeholder: cs.fields.selectPlaceholder,
        options: [
            { value: "yes", label: cs.fields.yes },
            { value: "no", label: cs.fields.no },
        ],
        values: ["no"],
    })
    const referrer = questionField(
        cs,
        "q-referrer",
        {
            id: "referrer",
            kind: "referrer",
            type: "member",
            label: "Kdo tě k nám pozval?",
            required: false,
        },
        []
    )
    assert.equal(referrer.control.kind, "member")
})

test("a window never holds more than five fields, in Discord or on the web", () => {
    const plan = planApplication({
        form: {
            ...form,
            questionWindows: [
                {
                    id: "q1",
                    questions: Array.from({ length: 6 }, (_, index) => ({
                        id: `extra-${index}`,
                        kind: "custom" as const,
                        type: "short_text" as const,
                        label: `Otázka ${index + 1}`,
                        required: false,
                    })),
                },
            ],
        },
        categories,
        answers: EMPTY_APPLICATION_ANSWERS,
    })
    const window = plan.windows.find((item) => item.id === "q1")!
    // The planner already keeps Discord's limit.
    assert.equal(window.fields.length, 5)
    const prefill = { answers: EMPTY_APPLICATION_ANSWERS }
    assert.equal(
        windowFieldModels(cs, { window, prefill, timeZone: "UTC" }).length,
        5
    )
})

test("linked accounts are found by platform; older Steam links are bare IDs", () => {
    assert.equal(
        linkedAccount(["steam:76561198000000017"], "steam"),
        "76561198000000017"
    )
    assert.equal(
        linkedAccount(["76561198000000017"], "steam"),
        "76561198000000017"
    )
    assert.equal(linkedAccount(["epic:abc"], "xbox"), undefined)
})
