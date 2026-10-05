"use client"

import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"
import Link from "next/link"

import {
    applyPanelGraphicsPatch,
    panelGraphicsChangeCount,
    panelGraphicsPatchFrom,
    panelMapTiles,
    serverGraphics,
    type PanelGraphicsPatch,
    type PanelGraphicsSettings,
    type PanelMapTile,
} from "@/domain/discord-publications/panel-graphics-settings"
import {
    formatImageUploadMessage,
    uploadImageAsset,
    type ImageUploadResult,
} from "@/lib/image-asset-upload"
import {
    savePanelGraphics,
    type PanelGraphicsSaveError,
} from "@/lib/panel-graphics-client"
import { unsavedChangesLabel } from "@/components/app/settings/unsaved-changes-bar"
import { panelImageCopy } from "@/domain/discord-publications/panel-image-copy"
import { SettingsSaveBar } from "@/components/app/settings/settings-save-bar"
import { SettingsPanel } from "@/components/app/settings/settings-panel"
import type { PanelGraphicsPageData } from "@/lib/panel-graphics-view"
import type { ImageAssetKind } from "@/domain/assets/image-asset"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"

import {
    bannerCard,
    isBarColorDraft,
    knownFiles,
    type KnownFile,
} from "./panel-graphics-state"
import { FactionIconsSection, StatusIconsSection } from "./panel-sign-sections"
import { ServerBannerCard } from "./server-banner-card"
import { PanelStylePicker } from "./panel-style-picker"
import { MapImageTiles } from "./map-image-tiles"

type Upload = (
    serverId: string,
    kind: ImageAssetKind,
    file: Blob
) => Promise<ImageUploadResult>
type Save = (
    serverId: string,
    patch: PanelGraphicsPatch
) => Promise<
    | { ok: true; revision: number }
    | { ok: false; error: PanelGraphicsSaveError }
>

/**
 * "Grafika panelů" (board P8): the clan's default panel style, one banner per
 * game server and the map images, plus the fixed signs the bot provisions.
 * Images upload immediately; "Uložit" saves every change in one request and
 * the panels pick it up at their next refresh (within 60 s).
 */
type FormProps = {
    serverId: string
    /** Dashboard locale (copy, plurals and numbers). */
    locale: string
    data: PanelGraphicsPageData
    /** Where one panel's own style is set (the panel editor). */
    editorHref: string
    gameServersHref: string
    dictionary: Dictionary
    upload?: Upload
    save?: Save
}

export function PanelGraphicsSettingsForm(props: FormProps) {
    const router = useRouter()
    return (
        <PanelGraphicsSettingsView
            {...props}
            refresh={() => router.refresh()}
        />
    )
}

