"use client"

import {
    ArrowDown,
    ArrowUp,
    FileText,
    Loader2,
    Paperclip,
    Plus,
    Save,
    Trash2,
    Upload,
} from "lucide-react"
import { useFieldArray, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { FieldErrors } from "react-hook-form"
import { useState, useTransition } from "react"
import { PhotoSlider } from "react-photo-view"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
    DISCORD_MESSAGE_MAX_ATTACHMENTS,
    isDiscordLevelZeroAttachmentSizeValid,
} from "@/domain/discord-sync/attachment-limits"
import {
    topicPresetSchema,
    type TopicPresetInput,
} from "@/lib/validation/topic-preset"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DiscordMarkdownTextarea } from "@/components/app/discord-markdown"
import { ExpandableItemCard } from "@/components/app/expandable-item-card"
import { HllMapSelector } from "@/components/app/hll-map-selector"
import { uploadFileToConvex } from "@/lib/client-uploads"
import type { Dictionary } from "@/i18n/dictionaries"
import { Textarea } from "@/components/ui/textarea"
import type { TopicPreset } from "@/types/domain"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

function FieldLabel({
    label,
    required,
}: {
    label: string
    required?: boolean
}) {
    return (
        <div className="mb-2 flex items-center gap-1 text-sm font-medium">
            <span>{label}</span>
            {required ? (
                <span className="text-destructive font-bold">*</span>
            ) : null}
        </div>
    )
}

function newTopic(title = "") {
    return {
        id: crypto.randomUUID(),
        title,
        body: "",
        attachments: [],
        messages: [{ id: crypto.randomUUID(), body: "", attachments: [] }],
    }
}

function getFirstErrorMessage(
    errors: FieldErrors<TopicPresetInput>
): string | undefined {
    if (typeof errors.name?.message === "string") return errors.name.message
    if (typeof errors.topics?.message === "string") return errors.topics.message
    if (typeof errors.topics?.root?.message === "string")
        return errors.topics.root.message

    if (Array.isArray(errors.topics)) {
        for (const topic of errors.topics) {
            if (typeof topic?.title?.message === "string")
                return topic.title.message
            if (typeof topic?.body?.message === "string")
                return topic.body.message
            if (typeof topic?.attachments?.message === "string")
                return topic.attachments.message
            if (Array.isArray(topic?.attachments)) {
                for (const attachment of topic.attachments) {
                    if (typeof attachment?.message === "string")
                        return attachment.message
                }
            }
        }
    }

    return undefined
}

function attachmentName(url: string, index: number) {
    try {
        const name = decodeURIComponent(
            new URL(url).pathname.split("/").pop() ?? ""
        )
        if (name) return name
    } catch {
        // Saved uploads are valid URLs. The fallback keeps legacy entries usable.
    }
    return `Attachment ${index + 1}`
}

