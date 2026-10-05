import {
    errorCard,
    escapeMarkdownText,
    type MessageBlock,
    type MessageButton,
    type MessageChip,
    type MessageField,
    type MessageView,
} from "../discord-messages/message-view"
import {
    discordWeekdayTimestamp,
    fillTemplate,
    formatCount,
} from "../discord-messages/format"
import { linkFlowId } from "../game-accounts/account-views"
import { GAME_LABELS, type GameId } from "../games/game"

import {
    nextWindow,
    submittedAccounts,
    windowComplete,
    type ApplicationAnswers,
    type ApplicationPlan,
    type PlannedWindow,
    type SubmittedAccounts,
    type SubmittedAnswer,
    type WindowIssue,
} from "./application-plan"
import {
    categoryGame,
    type ApplicationCategory,
    type ApplicationQuestion,
} from "./application-form"
import type { ApplicationOutcome } from "./application-decision"
import type { ApplicationCopy } from "./application-copy"
import { formatAnswer } from "./application-answers"

/**
 * Every Discord message of the application (L6, L4 1.1–1.3, L2 1.8, M3 1.6)
 * as a framework-free {@link MessageView}. The bot sends these through its
 * message kit and the settings page previews the same views (N4-10, N4-26,
 * N4-39), so both show the same words.
 */

// --- Custom IDs ----------------------------------------------------------------

/** The panel button keeps its ID so panels posted before the redesign still work. */
export const APPLICATION_START_ID = "membership:apply"
export const APPLICATION_BUTTON_PREFIX = "application:"
export const APPLICATION_WINDOW_PREFIX = "application-window:"
export const APPLICATION_DECISION_PREFIX = "application-decision:"
export const APPLICATION_REJECT_PREFIX = "application-reject:"

/** "Pokračovat" / "Upravit": opens `windowId` of the draft. */
export const openWindowId = (draftId: string, windowId: string) =>
    `${APPLICATION_BUTTON_PREFIX}${draftId}:open:${windowId}`
export const submitApplicationId = (draftId: string) =>
    `${APPLICATION_BUTTON_PREFIX}${draftId}:submit`
export const cancelApplicationId = (draftId: string) =>
    `${APPLICATION_BUTTON_PREFIX}${draftId}:cancel`
/** A window's modal; `new` before the first window creates the draft. */
export const windowModalId = (draftId: string, windowId: string) =>
    `${APPLICATION_WINDOW_PREFIX}${draftId}:${windowId}`
export const decisionButtonId = (
    action: "member" | "recruit" | "mercenary" | "reject" | "undecided"
) => `${APPLICATION_DECISION_PREFIX}${action}`

export type ParsedApplicationButton =
    | { draftId: string; action: "open"; windowId: string }
    | { draftId: string; action: "submit" | "cancel" }

export function parseApplicationButton(
    customId: string
): ParsedApplicationButton | null {
    if (!customId.startsWith(APPLICATION_BUTTON_PREFIX)) return null
    const [draftId, action, windowId] = customId
        .slice(APPLICATION_BUTTON_PREFIX.length)
        .split(":")
    if (!draftId) return null
    if (action === "open" && windowId)
        return { draftId, action: "open", windowId }
    if (action === "submit" || action === "cancel") return { draftId, action }
    return null
}

export function parseWindowModalId(customId: string) {
    if (!customId.startsWith(APPLICATION_WINDOW_PREFIX)) return null
    const [draftId, windowId] = customId
        .slice(APPLICATION_WINDOW_PREFIX.length)
        .split(":")
    return draftId && windowId ? { draftId, windowId } : null
}

// --- Shared formatting ----------------------------------------------------------

const t = fillTemplate

/** "A a B", "A, B a C" with the clan language's "a" / "and" / "und". */
export function joinList(conjunction: string, items: readonly string[]) {
    if (items.length <= 1) return items[0] ?? ""
    return `${items.slice(0, -1).join(", ")} ${conjunction} ${items[items.length - 1]}`
}

const lowerFirst = (value: string, locale: string) =>
    value ? value.charAt(0).toLocaleLowerCase(locale) + value.slice(1) : value

export function gameNames(games: readonly GameId[]) {
    return games.map((game) => GAME_LABELS[game]).join(", ")
}

export const categoryName = (
    category: Pick<ApplicationCategory, "id" | "label">
) => category.label?.trim() || category.id

/** The header label "PŘIHLÁŠKA DO KLANU VLCI · KROK 2 ZE 3" (laid out upper case). */
function stepLabel(
    copy: ApplicationCopy,
    clanName: string,
    step: number | "review",
    total: number
) {
    return [
        t(copy.label, { clan: clanName }),
        step === "review"
            ? copy.reviewStep
            : t(copy.step, { step: String(step), total: String(total) }),
    ].join(" · ")
}

/** The Discord window title "Přihláška · 1 ze 3 · O tobě" or "Přihláška · 3b · Otázky klanu". */
export function windowTitle(
    copy: ApplicationCopy,
    window: Pick<PlannedWindow, "kind" | "step" | "suffix">,
    totalSteps: number
) {
    const name = copy.windowNames[window.kind]
    return (
        window.suffix
            ? t(copy.windowTitleExtra, {
                  step: String(window.step),
                  suffix: window.suffix,
                  name,
              })
            : t(copy.windowTitle, {
                  step: String(window.step),
                  total: String(totalSteps),
                  name,
              })
    ).slice(0, 45)
}

