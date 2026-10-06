"use client"

import { useEffect, useId, useRef, useState } from "react"
import { ImageIcon, Upload } from "lucide-react"

import {
    formatImageUploadMessage,
    listImageAssets,
    uploadImageAsset,
} from "@/lib/image-asset-upload"
import {
    IMAGE_INPUT_TYPES,
    type ImageAssetDto,
} from "@/domain/assets/image-asset"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { fill } from "./panel-copy"

type Library =
    | { state: "closed" | "loading" | "error" }
    | { state: "ready"; assets: ImageAssetDto[] }

/**
 * "Banner" of the editor's "Vzhled" step (P2-23, P2-B06): upload a new image
 * or choose one this clan uploaded before. Only the asset ID is saved; the
 * server resolves the URL from the verified upload. While an upload is in
 * flight, saving waits.
 */
export function BannerField({
    serverId,
    value,
    disabled,
    onChange,
    onUploadingChange,
    dictionary,
}: {
    serverId: string
    value: { assetId: string | null; url: string | null }
    disabled: boolean
    onChange: (banner: { assetId: string | null; url: string | null }) => void
    onUploadingChange: (uploading: boolean) => void
    dictionary: Dictionary
}) {
    const text = dictionary.discordPanelsPage.editor.look.banner
    const errors = dictionary.publicPanelAppearance.errors
    const id = useId()
    const input = useRef<HTMLInputElement>(null)
    const mounted = useRef(true)
    const [uploading, setUploading] = useState(false)
    const [message, setMessage] = useState<{
        tone: "status" | "alert"
        text: string
    } | null>(null)
    const [library, setLibrary] = useState<Library>({ state: "closed" })
    useEffect(() => {
        mounted.current = true
        return () => {
            mounted.current = false
        }
    }, [])

    async function upload(file: File | undefined) {
        if (!file) return
        setMessage(null)
        setUploading(true)
        onUploadingChange(true)
        try {
            const result = await uploadImageAsset(
                serverId,
                "panel-banner",
                file
            )
            if (!mounted.current) return
            if (result.ok) {
                onChange({ assetId: result.asset.id, url: result.asset.url })
                setMessage({ tone: "status", text: text.uploaded })
            } else
                setMessage({
                    tone: "alert",
                    text: formatImageUploadMessage(
                        errors[result.error],
                        result.retryAfterMs
                    ),
                })
        } finally {
            if (mounted.current) setUploading(false)
            onUploadingChange(false)
        }
    }

    async function toggleLibrary() {
        if (library.state === "ready") {
            setLibrary({ state: "closed" })
            return
        }
        setLibrary({ state: "loading" })
        const result = await listImageAssets(serverId, "panel-banner")
        if (!mounted.current) return
        setLibrary(
            result.ok
                ? { state: "ready", assets: result.assets }
                : { state: "error" }
        )
    }

    return (
        <div className="space-y-2">
            <div className="text-sm">{text.label}</div>
            {value.url ? (
                // An immutable public asset URL; next/image adds nothing here.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={value.url}
                    alt={text.preview}
                    className="aspect-[3/1] w-full max-w-sm rounded-lg border object-cover"
                />
            ) : (
                <div
                    aria-hidden="true"
                    className="text-muted-foreground flex h-14 w-24 items-center justify-center rounded-lg border border-dashed"
                >
                    <ImageIcon className="size-4" />
                </div>
            )}
            <div className="flex flex-wrap gap-2">
                <input
                    ref={input}
                    id={id}
                    type="file"
                    className="sr-only"
                    tabIndex={-1}
                    accept={IMAGE_INPUT_TYPES.join(",")}
                    onChange={(event) => {
                        const file = event.target.files?.[0]
                        event.target.value = ""
                        void upload(file)
                    }}
                />
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    disabled={disabled || uploading}
                    onClick={() => input.current?.click()}
                >
                    <Upload className="size-3.5" aria-hidden="true" />
                    {uploading ? text.uploading : text.upload}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    aria-expanded={library.state === "ready"}
                    aria-controls={`${id}-library`}
                    disabled={
                        disabled || uploading || library.state === "loading"
                    }
                    onClick={() => void toggleLibrary()}
                >
                    {library.state === "ready"
                        ? text.hide
                        : library.state === "loading"
                          ? text.libraryLoading
                          : text.choose}
                </Button>
                {value.assetId ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="rounded-lg"
                        disabled={disabled || uploading}
                        onClick={() => {
                            setMessage(null)
                            onChange({ assetId: null, url: null })
                        }}
                    >
                        {text.remove}
                    </Button>
                ) : null}
            </div>
            <p className="text-muted-foreground text-xs">
                {value.assetId ? text.set : text.help}
            </p>
            {message ? (
                <p
                    role={message.tone}
                    className={cn(
                        "text-xs",
                        message.tone === "alert" && "text-destructive"
                    )}
                >
                    {message.text}
                </p>
            ) : null}
            {library.state === "error" ? (
                <p role="alert" className="text-destructive text-xs">
                    {text.libraryError}
                </p>
            ) : null}
            {library.state === "ready" ? (
                library.assets.length ? (
                    <ul
                        id={`${id}-library`}
                        aria-label={text.library}
                        className="flex flex-wrap gap-2"
                    >
                        {library.assets.map((asset) => {
                            const chosen = asset.id === value.assetId
                            return (
                                <li key={asset.id}>
                                    <button
                                        type="button"
                                        aria-pressed={chosen}
                                        disabled={disabled || uploading}
                                        className={cn(
                                            "focus-visible:ring-ring/50 block rounded-md border p-0.5 outline-none focus-visible:ring-[3px]",
                                            chosen && "ring-primary ring-2"
                                        )}
                                        onClick={() => {
                                            onChange({
                                                assetId: asset.id,
                                                url: asset.url,
                                            })
                                            setMessage({
                                                tone: "status",
                                                text: text.selected,
                                            })
                                        }}
                                    >
                                        {/* Immutable public asset URL. */}
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={asset.url}
                                            loading="lazy"
                                            alt={fill(text.libraryItem, {
                                                width: asset.width,
                                                height: asset.height,
                                                date: asset.createdAt.slice(
                                                    0,
                                                    10
                                                ),
                                            })}
                                            className="h-12 w-24 rounded object-cover"
                                        />
                                    </button>
                                </li>
                            )
                        })}
                    </ul>
                ) : (
                    <p
                        id={`${id}-library`}
                        className="text-muted-foreground text-xs"
                    >
                        {text.libraryEmpty}
                    </p>
                )
            ) : null}
        </div>
    )
}
