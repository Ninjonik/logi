import {
    liveServerPanelView,
    liveServerState,
    type LiveServerFacts,
} from "@/domain/discord-publications/live-panel"
import type {
    PanelBannerImage,
    PanelScoreImage,
} from "@/domain/discord-publications/panel-image-model"
import {
    panelMapDefinition,
    type PanelStyle,
} from "@/domain/discord-publications/panel-graphics"
import type {
    MessageMedia,
    MessageView,
} from "@/domain/discord-messages/message-view"
import { liveScoreImageModel } from "@/domain/discord-publications/live-panel-image"
import type { PanelEditorDraft } from "@/domain/discord-publications/panel-editor"
import { combinedPanelView } from "@/domain/discord-publications/combined-panel"
import { panelImageCopy } from "@/domain/discord-publications/panel-image-copy"
import { DEFAULT_MESSAGE_ACCENT_HEX } from "@/domain/discord-messages/format"
import { seedProgress } from "@/domain/discord-seed/progress"
import { getPanelMessages } from "@/lib/clan-language/panels"

/**
 * The editor preview (P2-27, P2-43..45, P2-B09): the exact view the bot
 * posts, built with the bot's own builders from the server data the test
 * read returned and the editor's unsaved settings. Pure; the editor owns the
 * requests and the rendered images.
 */

export type PreviewServer = {
    connectionId: string
    name: string | null
    gameId: string
    joinUrl: string | null
    address: string | null
    joinCode: string | null
    /** A password is stored or typed in; the preview never shows its value. */
    hasPassword: boolean
}

export type PreviewSeed = { liveFrom: number } | null

export type EditorPreviewInput = {
    draft: PanelEditorDraft
    panelId: string | null
    revision: number
    language: string
    timeZone: string
    clanName: string
    defaultStyle: PanelStyle
    now: number
    /** `@everyone` cannot view the channel; null before it was checked. */
    channelPrivate: boolean | null
    servers: Record<string, PreviewServer>
    facts: Record<string, LiveServerFacts | null>
    seeds: Record<string, PreviewSeed>
    liveFrom: Record<string, number>
    images: { score: string | null; banner: string | null }
    /** The dashboard's origin, for Logi's built-in map art. */
    assetOrigin: string
}

const MASKED_PASSWORD = "••••••"

/** The panel's resolved style: its own, else the clan default (P2-B16). */
export function draftStyle(draft: PanelEditorDraft, clanDefault: PanelStyle) {
    return draft.style ?? clanDefault
}

/** The bar colour drawn into images: the panel's own, else the clan's. */
export function resolvedAccent(
    draft: PanelEditorDraft,
    clanAccent: string | null
) {
    if (
        draft.accent === "custom" &&
        /^#[0-9a-fA-F]{6}$/.test(draft.accentColor)
    )
        return draft.accentColor.toLowerCase()
    return (clanAccent ?? DEFAULT_MESSAGE_ACCENT_HEX).toLowerCase()
}

/** Built-in map art as a small dashboard image (Next resizes the large files). */
export function mapThumbnail(
    origin: string,
    game: string,
    mapKey: string | null | undefined,
    description: string
): MessageMedia | null {
    const map = mapKey ? panelMapDefinition(game, mapKey) : null
    if (!map?.builtIn) return null
    return {
        url: `${origin.replace(/\/$/, "")}/_next/image?url=${encodeURIComponent(map.builtIn)}&w=256&q=70`,
        description,
    }
}

const accentOf = (draft: PanelEditorDraft) =>
    draft.accent === "custom" && /^#[0-9a-fA-F]{6}$/.test(draft.accentColor)
        ? draft.accentColor.toLowerCase()
        : null

/** The style A image model of the live preview, or null when the style has none. */
export function previewScoreModel(
    input: EditorPreviewInput,
    clanAccent: string | null
): PanelScoreImage | null {
    const { draft } = input
    if (
        draft.kind !== "server" ||
        draftStyle(draft, input.defaultStyle) !== "a"
    )
        return null
    const facts = input.facts[draft.connectionId]
    const server = input.servers[draft.connectionId]
    if (!facts) return null
    const seed = input.seeds[draft.connectionId] ?? null
    const state = liveServerState(facts, {
        paused: false,
        seedActive: Boolean(seed && draft.content.seedProgress),
        liveFrom: seed?.liveFrom ?? input.liveFrom[draft.connectionId] ?? 40,
    })
    const mapKey = facts.map?.key ?? null
    const map = mapKey ? panelMapDefinition(facts.game, mapKey) : null
    return liveScoreImageModel({
        facts,
        state,
        language: input.language,
        timeZone: input.timeZone,
        renderedAt: facts.dataAt ?? input.now,
        accentColor: resolvedAccent(draft, clanAccent),
        serverName:
            draft.title.trim() || server?.name || facts.serverName || "Logi",
        newMap: false,
        background: map?.builtIn
            ? { kind: "builtin", game: map.game, mapKey: map.key }
            : null,
        showQueue: draft.content.queue,
        showNextMap: draft.content.nextMap,
        joinCode: server?.joinCode ?? null,
    })
}

