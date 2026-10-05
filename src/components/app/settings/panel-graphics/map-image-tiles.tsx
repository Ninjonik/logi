"use client"

import { Search, Upload } from "lucide-react"
import { useRef, useState } from "react"
import Image from "next/image"

import {
    filterPanelMapTiles,
    type PanelMapTile,
} from "@/domain/discord-publications/panel-graphics-settings"
import type { PanelMapGame } from "@/domain/discord-publications/panel-graphics"
import { SegmentedControl } from "@/components/app/settings/segmented-control"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

import { GameChip, IMAGE_ACCEPT } from "./server-banner-card"
import { GraphicsPanel } from "./graphics-panel"
import { fill } from "./panel-graphics-state"

type Text = Dictionary["panelGraphicsPage"]
type GameFilter = PanelMapGame | "all"

const STATUS_CHIP = {
    builtin: "bg-muted text-foreground",
    custom: "border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-200",
    none: "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100",
} as const

function MapTile({
    tile,
    uploading,
    error,
    text,
    onUpload,
    onRestore,
}: {
    tile: PanelMapTile
    uploading: boolean
    error: string | null
    text: Text
    onUpload(file: File): void
    onRestore(): void
}) {
    const input = useRef<HTMLInputElement>(null)
    const t = text.maps
    const alt = fill(t.imageAlt, { name: tile.name })
    return (
        <li className="flex min-w-0 flex-col gap-1.5">
            <div className="relative aspect-square overflow-hidden rounded-lg border">
                {tile.status === "custom" && tile.image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- the clan's own upload, already normalized
                    <img
                        src={tile.image}
                        alt={alt}
                        className="absolute inset-0 size-full object-cover"
                    />
                ) : tile.image ? (
                    <Image
                        src={tile.image}
                        alt={alt}
                        fill
                        sizes="(max-width: 640px) 45vw, 160px"
                        quality={70}
                        className="object-cover"
                    />
                ) : (
                    <span className="text-muted-foreground flex size-full items-center justify-center border-dashed p-2 text-center text-xs font-medium">
                        {tile.name}
                    </span>
                )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-semibold">{tile.name}</span>
                <GameChip game={tile.game} text={text} />
            </div>
            <span
                className={cn(
                    "inline-flex h-5 w-fit items-center rounded-full border px-2 text-[11px] font-medium",
                    STATUS_CHIP[tile.status]
                )}
            >
                {tile.status === "custom"
                    ? t.customChip
                    : tile.status === "builtin"
                      ? t.builtinChip
                      : t.noneChip}
            </span>
            <input
                ref={input}
                type="file"
                accept={IMAGE_ACCEPT}
                className="sr-only"
                tabIndex={-1}
                aria-label={`${tile.status === "none" ? t.upload : t.replace}: ${tile.name}`}
                onChange={(event) => {
                    const chosen = event.target.files?.[0]
                    event.target.value = ""
                    if (chosen) onUpload(chosen)
                }}
            />
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit rounded-lg"
                disabled={uploading}
                aria-label={`${tile.status === "none" ? t.upload : t.replace}: ${tile.name}`}
                onClick={() => input.current?.click()}
            >
                {tile.status === "none" ? <Upload aria-hidden="true" /> : null}
                {uploading
                    ? t.uploading
                    : tile.status === "none"
                      ? t.upload
                      : t.replace}
            </Button>
            {tile.builtIn || tile.status === "custom" ? (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-fit rounded-lg"
                    disabled={tile.status !== "custom" || uploading}
                    aria-label={`${t.restore}: ${tile.name}`}
                    onClick={onRestore}
                >
                    {t.restore}
                </Button>
            ) : null}
            {error ? (
                <p role="alert" className="text-destructive text-xs">
                    {error}
                </p>
            ) : null}
        </li>
    )
}

/** "Obrázky map" (P8-14..19): built-in images, the clan's overrides, search and game filter. */
export function MapImageTiles({
    tiles,
    uploading,
    errors,
    pluralLocale,
    text,
    onUpload,
    onRestore,
}: {
    tiles: PanelMapTile[]
    /** `game:mapKey` of maps whose upload is running. */
    uploading: ReadonlySet<string>
    errors: Readonly<Record<string, string>>
    /** For the "1 vlastní" plural. */
    pluralLocale: string
    text: Text
    onUpload(tile: PanelMapTile, file: File): void
    onRestore(tile: PanelMapTile): void
}) {
    const t = text.maps
    const [query, setQuery] = useState("")
    const [game, setGame] = useState<GameFilter>("all")
    const shown = filterPanelMapTiles(tiles, { query, game })
    const custom = tiles.filter((tile) => tile.status === "custom").length
    const plural = new Intl.PluralRules(pluralLocale).select(custom)
    const customLabel = fill(
        plural === "one" || plural === "few" || plural === "many"
            ? t.customCount[plural]
            : t.customCount.other,
        { count: custom }
    )
    return (
        <GraphicsPanel
            id="panel-graphics-maps"
            title={t.title}
            description={t.description}
            chip={
                custom ? (
                    <span className="inline-flex h-6 items-center rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 text-xs font-medium text-sky-800 dark:text-sky-200">
                        {customLabel}
                    </span>
                ) : null
            }
        >
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                    <label
                        htmlFor="panel-graphics-map-search"
                        className="text-sm font-medium"
                    >
                        {t.search}
                    </label>
                    <div className="relative">
                        <Search
                            aria-hidden="true"
                            className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
                        />
                        <Input
                            id="panel-graphics-map-search"
                            type="search"
                            value={query}
                            placeholder={t.searchPlaceholder}
                            onChange={(event) => setQuery(event.target.value)}
                            className="pl-9"
                        />
                    </div>
                </div>
                <div className="space-y-1.5">
                    <p
                        id="panel-graphics-map-game"
                        className="text-sm font-medium"
                    >
                        {t.game}
                    </p>
                    <SegmentedControl<GameFilter>
                        labelledBy="panel-graphics-map-game"
                        value={game}
                        onChange={setGame}
                        options={[
                            { value: "all", label: t.all },
                            {
                                value: "hell_let_loose",
                                label: text.games.hell_let_loose,
                            },
                            { value: "wardogs", label: text.games.wardogs },
                        ]}
                    />
                </div>
            </div>
            {shown.length ? (
                <ul className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
                    {shown.map((tile) => {
                        const key = `${tile.game}:${tile.key}`
                        return (
                            <MapTile
                                key={key}
                                tile={tile}
                                uploading={uploading.has(key)}
                                error={errors[key] ?? null}
                                text={text}
                                onUpload={(file) => onUpload(tile, file)}
                                onRestore={() => onRestore(tile)}
                            />
                        )
                    })}
                </ul>
            ) : (
                <p className="text-muted-foreground text-sm">{t.noResults}</p>
            )}
            <p className="text-muted-foreground text-xs" aria-live="polite">
                {fill(t.footer, { shown: shown.length, total: tiles.length })}
            </p>
        </GraphicsPanel>
    )
}
