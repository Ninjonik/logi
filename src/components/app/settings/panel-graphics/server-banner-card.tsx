"use client"

import { Upload } from "lucide-react"
import { useId, useRef } from "react"
import Image from "next/image"

import {
    BANNER_CROPS,
    type BannerCrop,
    type PanelMapGame,
} from "@/domain/discord-publications/panel-graphics"
import type { PanelGraphicsServer } from "@/domain/discord-publications/panel-graphics-settings"
import { SegmentedControl } from "@/components/app/settings/segmented-control"
import type { Dictionary } from "@/i18n/dictionaries"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import {
    cropPosition,
    fill,
    formatKilobytes,
    isBarColorDraft,
    type BannerPreview,
    type KnownFile,
} from "./panel-graphics-state"

type Text = Dictionary["panelGraphicsPage"]

export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp"

const GAME_CHIP: Record<PanelMapGame, string> = {
    hell_let_loose: "bg-muted text-foreground",
    wardogs:
        "border-indigo-500/30 bg-indigo-500/10 text-indigo-800 dark:text-indigo-200",
}
const CHIP = {
    custom: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
    map: "bg-muted text-foreground",
    none: "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100",
} as const

export function GameChip({ game, text }: { game: PanelMapGame; text: Text }) {
    return (
        <span
            className={cn(
                "inline-flex h-5 shrink-0 items-center rounded-md border px-1.5 text-[11px] font-medium",
                GAME_CHIP[game]
            )}
        >
            {text.games[game]}
        </span>
    )
}

