"use client"

import { Check, ExternalLink, Loader2 } from "lucide-react"
import { useEffect, useId, useMemo, useState } from "react"

import {
    planApplication,
    type ApplicationAnswers,
    type PlannedWindow,
    type WindowIssue,
} from "@/domain/membership/application-plan"
import {
    windowFieldModels,
    type ApplicationFieldModel,
} from "@/domain/membership/application-fields"
import type {
    ApplicationCategory,
    ApplicationForm,
} from "@/domain/membership/application-form"
import type { PreviousPlayer } from "@/domain/membership/previous-players"
import { getApplicationMessages } from "@/lib/clan-language/application"
import { issueText } from "@/domain/membership/application-views"
import { fillTemplate } from "@/domain/discord-messages/format"
import type { Dictionary } from "@/i18n/dictionaries"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import { webReviewRows } from "./review-rows"

export type WebApplicationData = {
    guildId: string
    clanName: string
    applicantName: string
    /** The clan language: the form's words and the fixed fields. */
    language: string
    timeZone: string
    form: ApplicationForm
    categories: ApplicationCategory[]
    answers: ApplicationAnswers
    verifiedSteamId: string | null
    previousPlayers: PreviousPlayer[]
    linkedPlatformIds: string[]
    /** Where the applicant already is. */
    status:
        | { state: "editing" }
        | { state: "queued" }
        | { state: "failed"; reason: string }
        | { state: "done"; threadId: string }
}

type Status = WebApplicationData["status"]
type SaveResponse =
    | { ok: true; answers: ApplicationAnswers }
    | {
          ok: false
          reason?: string
          issues?: { fieldId: string; issue: string }[]
      }

const REVIEW = "review"

function initialValues(fields: readonly ApplicationFieldModel[]) {
    return Object.fromEntries(
        fields.map((field) => {
            const control = field.control
            return [
                field.id,
                control.kind === "select"
                    ? control.values
                    : control.value
                      ? [control.value]
                      : [],
            ]
        })
    )
}

/**
 * The clan application on the Logi web (Variant B, L6-16, L6-17, N4-42):
 * the same windows as in Discord, one step at a time, each saved on "Další
 * krok"; then the review and one "Odeslat přihlášku". The bot then creates
 * the same private thread and card as for the Discord windows.
 */
