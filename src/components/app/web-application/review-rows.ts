import {
    submittedAccounts,
    type ApplicationAnswers,
    type ApplicationPlan,
    type PlannedWindow,
} from "@/domain/membership/application-plan"
import { categoryName, gameNames } from "@/domain/membership/application-views"
import type { ApplicationCopy } from "@/domain/membership/application-copy"
import { formatAnswer } from "@/domain/membership/application-answers"

/**
 * The review step of the web form (Variant B, L6-16, N4-26): each step with
 * its answers as plain label and value pairs, in the clan language.
 */

export type ReviewLine = { label: string; value: string }
export type ReviewRow = {
    kind: PlannedWindow["kind"]
    title: string
    /** The first window of the step, opened by "Upravit". */
    windowId: string
    lines: ReviewLine[]
}

export function webReviewRows(
    copy: ApplicationCopy,
    plan: ApplicationPlan,
    answers: ApplicationAnswers,
    verifiedSteamId: string | null
): ReviewRow[] {
    const questionLines = (kind: PlannedWindow["kind"]) =>
        plan.windows
            .filter((window) => window.kind === kind)
            .flatMap((window) =>
                window.fields.flatMap((field) => {
                    if (field.kind !== "question") return []
                    const values = answers.answers[field.question.id] ?? []
                    const value = values.length
                        ? formatAnswer(field.question, values, copy.fields)
                        : ""
                    return value ? [{ label: field.question.label, value }] : []
                })
            )
    const first = (kind: PlannedWindow["kind"]) =>
        plan.windows.find((window) => window.kind === kind)?.id
    const rows: ReviewRow[] = []
    const aboutId = first("about")
    if (aboutId)
        rows.push({
            kind: "about",
            title: copy.windowNames.about,
            windowId: aboutId,
            lines: [
                { label: copy.review.games, value: gameNames(plan.games) },
                ...(plan.category
                    ? [
                          {
                              label: copy.review.category,
                              value: categoryName(plan.category),
                          },
                      ]
                    : []),
                ...(answers.inGameName
                    ? [{ label: copy.review.name, value: answers.inGameName }]
                    : []),
                ...questionLines("about"),
            ],
        })
    const accountsId = first("accounts")
    if (accountsId) {
        const accounts = submittedAccounts(answers, verifiedSteamId)
        rows.push({
            kind: "accounts",
            title: copy.windowNames.accounts,
            windowId: accountsId,
            lines: [
                ...(["steam", "epic", "xbox", "playstation"] as const)
                    .filter((platform) => accounts[platform])
                    .map((platform) => ({
                        label: copy.platforms[platform],
                        value:
                            platform === "steam" && accounts.steamVerified
                                ? `${accounts.steam} · ${copy.progress.steamVerified}`
                                : accounts[platform]!,
                    })),
                ...questionLines("accounts"),
            ],
        })
    }
    const questionsId = first("questions")
    if (questionsId)
        rows.push({
            kind: "questions",
            title: copy.windowNames.questions,
            windowId: questionsId,
            lines: questionLines("questions"),
        })
    return rows
}
