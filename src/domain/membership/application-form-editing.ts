import { GAME_IDS, type GameId } from "../games/game"

import {
    APPLICATION_LIMITS,
    aboutFixedFieldCount,
    accountPlatforms,
    allQuestions,
    applicationGames,
    maxVisibleQuestionCount,
    type ApplicationCategory,
    type ApplicationForm,
    type ApplicationOption,
    type ApplicationQuestion,
    type ApplicationQuestionChoiceType,
    type ApplicationQuestionWindow,
} from "./application-form"

/**
 * Edits of the application form in the settings page's builder (N4-13..N4-24):
 * windows, questions, options and their order. Pure: each edit returns a new
 * form, so the page can count changes and discard them.
 */

/** Window 1 `about`, window 2 `accounts` or a question window's ID. */
export type FormWindowKey = string

export type FormWindowSummary = {
    key: FormWindowKey
    kind: "about" | "accounts" | "questions"
    /** 1, 2, 3, then 3b and 3c for the extra question windows. */
    number: string
    questions: ApplicationQuestion[]
    /** Fields of the applicant who sees the most, fixed fields included (N4-B03). */
    fieldCount: number
    /** Fixed fields the bot always asks before the clan's questions. */
    fixedCount: number
    full: boolean
}

const QUESTION_SUFFIXES = ["", "b", "c"] as const

export function formWindows(
    form: ApplicationForm,
    categories: readonly ApplicationCategory[]
): FormWindowSummary[] {
    const games = applicationGames(categories)
    const aboutFixed = aboutFixedFieldCount(categories)
    const accountFixed = accountPlatforms(
        games.length ? games : ["hell_let_loose"],
        { steamLocked: false }
    ).length
    const summary = (
        key: string,
        kind: FormWindowSummary["kind"],
        number: string,
        questions: ApplicationQuestion[],
        fixedCount: number
    ): FormWindowSummary => {
        // Window 1 cannot filter: the applicant picks game and category there.
        const visible =
            kind === "about"
                ? questions.length
                : maxVisibleQuestionCount(questions, categories)
        const fieldCount = fixedCount + visible
        return {
            key,
            kind,
            number,
            questions,
            fieldCount,
            fixedCount,
            full: fieldCount >= APPLICATION_LIMITS.fieldsPerWindow,
        }
    }
    return [
        summary("about", "about", "1", form.about, aboutFixed),
        summary("accounts", "accounts", "2", form.accounts, accountFixed),
        ...form.questionWindows.map((window, index) =>
            summary(
                window.id,
                "questions",
                `3${QUESTION_SUFFIXES[index] ?? ""}`,
                window.questions,
                0
            )
        ),
    ]
}

function questionsOf(form: ApplicationForm, key: FormWindowKey) {
    if (key === "about") return form.about
    if (key === "accounts") return form.accounts
    return form.questionWindows.find((window) => window.id === key)?.questions
}

function withQuestions(
    form: ApplicationForm,
    key: FormWindowKey,
    questions: ApplicationQuestion[]
): ApplicationForm {
    if (key === "about") return { ...form, about: questions }
    if (key === "accounts") return { ...form, accounts: questions }
    return {
        ...form,
        questionWindows: form.questionWindows.map((window) =>
            window.id === key ? { ...window, questions } : window
        ),
    }
}

/** The window a question is in. */
export function windowOfQuestion(
    form: ApplicationForm,
    questionId: string
): FormWindowKey | null {
    if (form.about.some((question) => question.id === questionId))
        return "about"
    if (form.accounts.some((question) => question.id === questionId))
        return "accounts"
    return (
        form.questionWindows.find((window) =>
            window.questions.some((question) => question.id === questionId)
        )?.id ?? null
    )
}

function uniqueId(taken: ReadonlySet<string>, prefix: string) {
    for (let index = 1; ; index += 1) {
        const id = `${prefix}${index}`
        if (!taken.has(id)) return id
    }
}

/** Question IDs stay stable once saved: answers and drafts use them. */
export function newQuestionId(form: ApplicationForm) {
    return uniqueId(
        new Set(allQuestions(form).map((question) => question.id)),
        "question-"
    )
}

export function newOptionId(options: readonly ApplicationOption[]) {
    return uniqueId(new Set(options.map((option) => option.id)), "option-")
}

/** Options a new select question starts with ("Možnost 1", "Možnost 2"). */
function starterOptions(optionLabel: (index: number) => string) {
    return [1, 2].map((index) => ({
        id: `option-${index}`,
        label: optionLabel(index),
    }))
}

/** A new clan question; the admin names it in the editor. */
export function blankQuestion(
    form: ApplicationForm,
    input: {
        type: ApplicationQuestionChoiceType
        label: string
        optionLabel: (index: number) => string
    }
): ApplicationQuestion {
    return withType(
        {
            id: newQuestionId(form),
            kind: "custom",
            type: "short_text",
            label: input.label,
            required: true,
        },
        input.type,
        input.optionLabel
    )
}

/**
 * A question with another type: selects keep or get options, the multi
 * select its bounds; text types drop them. Built-in questions keep their
 * type (Specializace a select, Věk a number, the referrer a member).
 */
