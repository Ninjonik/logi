"use client"
import {
    defaultFactionEmoji,
    isPanelAccentColorDraft,
    isPanelFactionEmojiDraft,
    PANEL_ACCENT_COLOR_PATTERN,
    resolvePanelPresentation,
    type PanelFaction,
    type PanelLayout,
    type ResolvedPanelPresentation,
} from "@/domain/discord-publications/panel-presentation"
import {
    listImageAssets,
    uploadImageAsset,
    type ImageUploadError,
    type ImageUploadResult,
} from "@/lib/image-asset-upload"
import {
    IMAGE_INPUT_TYPES,
    type ImageAssetDto,
} from "@/domain/assets/image-asset"
import type { PublicPanelSettings } from "@/domain/discord-publications/settings"
import { useEffect, useId, useRef, useState } from "react"
import type { Dictionary } from "@/i18n/dictionaries"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/** Appearance state edited in the form; `bannerUrl` is only a preview of the stored asset. */
export type PanelAppearanceDraft = Omit<
    ResolvedPanelPresentation,
    "factionEmoji"
> & { factionEmoji: Partial<Record<string, string>> }
/**
 * Every edit is applied to the draft that is current when it lands, so a slow
 * banner upload never reverts changes made while it was in flight.
 */
export type PanelAppearanceUpdate = (
    current: PanelAppearanceDraft
) => PanelAppearanceDraft
/** The form's draft is null until edited; an update then starts from the defaults. */
export function applyPanelAppearanceUpdate(
    current: PanelAppearanceDraft | null,
    update: PanelAppearanceUpdate
): PanelAppearanceDraft {
    return update(current ?? resolvePanelPresentation(null))
}
/** Sets or clears only the banner fields. */
export function withPanelBanner(
    asset: Pick<ImageAssetDto, "id" | "url"> | null
): PanelAppearanceUpdate {
    return (current) => ({
        ...current,
        bannerAssetId: asset?.id ?? null,
        bannerUrl: asset?.url ?? null,
    })
}
/**
 * One banner upload. The form is told while it is in flight so saving and
 * switching panels wait. A result arriving after the editor was remounted for
 * another panel is dropped; otherwise only the banner fields are merged.
 */
export async function runPanelBannerUpload(
    upload: () => Promise<ImageUploadResult>,
    hooks: {
        isCurrent: () => boolean
        onUploadingChange: (uploading: boolean) => void
        onChange: (update: PanelAppearanceUpdate) => void
        onResult: (result: ImageUploadResult) => void
    }
): Promise<void> {
    hooks.onUploadingChange(true)
    let result: ImageUploadResult
    try {
        result = await upload()
    } finally {
        hooks.onUploadingChange(false)
    }
    if (!hooks.isCurrent()) return
    hooks.onResult(result)
    if (result.ok) hooks.onChange(withPanelBanner(result.asset))
}
type Texts = Dictionary["publicPanelAppearance"]
type Library =
    | { state: "closed" | "loading" | "error" }
    | { state: "ready"; assets: ImageAssetDto[] }
const LIVE_LAYOUT: readonly (keyof PanelLayout)[] = [
    "showMap",
    "showScoreboard",
    "showPlayerCount",
    "compact",
]
const RESULT_LAYOUT: readonly (keyof PanelLayout)[] = ["showMap", "compact"]
const DEFAULT_ACCENT = "#77b255"

export function uploadErrorMessage(
    t: Texts,
    error: ImageUploadError | "asset_unavailable",
    retryAfterMs: number | null = null
) {
    return t.errors[error].replace(
        "{seconds}",
        String(Math.max(1, Math.ceil((retryAfterMs ?? 0) / 1000)))
    )
}