/** The page without routing, so tests and previews can render it. */
export function PanelGraphicsSettingsView({
    serverId,
    locale,
    data,
    editorHref,
    gameServersHref,
    dictionary,
    upload = uploadImageAsset,
    save = savePanelGraphics,
    refresh,
}: FormProps & {
    /** Re-reads the server data after a save or for "Načíst znovu". */
    refresh(): void
}) {
    const text = dictionary.panelGraphicsPage
    const saveBar = dictionary.settingsHub.saveBar
    const [saved, setSaved] = useState<PanelGraphicsSettings>(data.settings)
    const [revision, setRevision] = useState(data.revision)
    const [draft, setDraft] = useState<PanelGraphicsSettings>(data.settings)
    const [files, setFiles] = useState<Record<string, KnownFile>>(() =>
        knownFiles(data)
    )
    const colorOf = (settings: PanelGraphicsSettings, id: string) =>
        (serverGraphics(settings, id).barColor ?? data.clanAccent).toUpperCase()
    const [colors, setColors] = useState<Record<string, string>>(() =>
        Object.fromEntries(
            data.servers.map((server) => [
                server.id,
                colorOf(data.settings, server.id),
            ])
        )
    )
    const [uploading, setUploading] = useState<ReadonlySet<string>>(new Set())
    const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({})
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState<PanelGraphicsSaveError | null>(
        null
    )

    const changes = panelGraphicsChangeCount(saved, draft)
    const colorsValid = data.servers.every((server) =>
        isBarColorDraft(colors[server.id] ?? "")
    )
    const tiles = useMemo(
        () =>
            panelMapTiles(
                draft.maps.flatMap((map) => {
                    const file = files[map.assetId]
                    return file
                        ? [
                              {
                                  game: map.game,
                                  mapKey: map.mapKey,
                                  url: file.url,
                              },
                          ]
                        : []
                })
            ),
        [draft.maps, files]
    )
    const imageCopy = panelImageCopy(locale)

    function change(patch: PanelGraphicsPatch) {
        setDraft((current) => applyPanelGraphicsPatch(current, patch))
        setSaveError(null)
    }
    async function runUpload(
        key: string,
        kind: ImageAssetKind,
        file: File,
        onDone: (assetId: string) => void
    ) {
        setUploading((current) => new Set(current).add(key))
        setUploadErrors((current) => {
            const next = { ...current }
            delete next[key]
            return next
        })
        try {
            const result = await upload(serverId, kind, file)
            if (result.ok) {
                setFiles((current) => ({
                    ...current,
                    [result.asset.id]: {
                        assetId: result.asset.id,
                        url: result.asset.url,
                        width: result.asset.width,
                        height: result.asset.height,
                        bytes: result.asset.bytes,
                        name: file.name,
                    },
                }))
                onDone(result.asset.id)
            } else
                setUploadErrors((current) => ({
                    ...current,
                    [key]: formatImageUploadMessage(
                        text.uploadErrors[result.error],
                        result.retryAfterMs
                    ),
                }))
        } finally {
            setUploading((current) => {
                const next = new Set(current)
                next.delete(key)
                return next
            })
        }
    }
    function setColor(id: string, value: string) {
        setColors((current) => ({ ...current, [id]: value }))
        const trimmed = value.trim()
        if (!isBarColorDraft(trimmed)) return
        change({
            servers: [
                {
                    connectionId: id,
                    barColor:
                        !trimmed ||
                        (trimmed.toLowerCase() ===
                            data.clanAccent.toLowerCase() &&
                            serverGraphics(draft, id).barColor === null)
                            ? null
                            : trimmed.toLowerCase(),
                },
            ],
        })
    }
    function discard() {
        setDraft(saved)
        setColors(
            Object.fromEntries(
                data.servers.map((server) => [
                    server.id,
                    colorOf(saved, server.id),
                ])
            )
        )
        setUploadErrors({})
        setSaveError(null)
    }
    async function submit() {
        const patch = panelGraphicsPatchFrom(saved, draft, revision)
        if (!patch || !colorsValid || uploading.size) return
        setSaving(true)
        setSaveError(null)
        try {
            const result = await save(serverId, patch)
            if (result.ok) {
                setSaved(draft)
                setRevision(result.revision)
                toast.success(text.saved)
                refresh()
            } else setSaveError(result.error)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-6">
            <PanelStylePicker
                value={draft.defaultStyle}
                onChange={(style) => change({ defaultStyle: style })}
                editorHref={editorHref}
                text={text.style}
            />
            <SettingsPanel
                id="panel-graphics-banners"
                title={text.banners.title}
                description={text.banners.description}
            >
                {data.servers.length ? (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {data.servers.map((server) => {
                            const settings = serverGraphics(draft, server.id)
                            const card = bannerCard({
                                connectionId: server.id,
                                gameId: server.gameId,
                                currentMapKey: server.currentMap?.key ?? null,
                                draft,
                                files,
                            })
                            const key = `server:${server.id}`
                            return (
                                <ServerBannerCard
                                    key={server.id}
                                    serverName={
                                        server.name ?? text.unnamedServer
                                    }
                                    game={server.gameId}
                                    currentMapName={
                                        server.currentMap?.name ?? null
                                    }
                                    settings={settings}
                                    chip={card.chip}
                                    preview={card.preview}
                                    file={
                                        settings.bannerAssetId
                                            ? (files[settings.bannerAssetId] ??
                                              null)
                                            : null
                                    }
                                    colorInput={colors[server.id] ?? ""}
                                    clanAccent={data.clanAccent}
                                    clanTag={data.clanTag}
                                    clanName={data.clanName ?? ""}
                                    uploading={uploading.has(key)}
                                    error={uploadErrors[key] ?? null}
                                    locale={locale}
                                    text={text}
                                    onUpload={(file) =>
                                        void runUpload(
                                            key,
                                            "panel-banner",
                                            file,
                                            (assetId) =>
                                                change({
                                                    servers: [
                                                        {
                                                            connectionId:
                                                                server.id,
                                                            bannerAssetId:
                                                                assetId,
                                                        },
                                                    ],
                                                })
                                        )
                                    }
                                    onRemove={() =>
                                        change({
                                            servers: [
                                                {
                                                    connectionId: server.id,
                                                    bannerAssetId: null,
                                                },
                                            ],
                                        })
                                    }
                                    onCrop={(crop) =>
                                        change({
                                            servers: [
                                                {
                                                    connectionId: server.id,
                                                    crop,
                                                },
                                            ],
                                        })
                                    }
                                    onUseMapImage={(useMapImage) =>
                                        change({
                                            servers: [
                                                {
                                                    connectionId: server.id,
                                                    useMapImage,
                                                },
                                            ],
                                        })
                                    }
                                    onColorInput={(value) =>
                                        setColor(server.id, value)
                                    }
                                    onClanColor={() => {
                                        setColors((current) => ({
                                            ...current,
                                            [server.id]:
                                                data.clanAccent.toUpperCase(),
                                        }))
                                        change({
                                            servers: [
                                                {
                                                    connectionId: server.id,
                                                    barColor: null,
                                                },
                                            ],
                                        })
                                    }}
                                />
                            )
                        })}
                    </div>
                ) : (
                    <p className="text-muted-foreground text-sm">
                        {text.banners.empty}{" "}
                        <Link
                            href={gameServersHref}
                            className="text-foreground underline underline-offset-4"
                        >
                            {text.banners.emptyLink}
                        </Link>
                    </p>
                )}
            </SettingsPanel>
            <MapImageTiles
                tiles={tiles}
                uploading={uploading}
                errors={uploadErrors}
                pluralLocale={locale}
                text={text}
                onUpload={(tile: PanelMapTile, file) =>
                    void runUpload(
                        `${tile.game}:${tile.key}`,
                        "panel-map",
                        file,
                        (assetId) =>
                            change({
                                maps: [
                                    {
                                        game: tile.game,
                                        mapKey: tile.key,
                                        assetId,
                                    },
                                ],
                            })
                    )
                }
                onRestore={(tile) =>
                    change({
                        maps: [
                            {
                                game: tile.game,
                                mapKey: tile.key,
                                assetId: null,
                            },
                        ],
                    })
                }
            />
            <FactionIconsSection emoji={data.emoji} text={text.factions} />
            <StatusIconsSection
                emoji={data.emoji}
                text={text.status}
                factionsText={text.factions}
                sample={{
                    queue: imageCopy.gauge(78, 100, { queue: 3 }),
                    seed: imageCopy.gauge(12, 100, { seedTarget: 40 }),
                }}
            />
            {saveError ? (
                <div
                    role="alert"
                    className="border-destructive/40 bg-destructive/5 text-destructive flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm"
                >
                    <span>{text.errors[saveError]}</span>
                    {saveError === "conflict" ||
                    saveError === "unknown_server" ? (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={refresh}
                        >
                            {text.reload}
                        </Button>
                    ) : null}
                </div>
            ) : null}
            <SettingsSaveBar
                note={text.saveNote}
                dirty={changes > 0}
                saving={saving || uploading.size > 0 || !colorsValid}
                discardLabel={saveBar.discard}
                saveLabel={saveBar.save}
                unsavedLabel={unsavedChangesLabel(changes, locale, saveBar)}
                onDiscard={discard}
                onSave={() => void submit()}
            />
        </div>
    )
}
