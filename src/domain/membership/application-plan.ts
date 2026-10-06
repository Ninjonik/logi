import {
    APPLICATION_LIMITS,
    accountPlatforms,
    applicationGames,
    categoryGame,
    isHellLetLoose,
    questionVisible,
    type AccountPlatform,
    type ApplicationCategory,
    type ApplicationForm,
    type ApplicationQuestion,
} from "./application-form"
import {
    parseQuestionAnswer,
    parseSteamId,
    type AnswerIssue,
} from "./application-answers"
import type { PreviousPlayer } from "./previous-players"
import { GAME_IDS, type GameId } from "../games/game"

/**
 * Which windows an applicant sees, in which order, and what one window's
 * submission changes (L6-05..L6-11, L6-B01, L6-B12). The same rules serve the
 * Discord windows and the web form; the web form shows all clan questions on
 * one step but validates them window by window.
 */

/** What the applicant has saved so far; a draft (L6-B03). */
export type ApplicationAnswers = {
    games: GameId[]
    categoryId?: string
    inGameName?: string
    accounts: Partial<Record<AccountPlatform, string>> & {
        /** A `platform:id` from "Našli jsme tě…", or "none". */
        previousPlayer?: string
    }
    /** Question ID → values (option IDs, text, a member ID). */
    answers: Record<string, string[]>
    /** Windows the applicant has submitted at least once. */
    completedWindows: string[]
}

export const EMPTY_APPLICATION_ANSWERS: ApplicationAnswers = {
    games: [],
    accounts: {},
    answers: {},
    completedWindows: [],
}

export type WindowKind = "about" | "accounts" | "questions"

export type PlannedField =
    | { id: "games"; kind: "games"; options: GameId[] }
    | { id: "category"; kind: "category"; options: ApplicationCategory[] }
    | { id: "name"; kind: "inGameName" }
    | { id: "previous"; kind: "previousPlayer"; candidates: PreviousPlayer[] }
    | { id: AccountPlatform; kind: "account"; platform: AccountPlatform }
    | { id: string; kind: "question"; question: ApplicationQuestion }

export type PlannedWindow = {
    /** `about`, `accounts` or the form's question window ID. */
    id: string
    kind: WindowKind
    /** 1, 2 or 3. */
    step: number
    /** "", "b" or "c": windows 3, 3b and 3c. */
    suffix: "" | "b" | "c"
    fields: PlannedField[]
}

export type ApplicationPlan = {
    windows: PlannedWindow[]
    /** The steps of the title "1 ze 3": two, or three with clan questions. */
    totalSteps: number
    /** The games the applicant's visible questions are chosen for. */
    games: GameId[]
    category?: ApplicationCategory
    /** Steam comes only from web verification (N4-B04). */
    steamLocked: boolean
}

export type PlanInput = {
    form: ApplicationForm
    categories: readonly ApplicationCategory[]
    answers: ApplicationAnswers
    previousPlayers?: readonly PreviousPlayer[]
}

/** The field ID of a question in a window. */
export const questionFieldId = (question: Pick<ApplicationQuestion, "id">) =>
    `q-${question.id}`

/** The games an applicant's questions are chosen for. */
export function applicantGames(
    categories: readonly ApplicationCategory[],
    answers: Pick<ApplicationAnswers, "games" | "categoryId">
): GameId[] {
    const clanGames = applicationGames(categories)
    if (clanGames.length <= 1) return clanGames
    const category = categories.find((item) => item.id === answers.categoryId)
    const games = new Set(
        answers.games.filter((game) => clanGames.includes(game))
    )
    if (category) games.add(categoryGame(category))
    return GAME_IDS.filter((game) => games.has(game))
}

const SUFFIXES = ["", "b", "c"] as const

