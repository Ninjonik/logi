"use client"

import {
    AlertTriangle,
    GripVertical,
    Info,
    Lock,
    Plus,
    Trash2,
} from "lucide-react"
import { useId, useState, type DragEvent, type KeyboardEvent } from "react"

import {
    addQuestion,
    addQuestionWindow,
    blankQuestion,
    formWindows,
    gameFilterChoices,
    moveQuestion,
    moveQuestionTo,
    removeQuestion,
    removeQuestionWindow,
    updateQuestion,
    type FormWindowSummary,
} from "@/domain/membership/application-form-editing"
import {
    APPLICATION_LIMITS,
    applicationGames,
    isHellLetLoose,
    type ApplicationCategory,
    type ApplicationForm,
    type ApplicationFormIssue,
    type ApplicationQuestion,
} from "@/domain/membership/application-form"
import {
    DiscordMessagePreview,
    type DiscordPreviewMentions,
} from "@/components/app/discord-preview/discord-message-preview"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    applicationReviewView,
    categoryName,
    windowTitle,
} from "@/domain/membership/application-views"
import type { MessageStyle } from "@/domain/discord-messages/message-style"
import type { ApplicationCopy } from "@/domain/membership/application-copy"
import { windowFieldModels } from "@/domain/membership/application-fields"
import { fillTemplate } from "@/domain/discord-messages/format"
import type { Dictionary } from "@/i18n/dictionaries"
import type { GameId } from "@/domain/games/game"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

import { previewApplicant, previewWindowPrefill } from "./preview-samples"
import { QuestionEditor } from "./question-editor"
import { WindowPreview } from "./window-preview"

type FormCopy = Dictionary["membershipApplication"]["form"]

export type FormBuilderPreview = {
    clanCopy: ApplicationCopy
    language: string
    style?: MessageStyle | null
    labels: Dictionary["discordPreview"]
    clanName: string
    timeZone: string
    now: number
    mentions?: DiscordPreviewMentions
}

/**
 * "Formulář: okna a otázky" (N4-11..N4-26): the windows with their fixed
 * fields and the clan's questions, the question editor, the window-full
 * warning with "Přidat okno", and beside them the preview of one window
 * as a Discord modal and the review message the applicant sees last.
 */