const platformName = (
    copy: ApplicationCopy,
    platform: keyof ApplicationCopy["platforms"]
) => copy.platforms[platform]

function answerText(
    copy: ApplicationCopy,
    item: ApplicationQuestion,
    values: string[]
) {
    const value = formatAnswer(item, values, copy.fields)
    return item.kind === "age" && value
        ? t(copy.progress.ageValue, { value })
        : value
}

function summaryLabel(copy: ApplicationCopy, item: ApplicationQuestion) {
    switch (item.kind) {
        case "source":
        case "age":
        case "referrer":
        case "specialization":
            return copy.summaryLabels[item.kind]
        default:
            return item.label.replace(/[?:]\s*$/, "")
    }
}

/** The step row text of "O tobě" after window 1: "Hell Let Loose, Wardogs · Člen · Hráč 17 · …". */
export function aboutSummary(
    copy: ApplicationCopy,
    plan: ApplicationPlan,
    answers: ApplicationAnswers
) {
    const about = plan.windows.find((window) => window.kind === "about")
    const custom =
        about?.fields.flatMap((field) => {
            if (field.kind !== "question") return []
            const values = answers.answers[field.question.id]
            if (!values?.length) return []
            const value = answerText(copy, field.question, values)
            return value
                ? [
                      field.question.type === "select" ||
                      field.question.type === "multi_select"
                          ? lowerFirst(value, copy.locale)
                          : value,
                  ]
                : []
        }) ?? []
    return [
        gameNames(plan.games),
        plan.category ? categoryName(plan.category) : "",
        answers.inGameName ? escapeMarkdownText(answers.inGameName) : "",
        ...custom.map((value) => escapeMarkdownText(value)),
    ]
        .filter(Boolean)
        .join(" · ")
}

/** The "O tobě" lines of the review: "Hry: … · Kategorie: …" and "Herní jméno: … · Odkud: …". */
function aboutReviewLines(
    copy: ApplicationCopy,
    plan: ApplicationPlan,
    answers: ApplicationAnswers
) {
    const about = plan.windows.find((window) => window.kind === "about")
    const custom =
        about?.fields.flatMap((field) => {
            if (field.kind !== "question") return []
            const values = answers.answers[field.question.id]
            if (!values?.length) return []
            const value = formatAnswer(field.question, values, copy.fields)
            return value
                ? [
                      `${summaryLabel(copy, field.question)}: ${escapeMarkdownText(
                          field.question.type === "select" ||
                              field.question.type === "multi_select"
                              ? lowerFirst(value, copy.locale)
                              : value
                      )}`,
                  ]
                : []
        }) ?? []
    return [
        [
            `${copy.review.games}: ${gameNames(plan.games)}`,
            plan.category
                ? `${copy.review.category}: ${escapeMarkdownText(categoryName(plan.category))}`
                : "",
        ]
            .filter(Boolean)
            .join(" · "),
        [
            answers.inGameName
                ? `${copy.review.name}: ${escapeMarkdownText(answers.inGameName)}`
                : "",
            ...custom,
        ]
            .filter(Boolean)
            .join(" · "),
    ].filter(Boolean)
}

/** "Steam 7656… · Xbox Hrac17CZ" (the verified chip goes on the row). */
export function accountsLines(
    copy: ApplicationCopy,
    accounts: SubmittedAccounts
) {
    return (["steam", "epic", "xbox", "playstation"] as const)
        .filter((platform) => accounts[platform])
        .map(
            (platform) =>
                `${platformName(copy, platform)} ${escapeMarkdownText(accounts[platform]!)}`
        )
}

/** The clan-question lines of the review; long answers get their own line. */
function questionReviewLines(
    copy: ApplicationCopy,
    plan: ApplicationPlan,
    answers: ApplicationAnswers
) {
    const short: string[] = []
    const long: string[] = []
    for (const window of plan.windows) {
        if (window.kind === "about") continue
        for (const field of window.fields) {
            if (field.kind !== "question") continue
            const values = answers.answers[field.question.id]
            if (!values?.length) continue
            const value = formatAnswer(field.question, values, copy.fields)
            if (!value) continue
            const line = `${summaryLabel(copy, field.question)}: ${
                field.question.type === "member"
                    ? value
                    : escapeMarkdownText(value)
            }`
            if (
                field.question.type === "long_text" ||
                field.question.type === "member"
            )
                long.push(line)
            else short.push(line)
        }
    }
    return [short.join(" · "), ...long].filter(Boolean)
}

// --- Panel (L6-12..L6-15, N4-10) -------------------------------------------------

export type ApplicationPanelInput = {
    title: string
    text: string
    imageUrl?: string | null
    categories: readonly ApplicationCategory[]
    /** Windows of the longest application: two or three. */
    windows: 2 | 3
    /** Variant B (N4-42): the link to the web form when it is switched on. */
    webFormUrl?: string | null
    accentColor?: string | null
    managedUrl?: string
}