export function planApplication(input: PlanInput): ApplicationPlan {
    const { form, categories, answers } = input
    const clanGames = applicationGames(categories)
    const category = categories.find((item) => item.id === answers.categoryId)
    const chosen = applicantGames(categories, answers)
    // Before window 1 the applicant may still pick any of the clan's games.
    const games = chosen.length ? chosen : clanGames
    const steamLocked = Boolean(
        form.requireVerifiedSteam && games.some(isHellLetLoose)
    )

    const about: PlannedWindow = {
        id: "about",
        kind: "about",
        step: 1,
        suffix: "",
        fields: [
            ...(clanGames.length > 1
                ? [{ id: "games", kind: "games", options: clanGames } as const]
                : []),
            {
                id: "category",
                kind: "category",
                options: [...categories],
            },
            { id: "name", kind: "inGameName" },
            ...form.about.map(
                (question) =>
                    ({
                        id: questionFieldId(question),
                        kind: "question",
                        question,
                    }) as const
            ),
        ],
    }

    const visible = (question: ApplicationQuestion) =>
        questionVisible(question, {
            games,
            categoryId: category?.id,
            categories,
        })
    const accountFields: PlannedField[] = [
        ...accountPlatforms(games, { steamLocked }).map(
            (platform) => ({ id: platform, kind: "account", platform }) as const
        ),
        ...form.accounts.filter(visible).map(
            (question) =>
                ({
                    id: questionFieldId(question),
                    kind: "question",
                    question,
                }) as const
        ),
    ]
    // A manual Steam claim is not offered when Steam must be verified.
    const candidates = (input.previousPlayers ?? []).filter(
        (player) => !(steamLocked && player.platform === "steam")
    )
    const accounts: PlannedWindow = {
        id: "accounts",
        kind: "accounts",
        step: 2,
        suffix: "",
        fields: [
            ...(candidates.length &&
            accountFields.length < APPLICATION_LIMITS.fieldsPerWindow
                ? [
                      {
                          id: "previous",
                          kind: "previousPlayer",
                          candidates,
                      } as const,
                  ]
                : []),
            ...accountFields,
        ],
    }

    const questionWindows: PlannedWindow[] = []
    for (const window of form.questionWindows) {
        const fields = window.questions.filter(visible).map(
            (question) =>
                ({
                    id: questionFieldId(question),
                    kind: "question",
                    question,
                }) as const
        )
        if (!fields.length) continue
        questionWindows.push({
            id: window.id,
            kind: "questions",
            step: 3,
            suffix: SUFFIXES[questionWindows.length] ?? "c",
            fields: fields.slice(0, APPLICATION_LIMITS.fieldsPerWindow),
        })
    }
    const anyCategoryHasQuestions =
        questionWindows.length > 0 ||
        (!category &&
            form.questionWindows.some((window) =>
                categories.some((item) =>
                    window.questions.some((question) =>
                        questionVisible(question, {
                            games,
                            categoryId: item.id,
                            categories,
                        })
                    )
                )
            ))
    return {
        windows: [about, accounts, ...questionWindows],
        totalSteps: anyCategoryHasQuestions ? 3 : 2,
        games,
        category,
        steamLocked,
    }
}

// --- One window's submission -------------------------------------------------

export type WindowIssue = {
    /** The field ID, or `accounts` for "fill at least one account". */
    fieldId: string
    issue: AnswerIssue | "steam" | "account-missing" | "unknown"
}

export type WindowSubmission =
    | { ok: true; answers: ApplicationAnswers }
    | {
          ok: false
          issues: WindowIssue[]
          /**
           * The answers with every valid field of the window applied and the
           * window still unfinished, so an invalid window can be saved and
           * "Upravit" reopens it filled in (L6-09).
           */
          partial: ApplicationAnswers
      }

/** Values per field ID as the modal or the web form sent them. */
export type WindowValues = Readonly<Record<string, readonly string[]>>

const first = (values: WindowValues, id: string) =>
    values[id]?.map((value) => value.trim()).find(Boolean) ?? ""

/**
 * Applies one window to the saved answers. Every field of the window is
 * validated; the window then counts as completed. `verifiedSteamId` is the
 * applicant's verified Steam account, which counts as an account.
 */
