import {
    EMPTY_APPLICATION_ANSWERS,
    planApplication,
    submittedAccounts,
    submittedAnswers,
    type ApplicationAnswers,
    type ApplicationPlan,
    type PlannedWindow,
} from "@/domain/membership/application-plan"
import {
    categoryAsksSpecialization,
    categoryGame,
    isHellLetLoose,
    type ApplicationCategory,
    type ApplicationForm,
    type ApplicationQuestion,
} from "@/domain/membership/application-form"
import type { ApplicationCopy } from "@/domain/membership/application-copy"
import { formatAnswer } from "@/domain/membership/application-answers"

/**
 * A sample applicant for the settings page's previews (N4-25, N4-26,
 * N4-39): "Hráč 17" applying for the first category that sees a window,
 * with answers that fill each kind of question.
 */

export type PreviewSampleText = {
    /** "Hráč 17". */
    name: string
    /** A short text answer. */
    shortText: string
    /** "Hledám tým na pravidelné zápasy…". */
    longText: string
}

export const PREVIEW_STEAM_ID = "76561198000000017"

/** Hell Let Loose categories that ask for a specialization come first. */
function rankedCategories(categories: readonly ApplicationCategory[]) {
    const score = (category: ApplicationCategory) =>
        (isHellLetLoose(categoryGame(category)) ? 2 : 0) +
        (categoryAsksSpecialization(category) ? 1 : 0)
    return [...categories].sort((a, b) => score(b) - score(a))
}

function sampleValues(
    question: ApplicationQuestion,
    text: PreviewSampleText
): string[] {
    switch (question.type) {
        case "select":
            return question.options?.[0] ? [question.options[0].id] : []
        case "multi_select": {
            const options = question.options ?? []
            // "Medik, Velitel čety": two choices past the first when there are.
            const picked = options.length > 2 ? options.slice(1, 3) : options
            return picked
                .slice(0, Math.max(1, question.maxValues ?? picked.length))
                .map((option) => option.id)
        }
        case "yes_no":
            return ["no"]
        case "number":
            return [question.kind === "age" ? "24" : "10"]
        case "long_text":
            return [text.longText]
        case "short_text":
            return [text.shortText]
        case "member":
            // A real member cannot be shown in a sample.
            return []
    }
}

export type PreviewApplicant = {
    category: ApplicationCategory | undefined
    plan: ApplicationPlan
    answers: ApplicationAnswers
    verifiedSteamId: string | null
}

/** The sample applicant who sees `windowKey`, or the first category. */
export function previewApplicant(
    form: ApplicationForm,
    categories: readonly ApplicationCategory[],
    text: PreviewSampleText,
    windowKey?: string
): PreviewApplicant {
    const ranked = rankedCategories(categories)
    const planFor = (category: ApplicationCategory | undefined) =>
        planApplication({
            form,
            categories,
            answers: {
                ...EMPTY_APPLICATION_ANSWERS,
                games: category ? [categoryGame(category)] : [],
                categoryId: category?.id,
            },
        })
    const category =
        (windowKey
            ? ranked.find((item) =>
                  planFor(item).windows.some(
                      (window) => window.id === windowKey
                  )
              )
            : undefined) ?? ranked[0]
    const base = planFor(category)
    const answers: ApplicationAnswers = {
        games: base.games,
        categoryId: category?.id,
        inGameName: text.name,
        accounts: base.steamLocked ? {} : { steam: PREVIEW_STEAM_ID },
        answers: Object.fromEntries(
            base.windows.flatMap((window) =>
                window.fields.flatMap((field) =>
                    field.kind === "question"
                        ? [
                              [
                                  field.question.id,
                                  sampleValues(field.question, text),
                              ],
                          ]
                        : []
                )
            )
        ),
        completedWindows: base.windows.map((window) => window.id),
    }
    return {
        category,
        plan: base,
        answers,
        verifiedSteamId: base.steamLocked ? PREVIEW_STEAM_ID : null,
    }
}

/**
 * What the window preview shows filled in: the choices of yes/no and
 * multi-select questions and the game and category; text fields and single
 * selects show their placeholders, as on the board.
 */
export function previewWindowPrefill(
    applicant: PreviewApplicant,
    window: PlannedWindow
): ApplicationAnswers {
    const shown = new Set(
        window.fields.flatMap((field) =>
            field.kind === "question" &&
            (field.question.type === "yes_no" ||
                field.question.type === "multi_select")
                ? [field.question.id]
                : []
        )
    )
    return {
        ...applicant.answers,
        inGameName: undefined,
        accounts: {},
        answers: Object.fromEntries(
            Object.entries(applicant.answers.answers).filter(([id]) =>
                shown.has(id)
            )
        ),
    }
}

/** The answers as the thread card shows them. */
export function previewCardAnswers(
    copy: ApplicationCopy,
    applicant: PreviewApplicant
) {
    return {
        accounts: submittedAccounts(
            applicant.answers,
            applicant.verifiedSteamId
        ),
        answers: submittedAnswers(
            applicant.plan,
            applicant.answers,
            (question, values) => formatAnswer(question, values, copy.fields)
        ),
    }
}