export function withType(
    question: ApplicationQuestion,
    type: ApplicationQuestionChoiceType,
    optionLabel: (index: number) => string
): ApplicationQuestion {
    if (question.kind !== "custom" && question.kind !== "source")
        return question
    const previous = question.options
    const rest = withoutFields(question, ["options", "minValues", "maxValues"])
    if (type === "select" || type === "multi_select") {
        const options = previous?.length
            ? previous
            : starterOptions(optionLabel)
        return {
            ...rest,
            type,
            options,
            ...(type === "multi_select"
                ? {
                      minValues: question.required ? 1 : 0,
                      maxValues: options.length,
                  }
                : {}),
        }
    }
    return { ...rest, type }
}

type OptionalQuestionField =
    | "help"
    | "placeholder"
    | "options"
    | "minValues"
    | "maxValues"
    | "game"
    | "categoryIds"

/** A copy of the question without these optional fields. */
export function withoutFields(
    question: ApplicationQuestion,
    fields: readonly OptionalQuestionField[]
): ApplicationQuestion {
    const copy = { ...question }
    for (const field of fields) delete copy[field]
    return copy
}

/** Whether a question's type can change in the editor. */
export function typeEditable(question: ApplicationQuestion) {
    return question.kind === "custom" || question.kind === "source"
}

/** Whether the editor offers "Jen pro kategorii" (Specializace follows the categories). */
export function categoryFilterEditable(question: ApplicationQuestion) {
    return question.kind !== "specialization"
}

export function addQuestion(
    form: ApplicationForm,
    key: FormWindowKey,
    question: ApplicationQuestion
): ApplicationForm {
    const questions = questionsOf(form, key)
    return questions ? withQuestions(form, key, [...questions, question]) : form
}

export function updateQuestion(
    form: ApplicationForm,
    question: ApplicationQuestion
): ApplicationForm {
    const key = windowOfQuestion(form, question.id)
    if (!key) return form
    return withQuestions(
        form,
        key,
        questionsOf(form, key)!.map((item) =>
            item.id === question.id ? question : item
        )
    )
}

export function removeQuestion(
    form: ApplicationForm,
    questionId: string
): ApplicationForm {
    const key = windowOfQuestion(form, questionId)
    if (!key) return form
    return withQuestions(
        form,
        key,
        questionsOf(form, key)!.filter((item) => item.id !== questionId)
    )
}

/** Moves a question up (-1) or down (+1) in its window ("Přesunout otázku"). */
export function moveQuestion(
    form: ApplicationForm,
    questionId: string,
    offset: number
): ApplicationForm {
    const key = windowOfQuestion(form, questionId)
    if (!key) return form
    const questions = [...questionsOf(form, key)!]
    const from = questions.findIndex((item) => item.id === questionId)
    const to = Math.max(0, Math.min(questions.length - 1, from + offset))
    if (from === to) return form
    const [question] = questions.splice(from, 1)
    questions.splice(to, 0, question!)
    return withQuestions(form, key, questions)
}

/** Drops a dragged question before another one, or at the end of a window. */
export function moveQuestionTo(
    form: ApplicationForm,
    questionId: string,
    target: { window: FormWindowKey; beforeId?: string }
): ApplicationForm {
    const question = allQuestions(form).find((item) => item.id === questionId)
    if (!question || questionId === target.beforeId) return form
    const without = removeQuestion(form, questionId)
    const questions = questionsOf(without, target.window)
    if (!questions) return form
    const index = target.beforeId
        ? questions.findIndex((item) => item.id === target.beforeId)
        : -1
    const next = [...questions]
    next.splice(index < 0 ? next.length : index, 0, question)
    return withQuestions(without, target.window, next)
}

/** "Přidat okno": a new empty question window 3b or 3c. */
export function addQuestionWindow(form: ApplicationForm): {
    form: ApplicationForm
    windowId: string | null
} {
    if (form.questionWindows.length >= APPLICATION_LIMITS.questionWindows)
        return { form, windowId: null }
    const windowId = uniqueId(
        new Set(form.questionWindows.map((window) => window.id)),
        "q"
    )
    const window: ApplicationQuestionWindow = { id: windowId, questions: [] }
    return {
        form: { ...form, questionWindows: [...form.questionWindows, window] },
        windowId,
    }
}

/** Removes an empty question window. */
export function removeQuestionWindow(
    form: ApplicationForm,
    windowId: string
): ApplicationForm {
    const window = form.questionWindows.find((item) => item.id === windowId)
    if (!window || window.questions.length) return form
    return {
        ...form,
        questionWindows: form.questionWindows.filter(
            (item) => item.id !== windowId
        ),
    }
}

// --- Options -------------------------------------------------------------------

export function addOption(
    question: ApplicationQuestion,
    label: string
): ApplicationQuestion {
    const options = question.options ?? []
    if (options.length >= APPLICATION_LIMITS.options) return question
    return {
        ...question,
        options: [...options, { id: newOptionId(options), label }],
    }
}