export function applicationPanelView(
    copy: ApplicationCopy,
    input: ApplicationPanelInput
): MessageView {
    const lines = input.categories.map((category) =>
        [
            `**${escapeMarkdownText(categoryName(category).slice(0, 80))}**`,
            GAME_LABELS[categoryGame(category)],
            ...(category.description?.trim()
                ? [category.description.trim().slice(0, 240)]
                : []),
        ].join(" · ")
    )
    const buttons: MessageButton[] = [
        {
            kind: "action",
            id: APPLICATION_START_ID,
            label: copy.panel.apply,
            style: "primary",
        },
        ...(input.webFormUrl
            ? [
                  {
                      kind: "link" as const,
                      url: input.webFormUrl,
                      label: copy.panel.applyOnWeb,
                  },
              ]
            : []),
    ]
    const blocks: MessageBlock[] = [
        ...(input.imageUrl
            ? [
                  {
                      kind: "gallery" as const,
                      items: [
                          {
                              url: input.imageUrl,
                              description: input.title.slice(0, 1024),
                          },
                      ],
                  },
              ]
            : []),
        {
            kind: "text",
            markdown: [
                `### ${escapeMarkdownText(input.title.trim()).slice(0, 256)}`,
                input.text.trim().slice(0, 2500),
            ]
                .filter(Boolean)
                .join("\n"),
        },
        ...(lines.length
            ? [{ kind: "text" as const, markdown: lines.join("\n") }]
            : []),
        {
            kind: "text",
            markdown: `-# ${
                input.windows === 3
                    ? copy.panel.windowsNote.three
                    : copy.panel.windowsNote.two
            }`,
        },
        { kind: "separator", divider: true, spacing: "small" },
        { kind: "buttons", buttons },
    ]
    return {
        accent: input.accentColor?.trim()
            ? { custom: input.accentColor.trim() }
            : "clan",
        blocks,
        footer: { kind: "managed", managedUrl: input.managedUrl },
    }
}

// --- Between windows (L6-24..L6-27) and the review (L6-38..L6-40) ---------------

export type ApplicationProgressInput = {
    clanName: string
    draftId: string
    plan: ApplicationPlan
    answers: ApplicationAnswers
    verifiedSteamId?: string | null
    /** "Ověřit Steam přes web" target; shown before window 2 while not verified. */
    verifySteamUrl?: string | null
}

const STEP_KINDS = ["about", "accounts", "questions"] as const

function stepWindows(plan: ApplicationPlan, kind: PlannedWindow["kind"]) {
    return plan.windows.filter((window) => window.kind === kind)
}

function stepDone(
    plan: ApplicationPlan,
    kind: PlannedWindow["kind"],
    input: ApplicationProgressInput
) {
    const windows = stepWindows(plan, kind)
    return (
        windows.length > 0 &&
        windows.every((window) =>
            windowComplete(window, input.answers, input.verifiedSteamId)
        )
    )
}

function countClanQuestions(plan: ApplicationPlan) {
    return stepWindows(plan, "questions").reduce(
        (total, window) => total + window.fields.length,
        0
    )
}

function stepRow(
    copy: ApplicationCopy,
    kind: (typeof STEP_KINDS)[number],
    input: ApplicationProgressInput
): MessageField {
    const { plan, answers, verifiedSteamId } = input
    const done = stepDone(plan, kind, input)
    const first = stepWindows(plan, kind)[0]
    const edit: MessageButton | undefined =
        done && first
            ? {
                  kind: "action",
                  id: openWindowId(input.draftId, first.id),
                  label: copy.progress.edit,
                  style: "secondary",
              }
            : undefined
    if (kind === "about")
        return {
            title: copy.windowNames.about,
            ...(done
                ? {
                      chip: { label: copy.progress.done, tone: "success" },
                      text: aboutSummary(copy, plan, answers),
                  }
                : {}),
            action: edit,
        }
    if (kind === "accounts") {
        if (verifiedSteamId)
            return {
                title: copy.windowNames.accounts,
                chip: { label: copy.progress.steamVerified, tone: "success" },
                text: t(copy.progress.accountsVerified, {
                    id: verifiedSteamId,
                }),
                action: edit,
            }
        return {
            title: copy.windowNames.accounts,
            ...(done
                ? { chip: { label: copy.progress.done, tone: "success" } }
                : {}),
            text: done
                ? accountsLines(copy, submittedAccounts(answers)).join(" · ")
                : plan.steamLocked
                  ? copy.progress.accountsLocked
                  : copy.progress.accountsPending,
            action: edit,
        }
    }
    return {
        title: copy.windowNames.questions,
        ...(done
            ? { chip: { label: copy.progress.done, tone: "success" } }
            : {}),
        text: done
            ? undefined
            : formatCount(
                  copy.locale,
                  countClanQuestions(plan),
                  copy.progress.questionsCount
              ),
        action: edit,
    }
}

function nextIntro(copy: ApplicationCopy, window: PlannedWindow) {
    if (window.kind === "about") return copy.progress.intro.about
    if (window.kind === "accounts") return copy.progress.intro.accounts
    return window.suffix
        ? copy.progress.intro.questionsMore
        : copy.progress.intro.questions
}

/**
 * The one private message between windows, edited in place after each
 * window: the next step, every step with "hotovo" and "Upravit", and
 * "Pokračovat" for the next window. With everything filled it is the review.
 */
