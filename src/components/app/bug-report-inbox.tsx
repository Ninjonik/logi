"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getBugReportMessages } from "@/i18n/messages/bug-reports"
import type { Report } from "@/domain/bug-reports/report"
import { Button } from "@/components/ui/button"
import type { Locale } from "@/i18n/config"
import { useState } from "react"

type Page = { page: Report[]; isDone: boolean; continueCursor: string }
export function BugReportInbox({
    locale,
    initial,
}: {
    locale: Locale
    initial: Page
}) {
    const t = getBugReportMessages(locale)
    const [reports, setReports] = useState(initial.page)
    const [cursor, setCursor] = useState(
        initial.isDone ? null : initial.continueCursor
    )
    const [busy, setBusy] = useState<string | null>(null)
    const [error, setError] = useState("")
    const date = (value: number) =>
        new Intl.DateTimeFormat(locale, {
            dateStyle: "medium",
            timeStyle: "short",
        }).format(value)
    async function update(id: string, status: string) {
        setBusy(id)
        setError("")
        try {
            const response = await fetch("/api/bug-reports", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, status }),
            })
            if (!response.ok) throw new Error()
            setReports((items) =>
                items.map((item) =>
                    item._id === id
                        ? { ...item, status: status as Report["status"] }
                        : item
                )
            )
        } catch {
            setError(t.updateError)
        } finally {
            setBusy(null)
        }
    }
    async function more() {
        setBusy("more")
        setError("")
        try {
            const response = await fetch(
                `/api/bug-reports?cursor=${encodeURIComponent(cursor ?? "")}`
            )
            if (!response.ok) throw new Error()
            const next: Page = await response.json()
            setReports((items) => [...items, ...next.page])
            setCursor(next.isDone ? null : next.continueCursor)
        } catch {
            setError(t.loadError)
        } finally {
            setBusy(null)
        }
    }
    return (
        <div className="max-w-4xl space-y-4">
            {error && (
                <p role="alert" className="text-destructive">
                    {error}
                </p>
            )}
            {!reports.length && (
                <p className="text-muted-foreground">{t.empty}</p>
            )}
            {reports.map((report) => (
                <Card key={report._id}>
                    <CardHeader>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <CardTitle className="min-w-0 break-words">
                                {report.title}
                            </CardTitle>
                            <label className="flex items-center gap-2 text-sm">
                                {t.status}
                                <select
                                    className="bg-background rounded-md border p-2"
                                    value={report.status}
                                    disabled={busy !== null}
                                    onChange={(event) =>
                                        update(report._id, event.target.value)
                                    }
                                >
                                    {(
                                        [
                                            "new",
                                            "investigating",
                                            "resolved",
                                        ] as const
                                    ).map((status) => (
                                        <option key={status} value={status}>
                                            {t[status]}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <dl className="text-muted-foreground grid gap-2 text-sm sm:grid-cols-2">
                            <div>
                                <dt>{t.reporter}</dt>
                                <dd>{report.reporter}</dd>
                            </div>
                            <div>
                                <dt>{t.submitted}</dt>
                                <dd>{date(report._creationTime)}</dd>
                            </div>
                            {report.server && (
                                <div>
                                    <dt>{t.server}</dt>
                                    <dd className="break-words">
                                        {report.server}
                                    </dd>
                                </div>
                            )}
                            {report.occurredAt !== undefined && (
                                <div>
                                    <dt>{t.occurred}</dt>
                                    <dd>{date(report.occurredAt)}</dd>
                                </div>
                            )}
                        </dl>
                        <p className="break-words whitespace-pre-wrap">
                            {report.message}
                        </p>
                        {report.attachments.length > 0 && (
                            <ul className="space-y-2">
                                {report.attachments.map((file, index) => (
                                    <li key={index}>
                                        <a
                                            className="text-primary break-all underline"
                                            href={`/api/bug-reports/${report._id}/attachments/${index}`}
                                        >
                                            {file.name}
                                        </a>
                                        <span className="text-muted-foreground ml-2 text-xs">
                                            {(file.size / 1024).toFixed(0)} KiB
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>
            ))}
            {cursor && (
                <Button
                    variant="outline"
                    disabled={busy !== null}
                    onClick={more}
                >
                    {busy === "more" ? t.loading : t.more}
                </Button>
            )}
        </div>
    )
}