export function removeOption(
    question: ApplicationQuestion,
    optionId: string
): ApplicationQuestion {
    const options = (question.options ?? []).filter(
        (option) => option.id !== optionId
    )
    return {
        ...question,
        options,
        ...(question.maxValues !== undefined
            ? {
                  maxValues: Math.max(
                      1,
                      Math.min(question.maxValues, options.length)
                  ),
              }
            : {}),
        ...(question.minValues !== undefined
            ? {
                  minValues: Math.min(
                      question.minValues,
                      Math.max(0, options.length)
                  ),
              }
            : {}),
    }
}

export function moveOption(
    question: ApplicationQuestion,
    optionId: string,
    offset: number
): ApplicationQuestion {
    const options = [...(question.options ?? [])]
    const from = options.findIndex((option) => option.id === optionId)
    const to = Math.max(0, Math.min(options.length - 1, from + offset))
    if (from < 0 || from === to) return question
    const [option] = options.splice(from, 1)
    options.splice(to, 0, option!)
    return { ...question, options }
}

// --- Filters -------------------------------------------------------------------

/**
 * "Jen pro hru" choices: each game the clan recruits for (Hell Let Loose
 * and its Vietnam edition count as one in filters) and "all".
 */
export function gameFilterChoices(
    categories: readonly ApplicationCategory[]
): GameId[] {
    const games = applicationGames(categories)
    return GAME_IDS.filter(
        (game) =>
            games.includes(game) &&
            !(
                game === "hell_let_loose_vietnam" &&
                games.includes("hell_let_loose")
            )
    )
}

export function withGame(
    question: ApplicationQuestion,
    game: GameId | null
): ApplicationQuestion {
    const rest = withoutFields(question, ["game"])
    return game ? { ...rest, game } : rest
}

export function withCategory(
    question: ApplicationQuestion,
    categoryId: string,
    included: boolean
): ApplicationQuestion {
    const current = new Set(question.categoryIds ?? [])
    if (included) current.add(categoryId)
    else current.delete(categoryId)
    const rest = withoutFields(question, ["categoryIds"])
    return current.size ? { ...rest, categoryIds: [...current] } : rest
}

/**
 * Whether a category can see a question limited to a game: a Wardogs
 * category never sees a Hell Let Loose question ("Wardogs · otázka je jen
 * pro HLL").
 */
export function categoryMatchesGame(
    question: Pick<ApplicationQuestion, "game">,
    category: Pick<ApplicationCategory, "gameId">
) {
    if (!question.game) return true
    const game = category.gameId ?? "hell_let_loose"
    const hll = (value: GameId) =>
        value === "hell_let_loose" || value === "hell_let_loose_vietnam"
    return game === question.game || (hll(game) && hll(question.game))
}

// --- Changes -------------------------------------------------------------------

/** How many questions and windows differ between two forms (the save bar). */
export function formChangeCount(
    before: ApplicationForm,
    after: ApplicationForm
): number {
    const index = (form: ApplicationForm) =>
        new Map(
            allQuestions(form).map((question) => [
                question.id,
                JSON.stringify({
                    question,
                    window: windowOfQuestion(form, question.id),
                    position: questionsOf(
                        form,
                        windowOfQuestion(form, question.id)!
                    )!.indexOf(question),
                }),
            ])
        )
    const a = index(before)
    const b = index(after)
    let changes = 0
    for (const [id, value] of a) if (b.get(id) !== value) changes += 1
    for (const id of b.keys()) if (!a.has(id)) changes += 1
    const windows = (form: ApplicationForm) =>
        new Set(form.questionWindows.map((window) => window.id))
    const wa = windows(before)
    const wb = windows(after)
    for (const id of wa) if (!wb.has(id)) changes += 1
    for (const id of wb) if (!wa.has(id)) changes += 1
    if (
        Boolean(before.requireVerifiedSteam) !==
        Boolean(after.requireVerifiedSteam)
    )
        changes += 1
    return changes
}

/**
 * The form as it is saved: trimmed texts, no empty help or placeholder
 * (Discord refuses empty texts) and no category filters naming a category
 * that no longer exists or plays another game.
 */
export function normalizeApplicationForm(
    form: ApplicationForm,
    categories: readonly ApplicationCategory[]
): ApplicationForm {
    const question = (item: ApplicationQuestion): ApplicationQuestion => {
        const { help, placeholder, options, categoryIds, ...rest } = item
        const kept = categoryIds?.filter((id) =>
            categories.some(
                (category) =>
                    category.id === id && categoryMatchesGame(item, category)
            )
        )
        return {
            ...rest,
            label: item.label.trim(),
            ...(help?.trim() ? { help: help.trim() } : {}),
            ...(placeholder?.trim() ? { placeholder: placeholder.trim() } : {}),
            ...(options
                ? {
                      options: options.map((option) => ({
                          ...option,
                          label: option.label.trim(),
                      })),
                  }
                : {}),
            ...(kept?.length ? { categoryIds: kept } : {}),
        }
    }
    return {
        ...form,
        about: form.about.map(question),
        accounts: form.accounts.map(question),
        questionWindows: form.questionWindows.map((window) => ({
            ...window,
            questions: window.questions.map(question),
        })),
    }
}