export function applicationProgressView(
    copy: ApplicationCopy,
    input: ApplicationProgressInput
): MessageView {
    const next = nextWindow(input.plan, input.answers, input.verifiedSteamId)
    if (!next) return applicationReviewView(copy, input)
    const steps = STEP_KINDS.filter(
        (kind) => stepWindows(input.plan, kind).length
    )
    const offerVerify =
        next.kind === "accounts" &&
        !input.verifiedSteamId &&
        Boolean(input.verifySteamUrl)
    return {
        accent: "clan",
        ephemeral: true,
        header: {
            label: stepLabel(
                copy,
                input.clanName,
                next.step,
                input.plan.totalSteps
            ),
            title: copy.windowNames[next.kind],
        },
        blocks: [
            { kind: "text", markdown: nextIntro(copy, next) },
            {
                kind: "fields",
                items: steps.map((kind) => stepRow(copy, kind, input)),
            },
            { kind: "separator", divider: true, spacing: "small" },
            {
                kind: "buttons",
                buttons: [
                    {
                        kind: "action",
                        id: openWindowId(input.draftId, next.id),
                        label: copy.progress.continue,
                        style: "primary",
                    },
                    ...(offerVerify
                        ? [
                              {
                                  kind: "link" as const,
                                  url: input.verifySteamUrl!,
                                  label: input.plan.steamLocked
                                      ? copy.progress.verifySteamRequired
                                      : copy.progress.verifySteam,
                              },
                          ]
                        : []),
                    // The `/link` guide inside the application (L4-60): it
                    // links the account, then this message comes back.
                    ...(next.kind === "accounts"
                        ? [
                              {
                                  kind: "action" as const,
                                  id: linkFlowId(
                                      {
                                          kind: "application",
                                          draftId: input.draftId,
                                      },
                                      "start"
                                  ),
                                  label: copy.progress.findAccount,
                                  style: "secondary" as const,
                              },
                          ]
                        : []),
                    {
                        kind: "action",
                        id: cancelApplicationId(input.draftId),
                        label: copy.progress.cancel,
                        style: "secondary",
                    },
                ],
            },
            { kind: "text", markdown: `-# ${copy.progress.keepNote}` },
        ],
    }
}

/** "Zkontroluj a odešli": every step with "Upravit", then one submit (L6-38..L6-40). */
export function applicationReviewView(
    copy: ApplicationCopy,
    input: ApplicationProgressInput
): MessageView {
    const { plan, answers } = input
    const accounts = submittedAccounts(answers, input.verifiedSteamId)
    const edit = (kind: PlannedWindow["kind"]): MessageButton | undefined => {
        const first = stepWindows(plan, kind)[0]
        return first
            ? {
                  kind: "action",
                  id: openWindowId(input.draftId, first.id),
                  label: copy.progress.edit,
                  style: "secondary",
              }
            : undefined
    }
    const rows: MessageField[] = [
        {
            title: copy.windowNames.about,
            text: aboutReviewLines(copy, plan, answers).join("\n"),
            action: edit("about"),
        },
        {
            title: copy.windowNames.accounts,
            ...(accounts.steamVerified
                ? {
                      chip: {
                          label: copy.progress.steamVerified,
                          tone: "success" as const,
                      },
                  }
                : {}),
            text: accountsLines(copy, accounts).join("\n") || undefined,
            action: edit("accounts"),
        },
        ...(stepWindows(plan, "questions").length
            ? [
                  {
                      title: copy.windowNames.questions,
                      text:
                          questionReviewLines(copy, plan, answers).join("\n") ||
                          undefined,
                      action: edit("questions"),
                  },
              ]
            : []),
    ]
    return {
        accent: "clan",
        ephemeral: true,
        header: {
            label: stepLabel(copy, input.clanName, "review", plan.totalSteps),
            title: copy.review.title,
        },
        blocks: [
            { kind: "fields", items: rows },
            { kind: "separator", divider: true, spacing: "small" },
            {
                kind: "buttons",
                buttons: [
                    {
                        kind: "action",
                        id: submitApplicationId(input.draftId),
                        label: copy.review.submit,
                        style: "primary",
                    },
                    {
                        kind: "action",
                        id: cancelApplicationId(input.draftId),
                        label: copy.review.cancel,
                        style: "secondary",
                    },
                ],
            },
            { kind: "text", markdown: `-# ${copy.review.note}` },
        ],
    }
}

/** One field problem as a sentence ("Steam ID nevypadá správně. …"). */
export function issueText(
    copy: ApplicationCopy,
    window: PlannedWindow,
    issue: WindowIssue
) {
    const field = window.fields.find((item) => item.id === issue.fieldId)
    const label =
        field?.kind === "question"
            ? field.question.label
            : field?.kind === "games"
              ? copy.fields.games.label
              : field?.kind === "category"
                ? copy.fields.category.label
                : field?.kind === "inGameName"
                  ? copy.fields.name.label
                  : field?.kind === "account"
                    ? copy.platforms[field.platform]
                    : field?.kind === "previousPlayer"
                      ? copy.fields.previous.label
                      : ""
    const template = {
        required: copy.issues.required,
        number: copy.issues.number,
        "too-long": copy.issues.tooLong,
        choice: copy.issues.choice,
        "too-few": copy.issues.tooFew,
        "too-many": copy.issues.tooMany,
        member: copy.issues.member,
        steam: copy.issues.steam,
        "account-missing": copy.issues.accountMissing,
        unknown: copy.issues.unknown,
    }[issue.issue]
    return t(template, { field: escapeMarkdownText(label) })
}

