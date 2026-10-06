import assert from "node:assert/strict"
import test from "node:test"

import {
    defaultApplicationForm,
    type ApplicationCategory,
} from "@/domain/membership/application-form"
import {
    applicationCardView,
    applicationReviewView,
} from "@/domain/membership/application-views"
import { updateQuestion } from "@/domain/membership/application-form-editing"
import { webReviewRows } from "@/components/app/web-application/review-rows"
import { windowFieldModels } from "@/domain/membership/application-fields"
import { getApplicationMessages } from "@/lib/clan-language/application"
import type { MembershipSettings } from "@/types/domain"
import { enMessages } from "@/i18n/messages/en"
import { deMessages } from "@/i18n/messages/de"
import { csMessages } from "@/i18n/messages/cs"

import {
    PREVIEW_STEAM_ID,
    previewApplicant,
    previewCardAnswers,
    previewWindowPrefill,
} from "./preview-samples"
import { membershipChangeCount } from "./settings-changes"

const cs = getApplicationMessages("cs")
const sample = csMessages.membershipApplication.form.sample
const categories: ApplicationCategory[] = [
    {
        id: "merc",
        gameId: "wardogs",
        label: "Žoldák",
        assignmentType: "mercenary",
    },
    {
        id: "main",
        gameId: "hell_let_loose",
        label: "Hlavní člen",
        assignmentType: "member",
    },
]
const form = defaultApplicationForm(categories, cs.defaultForm)

test("the sample applicant is a Hell Let Loose member who sees window 3 (N4-25)", () => {
    const applicant = previewApplicant(form, categories, sample, "q1")
    assert.equal(applicant.category?.id, "main")
    assert.equal(applicant.answers.inGameName, "Hráč 17")
    assert.deepEqual(applicant.answers.answers.microphone, ["no"])
    assert.deepEqual(applicant.answers.answers.specialization, ["spec-1"])
    assert.equal(applicant.answers.accounts.steam, PREVIEW_STEAM_ID)
    const window = applicant.plan.windows.find((item) => item.id === "q1")!
    const fields = windowFieldModels(cs, {
        window,
        prefill: { answers: previewWindowPrefill(applicant, window) },
        timeZone: "Europe/Prague",
    })
    // Text and single selects show placeholders; yes/no and multi-selects a choice.
    const hours = fields.find((field) => field.id === "q-hours")!
    assert.equal(
        hours.control.kind === "text" && hours.control.value,
        undefined
    )
    const microphone = fields.find((field) => field.id === "q-microphone")!
    assert.deepEqual(
        microphone.control.kind === "select" && microphone.control.values,
        ["no"]
    )
    const specialization = fields.find(
        (field) => field.id === "q-specialization"
    )!
    assert.deepEqual(
        specialization.control.kind === "select" &&
            specialization.control.values,
        []
    )
})

test("a required verified Steam shows as verified in the review (N4-26)", () => {
    const applicant = previewApplicant(
        { ...form, requireVerifiedSteam: true },
        categories,
        sample
    )
    assert.equal(applicant.verifiedSteamId, PREVIEW_STEAM_ID)
    const review = applicationReviewView(cs, {
        clanName: "Vlci",
        draftId: "preview",
        plan: applicant.plan,
        answers: applicant.answers,
        verifiedSteamId: applicant.verifiedSteamId,
    })
    assert.match(JSON.stringify(review), /Steam ověřen/)
})

test("the decision preview is the real card with all five buttons (N4-39)", () => {
    const applicant = previewApplicant(form, categories, sample)
    const card = applicationCardView(cs, {
        number: 42,
        games: applicant.plan.games,
        applicantId: "0",
        applicantName: "Hráč 17",
        categoryLabel: "Hlavní člen",
        submittedAt: "2026-10-11T18:21:00.000Z",
        timeZone: "Europe/Prague",
        inGameName: "Hráč 17",
        ...previewCardAnswers(cs, applicant),
        supportRoleIds: [],
        mercenaryAvailable: true,
    })
    const json = JSON.stringify(card)
    for (const label of [
        "Přijmout jako člena",
        "Přijmout jako rekruta",
        "Přijmout jako žoldáka",
        "Zamítnout…",
        "Ještě nerozhodnuto",
    ])
        assert.ok(json.includes(label), label)
    assert.match(json, /Pěchota/)
})

test("the web review lists each step's answers in the clan language", () => {
    const applicant = previewApplicant(form, categories, sample)
    const rows = webReviewRows(
        cs,
        applicant.plan,
        applicant.answers,
        applicant.verifiedSteamId
    )
    assert.deepEqual(
        rows.map((row) => row.title),
        ["O tobě", "Herní účty", "Otázky klanu"]
    )
    assert.deepEqual(rows[0]!.lines[2], {
        label: cs.review.name,
        value: "Hráč 17",
    })
    assert.deepEqual(rows[1]!.lines[0], {
        label: "Steam",
        value: PREVIEW_STEAM_ID,
    })
    assert.ok(
        rows[2]!.lines.some(
            (line) =>
                line.label === cs.defaultForm.microphone.label &&
                line.value === cs.fields.no
        )
    )
})

const settings: MembershipSettings = {
    enabled: true,
    panelTitle: "Přidej se",
    panelDescription: "",
    autoAssignRecruitOnApply: false,
    categories: [
        {
            id: "main",
            gameId: "hell_let_loose",
            label: "Hlavní člen",
            supportRoleIds: [],
            recruitRoleIds: [],
            finalRoleIds: [],
            modalQuestions: [],
            assignmentType: "member",
        },
    ],
}

test("the save bar counts each changed setting, category and question (N4-44)", () => {
    const before = { settings, form }
    assert.equal(membershipChangeCount(before, before), 0)
    const after = {
        settings: {
            ...settings,
            panelTitle: "Přidej se ke klanu Vlci",
            webFormEnabled: true,
            categories: [
                { ...settings.categories[0]!, askSpecialization: false },
            ],
        },
        form: updateQuestion(form, { ...form.about[0]!, required: false }),
    }
    assert.equal(membershipChangeCount(before, after), 4)
    // An empty text and a missing one are the same.
    assert.equal(
        membershipChangeCount(before, {
            settings: { ...settings, applicationWelcomeMessage: "" },
            form,
        }),
        0
    )
})

test("the page copy has the same keys in cs, en and de", () => {
    const keys = (value: unknown, prefix = ""): string[] =>
        value && typeof value === "object"
            ? Object.entries(value).flatMap(([key, child]) =>
                  keys(child, `${prefix}${key}.`)
              )
            : [prefix]
    for (const namespace of [
        "membershipApplication",
        "applicationWeb",
    ] as const) {
        const reference = keys(csMessages[namespace]).sort()
        assert.deepEqual(keys(enMessages[namespace]).sort(), reference)
        assert.deepEqual(keys(deMessages[namespace]).sort(), reference)
    }
})

test("Czech copy is the board's (N4-02, N4-11, N4-24, N4-42)", () => {
    const t = csMessages.membershipApplication
    assert.equal(
        t.description,
        "Jeden formulář v několika oknech, odeslaný až na konci. Pak soukromé vlákno, role a rozhodnutí."
    )
    assert.equal(t.form.windowFull, "Okno je plné.")
    assert.equal(
        t.form.windowFullText,
        "Discord dovolí v jednom okně nejvýš 5 polí. Další otázku dejte do nového okna."
    )
    assert.equal(t.web.switch, "Nabídnout i vyplnění na webu")
    assert.equal(
        csMessages.applicationWeb.autosave,
        "Rozpracované se ukládá samo."
    )
})