/** The style B banner model when the panel has no banner of its own. */
export function previewBannerModel(
    input: EditorPreviewInput,
    clanAccent: string | null
): PanelBannerImage | null {
    const { draft } = input
    if (
        draft.kind !== "server" ||
        draftStyle(draft, input.defaultStyle) !== "b" ||
        draft.bannerUrl
    )
        return null
    const facts = input.facts[draft.connectionId]
    if (!facts) return null
    const server = input.servers[draft.connectionId]
    const copy = getPanelMessages(input.language).live
    const mapKey = facts.map?.key ?? null
    const map = mapKey ? panelMapDefinition(facts.game, mapKey) : null
    const title =
        draft.title.trim() || server?.name || facts.serverName || "Logi"
    const language = ["cs", "en", "de"].includes(input.language)
        ? (input.language as PanelBannerImage["language"])
        : "en"
    return {
        version: 1,
        language,
        accentColor: resolvedAccent(draft, clanAccent),
        clanTag:
            Array.from(input.clanName.replace(/[^\p{L}\p{N}]/gu, ""))
                .slice(0, 3)
                .join("")
                .toLocaleUpperCase() || "LOGI",
        clanName: input.clanName.slice(0, 40) || "Logi",
        subtitle: `${title} · ${copy.game[facts.game]}`.slice(0, 80),
        background: map?.builtIn
            ? { kind: "builtin", game: map.game, mapKey: map.key }
            : null,
    }
}

/** The live server panel as the bot would post it now (P2-27). */
export function liveServerPreview(
    input: EditorPreviewInput
): MessageView | null {
    const { draft } = input
    const facts = input.facts[draft.connectionId]
    if (draft.kind !== "server" || !facts) return null
    const server = input.servers[draft.connectionId]
    const seed = input.seeds[draft.connectionId] ?? null
    const copy = getPanelMessages(input.language)
    const style = draftStyle(draft, input.defaultStyle)
    const privateChannel = input.channelPrivate === true
    const mapName = facts.map?.name ?? ""
    const alt = panelImageCopy(input.language).alt
    const liveFrom = seed?.liveFrom ?? input.liveFrom[draft.connectionId] ?? 40
    return liveServerPanelView({
        copy: copy.live,
        language: input.language,
        panel: {
            id: input.panelId ?? "preview",
            revision: input.revision,
            title: draft.title.trim() || server?.name || null,
            description: draft.description.trim() || null,
            showPlayers: draft.showPlayers,
            showLeaders: draft.showLeaders,
            reportEnabled: draft.report && Boolean(draft.reportCategoryId),
            layout: draft.layout,
            content: draft.content,
            accentColor: accentOf(draft),
            style,
        },
        facts,
        now: input.now,
        paused: false,
        privateChannel,
        seed: seed
            ? {
                  startedAt: input.now,
                  liveFrom: seed.liveFrom,
                  bar: seedProgress(facts.players, seed.liveFrom).bar,
                  callUrl: null,
                  channelId: null,
              }
            : null,
        seedChannelId: null,
        liveFrom,
        match: null,
        clanPlayers: null,
        server: {
            address: server?.address ?? null,
            joinCode: server?.joinCode ?? null,
            password:
                privateChannel && draft.content.password && server?.hasPassword
                    ? MASKED_PASSWORD
                    : null,
            joinUrl: server?.joinUrl ?? null,
        },
        newMap: false,
        emoji: {},
        images: {
            score: input.images.score
                ? { url: input.images.score, description: alt.score([mapName]) }
                : null,
            banner:
                style === "b"
                    ? draft.bannerUrl
                        ? {
                              url: draft.bannerUrl,
                              description: alt.banner(mapName),
                          }
                        : input.images.banner
                          ? {
                                url: input.images.banner,
                                description: alt.banner(mapName),
                            }
                          : null
                    : null,
            thumbnail:
                draft.artwork && style !== "c"
                    ? mapThumbnail(
                          input.assetOrigin,
                          facts.game,
                          facts.map?.key,
                          alt.map(mapName)
                      )
                    : null,
        },
        ids: { players: "preview:players", report: "preview:report" },
    })
}

/** "Naše servery" as the bot would post it now (P2-43..45). */
export function combinedPreview(input: EditorPreviewInput): MessageView | null {
    const { draft } = input
    if (draft.kind !== "servers" || !draft.connectionIds.length) return null
    const copy = getPanelMessages(input.language)
    const alt = panelImageCopy(input.language).alt
    const servers = draft.connectionIds.flatMap((connectionId) => {
        const facts = input.facts[connectionId]
        if (!facts) return []
        const server = input.servers[connectionId]
        const seed = input.seeds[connectionId] ?? null
        return [
            {
                connectionId,
                title: server?.name ?? facts.serverName ?? "—",
                facts,
                paused: false,
                seed: seed && draft.content.seedProgress ? seed : null,
                liveFrom: input.liveFrom[connectionId] ?? 40,
                joinUrl: draft.content.joinButton
                    ? (server?.joinUrl ?? null)
                    : null,
                joinable: Boolean(
                    facts.game === "wardogs"
                        ? server?.joinCode
                        : server?.address
                ),
                thumbnail:
                    draft.layout.showMap && draft.artwork
                        ? mapThumbnail(
                              input.assetOrigin,
                              facts.game,
                              facts.map?.key,
                              alt.map(facts.map?.name ?? "")
                          )
                        : null,
                address:
                    draft.content.address && facts.game !== "wardogs"
                        ? (server?.address ?? null)
                        : null,
                joinCode:
                    draft.content.joinCode && facts.game === "wardogs"
                        ? (server?.joinCode ?? null)
                        : null,
                seedBar:
                    seed && draft.content.seedProgress
                        ? seedProgress(facts.players, seed.liveFrom).bar
                        : null,
            },
        ]
    })
    if (!servers.length) return null
    return combinedPanelView({
        copy: copy.live,
        language: input.language,
        clanName: input.clanName,
        title: draft.title.trim() || null,
        description: draft.description.trim() || null,
        accentColor: accentOf(draft),
        footerTiming: draft.content.footerTiming,
        show: {
            score: draft.layout.showScoreboard,
            nextMap: draft.content.nextMap,
            queue: draft.content.queue,
        },
        servers,
        now: input.now,
        banner: null,
    })
}