/** "Něco v okně nesedí" (L6-54): the step with "opravit" and the reason, one way back. */
export function applicationFixView(
    copy: ApplicationCopy,
    input: {
        clanName: string
        draftId: string
        plan: ApplicationPlan
        window: PlannedWindow
        issues: readonly WindowIssue[]
    }
): MessageView {
    const kind = input.window.kind
    return {
        accent: "clan",
        ephemeral: true,
        header: {
            label: stepLabel(
                copy,
                input.clanName,
                input.window.step,
                input.plan.totalSteps
            ),
            title: copy.fixTitle[kind],
        },
        blocks: [
            {
                kind: "fields",
                items: [
                    {
                        title: copy.windowNames[kind],
                        chip: { label: copy.progress.fix, tone: "danger" },
                        text: [
                            ...new Set(
                                input.issues.map((issue) =>
                                    issueText(copy, input.window, issue)
                                )
                            ),
                        ].join("\n"),
                        action: {
                            kind: "action",
                            id: `${openWindowId(input.draftId, input.window.id)}:edit`,
                            label: copy.progress.edit,
                            style: "secondary",
                        },
                    },
                ],
            },
            { kind: "separator", divider: true, spacing: "small" },
            {
                kind: "buttons",
                buttons: [
                    {
                        kind: "action",
                        id: openWindowId(input.draftId, input.window.id),
                        label: copy.fixButton[kind],
                        style: "primary",
                    },
                    {
                        kind: "action",
                        id: cancelApplicationId(input.draftId),
                        label: copy.progress.cancel,
                        style: "secondary",
                    },
                ],
            },
        ],
    }
}

// --- After submit (L6-41) and errors (L6-52..L6-57, L4-20..L4-25) ----------------

export function applicationSentView(
    copy: ApplicationCopy,
    input: { threadId: string; threadUrl: string }
): MessageView {
    return {
        accent: "clan",
        ephemeral: true,
        header: { title: copy.sent.title },
        blocks: [
            {
                kind: "text",
                markdown: t(copy.sent.body, { thread: `<#${input.threadId}>` }),
            },
            {
                kind: "buttons",
                buttons: [
                    {
                        kind: "link",
                        url: input.threadUrl,
                        label: copy.sent.openThread,
                    },
                ],
            },
        ],
    }
}

const channelRef = (channelId?: string | null) =>
    channelId ? `<#${channelId}>` : undefined

export const applicationErrors = {
    cancelled: (copy: ApplicationCopy, panelChannelId?: string | null) =>
        errorCard({
            title: copy.cancelled.title,
            body: t(copy.cancelled.body, {
                channel: channelRef(panelChannelId) ?? "",
            }),
        }),
    expired: (copy: ApplicationCopy, panelChannelId?: string | null) =>
        errorCard({
            title: copy.expired.title,
            body: t(copy.expired.body, {
                channel: channelRef(panelChannelId) ?? "",
            }),
        }),
    windowExpired: (
        copy: ApplicationCopy,
        input: {
            savedSteps: string[]
            windowName: string
            continueId: string
        }
    ) =>
        errorCard({
            title: copy.windowExpired.title,
            body: input.savedSteps.length
                ? t(copy.windowExpired.body, {
                      steps: joinList(copy.listAnd, input.savedSteps),
                      window: input.windowName,
                  })
                : t(copy.windowExpired.bodyNothing, {
                      window: input.windowName,
                  }),
            action: {
                kind: "action",
                id: input.continueId,
                label: copy.windowExpired.continue,
                style: "primary",
            },
        }),
    alreadyInClan: (
        copy: ApplicationCopy,
        input: { clanName: string; ticketChannelId?: string | null }
    ) =>
        errorCard({
            title: t(copy.alreadyInClan.title, { clan: input.clanName }),
            body: input.ticketChannelId
                ? t(copy.alreadyInClan.body, {
                      tickets: `<#${input.ticketChannelId}>`,
                  })
                : copy.alreadyInClan.bodyNoTickets,
        }),
    openApplication: (
        copy: ApplicationCopy,
        input: { number: number; threadUrl: string }
    ) =>
        errorCard({
            title: t(copy.openApplication.title, {
                number: String(input.number),
            }),
            body: copy.openApplication.body,
            action: {
                kind: "link",
                url: input.threadUrl,
                label: copy.openApplication.open,
            },
        }),
    closed: (copy: ApplicationCopy, generalChannelId?: string | null) =>
        errorCard({
            title: copy.closed.title,
            body: generalChannelId
                ? t(copy.closed.body, { channel: `<#${generalChannelId}>` })
                : copy.closed.bodyNoChannel,
        }),
    sendFailed: (copy: ApplicationCopy) =>
        errorCard({ title: copy.sendFailed.title, body: copy.sendFailed.body }),
}

// --- The thread card (L6-42..L6-49, L4-26..L4-30) ---------------------------------

