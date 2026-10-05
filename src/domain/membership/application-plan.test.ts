import assert from "node:assert/strict"
import test from "node:test"

import { getApplicationMessages } from "../../lib/clan-language/application"

import {
    EMPTY_APPLICATION_ANSWERS,
    nextWindow,
    nextWindowInStep,
    planApplication,
    submitWindow,
    submittedAccounts,
    windowComplete,
    type ApplicationAnswers,
} from "./application-plan"
import {
    defaultApplicationForm,
    type ApplicationCategory,
} from "./application-form"

const categories: ApplicationCategory[] = [
    {
        id: "main",
        gameId: "hell_let_loose",
        label: "Člen",
        assignmentType: "member",
    },
    {
        id: "merc",
        gameId: "wardogs",
        label: "Žoldák",
        assignmentType: "mercenary",
        askSpecialization: true,
    },
]
const form = defaultApplicationForm(
    categories,
    getApplicationMessages("cs").defaultForm
)
const candidate = {
    key: "steam:76561198000000017",
    name: "Hráč 17",
    platform: "steam" as const,
    platformId: "76561198000000017",
    lastSeenAt: "2026-10-03T20:00:00.000Z",
    serverName: "Vlci #1",
}

function fieldIds(answers: ApplicationAnswers, windowId: string) {
    return planApplication({
        form,
        categories,
        answers,
        previousPlayers: [candidate],
    })
        .windows.find((window) => window.id === windowId)
        ?.fields.map((field) => field.id)
}

test("window 1 has Hry, Kategorie, Herní jméno and the clan's questions (L6-18..23)", () => {
    assert.deepEqual(fieldIds(EMPTY_APPLICATION_ANSWERS, "about"), [
        "games",
        "category",
        "name",
        "q-source",
        "q-age",
    ])
    // A clan with one game does not ask for the game (L6-10).
    const single = planApplication({
        form,
        categories: [categories[0]!],
        answers: EMPTY_APPLICATION_ANSWERS,
    })
    assert.deepEqual(
        single.windows[0]!.fields.map((field) => field.id).slice(0, 2),
        ["category", "name"]
    )
})

test("window 2 shows the found players and the accounts the game needs (L6-29..31)", () => {
    const hll: ApplicationAnswers = {
        ...EMPTY_APPLICATION_ANSWERS,
        games: ["hell_let_loose"],
        categoryId: "main",
    }
    assert.deepEqual(fieldIds(hll, "accounts"), [
        "previous",
        "steam",
        "epic",
        "xbox",
        "playstation",
    ])
    const wardogs: ApplicationAnswers = {
        ...EMPTY_APPLICATION_ANSWERS,
        games: ["wardogs"],
        categoryId: "merc",
    }
    assert.deepEqual(fieldIds(wardogs, "accounts"), ["previous", "steam"])
})

test("clan questions spill into 3b; the question window disappears without questions", () => {
    const hll: ApplicationAnswers = {
        ...EMPTY_APPLICATION_ANSWERS,
        games: ["hell_let_loose"],
        categoryId: "main",
    }
    const plan = planApplication({ form, categories, answers: hll })
    assert.deepEqual(
        plan.windows.map((window) => `${window.step}${window.suffix}`),
        ["1", "2", "3", "3b"]
    )
    assert.equal(plan.totalSteps, 3)
    assert.equal(nextWindowInStep(plan, "q1")?.id, "q2")
    assert.equal(nextWindowInStep(plan, "q2"), null)
    // Specialization is not asked of a Wardogs category (L6-10).
    const merc = planApplication({
        form,
        categories,
        answers: { ...hll, games: ["wardogs"], categoryId: "merc" },
    })
    assert.ok(
        !merc.windows
            .flatMap((window) => window.fields)
            .some((field) => field.id === "q-specialization")
    )
    const noQuestions = planApplication({
        form: { ...form, questionWindows: [] },
        categories,
        answers: hll,
    })
    assert.equal(noQuestions.totalSteps, 2)
})

