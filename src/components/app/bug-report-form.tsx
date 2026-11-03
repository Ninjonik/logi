"use client"
import { MAX_ATTACHMENTS, validAttachment } from "@/domain/bug-reports/report"
import { getBugReportMessages } from "@/i18n/messages/bug-reports"
import { CheckCircle2, Loader2, Paperclip, X } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import type { Locale } from "@/i18n/config"

export function BugReportForm({
    locale,
    servers,
    initialServer,
}: {
    locale: Locale
    servers: { id: string; name: string }[]
    initialServer: string
}) {
    const t = getBugReportMessages(locale)
    const [files, setFiles] = useState<File[]>([])
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState("")
    const [sent, setSent] = useState(false)
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const localTime = String(form.get("occurredAt") ?? "")
        if (localTime)
            form.set("occurredAt", String(new Date(localTime).getTime()))
        files.forEach((file) => form.append("attachments", file))
        setBusy(true)
        setError("")
        try {
            const response = await fetch("/api/bug-reports", {
                method: "POST",
                body: form,
            })
            if (!response.ok) throw new Error()
            setSent(true)
            setFiles([])
        } catch {
            setError(t.error)
        } finally {
            setBusy(false)
        }
    }
    return (
        <Card className="max-w-2xl">
            <CardContent className="pt-6">
                {sent ? (
                    <div role="status" className="space-y-4 py-6">
                        <CheckCircle2 className="size-8 text-green-600" />
                        <p>{t.success}</p>
                        <Button
                            onClick={() => setSent(false)}
                            variant="outline"
                        >
                            {t.another}
                        </Button>
                    </div>
                ) : (
                    <form onSubmit={submit} className="space-y-6">
                        <fieldset disabled={busy} className="space-y-5">
                            <div className="space-y-2">
                                <Label htmlFor="bug-title">{t.title} *</Label>
                                <Input
                                    id="bug-title"
                                    name="title"
                                    required
                                    minLength={3}
                                    maxLength={160}
                                    placeholder={t.titleHint}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="bug-message">
                                    {t.message} *
                                </Label>
                                <Textarea
                                    id="bug-message"
                                    name="message"
                                    required
                                    minLength={10}
                                    maxLength={10000}
                                    rows={7}
                                    placeholder={t.messageHint}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="bug-server">{t.server}</Label>
                                <Input
                                    id="bug-server"
                                    name="server"
                                    list="bug-servers"
                                    maxLength={200}
                                    defaultValue={initialServer}
                                    placeholder={t.serverHint}
                                />
                                <datalist id="bug-servers">
                                    {servers.map((server) => (
                                        <option
                                            key={server.id}
                                            value={`${server.name} (${server.id})`}
                                        />
                                    ))}
                                </datalist>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="bug-time">{t.time}</Label>
                                <Input
                                    id="bug-time"
                                    name="occurredAt"
                                    type="datetime-local"
                                    aria-describedby="bug-time-hint"
                                />
                                <p
                                    id="bug-time-hint"
                                    className="text-muted-foreground text-xs"
                                >
                                    {t.timeHint}
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="bug-files">
                                    <Paperclip className="size-4" />
                                    {t.files}
                                </Label>
                                <Input
                                    id="bug-files"
                                    type="file"
                                    multiple
                                    accept=".png,.jpg,.jpeg,.webp,.gif,.txt,.log,.json,.csv,.zip"
                                    aria-describedby="bug-files-hint"
                                    onChange={(event) => {
                                        const next = [
                                            ...files,
                                            ...Array.from(
                                                event.target.files ?? []
                                            ),
                                        ]
                                        if (
                                            next.length > MAX_ATTACHMENTS ||
                                            next.some(
                                                (file) => !validAttachment(file)
                                            )
                                        )
                                            setError(t.fileError)
                                        else {
                                            setFiles(next)
                                            setError("")
                                        }
                                        event.target.value = ""
                                    }}
                                />
                                <p
                                    id="bug-files-hint"
                                    className="text-muted-foreground text-xs"
                                >
                                    {t.filesHint}
                                </p>
                                <ul className="space-y-1">
                                    {files.map((file, i) => (
                                        <li
                                            key={`${file.name}-${i}`}
                                            className="flex items-center justify-between gap-2 rounded-md border px-3 py-1 text-sm"
                                        >
                                            <span className="min-w-0 truncate">
                                                {file.name} ·{" "}
                                                {(file.size / 1024).toFixed(0)}{" "}
                                                KiB
                                            </span>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                type="button"
                                                aria-label={`${t.remove}: ${file.name}`}
                                                onClick={() =>
                                                    setFiles(
                                                        files.filter(
                                                            (_, index) =>
                                                                index !== i
                                                        )
                                                    )
                                                }
                                            >
                                                <X className="size-4" />
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </fieldset>
                        {error && (
                            <p
                                role="alert"
                                className="text-destructive text-sm"
                            >
                                {error}
                            </p>
                        )}
                        <Button type="submit" disabled={busy}>
                            {busy && (
                                <Loader2 className="size-4 animate-spin" />
                            )}
                            {busy ? t.sending : t.submit}
                        </Button>
                    </form>
                )}
            </CardContent>
        </Card>
    )
}
