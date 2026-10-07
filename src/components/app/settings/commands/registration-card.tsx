"use client"

import { AlertTriangle, Check, Clock, RefreshCw } from "lucide-react"
import { useLocale } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"

import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** What the server read about the bot's last registration (N3-03). */
export type CommandRegistrationView = {
    registeredAt: number | null
    commandCount: number | null
    requestedAt: number | null
    failedAt: number | null
    failure: "forbidden" | "rate_limited" | "unavailable" | null
}

type Text = Dictionary["settingsHub"]["commandsPage"]["registration"]

const pluralForm = (locale: string, count: number) => {
    const form = new Intl.PluralRules(locale).select(count)
    return form === "one" || form === "few" || form === "many" ? form : "other"
}

/** "dnes v 14:02", "včera v 9:10" or a date and time in the reader's language. */
export function registrationTime(
    at: number,
    now: number,
    locale: string,
    text: Pick<Text, "today" | "yesterday">
) {
    const day = (value: number) => new Date(value).toDateString()
    const time = new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
    }).format(at)
    if (day(at) === day(now)) return text.today.replace("{time}", time)
    if (day(at) === day(now - 86_400_000))
        return text.yesterday.replace("{time}", time)
    return new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(at)
}

/** "8 příkazů" in the reader's plural form. */
export function commandCountLabel(count: number, locale: string, text: Text) {
    const forms = text.count as Record<string, string | undefined>
    return (forms[pluralForm(locale, count)] ?? text.count.other).replace(
        "{count}",
        String(count)
    )
}

/**
 * "Registrace příkazů" (N3-03, N3-04): when the bot last registered the
 * commands and how many, and "Znovu zaregistrovat", which asks the bot to
 * register them now (a live Discord action, not part of `/api/v1`).
 */
export function CommandRegistrationCard({
    serverId,
    serverName,
    registration,
    now,
    dictionary,
}: {
    serverId: string
    serverName: string
    registration: CommandRegistrationView | null
    now: number
    dictionary: Dictionary
}) {
    const text = dictionary.settingsHub.commandsPage.registration
    const locale = useLocale()
    const [requested, setRequested] = useState(false)
    const [busy, setBusy] = useState(false)
    const failed =
        registration?.failedAt !== null &&
        registration?.failedAt !== undefined &&
        (registration.registeredAt === null ||
            registration.failedAt > registration.registeredAt)
    const pending =
        requested ||
        (registration?.requestedAt !== null &&
            registration?.requestedAt !== undefined)
    const registeredAt = registration?.registeredAt ?? null
    const count = commandCountLabel(
        registration?.commandCount ?? 0,
        locale,
        text
    )
    const when =
        registeredAt === null
            ? null
            : registrationTime(registeredAt, now, locale, text)

    async function reregister() {
        setBusy(true)
        try {
            const response = await fetch(
                `/api/servers/${serverId}/discord-commands`,
                {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ action: "reregister" }),
                }
            )
            if (!response.ok) throw new Error("request failed")
            setRequested(true)
            toast.success(text.requested)
        } catch {
            toast.error(text.requestFailed)
        } finally {
            setBusy(false)
        }
    }

    const Icon = failed ? AlertTriangle : when ? Check : Clock
    const title = failed
        ? text.failedTitle
        : when
          ? text.title
          : text.neverTitle
    const body = failed
        ? text.failed.replace(
              "{reason}",
              text.failures[registration?.failure ?? "unavailable"]
          )
        : when
          ? text.registered
                .replace("{when}", when)
                .replace("{count}", count)
                .replace("{server}", serverName)
          : text.never
    return (
        <section
            aria-labelledby="commands-registration"
            className="bg-card flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between"
        >
            <div className="flex min-w-0 items-start gap-3">
                <span
                    className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                        failed
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                            : when
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                              : "bg-muted text-muted-foreground"
                    )}
                    aria-hidden="true"
                >
                    <Icon className="size-4" />
                </span>
                <div className="min-w-0 space-y-0.5">
                    <h2 id="commands-registration" className="font-semibold">
                        <span className="max-sm:hidden">{title}</span>
                        <span className="sm:hidden">
                            {when && !failed ? text.phoneTitle : title}
                        </span>
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        <span className="max-sm:hidden">{body}</span>
                        <span className="sm:hidden">
                            {when && !failed
                                ? text.registeredShort
                                      .replace(
                                          "{when}",
                                          when.charAt(0).toLocaleUpperCase() +
                                              when.slice(1)
                                      )
                                      .replace("{count}", count)
                                : body}
                        </span>
                    </p>
                    {pending ? (
                        <p className="text-muted-foreground text-sm">
                            {text.pending}
                        </p>
                    ) : null}
                </div>
            </div>
            <Button
                type="button"
                variant="outline"
                className="shrink-0 rounded-xl max-sm:w-full"
                disabled={busy}
                onClick={() => void reregister()}
            >
                <RefreshCw className="size-4" aria-hidden="true" />
                {text.reregister}
            </Button>
        </section>
    )
}