test("window 1 is saved; the category's game joins the chosen games", () => {
    const result = submitWindow({
        form,
        categories,
        answers: EMPTY_APPLICATION_ANSWERS,
        windowId: "about",
        values: {
            games: ["wardogs"],
            category: ["main"],
            name: ["  Hráč 17 "],
            "q-source": ["source-1"],
            "q-age": ["24"],
        },
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(result.answers.games, ["hell_let_loose", "wardogs"])
    assert.equal(result.answers.inGameName, "Hráč 17")
    assert.deepEqual(result.answers.answers, {
        source: ["source-1"],
        age: ["24"],
    })
    assert.deepEqual(result.answers.completedWindows, ["about"])
})

test("missing answers and a bad Steam ID come back as issues (L6-54)", () => {
    const about = submitWindow({
        form,
        categories,
        answers: EMPTY_APPLICATION_ANSWERS,
        windowId: "about",
        values: { games: [], category: ["nope"], name: [""] },
    })
    assert.deepEqual(
        about.ok ? [] : about.issues.map((issue) => issue.fieldId),
        ["games", "category", "name", "q-source"]
    )
    const answers: ApplicationAnswers = {
        ...EMPTY_APPLICATION_ANSWERS,
        games: ["hell_let_loose"],
        categoryId: "main",
        inGameName: "Hráč 17",
        completedWindows: ["about"],
    }
    const steam = submitWindow({
        form,
        categories,
        answers,
        windowId: "accounts",
        values: { steam: ["7656119800000"] },
    })
    assert.deepEqual(steam.ok ? [] : steam.issues, [
        { fieldId: "steam", issue: "steam" },
    ])
    const none = submitWindow({
        form,
        categories,
        answers,
        windowId: "accounts",
        values: {},
    })
    assert.deepEqual(none.ok ? [] : none.issues, [
        { fieldId: "accounts", issue: "account-missing" },
    ])
    // A verified Steam account is enough on its own (L6-27).
    const verified = submitWindow({
        form,
        categories,
        answers,
        windowId: "accounts",
        values: {},
        verifiedSteamId: "76561198000000017",
    })
    assert.equal(verified.ok, true)
})

test("required Steam verification hides the Steam field and manual Steam players", () => {
    const locked = { ...form, requireVerifiedSteam: true }
    const answers: ApplicationAnswers = {
        ...EMPTY_APPLICATION_ANSWERS,
        games: ["hell_let_loose"],
        categoryId: "main",
    }
    const plan = planApplication({
        form: locked,
        categories,
        answers,
        previousPlayers: [candidate],
    })
    assert.equal(plan.steamLocked, true)
    assert.deepEqual(
        plan.windows[1]!.fields.map((field) => field.id),
        ["epic", "xbox", "playstation"]
    )
})

test("completion follows the current plan; the next window is the first unfinished", () => {
    const answers: ApplicationAnswers = {
        games: ["hell_let_loose"],
        categoryId: "main",
        inGameName: "Hráč 17",
        accounts: { steam: "76561198000000017" },
        answers: { source: ["source-1"] },
        completedWindows: ["about", "accounts"],
    }
    const plan = planApplication({ form, categories, answers })
    assert.equal(windowComplete(plan.windows[0]!, answers), true)
    assert.equal(nextWindow(plan, answers)?.id, "q1")
    const done = {
        ...answers,
        answers: {
            ...answers.answers,
            specialization: ["spec-1"],
            hours: ["10"],
            why: ["Hraju rád."],
            when: ["when-1"],
            microphone: ["yes"],
        },
        completedWindows: [...answers.completedWindows, "q1", "q2"],
    }
    assert.equal(nextWindow(plan, done), null)
})

test("a found player fills its platform; a verified Steam account wins", () => {
    assert.deepEqual(
        submittedAccounts({
            accounts: {
                xbox: "Hrac17CZ",
                previousPlayer: "steam:76561198000000017",
            },
        }),
        {
            steamVerified: false,
            steam: "76561198000000017",
            xbox: "Hrac17CZ",
        }
    )
    assert.deepEqual(
        submittedAccounts(
            { accounts: { steam: "76561198000000099" } },
            "76561198000000017"
        ),
        { steamVerified: true, steam: "76561198000000017" }
    )
})