export function ApplicationFormBuilder({
    form,
    categories,
    issues,
    t,
    preview,
    onChange,
}: {
    form: ApplicationForm
    categories: readonly ApplicationCategory[]
    issues: readonly ApplicationFormIssue[]
    t: FormCopy
    preview: FormBuilderPreview
    onChange(form: ApplicationForm): void
}) {
    const id = useId()
    const [editingId, setEditingId] = useState<string | null>(null)
    const [dragged, setDragged] = useState<string | null>(null)
    const windows = formWindows(form, categories)
    const firstQuestions = windows.find((window) => window.kind === "questions")
    const [previewKey, setPreviewKey] = useState<string>(
        firstQuestions?.key ?? "about"
    )
    const shownKey = windows.some((window) => window.key === previewKey)
        ? previewKey
        : (firstQuestions?.key ?? "about")
    const games = applicationGames(categories)
    const clanHasHll = games.some(isHellLetLoose)
    const optionLabel = (index: number) =>
        fillTemplate(t.option, { number: String(index) })

    function add(window: FormWindowSummary) {
        const question = blankQuestion(form, {
            type: "short_text",
            label: t.newQuestion,
            optionLabel,
        })
        onChange(addQuestion(form, window.key, question))
        setEditingId(question.id)
    }

    function addWindow() {
        const result = addQuestionWindow(form)
        if (!result.windowId) return
        onChange(result.form)
        setPreviewKey(result.windowId)
    }

    function drop(event: DragEvent, window: string, beforeId?: string) {
        event.preventDefault()
        const questionId = dragged ?? event.dataTransfer.getData("text/plain")
        setDragged(null)
        if (questionId)
            onChange(moveQuestionTo(form, questionId, { window, beforeId }))
    }

    function handleKeys(event: KeyboardEvent, questionId: string) {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return
        event.preventDefault()
        onChange(
            moveQuestion(form, questionId, event.key === "ArrowUp" ? -1 : 1)
        )
        // Keep the focus on the handle the keyboard is moving.
        requestAnimationFrame(() =>
            document
                .querySelector<HTMLElement>(
                    `[data-question-handle="${CSS.escape(questionId)}"]`
                )
                ?.focus()
        )
    }

    const windowName = (window: FormWindowSummary) =>
        fillTemplate(t.window, {
            number: window.number,
            name: t.windowNames[window.kind],
        })
    const gameChip = (game: GameId | undefined) =>
        game
            ? (t.gameShort[game as keyof typeof t.gameShort] ?? game)
            : games.length > 2
              ? t.allGames
              : t.bothGames
    const issuesOf = (questionId: string) =>
        issues.filter((issue) => issue.questionId === questionId)

    // The previews: one window and the review, for the sample applicant.
    const applicant = previewApplicant(form, categories, t.sample, shownKey)
    const plannedWindow = applicant.plan.windows.find(
        (window) => window.id === shownKey
    )
    const shownSummary = windows.find((window) => window.key === shownKey)
    const modalFields = plannedWindow
        ? windowFieldModels(preview.clanCopy, {
              window: plannedWindow,
              prefill: {
                  answers: previewWindowPrefill(applicant, plannedWindow),
              },
              timeZone: preview.timeZone,
              now: preview.now,
          })
        : []
    const previewGame = applicant.category
        ? (t.gameShort[
              (applicant.category.gameId ??
                  "hell_let_loose") as keyof typeof t.gameShort
          ] ?? applicant.category.gameId ?? "")
        : ""

    return (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
            <div className="min-w-0 space-y-4">
                <p className="text-muted-foreground flex gap-2 text-sm">
                    <Info
                        className="mt-0.5 size-4 shrink-0"
                        aria-hidden="true"
                    />
                    <span>{t.note}</span>
                </p>
                {windows.map((window) => {
                    const questionWindowCount = windows.filter(
                        (item) => item.kind === "questions"
                    ).length
                    const canAddWindow =
                        questionWindowCount < APPLICATION_LIMITS.questionWindows
                    const titleId = `${id}-${window.key}-title`
                    return (
                        <section
                            key={window.key}
                            aria-labelledby={titleId}
                            onDragOver={(event) => {
                                if (dragged) event.preventDefault()
                            }}
                            onDrop={(event) => drop(event, window.key)}
                            className={cn(
                                "bg-card rounded-xl border",
                                window.key === shownKey &&
                                    "border-foreground border-2"
                            )}
                        >
                            <header className="flex flex-wrap items-center gap-2 border-b px-3 py-3 sm:px-4">
                                <span
                                    aria-hidden="true"
                                    className="bg-foreground text-background flex size-6 items-center justify-center rounded-full text-xs font-semibold"
                                >
                                    {window.number}
                                </span>
                                <h3
                                    id={titleId}
                                    className="min-w-0 flex-1 font-semibold"
                                >
                                    {windowName(window)}
                                </h3>
                                <span
                                    className={cn(
                                        "rounded-md border px-1.5 py-0.5 text-xs",
                                        window.fieldCount >
                                            APPLICATION_LIMITS.fieldsPerWindow
                                            ? "border-destructive text-destructive"
                                            : window.full
                                              ? "border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                                              : "text-muted-foreground"
                                    )}
                                >
                                    {fillTemplate(t.fieldCount, {
                                        count: String(window.fieldCount),
                                    })}
                                </span>
                                {window.key === shownKey ? (
                                    <span className="text-muted-foreground text-xs">
                                        {t.inPreview}
                                    </span>
                                ) : null}
                            </header>
                            {window.kind === "accounts" ? (
                                <p className="text-muted-foreground border-b px-3 py-2 text-xs sm:px-4">
                                    {t.accountsNote}
                                </p>
                            ) : null}
                            <ul className="divide-y">
                                {fixedRows(window, games, t).map((row) => (
                                    <li
                                        key={row.name}
                                        className="flex items-start gap-3 px-3 py-3 sm:px-4"
                                    >
                                        <Lock
                                            className="text-muted-foreground mt-1 size-3.5 shrink-0"
                                            aria-hidden="true"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm">
                                                {row.name}
                                            </p>
                                            <Chips items={row.chips} />
                                        </div>
                                        <span className="text-muted-foreground text-xs">
                                            {t.fixed}
                                        </span>
                                    </li>
                                ))}
                                {window.questions.map((question) => {
                                    const editing = editingId === question.id
                                    const questionIssues = issuesOf(question.id)
                                    const name =
                                        question.label.trim() || t.newQuestion
                                    return (
                                        <li
                                            key={question.id}
                                            draggable
                                            onDragStart={(event) => {
                                                setDragged(question.id)
                                                event.dataTransfer.setData(
                                                    "text/plain",
                                                    question.id
                                                )
                                                event.dataTransfer.effectAllowed =
                                                    "move"
                                            }}
                                            onDragEnd={() => setDragged(null)}
                                            onDragOver={(event) => {
                                                if (dragged)
                                                    event.preventDefault()
                                            }}
                                            onDrop={(event) => {
                                                event.stopPropagation()
                                                drop(
                                                    event,
                                                    window.key,
                                                    question.id
                                                )
                                            }}
                                            className={cn(
                                                "space-y-3 px-3 py-3 sm:px-4",
                                                editing && "bg-muted/40",
                                                dragged === question.id &&
                                                    "opacity-50"
                                            )}
                                        >
                                            <div className="flex items-start gap-2">
                                                <button
                                                    type="button"
                                                    data-question-handle={
                                                        question.id
                                                    }
                                                    aria-label={fillTemplate(
                                                        t.move,
                                                        { name }
                                                    )}
                                                    title={t.moveHint}
                                                    onKeyDown={(event) =>
                                                        handleKeys(
                                                            event,
                                                            question.id
                                                        )
                                                    }
                                                    className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 -ml-1 flex size-7 shrink-0 cursor-grab items-center justify-center rounded-md focus-visible:ring-[3px] focus-visible:outline-none"
                                                >
                                                    <GripVertical
                                                        className="size-4"
                                                        aria-hidden="true"
                                                    />
                                                </button>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm break-words">
                                                        {name}
                                                    </p>
                                                    <Chips
                                                        items={questionChips(
                                                            question,
                                                            window,
                                                            categories,
                                                            t,
                                                            gameChip
                                                        )}
                                                    />
                                                </div>
                                                <div className="flex shrink-0 gap-1.5">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="rounded-lg"
                                                        aria-expanded={editing}
                                                        aria-label={
                                                            editing
                                                                ? undefined
                                                                : fillTemplate(
                                                                      t.editAria,
                                                                      { name }
                                                                  )
                                                        }
                                                        onClick={() =>
                                                            setEditingId(
                                                                editing
                                                                    ? null
                                                                    : question.id
                                                            )
                                                        }
                                                    >
                                                        {editing
                                                            ? t.close
                                                            : t.edit}
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        className="text-destructive size-8 rounded-lg"
                                                        aria-label={fillTemplate(
                                                            t.remove,
                                                            { name }
                                                        )}
                                                        onClick={() => {
                                                            onChange(
                                                                removeQuestion(
                                                                    form,
                                                                    question.id
                                                                )
                                                            )
                                                            if (editing)
                                                                setEditingId(
                                                                    null
                                                                )
                                                        }}
                                                    >
                                                        <Trash2
                                                            className="size-4"
                                                            aria-hidden="true"
                                                        />
                                                    </Button>
                                                </div>
                                            </div>
                                            {questionIssues.length ? (
                                                <ul
                                                    role="alert"
                                                    className="text-destructive space-y-0.5 pl-9 text-xs"
                                                >
                                                    {questionIssues.map(
                                                        (issue) => (
                                                            <li
                                                                key={issue.code}
                                                            >
                                                                {
                                                                    t.issues[
                                                                        issue
                                                                            .code
                                                                    ]
                                                                }
                                                            </li>
                                                        )
                                                    )}
                                                </ul>
                                            ) : null}
                                            {editing ? (
                                                <QuestionEditor
                                                    question={question}
                                                    inAbout={
                                                        window.kind === "about"
                                                    }
                                                    categories={categories}
                                                    t={t}
                                                    onChange={(next) =>
                                                        onChange(
                                                            updateQuestion(
                                                                form,
                                                                next
                                                            )
                                                        )
                                                    }
                                                    onDone={() =>
                                                        setEditingId(null)
                                                    }
                                                />
                                            ) : null}
                                        </li>
                                    )
                                })}
                            </ul>
                            {window.kind === "questions" &&
                            !window.questions.length ? (
                                <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 border-t px-3 py-3 text-sm sm:px-4">
                                    <span>{t.windowEmpty}</span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="rounded-lg"
                                        onClick={() =>
                                            onChange(
                                                removeQuestionWindow(
                                                    form,
                                                    window.key
                                                )
                                            )
                                        }
                                    >
                                        {fillTemplate(t.removeWindow, {
                                            number: window.number,
                                        })}
                                    </Button>
                                </div>
                            ) : null}
                            {window.kind === "accounts" && clanHasHll ? (
                                <div className="border-t px-3 py-3 sm:px-4">
                                    <div className="bg-muted/50 flex items-start gap-3 rounded-lg p-3">
                                        <Switch
                                            id={`${id}-steam`}
                                            checked={Boolean(
                                                form.requireVerifiedSteam
                                            )}
                                            onCheckedChange={(checked) =>
                                                onChange({
                                                    ...form,
                                                    requireVerifiedSteam:
                                                        checked,
                                                })
                                            }
                                            className="mt-0.5"
                                        />
                                        <Label
                                            htmlFor={`${id}-steam`}
                                            className="block space-y-0.5 font-normal"
                                        >
                                            <span className="block text-sm">
                                                {t.requireSteam}
                                            </span>
                                            <span className="text-muted-foreground block text-xs">
                                                {t.requireSteamHelp}
                                            </span>
                                        </Label>
                                    </div>
                                </div>
                            ) : null}
                            <div className="space-y-3 border-t px-3 py-3 sm:px-4">
                                {window.full ? (
                                    <div
                                        role="status"
                                        className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                                    >
                                        <p className="flex gap-2">
                                            <AlertTriangle
                                                className="mt-0.5 size-4 shrink-0"
                                                aria-hidden="true"
                                            />
                                            <span>
                                                <strong>{t.windowFull}</strong>{" "}
                                                {t.windowFullText}
                                            </span>
                                        </p>
                                        {canAddWindow ? (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="bg-background rounded-lg"
                                                onClick={addWindow}
                                            >
                                                <Plus
                                                    className="size-4"
                                                    aria-hidden="true"
                                                />
                                                {t.addWindow}
                                            </Button>
                                        ) : (
                                            <p className="text-xs">
                                                {t.noMoreWindows}
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="rounded-lg"
                                        onClick={() => add(window)}
                                    >
                                        <Plus
                                            className="size-4"
                                            aria-hidden="true"
                                        />
                                        {t.addQuestion}
                                    </Button>
                                )}
                            </div>
                        </section>
                    )
                })}
                {!windows.some((window) => window.kind === "questions") ? (
                    <Button
                        type="button"
                        variant="outline"
                        className="rounded-lg"
                        onClick={addWindow}
                    >
                        <Plus className="size-4" aria-hidden="true" />
                        {t.addWindow}
                    </Button>
                ) : null}
            </div>

            <div className="min-w-0 space-y-6 xl:sticky xl:top-4 xl:self-start">
                <div className="space-y-2">
                    <div className="flex flex-wrap items-end justify-between gap-2">
                        <h3 className="text-sm font-semibold">
                            {applicant.category && shownSummary
                                ? fillTemplate(t.windowPreview, {
                                      number: shownSummary.number,
                                      game: previewGame,
                                      category: categoryName(
                                          applicant.category
                                      ),
                                  })
                                : fillTemplate(t.windowPreviewNoCategory, {
                                      number: shownSummary?.number ?? "1",
                                  })}
                        </h3>
                        <Select value={shownKey} onValueChange={setPreviewKey}>
                            <SelectTrigger
                                aria-label={t.previewWindowPick}
                                className="h-8 w-auto rounded-lg text-xs"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {windows.map((window) => (
                                    <SelectItem
                                        key={window.key}
                                        value={window.key}
                                    >
                                        {windowName(window)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {plannedWindow ? (
                        <WindowPreview
                            title={windowTitle(
                                preview.clanCopy,
                                plannedWindow,
                                applicant.plan.totalSteps
                            )}
                            fields={modalFields}
                            labels={{
                                region: t.modalLabel,
                                close: t.modalClose,
                                cancel: t.modalCancel,
                                submit: t.modalSubmit,
                            }}
                        />
                    ) : (
                        <p className="text-muted-foreground rounded-xl border border-dashed p-4 text-sm">
                            {t.windowEmpty}
                        </p>
                    )}
                </div>
                <div className="space-y-2">
                    <h3 className="text-sm font-semibold">{t.reviewPreview}</h3>
                    <DiscordMessagePreview
                        view={applicationReviewView(preview.clanCopy, {
                            clanName: preview.clanName,
                            draftId: "preview",
                            plan: applicant.plan,
                            answers: applicant.answers,
                            verifiedSteamId: applicant.verifiedSteamId,
                        })}
                        language={preview.language}
                        style={preview.style}
                        labels={preview.labels}
                        now={preview.now}
                        timeZone={preview.timeZone}
                        mentions={preview.mentions}
                        author={{ name: "Logi" }}
                    />
                </div>
            </div>
        </div>
    )
}

type Chip = { label: string; tone?: "type" | "required" | "plain" }

function Chips({ items }: { items: readonly Chip[] }) {
    return (
        <div className="mt-1 flex flex-wrap gap-1">
            {items.map((item) => (
                <span
                    key={item.label}
                    className={cn(
                        "rounded px-1.5 py-0.5 text-xs",
                        item.tone === "type"
                            ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
                            : item.tone === "required"
                              ? "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                              : "bg-muted text-muted-foreground"
                    )}
                >
                    {item.label}
                </span>
            ))}
        </div>
    )
}

/** The fixed fields of windows 1 and 2 (N4-13, N4-15). */
function fixedRows(
    window: FormWindowSummary,
    games: readonly GameId[],
    t: FormCopy
): Array<{ name: string; chips: Chip[] }> {
    const type = (label: string): Chip => ({ label, tone: "type" })
    const required: Chip = { label: t.required, tone: "required" }
    if (window.kind === "about")
        return [
            ...(games.length > 1
                ? [
                      {
                          name: t.fixedFields.games,
                          chips: [
                              type(t.types.select),
                              required,
                              { label: t.gamesNote },
                          ],
                      },
                  ]
                : []),
            {
                name: t.fixedFields.category,
                chips: [
                    type(t.types.select),
                    required,
                    { label: t.categoryNote },
                ],
            },
            {
                name: t.fixedFields.name,
                chips: [type(t.types.short_text), required],
            },
        ]
    if (window.kind === "accounts") {
        const hll = games.some(isHellLetLoose)
        const all =
            games.length > 2
                ? t.allGames
                : games.length === 2
                  ? t.bothGames
                  : (t.gameShort[
                        (games[0] ?? "hell_let_loose") as keyof typeof t.gameShort
                    ] ?? games[0] ?? "")
        return [
            {
                name: t.fixedFields.steam,
                chips: [type(t.types.short_text), { label: all }],
            },
            ...(hll
                ? (["epic", "xbox", "playstation"] as const).map(
                      (platform) => ({
                          name: t.fixedFields[platform],
                          chips: [
                              type(t.types.short_text),
                              { label: t.gameShort.hell_let_loose },
                          ],
                      })
                  )
                : []),
        ]
    }
    return []
}

function questionChips(
    question: ApplicationQuestion,
    window: FormWindowSummary,
    categories: readonly ApplicationCategory[],
    t: FormCopy,
    gameChip: (game: GameId | undefined) => string
): Chip[] {
    const chips: Chip[] = [{ label: t.types[question.type], tone: "type" }]
    if (question.required) chips.push({ label: t.required, tone: "required" })
    const games = gameFilterChoices(categories)
    if (games.length > 1 || question.game)
        chips.push({
            label: gameChip(
                window.kind === "about" ? undefined : question.game
            ),
        })
    if (question.kind === "specialization")
        chips.push({ label: t.specializationCategories })
    else if (window.kind !== "about" && question.categoryIds?.length)
        chips.push({
            label: question.categoryIds
                .map((id) => {
                    const category = categories.find((item) => item.id === id)
                    return category ? categoryName(category) : id
                })
                .join(", "),
        })
    return chips
}