export type ApplicationCardInput = {
    number: number
    games: readonly GameId[]
    applicantId: string
    applicantName: string
    categoryLabel: string
    submittedAt: string
    timeZone: string
    inGameName?: string
    accounts: SubmittedAccounts
    answers: readonly SubmittedAnswer[]
    /** Initial status of the membership; a recruit already has roles. */
    status?: "pending" | "recruit"
    supportRoleIds: readonly string[]
    undecided?: { name: string; at: string }
}

function decidersNote(
    copy: ApplicationCopy,
    supportRoleIds: readonly string[]
) {
    return supportRoleIds.length
        ? t(copy.card.deciders, {
              roles: joinList(
                  copy.listAnd,
                  supportRoleIds.map((roleId) => `<@&${roleId}>`)
              ),
          })
        : copy.card.decidersAdmins
}

function clockTime(locale: string, iso: string, timeZone: string) {
    const date = new Date(iso)
    try {
        return new Intl.DateTimeFormat(locale, {
            hour: "2-digit",
            minute: "2-digit",
            timeZone,
        }).format(date)
    } catch {
        return new Intl.DateTimeFormat(locale, {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "UTC",
        }).format(date)
    }
}

/** The answers as the card's fields: "Účty", "Odkud o nás ví", then each question. */
export function applicationCardFields(
    copy: ApplicationCopy,
    input: Pick<ApplicationCardInput, "accounts" | "answers">
): MessageField[] {
    const fields: MessageField[] = []
    const accounts = accountsLines(copy, input.accounts)
    if (accounts.length)
        fields.push({
            title: copy.card.accounts,
            ...(input.accounts.steamVerified
                ? {
                      chip: {
                          label: copy.progress.steamVerified,
                          tone: "success" as const,
                      },
                  }
                : {}),
            text: accounts.join(" · "),
        })
    const source = input.answers.find((answer) => answer.kind === "source")
    const referrer = input.answers.find((answer) => answer.kind === "referrer")
    if (source || referrer)
        fields.push({
            title: copy.card.source,
            text: [
                source ? escapeMarkdownText(source.value) : "",
                referrer
                    ? t(copy.card.invitedBy, { member: referrer.value })
                    : "",
            ]
                .filter(Boolean)
                .join(", "),
        })
    for (const answer of input.answers) {
        if (answer.kind === "source" || answer.kind === "referrer") continue
        fields.push({
            title: answer.label.slice(0, 100),
            text: escapeMarkdownText(answer.value).slice(0, 1000),
        })
    }
    return fields
}

/** The application card with the five decision buttons (L6-43..L6-46). */
export function applicationCardView(
    copy: ApplicationCopy,
    input: ApplicationCardInput
): MessageView {
    const chip: MessageChip = input.undecided
        ? {
              label: t(copy.card.undecided, {
                  name: input.undecided.name,
                  time: clockTime(
                      copy.locale,
                      input.undecided.at,
                      input.timeZone
                  ),
              }),
              tone: "warning",
          }
        : {
              label:
                  input.status === "recruit"
                      ? copy.card.recruitPending
                      : copy.card.pending,
              tone: "warning",
          }
    const submitted = discordWeekdayTimestamp(
        input.submittedAt,
        copy.locale,
        input.timeZone
    )
    return {
        accent: "clan",
        header: {
            label: t(copy.card.label, {
                number: String(input.number),
                games: gameNames(input.games),
            }),
            title: t(copy.card.title, {
                name: input.applicantName,
                category: input.categoryLabel,
            }),
            chips: [chip],
        },
        blocks: [
            ...(input.undecided
                ? [{ kind: "text" as const, markdown: copy.card.undecidedNote }]
                : []),
            {
                kind: "meta",
                lines: [
                    {
                        text: [
                            `<@${input.applicantId}>`,
                            submitted
                                ? t(copy.card.submitted, { time: submitted })
                                : "",
                            input.inGameName
                                ? t(copy.card.inGameName, {
                                      name: escapeMarkdownText(
                                          input.inGameName
                                      ),
                                  })
                                : "",
                        ]
                            .filter(Boolean)
                            .join(" · "),
                    },
                ],
            },
            { kind: "fields", items: applicationCardFields(copy, input) },
            { kind: "separator", divider: true, spacing: "small" },
            {
                kind: "buttons",
                buttons: [
                    {
                        kind: "action",
                        id: decisionButtonId("member"),
                        label: copy.card.accept.member,
                        style: "primary",
                    },
                    {
                        kind: "action",
                        id: decisionButtonId("recruit"),
                        label: copy.card.accept.recruit,
                        style: "secondary",
                    },
                    {
                        kind: "action",
                        id: decisionButtonId("mercenary"),
                        label: copy.card.accept.mercenary,
                        style: "secondary",
                    },
                    {
                        kind: "action",
                        id: decisionButtonId("reject"),
                        label: copy.card.reject,
                        style: "danger",
                    },
                    {
                        kind: "action",
                        id: decisionButtonId("undecided"),
                        label: copy.card.undecidedButton,
                        style: "secondary",
                    },
                ],
            },
        ],
        footer: {
            kind: "managed",
            notes: [decidersNote(copy, input.supportRoleIds)],
        },
    }
}