export function WebApplicationForm({
    data,
    t,
    now,
}: {
    data: WebApplicationData
    t: Dictionary["applicationWeb"]
    /** "Now" from the server, for the last-seen dates of found players. */
    now: number
}) {
    const id = useId()
    const copy = getApplicationMessages(data.language)
    const [answers, setAnswers] = useState(data.answers)
    const [status, setStatus] = useState<Status>(data.status)
    const plan = useMemo(
        () =>
            planApplication({
                form: data.form,
                categories: data.categories,
                answers,
                previousPlayers: data.previousPlayers,
            }),
        [data.form, data.categories, data.previousPlayers, answers]
    )
    const firstOpen = plan.windows.find(
        (window) => !answers.completedWindows.includes(window.id)
    )
    const [step, setStep] = useState<string>(firstOpen?.id ?? REVIEW)
    const window = plan.windows.find((item) => item.id === step) ?? null
    const fields = useMemo(
        () =>
            window
                ? windowFieldModels(copy, {
                      window,
                      prefill: {
                          answers,
                          verifiedSteamId: data.verifiedSteamId,
                          linkedPlatformIds: data.linkedPlatformIds,
                      },
                      timeZone: data.timeZone,
                      now,
                  })
                : [],
        [copy, window, answers, data, now]
    )
    const [values, setValues] = useState<Record<string, string[]>>(() =>
        initialValues(fields)
    )
    const [valuesFor, setValuesFor] = useState(step)
    if (valuesFor !== step) {
        // A new step starts from what was saved for it.
        setValuesFor(step)
        setValues(initialValues(fields))
    }
    const [issues, setIssues] = useState<WindowIssue[]>([])
    const [message, setMessage] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    // While the bot creates the thread, ask where the application is.
    useEffect(() => {
        if (status.state !== "queued") return
        const timer = setInterval(async () => {
            const response = await fetch(`/api/applications/${data.guildId}`, {
                cache: "no-store",
            }).catch(() => null)
            const body = (await response
                ?.json()
                .catch(() => null)) as Status | null
            if (body && body.state !== "queued") setStatus(body)
        }, 2500)
        return () => clearInterval(timer)
    }, [status.state, data.guildId])

    async function post(body: unknown) {
        const response = await fetch(`/api/applications/${data.guildId}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
        })
        return (await response.json().catch(() => null)) as
            (SaveResponse & Record<string, unknown>) | null
    }

    function reasonText(reason: string | undefined) {
        switch (reason) {
            case "expired":
                return t.expired
            case "busy":
                return t.busy
            case "disabled":
                return t.disabled
            case "open-application":
                return t.alreadyOpen
            case "in-clan":
                return t.member
            case "incomplete":
            case "invalid":
                return t.fixErrors
            default:
                return t.unavailable
        }
    }

    async function next(current: PlannedWindow) {
        setBusy(true)
        setMessage(null)
        try {
            const body = await post({
                action: "save",
                windowId: current.id,
                values: Object.fromEntries(
                    current.fields.map((field) => [
                        field.id,
                        values[field.id] ?? [],
                    ])
                ),
            })
            if (body?.ok) {
                const saved = body.answers
                setAnswers(saved)
                setIssues([])
                const nextPlan = planApplication({
                    form: data.form,
                    categories: data.categories,
                    answers: saved,
                    previousPlayers: data.previousPlayers,
                })
                const index = nextPlan.windows.findIndex(
                    (item) => item.id === current.id
                )
                const following = nextPlan.windows
                    .slice(index + 1)
                    .find((item) => !saved.completedWindows.includes(item.id))
                setStep(following?.id ?? REVIEW)
                return
            }
            setIssues(
                (body?.issues ?? []).map((issue) => ({
                    fieldId: issue.fieldId,
                    issue: issue.issue as WindowIssue["issue"],
                }))
            )
            setMessage(reasonText(body?.reason))
        } catch {
            setMessage(t.unavailable)
        } finally {
            setBusy(false)
        }
    }

    async function submit() {
        setBusy(true)
        setMessage(null)
        try {
            const body = await post({ action: "submit" })
            if (body?.ok) setStatus({ state: "queued" })
            else {
                setMessage(reasonText(body?.reason))
                const windowId = body?.windowId
                if (typeof windowId === "string") setStep(windowId)
            }
        } catch {
            setMessage(t.unavailable)
        } finally {
            setBusy(false)
        }
    }

    const steps = [
        ...(["about", "accounts", "questions"] as const).flatMap((kind) => {
            const first = plan.windows.find((item) => item.kind === kind)
            return first
                ? [{ id: first.id, kind, label: copy.windowNames[kind] }]
                : []
        }),
        { id: REVIEW, kind: "review" as const, label: t.review },
    ]
    const currentKind = window?.kind ?? "review"
    const threadUrl =
        status.state === "done"
            ? `https://discord.com/channels/${data.guildId}/${status.threadId}`
            : null

    return (
        <article className="bg-card mx-auto w-full max-w-2xl space-y-6 rounded-2xl border p-5 shadow-sm sm:p-7">
            <header className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-semibold">
                        {fillTemplate(t.brand, { clan: data.clanName })}
                    </span>
                    <span className="text-muted-foreground">
                        {fillTemplate(t.signedInAs, {
                            name: data.applicantName,
                        })}
                    </span>
                </div>
                <h1 className="text-2xl font-semibold">
                    {fillTemplate(t.title, { clan: data.clanName })}
                </h1>
                {status.state === "editing" ? (
                    <nav aria-label={t.stepsLabel}>
                        <ol className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                            {steps.map((item, index) => {
                                const active = item.kind === currentKind
                                return (
                                    <li
                                        key={item.id}
                                        aria-current={
                                            active ? "step" : undefined
                                        }
                                        className={cn(
                                            "flex items-center gap-1.5",
                                            active
                                                ? "font-semibold"
                                                : "text-muted-foreground"
                                        )}
                                    >
                                        <span
                                            aria-hidden="true"
                                            className={cn(
                                                "flex size-5 items-center justify-center rounded-full text-xs",
                                                active
                                                    ? "bg-foreground text-background"
                                                    : "bg-muted"
                                            )}
                                        >
                                            {index + 1}
                                        </span>
                                        {item.label}
                                    </li>
                                )
                            })}
                        </ol>
                    </nav>
                ) : null}
            </header>

            {status.state === "queued" ? (
                <p
                    role="status"
                    className="text-muted-foreground flex items-center gap-2 text-sm"
                >
                    <Loader2
                        className="size-4 animate-spin"
                        aria-hidden="true"
                    />
                    {t.queued}
                </p>
            ) : status.state === "done" ? (
                <div role="status" className="space-y-3">
                    <p className="flex items-center gap-2 text-sm">
                        <Check
                            className="size-4 text-emerald-600"
                            aria-hidden="true"
                        />
                        {t.done}
                    </p>
                    {threadUrl ? (
                        <Button
                            asChild
                            variant="outline"
                            className="rounded-xl"
                        >
                            <a
                                href={threadUrl}
                                target="_blank"
                                rel="noreferrer"
                            >
                                {t.openThread}
                                <ExternalLink
                                    className="size-4"
                                    aria-hidden="true"
                                />
                            </a>
                        </Button>
                    ) : null}
                </div>
            ) : status.state === "failed" ? (
                <div role="alert" className="space-y-3">
                    <p className="text-destructive text-sm">{t.failed}</p>
                    <Button
                        type="button"
                        className="rounded-xl"
                        disabled={busy}
                        onClick={() => void submit()}
                    >
                        {t.retry}
                    </Button>
                </div>
            ) : window ? (
                <form
                    className="space-y-5"
                    onSubmit={(event) => {
                        event.preventDefault()
                        void next(window)
                    }}
                    noValidate
                >
                    {plan.steamLocked &&
                    window.kind === "accounts" &&
                    !data.verifiedSteamId ? (
                        <p className="bg-muted/60 rounded-lg p-3 text-sm">
                            {t.steamLocked}
                        </p>
                    ) : null}
                    {fields.map((field) => {
                        const fieldIssue = issues.find(
                            (issue) => issue.fieldId === field.id
                        )
                        return (
                            <Field
                                key={field.id}
                                id={`${id}-${field.id}`}
                                field={field}
                                values={values[field.id] ?? []}
                                error={
                                    fieldIssue
                                        ? issueText(copy, window, fieldIssue)
                                        : null
                                }
                                t={t}
                                onChange={(next) =>
                                    setValues((current) => ({
                                        ...current,
                                        [field.id]: next,
                                    }))
                                }
                            />
                        )
                    })}
                    {issues
                        .filter(
                            (issue) =>
                                !fields.some(
                                    (field) => field.id === issue.fieldId
                                )
                        )
                        .map((issue) => (
                            <p
                                key={issue.fieldId}
                                role="alert"
                                className="text-destructive text-sm"
                            >
                                {issueText(copy, window, issue)}
                            </p>
                        ))}
                    {message ? (
                        <p role="alert" className="text-destructive text-sm">
                            {message}
                        </p>
                    ) : null}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-muted-foreground text-xs">
                            {t.autosave}
                        </p>
                        <div className="flex gap-2">
                            {plan.windows[0]?.id !== window.id ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="rounded-xl"
                                    onClick={() => {
                                        const index = plan.windows.findIndex(
                                            (item) => item.id === window.id
                                        )
                                        setStep(
                                            plan.windows[index - 1]?.id ??
                                                window.id
                                        )
                                    }}
                                >
                                    {t.back}
                                </Button>
                            ) : null}
                            <Button
                                type="submit"
                                className="rounded-xl"
                                disabled={busy}
                            >
                                {busy ? t.saving : t.next}
                            </Button>
                        </div>
                    </div>
                </form>
            ) : (
                <section className="space-y-4" aria-labelledby={`${id}-review`}>
                    <h2 id={`${id}-review`} className="text-lg font-semibold">
                        {t.reviewTitle}
                    </h2>
                    <ul className="divide-y rounded-xl border">
                        {webReviewRows(
                            copy,
                            plan,
                            answers,
                            data.verifiedSteamId
                        ).map((row) => (
                            <li
                                key={row.kind}
                                className="flex items-start gap-3 p-4"
                            >
                                <div className="min-w-0 flex-1 space-y-1">
                                    <h3 className="text-sm font-semibold">
                                        {row.title}
                                    </h3>
                                    <dl className="space-y-0.5 text-sm">
                                        {row.lines.map((line) => (
                                            <div
                                                key={line.label}
                                                className="flex flex-wrap gap-x-1"
                                            >
                                                <dt className="text-muted-foreground">
                                                    {line.label}:
                                                </dt>
                                                <dd className="break-words">
                                                    {line.value}
                                                </dd>
                                            </div>
                                        ))}
                                    </dl>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="rounded-lg"
                                    onClick={() => setStep(row.windowId)}
                                >
                                    {t.edit}
                                </Button>
                            </li>
                        ))}
                    </ul>
                    {message ? (
                        <p role="alert" className="text-destructive text-sm">
                            {message}
                        </p>
                    ) : null}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-muted-foreground text-xs">
                            {t.reviewNote}
                        </p>
                        <Button
                            type="button"
                            className="rounded-xl"
                            disabled={busy}
                            onClick={() => void submit()}
                        >
                            {busy ? t.submitting : t.submit}
                        </Button>
                    </div>
                </section>
            )}
        </article>
    )
}

function Field({
    id,
    field,
    values,
    error,
    t,
    onChange,
}: {
    id: string
    field: ApplicationFieldModel
    values: string[]
    error: string | null
    t: Dictionary["applicationWeb"]
    onChange(values: string[]): void
}) {
    const control = field.control
    const describedBy =
        [field.description ? `${id}-help` : "", error ? `${id}-error` : ""]
            .filter(Boolean)
            .join(" ") || undefined
    const label = (
        <>
            {field.label}
            {field.required ? (
                <span className="text-destructive ml-0.5" aria-hidden="true">
                    *
                </span>
            ) : null}
            {field.required ? (
                <span className="sr-only"> ({t.required})</span>
            ) : null}
        </>
    )
    const help = field.description ? (
        <p id={`${id}-help`} className="text-muted-foreground text-xs">
            {field.description}
        </p>
    ) : null
    const errorLine = error ? (
        <p id={`${id}-error`} role="alert" className="text-destructive text-xs">
            {error}
        </p>
    ) : null

    if (control.kind === "select") {
        const toggle = (value: string) => {
            if (!control.multi) {
                onChange(values[0] === value && !field.required ? [] : [value])
                return
            }
            onChange(
                values.includes(value)
                    ? values.filter((item) => item !== value)
                    : [...values, value].slice(0, control.max)
            )
        }
        return (
            <fieldset
                className="space-y-2"
                aria-describedby={describedBy}
                aria-invalid={error ? true : undefined}
            >
                <legend className="text-sm font-medium">{label}</legend>
                {help}
                {control.multi && control.max > 1 && !field.description ? (
                    <p className="text-muted-foreground text-xs">
                        {fillTemplate(t.chooseUpTo, {
                            min: String(control.min),
                            max: String(control.max),
                        })}
                    </p>
                ) : null}
                <div
                    role={control.multi ? "group" : "radiogroup"}
                    className="flex flex-wrap gap-2"
                >
                    {control.options.map((option) => {
                        const checked = values.includes(option.value)
                        return (
                            <button
                                key={option.value}
                                type="button"
                                role={control.multi ? "checkbox" : "radio"}
                                aria-checked={checked}
                                onClick={() => toggle(option.value)}
                                className={cn(
                                    "focus-visible:ring-ring/50 rounded-lg border px-3 py-1.5 text-left text-sm transition-colors focus-visible:ring-[3px] focus-visible:outline-none",
                                    checked
                                        ? "border-foreground bg-foreground/5 font-medium"
                                        : "hover:bg-muted"
                                )}
                            >
                                <span className="flex items-center gap-1.5">
                                    {checked ? (
                                        <Check
                                            className="size-3.5"
                                            aria-hidden="true"
                                        />
                                    ) : null}
                                    {option.label}
                                </span>
                                {option.description ? (
                                    <span className="text-muted-foreground block text-xs font-normal">
                                        {option.description}
                                    </span>
                                ) : null}
                            </button>
                        )
                    })}
                </div>
                {errorLine}
            </fieldset>
        )
    }

    const value = values[0] ?? ""
    return (
        <div className="space-y-1.5">
            <label htmlFor={id} className="block text-sm font-medium">
                {label}
            </label>
            {help}
            {control.kind === "text" && control.paragraph ? (
                <Textarea
                    id={id}
                    value={value}
                    maxLength={control.maxLength}
                    placeholder={control.placeholder}
                    aria-describedby={describedBy}
                    aria-invalid={error ? true : undefined}
                    onChange={(event) => onChange([event.target.value])}
                    className="min-h-24 rounded-xl"
                />
            ) : (
                <Input
                    id={id}
                    value={value}
                    inputMode={
                        control.kind === "member" ||
                        (control.kind === "text" && control.numeric)
                            ? "numeric"
                            : undefined
                    }
                    maxLength={control.kind === "text" ? control.maxLength : 20}
                    placeholder={control.placeholder}
                    aria-describedby={describedBy}
                    aria-invalid={error ? true : undefined}
                    onChange={(event) => onChange([event.target.value])}
                    className="rounded-xl"
                />
            )}
            {control.kind === "member" ? (
                <p className="text-muted-foreground text-xs">{t.memberHint}</p>
            ) : null}
            {errorLine}
        </div>
    )
}