export function submitWindow(
    input: PlanInput & {
        windowId: string
        values: WindowValues
        verifiedSteamId?: string | null
    }
): WindowSubmission {
    const plan = planApplication(input)
    const window = plan.windows.find((item) => item.id === input.windowId)
    if (!window)
        return {
            ok: false,
            issues: [{ fieldId: "", issue: "unknown" }],
            partial: input.answers,
        }
    const next: ApplicationAnswers = {
        games: [...input.answers.games],
        categoryId: input.answers.categoryId,
        inGameName: input.answers.inGameName,
        accounts: { ...input.answers.accounts },
        answers: { ...input.answers.answers },
        completedWindows: [...input.answers.completedWindows],
    }
    const issues: WindowIssue[] = []
    const clanGames = applicationGames(input.categories)
    for (const field of window.fields) {
        const raw = input.values[field.id] ?? []
        switch (field.kind) {
            case "games": {
                const games = GAME_IDS.filter((game) =>
                    raw.some((value) => value === game)
                ).filter((game) => clanGames.includes(game))
                if (!games.length)
                    issues.push({ fieldId: field.id, issue: "required" })
                else next.games = games
                break
            }
            case "category": {
                const category = input.categories.find(
                    (item) => item.id === first(input.values, field.id)
                )
                if (!category) {
                    issues.push({ fieldId: field.id, issue: "required" })
                    break
                }
                next.categoryId = category.id
                const game = categoryGame(category)
                if (!next.games.includes(game))
                    next.games = GAME_IDS.filter(
                        (item) => item === game || next.games.includes(item)
                    )
                break
            }
            case "inGameName": {
                const name = first(input.values, field.id)
                if (!name) issues.push({ fieldId: field.id, issue: "required" })
                else if (name.length > APPLICATION_LIMITS.inGameName)
                    issues.push({ fieldId: field.id, issue: "too-long" })
                else next.inGameName = name
                break
            }
            case "previousPlayer": {
                const value = first(input.values, field.id)
                if (
                    value &&
                    value !== "none" &&
                    !field.candidates.some(
                        (candidate) => candidate.key === value
                    )
                )
                    issues.push({ fieldId: field.id, issue: "choice" })
                else next.accounts.previousPlayer = value || undefined
                break
            }
            case "account": {
                const value = first(input.values, field.id)
                if (!value) {
                    delete next.accounts[field.platform]
                    break
                }
                if (field.platform === "steam") {
                    const steam = parseSteamId(value)
                    if (!steam)
                        issues.push({ fieldId: field.id, issue: "steam" })
                    else next.accounts.steam = steam
                } else if (value.length > APPLICATION_LIMITS.accountId)
                    issues.push({ fieldId: field.id, issue: "too-long" })
                else next.accounts[field.platform] = value
                break
            }
            case "question": {
                const parsed = parseQuestionAnswer(field.question, raw)
                if (!parsed.ok)
                    issues.push({ fieldId: field.id, issue: parsed.issue })
                else if (parsed.values.length)
                    next.answers[field.question.id] = parsed.values
                else delete next.answers[field.question.id]
                break
            }
        }
    }
    if (window.kind === "accounts" && !issues.length) {
        if (plan.steamLocked) delete next.accounts.steam
        if (!hasAnyAccount(next, input.verifiedSteamId))
            issues.push({ fieldId: "accounts", issue: "account-missing" })
    }
    if (issues.length) return { ok: false, issues, partial: next }
    if (!next.completedWindows.includes(window.id))
        next.completedWindows.push(window.id)
    return { ok: true, answers: next }
}

/** Steam (typed or verified), Epic, Xbox, PlayStation or a found player. */
export function hasAnyAccount(
    answers: Pick<ApplicationAnswers, "accounts">,
    verifiedSteamId?: string | null
) {
    const accounts = answers.accounts
    return Boolean(
        verifiedSteamId ||
        accounts.steam ||
        accounts.epic ||
        accounts.xbox ||
        accounts.playstation ||
        (accounts.previousPlayer && accounts.previousPlayer !== "none")
    )
}

/**
 * Whether a planned window is done: submitted once and every required field
 * it now shows has an answer (a changed category can add questions).
 */