const OUTCOME_TONE: Record<ApplicationOutcome, MessageChip["tone"]> = {
    member: "success",
    recruit: "success",
    mercenary: "success",
    pending: "warning",
    denied: "danger",
}

function rolesSentence(
    copy: ApplicationCopy,
    templates: { one: string; other: string },
    roles: readonly string[],
    format: (roleId: string) => string
) {
    return t(roles.length === 1 ? templates.one : templates.other, {
        roles: joinList(copy.listAnd, roles.map(format)),
    })
}

export type DecidedCardInput = {
    number: number
    applicantName: string
    outcome: ApplicationOutcome
    deciderId: string
    decidedAt: string
    timeZone: string
    reason?: string
    /** Roles after the decision, shown when the decision adds any. */
    rolesAfter: readonly string[]
    rolesAdded: readonly string[]
    rolesRemoved: readonly string[]
}

/** The card after a decision, edited in place (L6-48, L4-30, L4-33). */
export function applicationDecidedCardView(
    copy: ApplicationCopy,
    input: DecidedCardInput
): MessageView {
    const decided = discordWeekdayTimestamp(
        input.decidedAt,
        copy.locale,
        input.timeZone
    )
    const blocks: MessageBlock[] = [
        {
            kind: "meta",
            lines: [
                {
                    text: t(copy.card.decidedBy, {
                        member: `<@${input.deciderId}>`,
                        time: decided ?? "",
                    }).replace(/ · $/, ""),
                },
            ],
        },
    ]
    if (input.reason?.trim())
        blocks.push({
            kind: "text",
            markdown: `> ${escapeMarkdownText(input.reason.trim()).slice(0, 1000)}`,
        })
    const lines: string[] = []
    if (input.rolesAdded.length)
        lines.push(
            rolesSentence(
                copy,
                copy.card.rolesAdd,
                input.rolesAfter,
                (roleId) => `<@&${roleId}>`
            )
        )
    if (input.rolesRemoved.length)
        lines.push(
            rolesSentence(
                copy,
                copy.card.rolesRemove,
                input.rolesRemoved,
                (roleId) => `<@&${roleId}>`
            )
        )
    if (lines.length) blocks.push({ kind: "text", markdown: lines.join("\n") })
    blocks.push({ kind: "separator", divider: true, spacing: "small" })
    return {
        accent: "clan",
        header: {
            label: t(copy.card.closedLabel, { number: String(input.number) }),
            title: t(copy.card.decidedTitle[input.outcome], {
                name: input.applicantName,
            }),
            chips: [
                {
                    label: copy.card.outcome[input.outcome],
                    tone: OUTCOME_TONE[input.outcome],
                },
                ...(input.rolesAdded.length
                    ? [
                          {
                              label: copy.card.rolesPending,
                              tone: "warning" as const,
                          },
                      ]
                    : []),
            ],
        },
        blocks,
        footer: { kind: "managed", notes: [copy.card.closedFooter] },
    }
}

// --- DMs (L6-50, L4-31..L4-34, L2-54, L2-55, L2-59, L2-B13) ------------------------

export type DecisionDmInput = {
    clanName: string
    number: number
    outcome: ApplicationOutcome
    gameId: GameId
    reason?: string
    /** Role names, never mentions: Discord cannot show mentions outside the server. */
    roleNames: readonly string[]
    threadUrl?: string
    ticketChannelName?: string | null
    settingsUrl?: string
}

export function applicationDecisionDmView(
    copy: ApplicationCopy,
    input: DecisionDmInput
): MessageView {
    const blocks: MessageBlock[] = []
    let title: string
    const reason = input.reason?.trim()
        ? `> ${escapeMarkdownText(input.reason.trim()).slice(0, 1000)}`
        : undefined
    if (input.outcome === "denied") {
        title = copy.dm.rejectedTitle
        if (reason) blocks.push({ kind: "text", markdown: reason })
        blocks.push({
            kind: "text",
            markdown: input.ticketChannelName
                ? t(copy.dm.rejectedHelp, {
                      clan: escapeMarkdownText(input.clanName),
                      channel: escapeMarkdownText(input.ticketChannelName),
                  })
                : t(copy.dm.rejectedHelpNoTickets, {
                      clan: escapeMarkdownText(input.clanName),
                  }),
        })
    } else if (input.outcome === "pending") {
        title = copy.dm.pendingTitle
        blocks.push({ kind: "text", markdown: copy.dm.pendingBody })
        if (reason) blocks.push({ kind: "text", markdown: reason })
    } else {
        title = copy.dm.accepted[input.outcome]
        const body = [
            t(copy.dm.acceptedBody, { game: GAME_LABELS[input.gameId] }),
            ...(input.roleNames.length
                ? [
                      t(
                          input.roleNames.length === 1
                              ? copy.dm.roles.one
                              : copy.dm.roles.other,
                          {
                              roles: joinList(
                                  copy.listAnd,
                                  input.roleNames.map(escapeMarkdownText)
                              ),
                          }
                      ),
                  ]
                : []),
        ].join(" ")
        blocks.push({ kind: "text", markdown: body })
        if (reason) blocks.push({ kind: "text", markdown: reason })
    }
    if (input.threadUrl)
        blocks.push({
            kind: "buttons",
            buttons: [
                {
                    kind: "link",
                    url: input.threadUrl,
                    label: copy.dm.openThread,
                },
            ],
        })
    return {
        accent: "clan",
        header: {
            label: t(copy.dm.label, {
                clan: input.clanName,
                number: String(input.number),
            }),
            title,
        },
        blocks,
        footer: {
            kind: "dm",
            clanName: input.clanName,
            settingsUrl: input.settingsUrl,
        },
    }
}

