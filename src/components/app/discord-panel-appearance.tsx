"use client"
import {
    defaultFactionEmoji,
    isPanelAccentColorDraft,
    isPanelFactionEmojiDraft,
    PANEL_ACCENT_COLOR_PATTERN,
    type PanelFaction,
    type PanelLayout,
    type ResolvedPanelPresentation,
} from "@/domain/discord-publications/panel-presentation"
import {
    uploadImageAsset,
    type ImageUploadError,
} from "@/lib/image-asset-upload"
import type { PublicPanelSettings } from "@/domain/discord-publications/settings"
import { IMAGE_INPUT_TYPES } from "@/domain/assets/image-asset"
import type { Dictionary } from "@/i18n/dictionaries"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useId, useState } from "react"

/** Appearance state edited in the form; `bannerUrl` is only a preview of the stored asset. */
export type PanelAppearanceDraft = Omit<
    ResolvedPanelPresentation,
    "factionEmoji"
> & { factionEmoji: Partial<Record<string, string>> }
type Texts = Dictionary["publicPanelAppearance"]
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
}: {
    serverId: string
    kind: PublicPanelSettings["kind"]
    value: PanelAppearanceDraft
    factions: readonly PanelFaction[]
    disabled: boolean
    t: Texts
    onChange: (next: PanelAppearanceDraft) => void
}) {
    const id = useId()
    const [uploading, setUploading] = useState(false),
        [uploadError, setUploadError] = useState(""),
        [uploaded, setUploaded] = useState(false)
    const accentValid = isPanelAccentColorDraft(value.accentColor)
    const accent = value.accentColor?.trim() ?? ""
    async function upload(file: File | undefined) {
        if (!file) return
        setUploading(true)
        setUploadError("")
        setUploaded(false)
        const result = await uploadImageAsset(serverId, "panel-banner", file)
        setUploading(false)
        if (!result.ok) {
            setUploadError(
                uploadErrorMessage(t, result.error, result.retryAfterMs)
            )
            return
        }
        setUploaded(true)
        onChange({
            ...value,
            bannerAssetId: result.asset.id,
            bannerUrl: result.asset.url,
        })
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
                                        onChange({
                                            ...value,
                                            layout: {
                                                ...value.layout,
                                                [key]: checked,
                                            },
                                        })
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
                        onChange={(e) =>
                            onChange({ ...value, accentColor: e.target.value })
                        }
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
                        onChange={(e) =>
                            onChange({
                                ...value,
                                accentColor: e.target.value || null,
                            })
                        }
                    />
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disabled || !value.accentColor}
                        onClick={() =>
                            onChange({ ...value, accentColor: null })
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
                                setUploaded(false)
                                setUploadError("")
                                onChange({
                                    ...value,
                                    bannerAssetId: null,
                                    bannerUrl: null,
                                })
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
                {uploaded && !uploadError && (
                    <p role="status" className="text-xs">
                        {t.bannerUploaded}
                    </p>
                )}
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
                                        onChange={(e) =>
                                            onChange({
                                                ...value,
                                                factionEmoji: {
                                                    ...value.factionEmoji,
                                                    [faction]: e.target.value,
                                                },
                                            })
                                        }
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