export function windowComplete(
    window: PlannedWindow,
    answers: ApplicationAnswers,
    verifiedSteamId?: string | null
) {
    if (!answers.completedWindows.includes(window.id)) return false
    return window.fields.every((field) => {
        switch (field.kind) {
            case "games":
                return answers.games.length > 0
            case "category":
                return Boolean(answers.categoryId)
            case "inGameName":
                return Boolean(answers.inGameName)
            case "question":
                return (
                    !field.question.required ||
                    Boolean(answers.answers[field.question.id]?.length)
                )
            default:
                return window.kind !== "accounts"
                    ? true
                    : hasAnyAccount(answers, verifiedSteamId)
        }
    })
}

/** The first window still to fill, or null when the application is ready to submit. */
export function nextWindow(
    plan: ApplicationPlan,
    answers: ApplicationAnswers,
    verifiedSteamId?: string | null
) {
    return (
        plan.windows.find(
            (window) => !windowComplete(window, answers, verifiedSteamId)
        ) ?? null
    )
}

/** The window after `windowId` within the same step (3 → 3b), if any. */
export function nextWindowInStep(plan: ApplicationPlan, windowId: string) {
    const index = plan.windows.findIndex((window) => window.id === windowId)
    const current = plan.windows[index]
    const following = plan.windows[index + 1]
    return current && following && following.step === current.step
        ? following
        : null
}

// --- The submitted application ----------------------------------------------

export type SubmittedAnswer = {
    questionId: string
    kind: ApplicationQuestion["kind"]
    label: string
    /** Display text: option labels, "Ano"/"Ne", a member mention, typed text. */
    value: string
}

export type SubmittedAccounts = {
    steam?: string
    steamVerified: boolean
    epic?: string
    xbox?: string
    playstation?: string
}

/**
 * Accounts the application ends with: a verified Steam account wins, a
 * found player fills its platform when the applicant typed none.
 */
export function submittedAccounts(
    answers: Pick<ApplicationAnswers, "accounts">,
    verifiedSteamId?: string | null
): SubmittedAccounts {
    const accounts: SubmittedAccounts = { steamVerified: false }
    const typed = answers.accounts
    if (typed.steam) accounts.steam = typed.steam
    if (typed.epic) accounts.epic = typed.epic
    if (typed.xbox) accounts.xbox = typed.xbox
    if (typed.playstation) accounts.playstation = typed.playstation
    const previous = typed.previousPlayer
    if (previous && previous !== "none") {
        const [platform, ...rest] = previous.split(":")
        const id = rest.join(":")
        if (
            id &&
            (platform === "steam" ||
                platform === "epic" ||
                platform === "xbox" ||
                platform === "playstation") &&
            !accounts[platform]
        )
            accounts[platform] = id
    }
    if (verifiedSteamId) {
        accounts.steam = verifiedSteamId
        accounts.steamVerified = true
    }
    return accounts
}

/** The visible questions' answers in window order, for the card and the record. */
export function submittedAnswers(
    plan: ApplicationPlan,
    answers: ApplicationAnswers,
    format: (question: ApplicationQuestion, values: string[]) => string
): SubmittedAnswer[] {
    return plan.windows.flatMap((window) =>
        window.fields.flatMap((field) => {
            if (field.kind !== "question") return []
            const values = answers.answers[field.question.id]
            const value = values?.length ? format(field.question, values) : ""
            return value
                ? [
                      {
                          questionId: field.question.id,
                          kind: field.question.kind,
                          label: field.question.label,
                          value,
                      },
                  ]
                : []
        })
    )
}

/**
 * The windows of the longest application, for the panel's note "Přihláška
 * má tři krátká okna…": three when any category gets clan questions.
 */
export function applicationWindowCount(
    form: ApplicationForm,
    categories: readonly ApplicationCategory[]
): 2 | 3 {
    return categories.some(
        (category) =>
            planApplication({
                form,
                categories,
                answers: {
                    ...EMPTY_APPLICATION_ANSWERS,
                    categoryId: category.id,
                },
            }).totalSteps === 3
    )
        ? 3
        : 2
}