/** The DM after submit when "Poslat uchazeči DM s potvrzením" is on (N4-36). */
export function applicationConfirmationDmView(
    copy: ApplicationCopy,
    input: {
        clanName: string
        number: number
        threadUrl: string
        settingsUrl?: string
    }
): MessageView {
    return {
        accent: "clan",
        header: {
            label: t(copy.dm.label, {
                clan: input.clanName,
                number: String(input.number),
            }),
            title: t(copy.dm.confirmationTitle, {
                number: String(input.number),
            }),
        },
        blocks: [
            { kind: "text", markdown: copy.dm.confirmationBody },
            {
                kind: "buttons",
                buttons: [
                    {
                        kind: "link",
                        url: input.threadUrl,
                        label: copy.dm.openThread,
                    },
                ],
            },
        ],
        footer: {
            kind: "dm",
            clanName: input.clanName,
            settingsUrl: input.settingsUrl,
        },
    }
}

// --- Decision replies (L6-58, L6-59, M3-39..M3-43) ---------------------------------

export const decisionErrors = {
    notAllowed: (
        copy: ApplicationCopy,
        input: {
            categoryLabel: string
            supportRoleIds: readonly string[]
            title?: string
        }
    ) =>
        errorCard({
            title: input.title ?? copy.decision.notAllowed.title,
            body: input.supportRoleIds.length
                ? t(copy.decision.notAllowed.body, {
                      category: escapeMarkdownText(input.categoryLabel),
                      roles: joinList(
                          copy.listAnd,
                          input.supportRoleIds.map((roleId) => `<@&${roleId}>`)
                      ),
                  })
                : t(copy.decision.notAllowed.bodyAdmins, {
                      category: escapeMarkdownText(input.categoryLabel),
                  }),
        }),
    unverifiable: (copy: ApplicationCopy) =>
        errorCard({
            title: copy.decision.unverifiable.title,
            body: copy.decision.unverifiable.body,
        }),
    alreadyDecided: (
        copy: ApplicationCopy,
        input: {
            number: number
            deciderId?: string
            outcome?: ApplicationOutcome
            membersUrl?: string
            /** `/close_application` words it "Přihláška #42 je už uzavřená" (M3-43). */
            command?: boolean
        }
    ) =>
        errorCard({
            title: t(
                input.command
                    ? copy.command.alreadyClosed.title
                    : copy.decision.alreadyDecided.title,
                { number: String(input.number) }
            ),
            body: input.command
                ? t(copy.command.alreadyClosed.body, {
                      outcome: input.outcome
                          ? copy.card.outcome[input.outcome]
                          : "",
                  })
                : t(copy.decision.alreadyDecided.body, {
                      member: input.deciderId ? `<@${input.deciderId}>` : "",
                      outcome: input.outcome
                          ? copy.card.outcome[input.outcome]
                          : "",
                  }),
            action: input.membersUrl
                ? {
                      kind: "link",
                      url: input.membersUrl,
                      label: input.command
                          ? copy.command.alreadyClosed.members
                          : copy.decision.alreadyDecided.members,
                  }
                : undefined,
        }),
    notTracked: (copy: ApplicationCopy) =>
        errorCard({
            title: copy.decision.notTracked.title,
            body: copy.decision.notTracked.body,
        }),
    wrongPlace: (copy: ApplicationCopy) =>
        errorCard({
            title: copy.command.wrongPlace.title,
            body: copy.command.wrongPlace.body,
        }),
}

/** The private `/close_application` reply (M3-39, M3-40, M3-B07, L4-34). */
export function closeApplicationReplyView(
    copy: ApplicationCopy,
    input: {
        number: number
        outcome: ApplicationOutcome
        applicantName: string
        /** Role names the decision adds. */
        addedRoleNames: readonly string[]
        dmDelivered: boolean
    }
): MessageView {
    const title =
        input.outcome === "denied"
            ? t(copy.command.rejectedTitle, { number: String(input.number) })
            : t(copy.command.closedTitle, {
                  number: String(input.number),
                  outcome: copy.card.outcome[input.outcome],
              })
    const lines = [
        ...(input.addedRoleNames.length
            ? [
                  t(
                      input.addedRoleNames.length === 1
                          ? copy.command.roles.one
                          : copy.command.roles.other,
                      {
                          name: escapeMarkdownText(input.applicantName),
                          roles: joinList(
                              copy.listAnd,
                              input.addedRoleNames.map(escapeMarkdownText)
                          ),
                      }
                  ),
              ]
            : []),
        input.dmDelivered ? copy.command.delivered : copy.command.notDelivered,
    ]
    return {
        accent: "clan",
        ephemeral: true,
        header: { title },
        blocks: [{ kind: "text", markdown: lines.join(" ") }],
    }
}