function isPreviewableImage(url: string) {
    return /\.(avif|gif|jpe?g|png|svg|webp)(?:$|[?#])/i.test(url)
}

function TopicMessageAttachments({
    attachments,
    canEdit,
    dictionary,
    onUpload,
    onRemove,
}: {
    attachments: string[]
    canEdit: boolean
    dictionary: Dictionary
    onUpload: (files: FileList | File[] | null) => void
    onRemove: (index: number) => void
}) {
    const previewAttachments = attachments.filter(isPreviewableImage)
    const [viewerVisible, setViewerVisible] = useState(false)
    const [viewerIndex, setViewerIndex] = useState(0)

    return (
        <div
            className="border-border/60 bg-background/45 rounded-lg border border-dashed p-2"
            onDragOver={(event) => {
                if (canEdit) event.preventDefault()
            }}
            onDrop={(event) => {
                if (!canEdit) return
                event.preventDefault()
                onUpload(event.dataTransfer.files)
            }}
        >
            <div className="flex flex-wrap gap-2">
                {attachments.map((attachment, attachmentIndex) => {
                    const imageIndex = previewAttachments.indexOf(attachment)
                    const isImage = imageIndex >= 0
                    return (
                        <div
                            key={`${attachment}-${attachmentIndex}`}
                            className="border-border/60 bg-card group relative flex h-16 w-28 overflow-hidden rounded-md border"
                        >
                            {isImage ? (
                                <button
                                    type="button"
                                    className="size-full cursor-zoom-in"
                                    onClick={() => {
                                        setViewerIndex(imageIndex)
                                        setViewerVisible(true)
                                    }}
                                >
                                    <img
                                        src={attachment}
                                        alt={attachmentName(
                                            attachment,
                                            attachmentIndex
                                        )}
                                        className="size-full object-cover"
                                    />
                                </button>
                            ) : (
                                <div className="text-muted-foreground flex min-w-0 items-center gap-2 px-2 text-xs">
                                    <FileText className="size-4 shrink-0" />
                                    <span className="line-clamp-2 break-all">
                                        {attachmentName(
                                            attachment,
                                            attachmentIndex
                                        )}
                                    </span>
                                </div>
                            )}
                            {canEdit ? (
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="destructive"
                                    className="absolute top-1 right-1 size-6 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                                    onClick={() => onRemove(attachmentIndex)}
                                >
                                    <Trash2 className="size-3.5" />
                                </Button>
                            ) : null}
                        </div>
                    )
                })}
                {canEdit ? (
                    <label className="border-border/60 text-muted-foreground hover:bg-accent hover:text-accent-foreground flex h-16 w-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed text-xs transition-colors">
                        <Upload className="size-4" />
                        {dictionary.common.upload}
                        <input
                            type="file"
                            multiple
                            className="sr-only"
                            onChange={(event) => {
                                onUpload(event.target.files)
                                event.target.value = ""
                            }}
                        />
                    </label>
                ) : null}
            </div>
            <div className="text-muted-foreground mt-2 flex items-center gap-1 text-xs">
                <Paperclip className="size-3" />
                {attachments.length}/{DISCORD_MESSAGE_MAX_ATTACHMENTS}
            </div>
            <PhotoSlider
                images={previewAttachments.map((attachment, index) => ({
                    key: `${attachment}-${index}`,
                    src: attachment,
                }))}
                index={viewerIndex}
                visible={viewerVisible}
                onIndexChange={setViewerIndex}
                onClose={() => setViewerVisible(false)}
                loop
                maskOpacity={0.92}
            />
        </div>
    )
}

export function TopicPresetForm({
    preset,
    serverId,
    locale,
    canEdit,
    dictionary,
    createMode = false,
}: {
    preset?: TopicPreset
    serverId: string
    locale: string
    canEdit: boolean
    dictionary: Dictionary
    createMode?: boolean
}) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [collapsedTopicIds, setCollapsedTopicIds] = useState<string[]>([])

    const form = useForm<TopicPresetInput>({
        resolver: zodResolver(topicPresetSchema),
        defaultValues: {
            name: preset?.name ?? "",
            map: preset?.map ?? "",
            side: preset?.side ?? "",
            cap: preset?.cap ?? "",
            notes: preset?.notes ?? "",
            topics: preset?.topics.length
                ? preset.topics.map((topic) => ({
                      ...topic,
                      id: topic.id ?? crypto.randomUUID(),
                      messages: topic.messages?.length
                          ? topic.messages
                          : [
                                {
                                    id: crypto.randomUUID(),
                                    body: topic.body ?? "",
                                    attachments: topic.attachments ?? [],
                                },
                            ],
                  }))
                : [newTopic(dictionary.presets.newTopic)],
        },
    })

    const topics = useFieldArray({
        control: form.control,
        name: "topics",
    })

    function setTopicCollapsed(topicId: string, collapsed: boolean) {
        setCollapsedTopicIds((current: string[]) =>
            collapsed
                ? current.includes(topicId)
                    ? current
                    : [...current, topicId]
                : current.filter((id: string) => id !== topicId)
        )
    }

    async function submit(values: TopicPresetInput) {
        const response = await fetch(
            createMode
                ? `/api/servers/${serverId}/topic-presets`
                : `/api/servers/${serverId}/topic-presets/${preset?.id}`,
            {
                method: createMode ? "POST" : "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(values),
            }
        )

        const body = await response.json()
        if (!response.ok) {
            const message = body.error ?? "Unable to save the topic preset."
            form.setError("root", { message })
            toast.error(message)
            return
        }

        toast.success(dictionary.common.save)
        startTransition(() => {
            router.push(
                `/${locale}/dashboard/servers/${serverId}/topic-presets/${createMode ? body.presetId : preset?.id}`
            )
            router.refresh()
        })
    }

    async function handleUpload(
        topicIndex: number,
        files: FileList | File[] | null,
        messageIndex?: number
    ) {
        const uploadedFiles = Array.from(files ?? [])
        if (!uploadedFiles.length) return

        const current =
            messageIndex === undefined
                ? (form.getValues(`topics.${topicIndex}.attachments`) ?? [])
                : (form.getValues(`topics.${topicIndex}.messages`)?.[
                      messageIndex
                  ]?.attachments ?? [])
        const oversizedFile = uploadedFiles.find(
            (file) => !isDiscordLevelZeroAttachmentSizeValid(file.size)
        )
        if (oversizedFile) {
            toast.error(
                `“${oversizedFile.name}” exceeds Discord's 20 MiB level-0 upload limit.`
            )
            return
        }
        if (
            current.length + uploadedFiles.length >
            DISCORD_MESSAGE_MAX_ATTACHMENTS
        ) {
            toast.error(
                `A Discord message can have at most ${DISCORD_MESSAGE_MAX_ATTACHMENTS} attachments.`
            )
            return
        }

        try {
            for (const file of uploadedFiles) {
                const upload = await uploadFileToConvex(file)
                const url = upload.url
                if (messageIndex === undefined) {
                    const latest =
                        form.getValues(`topics.${topicIndex}.attachments`) ?? []
                    form.setValue(
                        `topics.${topicIndex}.attachments`,
                        [...latest, url],
                        { shouldDirty: true, shouldValidate: true }
                    )
                } else {
                    updateMessages(topicIndex, (messages) =>
                        messages.map((message, index) =>
                            index === messageIndex
                                ? {
                                      ...message,
                                      attachments: [
                                          ...message.attachments,
                                          url,
                                      ],
                                  }
                                : message
                        )
                    )
                }
            }
            toast.success(dictionary.common.save)
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : dictionary.common.error
            )
        }
    }

    function updateMessages(
        topicIndex: number,
        update: (
            messages: Array<{
                id: string
                body?: string
                attachments: string[]
            }>
        ) => Array<{ id: string; body?: string; attachments: string[] }>
    ) {
        const current = form.getValues(`topics.${topicIndex}.messages`) ?? []
        form.setValue(`topics.${topicIndex}.messages`, update(current), {
            shouldDirty: true,
            shouldValidate: true,
        })
    }

    const disabled = !canEdit || isPending || form.formState.isSubmitting

    return (
        <Card className="border-border/60 rounded-2xl">
            <CardHeader>
                <CardTitle className="text-2xl">
                    {createMode
                        ? dictionary.presets.createTopicTitle
                        : dictionary.presets.presetDetails}
                </CardTitle>
                <p className="text-muted-foreground text-sm">
                    {dictionary.presets.topicPresetPageDescription}
                </p>
            </CardHeader>
            <CardContent>
                <form
                    className="space-y-6"
                    onSubmit={form.handleSubmit(submit, (errors) => {
                        const message =
                            getFirstErrorMessage(errors) ??
                            dictionary.common.error
                        form.setError("root", { message })
                        toast.error(message)
                    })}
                >
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="md:col-span-2">
                            <FieldLabel
                                label={dictionary.presets.fields.name}
                                required
                            />
                            <Input
                                {...form.register("name")}
                                className="rounded-xl"
                                disabled={!canEdit}
                            />
                            {form.formState.errors.name ? (
                                <p className="text-destructive mt-2 text-sm">
                                    {form.formState.errors.name.message}
                                </p>
                            ) : null}
                        </div>
                        <div className="space-y-3 md:col-span-2">
                            <FieldLabel label={dictionary.presets.fields.map} />
                            <HllMapSelector
                                mapId={form.watch("map") ?? ""}
                                onMapIdChange={(value) => {
                                    form.setValue("map", value, {
                                        shouldDirty: true,
                                        shouldTouch: true,
                                        shouldValidate: true,
                                    })
                                    form.setValue("cap", "", {
                                        shouldDirty: true,
                                        shouldTouch: true,
                                        shouldValidate: true,
                                    })
                                }}
                                pointValue={form.watch("cap") ?? ""}
                                onPointValueChange={(value) =>
                                    form.setValue("cap", value, {
                                        shouldDirty: true,
                                        shouldTouch: true,
                                        shouldValidate: true,
                                    })
                                }
                                sideValue={form.watch("side") ?? ""}
                                onSideValueChange={(value) =>
                                    form.setValue("side", value, {
                                        shouldDirty: true,
                                        shouldTouch: true,
                                        shouldValidate: true,
                                    })
                                }
                                includeVariants={false}
                                includePoint={true}
                                includeSide={true}
                                disabled={!canEdit}
                                labels={{
                                    map: dictionary.presets.fields.map,
                                    mapSearch: dictionary.presets.fields.map,
                                    time: dictionary.event.fields.mapVariant,
                                    mode: dictionary.event.fields.mapMode,
                                    point: dictionary.presets.fields.cap,
                                    pointSearch: dictionary.presets.fields.cap,
                                    side: dictionary.presets.fields.side,
                                    optional: dictionary.shared.notSet,
                                    noResults:
                                        dictionary.shared.noMatchingResults,
                                }}
                            />
                        </div>
                        <div className="md:col-span-2">
                            <FieldLabel
                                label={dictionary.presets.fields.notes}
                            />
                            <Textarea
                                {...form.register("notes")}
                                className="min-h-24 rounded-xl"
                                disabled={!canEdit}
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h3 className="text-lg font-semibold">
                                    {dictionary.presets.topics}
                                </h3>
                                <p className="text-muted-foreground text-sm">
                                    {dictionary.presets.topicEditorDescription}
                                </p>
                            </div>
                            {canEdit ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="rounded-xl"
                                    onClick={() =>
                                        topics.append(
                                            newTopic(
                                                dictionary.presets.newTopic
                                            )
                                        )
                                    }
                                >
                                    <Plus className="size-4" />
                                    {dictionary.presets.addTopic}
                                </Button>
                            ) : null}
                        </div>

                        {topics.fields.map((topic, topicIndex) => {
                            const title =
                                form.watch(`topics.${topicIndex}.title`) ||
                                dictionary.presets.newTopic
                            const isOpen = !collapsedTopicIds.includes(topic.id)

                            return (
                                <ExpandableItemCard
                                    key={topic.id}
                                    open={isOpen}
                                    onOpenChange={(open) =>
                                        setTopicCollapsed(topic.id, !open)
                                    }
                                    title={title}
                                    subtitle={`ID: ${topic.id}`}
                                    className="bg-muted/10"
                                    actions={
                                        canEdit ? (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="rounded-lg"
                                                onClick={() =>
                                                    topics.remove(topicIndex)
                                                }
                                                disabled={
                                                    topics.fields.length <= 1
                                                }
                                            >
                                                <Trash2 className="size-4" />
                                            </Button>
                                        ) : undefined
                                    }
                                >
                                    <div className="space-y-3">
                                        <div className="flex-1">
                                            <Input
                                                {...form.register(
                                                    `topics.${topicIndex}.title`
                                                )}
                                                className="border-border/60 bg-background h-10 rounded-lg"
                                                placeholder={
                                                    dictionary.presets.newTopic
                                                }
                                                disabled={!canEdit}
                                            />
                                            {form.formState.errors.topics?.[
                                                topicIndex
                                            ]?.title ? (
                                                <p className="text-destructive mt-2 text-sm">
                                                    {
                                                        form.formState.errors
                                                            .topics[topicIndex]
                                                            ?.title?.message
                                                    }
                                                </p>
                                            ) : null}
                                        </div>
                                        <div className="border-border/60 space-y-3 rounded-lg border p-3">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-sm font-medium">
                                                    Discord messages
                                                </p>
                                                {canEdit ? (
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() =>
                                                            updateMessages(
                                                                topicIndex,
                                                                (messages) => [
                                                                    ...messages,
                                                                    {
                                                                        id: crypto.randomUUID(),
                                                                        body: "",
                                                                        attachments:
                                                                            [],
                                                                    },
                                                                ]
                                                            )
                                                        }
                                                    >
                                                        <Plus className="size-4" />
                                                        Add message
                                                    </Button>
                                                ) : null}
                                            </div>
                                            {(
                                                form.watch(
                                                    `topics.${topicIndex}.messages`
                                                ) ?? []
                                            ).map((message, messageIndex) => (
                                                <div
                                                    key={message.id}
                                                    className="bg-muted/30 has-[input:focus]:border-primary/40 space-y-2 rounded-md border border-dashed border-transparent p-3 transition-colors"
                                                    onDragOver={(event) => {
                                                        if (canEdit)
                                                            event.preventDefault()
                                                    }}
                                                    onDrop={(event) => {
                                                        if (!canEdit) return
                                                        event.preventDefault()
                                                        void handleUpload(
                                                            topicIndex,
                                                            event.dataTransfer
                                                                .files,
                                                            messageIndex
                                                        )
                                                    }}
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-muted-foreground text-xs font-medium">
                                                            Message{" "}
                                                            {messageIndex + 1}
                                                        </span>
                                                        {canEdit ? (
                                                            <div className="flex gap-1">
                                                                <Button
                                                                    type="button"
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="size-7"
                                                                    disabled={
                                                                        messageIndex ===
                                                                        0
                                                                    }
                                                                    onClick={() =>
                                                                        updateMessages(
                                                                            topicIndex,
                                                                            (
                                                                                messages
                                                                            ) => {
                                                                                const next =
                                                                                    [
                                                                                        ...messages,
                                                                                    ]
                                                                                ;[
                                                                                    next[
                                                                                        messageIndex -
                                                                                            1
                                                                                    ],
                                                                                    next[
                                                                                        messageIndex
                                                                                    ],
                                                                                ] =
                                                                                    [
                                                                                        next[
                                                                                            messageIndex
                                                                                        ]!,
                                                                                        next[
                                                                                            messageIndex -
                                                                                                1
                                                                                        ]!,
                                                                                    ]
                                                                                return next
                                                                            }
                                                                        )
                                                                    }
                                                                >
                                                                    <ArrowUp className="size-4" />
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="size-7"
                                                                    disabled={
                                                                        messageIndex ===
                                                                        (form.getValues(
                                                                            `topics.${topicIndex}.messages`
                                                                        )
                                                                            ?.length ??
                                                                            1) -
                                                                            1
                                                                    }
                                                                    onClick={() =>
                                                                        updateMessages(
                                                                            topicIndex,
                                                                            (
                                                                                messages
                                                                            ) => {
                                                                                const next =
                                                                                    [
                                                                                        ...messages,
                                                                                    ]
                                                                                ;[
                                                                                    next[
                                                                                        messageIndex
                                                                                    ],
                                                                                    next[
                                                                                        messageIndex +
                                                                                            1
                                                                                    ],
                                                                                ] =
                                                                                    [
                                                                                        next[
                                                                                            messageIndex +
                                                                                                1
                                                                                        ]!,
                                                                                        next[
                                                                                            messageIndex
                                                                                        ]!,
                                                                                    ]
                                                                                return next
                                                                            }
                                                                        )
                                                                    }
                                                                >
                                                                    <ArrowDown className="size-4" />
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="size-7"
                                                                    disabled={
                                                                        (form.getValues(
                                                                            `topics.${topicIndex}.messages`
                                                                        )
                                                                            ?.length ??
                                                                            1) <=
                                                                        1
                                                                    }
                                                                    onClick={() =>
                                                                        updateMessages(
                                                                            topicIndex,
                                                                            (
                                                                                messages
                                                                            ) =>
                                                                                messages.filter(
                                                                                    (
                                                                                        _,
                                                                                        index
                                                                                    ) =>
                                                                                        index !==
                                                                                        messageIndex
                                                                                )
                                                                        )
                                                                    }
                                                                >
                                                                    <Trash2 className="size-4" />
                                                                </Button>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                    <DiscordMarkdownTextarea
                                                        value={
                                                            message.body ?? ""
                                                        }
                                                        onChange={(body) =>
                                                            updateMessages(
                                                                topicIndex,
                                                                (messages) =>
                                                                    messages.map(
                                                                        (
                                                                            item,
                                                                            index
                                                                        ) =>
                                                                            index ===
                                                                            messageIndex
                                                                                ? {
                                                                                      ...item,
                                                                                      body,
                                                                                  }
                                                                                : item
                                                                    )
                                                            )
                                                        }
                                                        disabled={!canEdit}
                                                        rows={4}
                                                        hideToolbar={!canEdit}
                                                    />
                                                    <TopicMessageAttachments
                                                        attachments={
                                                            message.attachments
                                                        }
                                                        canEdit={canEdit}
                                                        dictionary={dictionary}
                                                        onUpload={(files) => {
                                                            void handleUpload(
                                                                topicIndex,
                                                                files,
                                                                messageIndex
                                                            )
                                                        }}
                                                        onRemove={(
                                                            attachmentIndex
                                                        ) =>
                                                            updateMessages(
                                                                topicIndex,
                                                                (messages) =>
                                                                    messages.map(
                                                                        (
                                                                            item,
                                                                            index
                                                                        ) =>
                                                                            index ===
                                                                            messageIndex
                                                                                ? {
                                                                                      ...item,
                                                                                      attachments:
                                                                                          item.attachments.filter(
                                                                                              (
                                                                                                  _,
                                                                                                  index
                                                                                              ) =>
                                                                                                  index !==
                                                                                                  attachmentIndex
                                                                                          ),
                                                                                  }
                                                                                : item
                                                                    )
                                                            )
                                                        }
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </ExpandableItemCard>
                            )
                        })}
                    </div>

                    {form.formState.errors.topics?.root ? (
                        <p className="text-destructive text-sm">
                            {form.formState.errors.topics.root.message}
                        </p>
                    ) : null}
                    {form.formState.errors.root ? (
                        <p className="text-destructive text-sm">
                            {form.formState.errors.root.message}
                        </p>
                    ) : null}

                    {canEdit ? (
                        <div className="flex flex-wrap gap-3">
                            <Button
                                className="rounded-xl"
                                type="submit"
                                disabled={disabled}
                            >
                                {form.formState.isSubmitting ? (
                                    <Loader2 className="mr-2 size-4 animate-spin" />
                                ) : (
                                    <Save className="mr-2 size-4" />
                                )}
                                {dictionary.common.save}
                            </Button>
                        </div>
                    ) : null}
                </form>
            </CardContent>
        </Card>
    )
}
