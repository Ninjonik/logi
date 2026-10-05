"use client"
import { DiscordMarkdownTextarea } from "@/components/app/discord-markdown"
import { uploadFileToConvex } from "@/lib/client-uploads"
import type { Dictionary } from "@/i18n/dictionaries"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"
import { Paperclip, X } from "lucide-react"
import { useState } from "react"

type Attachment = { url: string; name: string }
type Field = "title" | "description" | "body"

export function ArticleForm({
    serverId,
    locale,
    dictionary,
}: {
    serverId: string
    locale: string
    dictionary: Dictionary
}) {
    const labels = dictionary.articles
    const router = useRouter()
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [tags, setTags] = useState("")
    const [body, setBody] = useState("")
    const [attachments, setAttachments] = useState<Attachment[]>([])
    const [uploadingCount, setUploadingCount] = useState(0)
    const [uploadError, setUploadError] = useState("")
    const [pending, setPending] = useState(false)
    const [error, setError] = useState("")
    const [fieldErrors, setFieldErrors] = useState<
        Partial<Record<Field, string>>
    >({})
    const isUploading = uploadingCount > 0

    async function upload(files: File[]) {
        if (!files.length) return
        setUploadError("")
        setUploadingCount((count) => count + files.length)
        // Each file settles on its own, so one failure keeps the others.
        await Promise.all(
            files.map(async (file) => {
                try {
                    const { url } = await uploadFileToConvex(file)
                    setAttachments((current) => [
                        ...current,
                        { url, name: file.name },
                    ])
                } catch (uploadFailure) {
                    setUploadError(
                        labels.uploadFailed.replace(
                            "{reason}",
                            uploadFailure instanceof Error
                                ? uploadFailure.message
                                : file.name
                        )
                    )
                } finally {
                    setUploadingCount((count) => count - 1)
                }
            })
        )
    }

    async function submit() {
        if (isUploading || pending) return
        const nextErrors: Partial<Record<Field, string>> = {}
        if (!title.trim()) nextErrors.title = labels.titleRequired
        if (!description.trim())
            nextErrors.description = labels.descriptionRequired
        if (!body.trim()) nextErrors.body = labels.bodyRequired
        setFieldErrors(nextErrors)
        if (Object.keys(nextErrors).length) return

        setPending(true)
        setError("")
        try {
            const response = await fetch(`/api/servers/${serverId}/articles`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    title,
                    description,
                    tags: tags.split(","),
                    body,
                    attachments: attachments.map((item) => item.url),
                }),
            })
            if (response.ok) {
                router.push(`/${locale}/dashboard/servers/${serverId}/articles`)
                router.refresh()
                return
            }
            const result = (await response.json().catch(() => null)) as {
                error?: unknown
                field?: unknown
            } | null
            // The server names the rejected field; show it where it belongs.
            const fieldMessages: Record<string, string> = {
                title: labels.titleRequired,
                description: labels.descriptionRequired,
                body: labels.bodyRequired,
            }
            const field = typeof result?.field === "string" ? result.field : ""
            if (field in fieldMessages) {
                setFieldErrors({ [field]: fieldMessages[field] })
                setError(labels.saveFailed)
                return
            }
            setError(
                typeof result?.error === "string" && result.error
                    ? `${labels.saveFailed} ${result.error}`
                    : labels.saveFailed
            )
        } catch {
            setError(labels.saveFailed)
        } finally {
            setPending(false)
        }
    }

    function errorFor(field: Field) {
        return fieldErrors[field] ? (
            <p
                id={`article-${field}-error`}
                className="text-destructive text-sm"
            >
                {fieldErrors[field]}
            </p>
        ) : null
    }

    return (
        <form
            className="space-y-5"
            noValidate
            onSubmit={(event) => {
                event.preventDefault()
                void submit()
            }}
        >
            <div className="space-y-2">
                <Label htmlFor="article-title">{labels.titleLabel}</Label>
                <Input
                    id="article-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={labels.titlePlaceholder}
                    aria-invalid={Boolean(fieldErrors.title)}
                    aria-describedby={
                        fieldErrors.title ? "article-title-error" : undefined
                    }
                    className="rounded-xl"
                />
                {errorFor("title")}
            </div>
            <div className="space-y-2">
                <Label htmlFor="article-description">
                    {labels.descriptionLabel}
                </Label>
                <Textarea
                    id="article-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={labels.descriptionPlaceholder}
                    aria-invalid={Boolean(fieldErrors.description)}
                    aria-describedby={
                        fieldErrors.description
                            ? "article-description-error"
                            : undefined
                    }
                    className="rounded-xl"
                />
                {errorFor("description")}
            </div>
            <div className="space-y-2">
                <Label htmlFor="article-tags">{labels.tagsLabel}</Label>
                <Input
                    id="article-tags"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder={labels.tagsPlaceholder}
                    aria-describedby="article-tags-hint"
                    className="rounded-xl"
                />
                <p
                    id="article-tags-hint"
                    className="text-muted-foreground text-sm"
                >
                    {labels.tagsHint}
                </p>
            </div>
            <div className="space-y-2">
                <span className="text-sm leading-none font-medium">
                    {labels.bodyLabel}
                </span>
                <DiscordMarkdownTextarea
                    value={body}
                    onChange={setBody}
                    placeholder={labels.bodyPlaceholder}
                    height={420}
                />
                {errorFor("body")}
            </div>
            <div className="space-y-2">
                <Label htmlFor="article-attachments">
                    {labels.attachments}
                </Label>
                <Input
                    id="article-attachments"
                    type="file"
                    multiple
                    aria-describedby="article-attachments-hint"
                    className="rounded-xl"
                    onChange={(event) => {
                        const files = Array.from(event.target.files ?? [])
                        event.target.value = ""
                        void upload(files)
                    }}
                />
                <p
                    id="article-attachments-hint"
                    className="text-muted-foreground text-sm"
                >
                    {labels.attachmentsHint}
                </p>
                {isUploading ? (
                    <p role="status" className="text-muted-foreground text-sm">
                        {labels.uploading.replace(
                            "{count}",
                            String(uploadingCount)
                        )}
                    </p>
                ) : null}
                {uploadError ? (
                    <p role="alert" className="text-destructive text-sm">
                        {uploadError}
                    </p>
                ) : null}
                {attachments.length ? (
                    <ul className="space-y-1 text-sm">
                        {attachments.map((item) => (
                            <li
                                key={item.url}
                                className="flex min-w-0 items-center gap-2"
                            >
                                <Paperclip className="text-muted-foreground size-4 shrink-0" />
                                <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="truncate underline underline-offset-4"
                                >
                                    {item.name}
                                </a>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-7 shrink-0"
                                    aria-label={labels.removeAttachment.replace(
                                        "{name}",
                                        item.name
                                    )}
                                    onClick={() =>
                                        setAttachments((current) =>
                                            current.filter(
                                                (entry) =>
                                                    entry.url !== item.url
                                            )
                                        )
                                    }
                                >
                                    <X className="size-4" />
                                </Button>
                            </li>
                        ))}
                    </ul>
                ) : null}
            </div>
            {error ? (
                <p role="alert" className="text-destructive text-sm">
                    {error}
                </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
                <Button
                    type="submit"
                    className="rounded-xl"
                    disabled={pending || isUploading}
                >
                    {pending ? labels.publishing : labels.publish}
                </Button>
                {isUploading ? (
                    <span className="text-muted-foreground text-sm">
                        {labels.waitForUpload}
                    </span>
                ) : null}
            </div>
        </form>
    )
}
