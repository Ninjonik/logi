"use client"

import { AlertTriangle, Check, ImageIcon, Loader2, Upload } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    formatImageUploadMessage,
    listImageAssets,
    uploadImageAsset,
} from "@/lib/image-asset-upload"
import { DiscordMessagePreview } from "@/components/app/discord-preview/discord-message-preview"
import type { ApplicationChannelReport } from "@/domain/membership/application-channels"
import type { SelectableDiscordChannel } from "@/components/app/discord-channel-select"
import { normalizeAccentColor } from "@/domain/discord-messages/message-style"
import { DiscordChannelSelect } from "@/components/app/discord-channel-select"
import { DiscordMarkdownTextarea } from "@/components/app/discord-markdown"
import type { MessageView } from "@/domain/discord-messages/message-view"
import type { ImageAssetDto } from "@/domain/assets/image-asset"
import { fillTemplate } from "@/domain/discord-messages/format"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

import type { FormBuilderPreview } from "./form-builder"

type PanelCopy = Dictionary["membershipApplication"]["panel"]

export type PanelImageChoice = { assetId: string; url: string } | null

type CheckState =
    | { status: "idle" }
    | { status: "checking" }
    | { status: "done"; report: ApplicationChannelReport }
    | { status: "unavailable" }

/**
 * Asks Discord whether the bot can use the two channels (N4-05, N4-06,
 * N4-B08) whenever the choice changes; the answer is shown under each
 * select.
 */
function useChannelChecks(
    serverId: string,
    panelChannelId: string | undefined,
    threadChannelId: string | undefined
): CheckState {
    const [state, setState] = useState<CheckState>({ status: "idle" })
    const none = !panelChannelId && !threadChannelId
    useEffect(() => {
        if (none) return
        const controller = new AbortController()
        const timer = setTimeout(() => {
            setState({ status: "checking" })
            fetch(
                `/api/servers/${encodeURIComponent(serverId)}/membership-application`,
                {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                        action: "check-channels",
                        panelChannelId: panelChannelId || null,
                        threadChannelId: threadChannelId || null,
                    }),
                    signal: controller.signal,
                }
            )
                .then(async (response) => {
                    const body = (await response.json().catch(() => null)) as {
                        channels?: ApplicationChannelReport
                    } | null
                    setState(
                        response.ok && body?.channels
                            ? { status: "done", report: body.channels }
                            : { status: "unavailable" }
                    )
                })
                .catch((error: unknown) => {
                    if ((error as { name?: string })?.name !== "AbortError")
                        setState({ status: "unavailable" })
                })
        }, 400)
        return () => {
            clearTimeout(timer)
            controller.abort()
        }
    }, [serverId, panelChannelId, threadChannelId, none])
    return none ? { status: "idle" } : state
}

function CheckLine({
    state,
    part,
    ok,
    blocked,
    t,
}: {
    state: CheckState
    part: "panel" | "threads"
    ok: string
    blocked: string
    t: PanelCopy
}) {
    if (state.status === "idle") return null
    if (state.status === "checking")
        return (
            <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                {t.checking}
            </p>
        )
    if (state.status === "unavailable")
        return (
            <p className="text-muted-foreground text-xs">
                {t.checkUnavailable}
            </p>
        )
    const result = state.report[part]
    if (!result) return null
    return result.ok ? (
        <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
            <Check className="size-3.5 shrink-0" aria-hidden="true" />
            {ok}
        </p>
    ) : (
        <p className="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
            />
            {blocked}
        </p>
    )
}