export function DiscordPanelAppearance({
    serverId,
    kind,
    value,
    factions,
    disabled,
    t,
    onChange,
    onUploadingChange,
}: {
    serverId: string
    kind: PublicPanelSettings["kind"]
    value: PanelAppearanceDraft
    factions: readonly PanelFaction[]
    disabled: boolean
    t: Texts
    onChange: (update: PanelAppearanceUpdate) => void
    onUploadingChange: (uploading: boolean) => void
}) {
    const id = useId()
    const [uploading, setUploading] = useState(false),
        [uploadError, setUploadError] = useState(""),
        [bannerStatus, setBannerStatus] = useState<
            "uploaded" | "selected" | null
        >(null),
        [library, setLibrary] = useState<Library>({ state: "closed" })
    // The form remounts this editor for another panel or after a save.
    const mounted = useRef(false)
    useEffect(() => {
        mounted.current = true
        return () => {
            mounted.current = false
        }
    }, [])
    const accentValid = isPanelAccentColorDraft(value.accentColor)
    const accent = value.accentColor?.trim() ?? ""
    async function upload(file: File | undefined) {
        if (!file) return
        setUploadError("")
        setBannerStatus(null)
        await runPanelBannerUpload(
            () => uploadImageAsset(serverId, "panel-banner", file),
            {
                isCurrent: () => mounted.current,
                onUploadingChange: (next) => {
                    setUploading(next)
                    onUploadingChange(next)
                },
                onChange,
                onResult: (result) =>
                    result.ok
                        ? setBannerStatus("uploaded")
                        : setUploadError(
                              uploadErrorMessage(
                                  t,
                                  result.error,
                                  result.retryAfterMs
                              )
                          ),
            }
        )
    }
    async function toggleLibrary() {
        if (library.state === "ready") return setLibrary({ state: "closed" })
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
        <fieldset className="space-y-4 rounded border p-3">
            <legend className="px-1 font-semibold">{t.title}</legend>
            <p className="text-muted-foreground text-sm">{t.description}</p>
            <div className="space-y-2">
                <p className="text-sm font-medium">{t.layout}</p>
                <div className="flex flex-wrap gap-4">
                    {(kind === "results" ? RESULT_LAYOUT : LIVE_LAYOUT).map(
                        (key) => (
                            <div key={key} className="flex items-center gap-2">
                                <Switch
                                    id={`${id}-${key}`}
                                    checked={value.layout[key]}
                                    disabled={disabled}
                                    onCheckedChange={(checked) =>
                                        onChange((current) => ({
                                            ...current,
                                            layout: {
                                                ...current.layout,
                                                [key]: checked,
                                            },
                                        }))
                                    }
                                />
                                <Label htmlFor={`${id}-${key}`}>{t[key]}</Label>
                            </div>
                        )
                    )}
                </div>
                <p className="text-muted-foreground text-xs">
                    {kind === "results" ? t.resultsLayoutHelp : t.layoutHelp}
                </p>
            </div>
            <div className="space-y-2">
                <Label htmlFor={`${id}-accent`}>{t.accentColor}</Label>
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        type="color"
                        aria-label={t.accentColorPicker}
                        className="h-9 w-12 cursor-pointer rounded border bg-transparent p-1"
                        disabled={disabled}
                        value={
                            PANEL_ACCENT_COLOR_PATTERN.test(accent)
                                ? accent.toLowerCase()
                                : DEFAULT_ACCENT
                        }
                        onChange={(e) => {
                            const accentColor = e.target.value
                            onChange((current) => ({ ...current, accentColor }))
                        }}
                    />
                    <Input
                        id={`${id}-accent`}
                        className="w-32 font-mono"
                        maxLength={7}
                        placeholder={t.accentColorPlaceholder}
                        disabled={disabled}
                        value={value.accentColor ?? ""}
                        aria-invalid={!accentValid}
                        aria-describedby={`${id}-accent-help`}
                        onChange={(e) => {
                            const accentColor = e.target.value || null
                            onChange((current) => ({ ...current, accentColor }))
                        }}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disabled || !value.accentColor}
                        onClick={() =>
                            onChange((current) => ({
                                ...current,
                                accentColor: null,
                            }))
                        }
                    >
                        {t.accentColorReset}
                    </Button>
                </div>
                <p
                    id={`${id}-accent-help`}
                    className={
                        accentValid
                            ? "text-muted-foreground text-xs"
                            : "text-destructive text-xs"
                    }
                >
                    {accentValid ? t.accentColorHelp : t.accentColorInvalid}
                </p>
            </div>
            <div className="space-y-2">
                <Label htmlFor={`${id}-banner`}>{t.banner}</Label>
                {value.bannerUrl ? (
                    // The banner is an immutable public asset URL; next/image adds nothing here.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={value.bannerUrl}
                        alt={t.bannerPreview}
                        className="max-h-40 w-full max-w-xl rounded border object-cover"
                    />
                ) : (
                    <p className="text-muted-foreground text-xs">
                        {t.bannerNone}
                    </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                    <Input
                        id={`${id}-banner`}
                        type="file"
                        className="max-w-xs"
                        accept={IMAGE_INPUT_TYPES.join(",")}
                        disabled={disabled || uploading}
                        aria-describedby={`${id}-banner-help`}
                        onChange={(e) => {
                            const file = e.target.files?.[0]
                            // Clear the picker so the same file can be retried.
                            e.target.value = ""
                            void upload(file)
                        }}
                    />
                    {value.bannerAssetId && (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={disabled || uploading}
                            onClick={() => {
                                setBannerStatus(null)
                                setUploadError("")
                                onChange(withPanelBanner(null))
                            }}
                        >
                            {t.bannerRemove}
                        </Button>
                    )}
                </div>
                <p
                    id={`${id}-banner-help`}
                    className="text-muted-foreground text-xs"
                >
                    {uploading ? t.bannerUploading : t.bannerHelp}
                </p>
                {uploadError && (
                    <p role="alert" className="text-destructive text-xs">
                        {uploadError}
                    </p>
                )}
                {bannerStatus && !uploadError && (
                    <p role="status" className="text-xs">
                        {bannerStatus === "uploaded"
                            ? t.bannerUploaded
                            : t.bannerSelected}
                    </p>
                )}
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-expanded={library.state === "ready"}
                    aria-controls={`${id}-library`}
                    disabled={
                        disabled || uploading || library.state === "loading"
                    }
                    onClick={() => void toggleLibrary()}
                >
                    {library.state === "ready"
                        ? t.bannerLibraryHide
                        : library.state === "loading"
                          ? t.bannerLibraryLoading
                          : t.bannerLibraryShow}
                </Button>
                {library.state === "error" && (
                    <p role="alert" className="text-destructive text-xs">
                        {t.bannerLibraryError}
                    </p>
                )}
                {library.state === "ready" &&
                    (library.assets.length === 0 ? (
                        <p
                            id={`${id}-library`}
                            className="text-muted-foreground text-xs"
                        >
                            {t.bannerLibraryEmpty}
                        </p>
                    ) : (
                        <ul
                            id={`${id}-library`}
                            aria-label={t.bannerLibrary}
                            className="flex flex-wrap gap-2"
                        >
                            {library.assets.map((asset) => {
                                const chosen = asset.id === value.bannerAssetId
                                return (
                                    <li key={asset.id}>
                                        <button
                                            type="button"
                                            aria-pressed={chosen}
                                            disabled={disabled || uploading}
                                            className={cn(
                                                "focus-visible:ring-ring/50 block rounded border p-1 outline-none focus-visible:ring-[3px] disabled:opacity-50",
                                                chosen &&
                                                    "border-primary ring-primary ring-2"
                                            )}
                                            onClick={() => {
                                                setUploadError("")
                                                setBannerStatus("selected")
                                                onChange(withPanelBanner(asset))
                                            }}
                                        >
                                            {/* Immutable public asset URL, as in the preview above. */}
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={asset.url}
                                                loading="lazy"
                                                alt={t.bannerLibraryItem
                                                    .replace(
                                                        "{width}",
                                                        String(asset.width)
                                                    )
                                                    .replace(
                                                        "{height}",
                                                        String(asset.height)
                                                    )
                                                    .replace(
                                                        "{date}",
                                                        asset.createdAt.slice(
                                                            0,
                                                            10
                                                        )
                                                    )}
                                                className="h-16 w-28 rounded object-cover"
                                            />
                                        </button>
                                    </li>
                                )
                            })}
                        </ul>
                    ))}
            </div>
            {factions.length > 0 && (
                <div className="space-y-2">
                    <p className="text-sm font-medium">{t.factionEmoji}</p>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {factions.map((faction) => {
                            const valid = isPanelFactionEmojiDraft(
                                value.factionEmoji[faction]
                            )
                            return (
                                <div key={faction} className="space-y-1">
                                    <Label htmlFor={`${id}-emoji-${faction}`}>
                                        {t.factions[faction]}
                                    </Label>
                                    <Input
                                        id={`${id}-emoji-${faction}`}
                                        maxLength={64}
                                        disabled={disabled}
                                        placeholder={
                                            defaultFactionEmoji(faction) ??
                                            t.noDefaultEmoji
                                        }
                                        value={
                                            value.factionEmoji[faction] ?? ""
                                        }
                                        aria-invalid={!valid}
                                        aria-describedby={`${id}-emoji-help`}
                                        onChange={(e) => {
                                            const emoji = e.target.value
                                            onChange((current) => ({
                                                ...current,
                                                factionEmoji: {
                                                    ...current.factionEmoji,
                                                    [faction]: emoji,
                                                },
                                            }))
                                        }}
                                    />
                                    {!valid && (
                                        <p className="text-destructive text-xs">
                                            {t.factionEmojiInvalid}
                                        </p>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                    <p
                        id={`${id}-emoji-help`}
                        className="text-muted-foreground text-xs"
                    >
                        {t.factionEmojiHelp}
                    </p>
                </div>
            )}
        </fieldset>
    )
}