/** How the top of the panel looks in Discord: bar colour, banner, badge and title. */
function BannerPreviewCard({
    preview,
    barColor,
    clanAccent,
    clanTag,
    clanName,
    subtitle,
    serverName,
    text,
}: {
    preview: BannerPreview
    barColor: string
    clanAccent: string
    clanTag: string
    clanName: string
    subtitle: string
    serverName: string
    text: Text["banners"]
}) {
    const objectPosition = preview ? cropPosition(preview.crop) : undefined
    return (
        <div
            className="space-y-2 rounded-lg border-l-4 bg-[#2b2d31] p-2.5 text-[#f2f3f5]"
            style={{ borderLeftColor: barColor }}
        >
            <div className="relative aspect-[3/1] overflow-hidden rounded-md bg-[#0e1116]">
                {preview?.kind === "builtin" ? (
                    <Image
                        src={preview.path}
                        alt=""
                        fill
                        sizes="(max-width: 768px) 100vw, 320px"
                        quality={70}
                        className="object-cover"
                        style={{ objectPosition }}
                    />
                ) : preview ? (
                    // eslint-disable-next-line @next/next/no-img-element -- the clan's own uploads, already normalized
                    <img
                        src={preview.url}
                        alt=""
                        className="absolute inset-0 size-full object-cover"
                        style={{ objectPosition }}
                    />
                ) : null}
                <span
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-[#090b0f]/85 to-[#090b0f]/10"
                />
                {preview && preview.kind !== "asset" ? (
                    <span className="absolute top-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium">
                        {text.mapOverlay}
                    </span>
                ) : null}
                <span className="absolute bottom-2 left-2.5 flex items-center gap-2">
                    <span
                        className="flex size-9 items-center justify-center rounded-full border-2 bg-[#171717] text-[10px] font-extrabold"
                        style={{ borderColor: clanAccent }}
                    >
                        {clanTag}
                    </span>
                    <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm leading-4 font-extrabold">
                            {clanName}
                        </span>
                        <span className="truncate text-[10px] text-[#e3e5e8]">
                            {subtitle}
                        </span>
                    </span>
                </span>
            </div>
            <div className="px-0.5">
                <p className="text-[10px] font-semibold tracking-[0.04em] text-[#b5bac1] uppercase">
                    {text.liveServer}
                </p>
                <p className="truncate text-sm font-semibold">{serverName}</p>
            </div>
        </div>
    )
}

/** One server of "Bannery serverů" (P8-07, P8-12, P8-13). */
export function ServerBannerCard({
    serverName,
    game,
    currentMapName,
    settings,
    chip,
    preview,
    file,
    colorInput,
    clanAccent,
    clanTag,
    clanName,
    uploading,
    error,
    locale,
    text,
    onUpload,
    onRemove,
    onCrop,
    onUseMapImage,
    onColorInput,
    onClanColor,
}: {
    serverName: string
    game: PanelMapGame
    currentMapName: string | null
    settings: PanelGraphicsServer
    chip: "custom" | "map" | "none"
    preview: BannerPreview
    file: KnownFile | null
    /** The bar colour field; empty or the clan colour means the clan colour. */
    colorInput: string
    clanAccent: string
    clanTag: string
    clanName: string
    uploading: boolean
    error: string | null
    locale: string
    text: Text
    onUpload(file: File): void
    onRemove(): void
    onCrop(crop: BannerCrop): void
    onUseMapImage(value: boolean): void
    onColorInput(value: string): void
    onClanColor(): void
}) {
    const id = useId()
    const input = useRef<HTMLInputElement>(null)
    const t = text.banners
    const colorValid = isBarColorDraft(colorInput)
    const custom = settings.barColor !== null
    const barColor = settings.barColor ?? clanAccent
    const help = settings.bannerAssetId
        ? file
            ? fill(file.name ? t.uploadedFile : t.uploadedBanner, {
                  name: file.name ?? "",
                  width: file.width,
                  height: file.height,
                  size: formatKilobytes(file.bytes, locale),
              })
            : ""
        : !settings.useMapImage
          ? t.withoutBannerOff
          : currentMapName
            ? fill(t.withoutBanner, { map: currentMapName })
            : t.withoutBannerUnknownMap
    return (
        <article
            aria-labelledby={`${id}-title`}
            className="bg-card flex min-w-0 flex-col gap-3 rounded-xl border p-3.5"
        >
            <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                    <h3
                        id={`${id}-title`}
                        className="text-[15px] font-semibold"
                    >
                        {serverName}
                    </h3>
                    <GameChip game={game} text={text} />
                </div>
                <span
                    className={cn(
                        "inline-flex h-5 items-center rounded-full border px-2 text-[11px] font-medium",
                        CHIP[chip]
                    )}
                >
                    {chip === "custom"
                        ? t.customChip
                        : chip === "map"
                          ? t.mapChip
                          : t.noneChip}
                </span>
            </div>
            <BannerPreviewCard
                preview={preview}
                barColor={barColor}
                clanAccent={clanAccent}
                clanTag={clanTag}
                clanName={clanName}
                subtitle={`${serverName} · ${text.gameNames[game]}`}
                serverName={serverName}
                text={t}
            />
            <div className="space-y-1.5">
                <p className="text-sm font-semibold">{t.banner}</p>
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        ref={input}
                        id={`${id}-file`}
                        type="file"
                        accept={IMAGE_ACCEPT}
                        className="sr-only"
                        tabIndex={-1}
                        onChange={(event) => {
                            const chosen = event.target.files?.[0]
                            event.target.value = ""
                            if (chosen) onUpload(chosen)
                        }}
                    />
                    <Button
                        type="button"
                        variant="outline"
                        className="rounded-lg"
                        disabled={uploading}
                        onClick={() => input.current?.click()}
                    >
                        <Upload aria-hidden="true" />
                        {uploading ? t.uploading : t.upload}
                    </Button>
                    {settings.bannerAssetId ? (
                        <Button
                            type="button"
                            variant="ghost"
                            className="rounded-lg"
                            disabled={uploading}
                            onClick={onRemove}
                        >
                            {t.remove}
                        </Button>
                    ) : null}
                </div>
                <p className="text-muted-foreground text-xs leading-5">
                    {t.help}
                    {help ? ` ${help}` : ""}
                </p>
                {error ? (
                    <p role="alert" className="text-destructive text-xs">
                        {error}
                    </p>
                ) : null}
            </div>
            <div className="space-y-1.5">
                <p id={`${id}-crop`} className="text-sm font-semibold">
                    {t.crop}
                </p>
                <SegmentedControl
                    labelledBy={`${id}-crop`}
                    value={settings.crop}
                    onChange={onCrop}
                    options={BANNER_CROPS.map((crop) => ({
                        value: crop,
                        label: t.crops[crop],
                    }))}
                />
            </div>
            <label className="flex items-start gap-2.5 text-sm">
                <Switch
                    checked={settings.useMapImage}
                    onCheckedChange={onUseMapImage}
                    className="mt-0.5"
                />
                <span>{t.useMapImage}</span>
            </label>
            <div className="space-y-1.5">
                <label
                    htmlFor={`${id}-color`}
                    className="text-sm font-semibold"
                >
                    {t.barColor}
                </label>
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        type="color"
                        aria-label={t.barColor}
                        value={
                            colorValid && colorInput.trim()
                                ? colorInput.trim().toLowerCase()
                                : barColor
                        }
                        onChange={(event) => onColorInput(event.target.value)}
                        className="size-9 shrink-0 cursor-pointer rounded-lg border bg-transparent p-0.5"
                    />
                    <Input
                        id={`${id}-color`}
                        value={colorInput}
                        onChange={(event) => onColorInput(event.target.value)}
                        aria-invalid={!colorValid}
                        aria-describedby={
                            colorValid ? undefined : `${id}-color-error`
                        }
                        title={t.barColorInput}
                        spellCheck={false}
                        className="w-28 font-mono text-sm uppercase"
                    />
                    {custom ? null : (
                        <span className="text-muted-foreground text-xs">
                            {t.clanColorNote}
                        </span>
                    )}
                </div>
                {custom ? (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-lg"
                        onClick={onClanColor}
                    >
                        {t.clanColor}
                    </Button>
                ) : null}
                {colorValid ? null : (
                    <p
                        id={`${id}-color-error`}
                        role="alert"
                        className="text-destructive text-xs"
                    >
                        {t.barColorInvalid}
                    </p>
                )}
            </div>
        </article>
    )
}