/** "Panel a kanály" (N4-05..N4-10). */
export function PanelSection({
    serverId,
    channels,
    panelChannelId,
    threadChannelId,
    title,
    text,
    imageUrl,
    accentColor,
    panelView,
    preview,
    t,
    onChange,
    onImage,
}: {
    serverId: string
    channels: SelectableDiscordChannel[]
    panelChannelId?: string
    threadChannelId?: string
    title: string
    text: string
    imageUrl: string
    /** What the admin typed; empty is the clan colour (L4-10). */
    accentColor: string
    panelView: MessageView | null
    preview: FormBuilderPreview
    t: PanelCopy
    onChange(patch: {
        submitChannelId?: string
        applicationParentChannelId?: string
        panelTitle?: string
        panelDescription?: string
        panelAccentColor?: string
    }): void
    onImage(image: PanelImageChoice): void
}) {
    const id = useId()
    const checks = useChannelChecks(serverId, panelChannelId, threadChannelId)
    const fileInput = useRef<HTMLInputElement>(null)
    const [uploading, setUploading] = useState(false)
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [pickerOpen, setPickerOpen] = useState(false)
    const [assets, setAssets] = useState<ImageAssetDto[] | null | "error">(null)
    const channelName = channels.find(
        (channel) => channel.id === panelChannelId
    )?.name
    const colorInvalid =
        Boolean(accentColor.trim()) && !normalizeAccentColor(accentColor)

    async function upload(file: File) {
        setUploading(true)
        setUploadError(null)
        const result = await uploadImageAsset(serverId, "panel-banner", file)
        setUploading(false)
        if (result.ok)
            onImage({ assetId: result.asset.id, url: result.asset.url })
        else
            setUploadError(
                formatImageUploadMessage(
                    t.uploadErrors[result.error],
                    result.retryAfterMs
                )
            )
    }

    async function openPicker() {
        setPickerOpen(true)
        setAssets(null)
        const result = await listImageAssets(serverId, "panel-banner")
        setAssets(result.ok ? result.assets : "error")
    }

    return (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
            <div className="min-w-0 space-y-4">
                <div className="space-y-2">
                    <Label>{t.channel}</Label>
                    <DiscordChannelSelect
                        value={panelChannelId}
                        onChange={(value) =>
                            onChange({ submitChannelId: value ?? "" })
                        }
                        channels={channels}
                        placeholder={t.channel}
                    />
                    <CheckLine
                        state={checks}
                        part="panel"
                        ok={t.channelOk}
                        blocked={t.channelBlocked}
                        t={t}
                    />
                </div>
                <div className="space-y-2">
                    <Label>{t.threads}</Label>
                    <DiscordChannelSelect
                        value={threadChannelId}
                        purpose="private-thread"
                        onChange={(value) =>
                            onChange({
                                applicationParentChannelId: value ?? "",
                            })
                        }
                        channels={channels}
                        placeholder={t.threads}
                    />
                    <CheckLine
                        state={checks}
                        part="threads"
                        ok={t.threadsOk}
                        blocked={t.threadsBlocked}
                        t={t}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor={`${id}-title`}>{t.heading}</Label>
                    <Input
                        id={`${id}-title`}
                        value={title}
                        maxLength={256}
                        onChange={(event) =>
                            onChange({ panelTitle: event.target.value })
                        }
                        className="rounded-xl"
                    />
                </div>
                <div className="space-y-2">
                    <Label>{t.text}</Label>
                    <DiscordMarkdownTextarea
                        value={text}
                        onChange={(value) =>
                            onChange({ panelDescription: value })
                        }
                        maxLength={4096}
                        className="min-h-24 rounded-xl"
                        rows={4}
                    />
                    <p className="text-muted-foreground text-xs">
                        {t.textHelp}
                    </p>
                </div>
                <div className="space-y-2">
                    <p className="text-sm font-medium" id={`${id}-image`}>
                        {t.image}
                    </p>
                    <div
                        className="relative flex flex-wrap items-center gap-2"
                        role="group"
                        aria-labelledby={`${id}-image`}
                    >
                        <div className="bg-muted/40 flex h-14 w-24 items-center justify-center overflow-hidden rounded-lg border border-dashed">
                            {imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element -- the clan's own uploads, already normalized
                                <img
                                    src={imageUrl}
                                    alt={t.imageAlt}
                                    className="size-full object-cover"
                                />
                            ) : (
                                <ImageIcon
                                    className="text-muted-foreground size-5"
                                    aria-hidden="true"
                                />
                            )}
                        </div>
                        <input
                            ref={fileInput}
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="sr-only"
                            tabIndex={-1}
                            aria-hidden="true"
                            onChange={(event) => {
                                const file = event.target.files?.[0]
                                event.target.value = ""
                                if (file) void upload(file)
                            }}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-lg"
                            disabled={uploading}
                            onClick={() => fileInput.current?.click()}
                        >
                            {uploading ? (
                                <Loader2
                                    className="size-4 animate-spin"
                                    aria-hidden="true"
                                />
                            ) : (
                                <Upload className="size-4" aria-hidden="true" />
                            )}
                            {uploading ? t.uploading : t.upload}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-lg"
                            onClick={() => void openPicker()}
                        >
                            {t.pick}
                        </Button>
                        {imageUrl ? (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-destructive rounded-lg"
                                onClick={() => onImage(null)}
                            >
                                {t.removeImage}
                            </Button>
                        ) : null}
                    </div>
                    {uploadError ? (
                        <p role="alert" className="text-destructive text-xs">
                            {uploadError}
                        </p>
                    ) : null}
                    <p className="text-muted-foreground text-xs">
                        {t.imageHelp}
                    </p>
                </div>
                <div className="space-y-2">
                    <Label htmlFor={`${id}-color`}>{t.color}</Label>
                    <div className="flex items-center gap-2">
                        <input
                            type="color"
                            aria-label={t.color}
                            value={
                                normalizeAccentColor(accentColor) ?? "#E8A33D"
                            }
                            onChange={(event) =>
                                onChange({
                                    panelAccentColor:
                                        event.target.value.toUpperCase(),
                                })
                            }
                            className="border-input size-9 shrink-0 cursor-pointer rounded-lg border bg-transparent p-1"
                        />
                        <Input
                            id={`${id}-color`}
                            value={accentColor}
                            onChange={(event) =>
                                onChange({
                                    panelAccentColor: event.target.value,
                                })
                            }
                            maxLength={7}
                            placeholder="#E8A33D"
                            aria-invalid={colorInvalid || undefined}
                            aria-describedby={`${id}-color-hint`}
                            className="max-w-40 rounded-xl font-mono"
                        />
                    </div>
                    <p
                        id={`${id}-color-hint`}
                        className={
                            colorInvalid
                                ? "text-destructive text-xs"
                                : "text-muted-foreground text-xs"
                        }
                    >
                        {colorInvalid ? t.colorInvalid : t.colorHint}
                    </p>
                </div>
            </div>
            <div className="min-w-0 space-y-2">
                <h3 className="text-sm font-semibold">
                    {channelName
                        ? fillTemplate(t.preview, { channel: channelName })
                        : t.previewNoChannel}
                </h3>
                {panelView ? (
                    <DiscordMessagePreview
                        view={panelView}
                        language={preview.language}
                        style={preview.style}
                        labels={preview.labels}
                        now={preview.now}
                        timeZone={preview.timeZone}
                        mentions={preview.mentions}
                        author={{ name: "Logi" }}
                    />
                ) : (
                    <p className="text-muted-foreground rounded-xl border border-dashed p-4 text-sm">
                        {t.previewEmpty}
                    </p>
                )}
            </div>
            <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{t.pickTitle}</DialogTitle>
                        <DialogDescription>
                            {t.pickDescription}
                        </DialogDescription>
                    </DialogHeader>
                    {assets === null ? (
                        <Loader2
                            className="text-muted-foreground mx-auto size-5 animate-spin"
                            aria-hidden="true"
                        />
                    ) : assets === "error" ? (
                        <p role="alert" className="text-destructive text-sm">
                            {t.pickUnavailable}
                        </p>
                    ) : assets.length === 0 ? (
                        <p className="text-muted-foreground text-sm">
                            {t.pickEmpty}
                        </p>
                    ) : (
                        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {assets.map((asset, index) => (
                                <li key={asset.id}>
                                    <button
                                        type="button"
                                        aria-label={fillTemplate(t.pickImage, {
                                            number: String(index + 1),
                                        })}
                                        onClick={() => {
                                            onImage({
                                                assetId: asset.id,
                                                url: asset.url,
                                            })
                                            setPickerOpen(false)
                                        }}
                                        className="focus-visible:ring-ring/50 block aspect-video w-full overflow-hidden rounded-lg border focus-visible:ring-[3px] focus-visible:outline-none"
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element -- the clan's own uploads, already normalized */}
                                        <img
                                            src={asset.url}
                                            alt=""
                                            className="size-full object-cover"
                                        />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
