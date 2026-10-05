import type { MessageCreateOptions } from "discord.js"

import {
    isNewMap,
    nextMapChange,
    planPanelAttachments,
    resolvePanelAccent,
    resolvePanelMapImage,
    resolvePanelStyle,
    resolveScoreImageBackground,
    type MapChangeState,
    type PanelStyle,
} from "../../../src/domain/discord-publications/panel-graphics"
import {
    hllLiveFacts,
    liveServerPanelView,
    liveServerState,
    snapshotLiveFacts,
    wardogsLiveFacts,
    type LiveServerFacts,
    type PanelEmojiMarkup,
} from "../../../src/domain/discord-publications/live-panel"
import {
    isPanelPaused,
    normalizePanelKind,
    resolvePanelContent,
    type PanelContent,
} from "../../../src/domain/discord-publications/settings"
import {
    panelBannerImage,
    resolvePanelPresentation,
    type PanelPresentation,
} from "../../../src/domain/discord-publications/panel-presentation"
import {
    isRequestPending,
    panelWork,
    type PanelAttempt,
    type PanelWarning,
} from "../../../src/domain/discord-publications/panel-delivery"
import {
    competitionTableView,
    type CompetitionDivisionTable,
} from "../../../src/domain/discord-publications/competition-panel"
import {
    passwordShown,
    passwordWithheldNotice,
    serverJoinUrl,
} from "../../../src/domain/discord-publications/server-join"
import type {
    PanelBannerImage,
    PanelScoreImage,
} from "../../../src/domain/discord-publications/panel-image-model"
import {
    clanPlayersOnServer,
    type RunningMatch,
} from "../../../src/domain/discord-publications/running-match"
import {
    synchronizeResults,
    type ResultEvent,
} from "../../../src/application/discord-publications/results"
import type { PanelGraphicsForBot } from "../../../src/domain/discord-publications/panel-graphics-settings"
import type {
    ChipTone,
    MessageMedia,
} from "../../../src/domain/discord-messages/message-view"
import { liveScoreImageModel } from "../../../src/domain/discord-publications/live-panel-image"
import { combinedPanelView } from "../../../src/domain/discord-publications/combined-panel"
import { panelImageCopy } from "../../../src/domain/discord-publications/panel-image-copy"
import type { SeedPanelState } from "../../../src/application/discord-seed/panel-state"
import { resultCardView } from "../../../src/domain/discord-publications/result-panel"
import type { MessageStyle } from "../../../src/domain/discord-messages/message-style"
import { factionEmblem } from "../../../src/domain/discord-messages/faction-emblem"
import type { WarconServed } from "../../../src/application/game-data/read-warcon"
import type { HllServed } from "../../../src/application/game-data/read-hll-live"
import type { ServerSnapshot } from "../../../src/domain/game-data/contracts"
import { seedProgress } from "../../../src/domain/discord-seed/progress"
import { getPanelMessages } from "../../../src/lib/clan-language/panels"
import { getEventMessages } from "../../../src/lib/clan-language/events"
import { classifyPanelError, PanelPassError } from "./panel-errors"
import { isGameId } from "../../../src/domain/games/game"
import type { PanelImageAttachment } from "./score-image"
import { publicationHash } from "../sync/publication"
import { messagePayload } from "../ui/message-kit"
import { formatMapLabel } from "../map-label"

/**
 * One pass of the bot over one panel: decide the work (render, draw the
 * paused state once, withdraw, remove), read the server data, build the
 * view with the shared domain renderer, publish it and report what happened.
 * Discord, Convex and the image renderer are ports, so the whole pass runs
 * with fakes in tests.
 */

export type BotPanelServer = {
    connectionId: string
    name: string | null
    gameId: string
    provider: string
    snapshot: ServerSnapshot | null
    seedPlan: { liveFrom: number; seedChannelId: string | null } | null
    join: {
        slug: string
        address: string | null
        joinCode: string | null
        hasPassword: boolean
    } | null
}

/** A panel as `discordPublicPanels:forGuild` returns it. */
export type BotPanel = {
    _id: string
    guildId: string
    gameId: string
    kind: string
    channelId: string
    connectionId?: string
    connectionIds?: string[]
    title?: string
    description?: string
    enabled: boolean
    paused?: boolean
    draft?: boolean
    removing?: boolean
    showPlayers: boolean
    showLeaders?: boolean
    reportCategoryId?: string
    artwork: boolean
    content?: Partial<PanelContent>
    presentation?: Partial<PanelPresentation> | null
    calendarCategories?: string[]
    competitionId?: string
    requestedAt?: number
    revision: number
    createdAt: number
    servers: BotPanelServer[]
    status: {
        handledRequestAt: number | null
        passwordNotifiedAt: number | null
        sentAt: number | null
    } | null
}

/** What every panel of one workspace is drawn with on this pass. */
export type GuildPass = {
    guildId: string
    language: string
    timeZone: string
    clanName: string
    siteUrl: string
    style: MessageStyle | null
    graphics: PanelGraphicsForBot
    seeds: SeedPanelState[]
    emoji: PanelEmojiMarkup
    now: number
}

export type PublicationBinding = {
    key: string
    channelId: string | null
    messageId: string | null
    hash: string | null
    lastSuccessAt: number | null
}

export type PanelRunPorts = {
    publish(input: {
        key: string
        revision: number
        channelId: string | null
        message: MessageCreateOptions
    }): Promise<string | null | undefined>
    bindings(): Promise<PublicationBinding[]>
    /** Fresh channel facts; null when the channel no longer exists. */
    channelAccess(
        channelId: string
    ): Promise<{ everyoneCanView: boolean; canAttach: boolean } | null>
    hllLive(panel: BotPanel, connectionId: string): Promise<HllServed>
    warconLive(panel: BotPanel, connectionId: string): Promise<WarconServed>
    password(panelId: string): Promise<string | null>
    clanPlayers(platformIds: string[]): Promise<string[]>
    runningMatch(connectionId: string): Promise<RunningMatch | null>
    scoreImage(
        key: string,
        model: PanelScoreImage
    ): Promise<PanelImageAttachment | null>
    bannerImage(
        key: string,
        model: PanelBannerImage,
        serverName: string,
        timeZone: string
    ): Promise<PanelImageAttachment | null>
    mapImage(
        game: string,
        mapKey: string | null,
        look: "thumb" | "banner"
    ): Promise<{ name: string; bytes: Uint8Array; description: string } | null>
    resultsPage(
        panelId: string,
        cursor: string | null
    ): Promise<{ cursor: string | null; events: ResultEvent[] } | null>
    competition(
        competitionId: string
    ): Promise<{ slug: string; tables: CompetitionDivisionTable[] } | null>
    /** Redraws the calendar from the guild sync data (`sync/panels.ts`). */
    refreshCalendar(): Promise<void>
    purge(panelId: string): Promise<boolean>
    /** Tells the admins in the errors channel that the password was removed (P4-30). */
    notifyPasswordHidden(panel: BotPanel): Promise<void>
    /** W5's WD League renderer; absent until it lands. */
    league?: (panel: BotPanel, pass: GuildPass) => Promise<number>
}

/** What a pass remembers between passes in one bot process. */
export type PanelRunMemory = {
    /** Panels whose current paused state is already drawn. */
    pausedDrawn: Map<string, string>
    /** The last map per server, for "Nová mapa" (P7-31). */
    maps: Map<string, MapChangeState>
}
export function createPanelRunMemory(): PanelRunMemory {
    return { pausedDrawn: new Map(), maps: new Map() }
}

export type PanelRunResult = {
    attempt: PanelAttempt
    passwordNotified?: boolean
    passwordReset?: boolean
    /** Come back sooner than the 60 s refresh (an HLL read is busy). */
    retryInMs?: number
}

const REFRESH_MS = 60_000
/** A card unchanged since this long ago is re-checked in Discord anyway (L3-B01). */
const RESULT_RECHECK_MS = 10 * 60_000

/** The state of a panel that, when it changes, makes the bot look at once. */
export function panelStateKey(panel: BotPanel) {
    return [
        panel.revision,
        isPanelPaused(panel),
        Boolean(panel.draft),
        Boolean(panel.removing),
        panel.requestedAt ?? 0,
    ].join(":")
}

const keyOf = (panel: BotPanel) => `panel:${panel._id}`
const ownsKey = (panel: BotPanel, key: string) =>
    key === keyOf(panel) ||
    key.startsWith(`${keyOf(panel)}:`) ||
    (panel.kind === "calendar" && key === "calendar")

function chipIcons(emoji: PanelEmojiMarkup) {
    const icons: Partial<Record<ChipTone, string>> = {}
    if (emoji.live) icons.success = emoji.live
    if (emoji.seeding) icons.warning = emoji.seeding
    if (emoji.empty) icons.neutral = emoji.empty
    if (emoji.offline) icons.danger = emoji.offline
    return icons
}

function attempt(
    pass: GuildPass,
    input: Partial<PanelAttempt> & { handledRequestAt: number | null }
): PanelAttempt {
    return {
        attemptAt: pass.now,
        ok: true,
        error: null,
        nextAt: pass.now + REFRESH_MS,
        dataAt: null,
        warnings: [],
        messages: 0,
        ...input,
    }
}

/** Facts of a server from its live read, else its collected snapshot. */
async function serverFacts(
    panel: BotPanel,
    server: BotPanelServer,
    ports: PanelRunPorts,
    warnings: PanelWarning[]
): Promise<{ facts: LiveServerFacts; busyMs: number | null }> {
    const fallback = (): LiveServerFacts =>
        server.snapshot
            ? snapshotLiveFacts(server.snapshot)
            : {
                  ...snapshotLiveFacts({
                      id: server.connectionId,
                      guildId: panel.guildId,
                      gameId:
                          server.gameId === "wardogs"
                              ? "wardogs"
                              : "hell_let_loose",
                      provider: "hll_crcon",
                      displayName: server.name,
                      state: "unknown",
                      map: null,
                      players: null,
                      capacity: null,
                      providerInstanceId: null,
                      scores: [],
                      capabilities: [],
                      observedAt: null,
                      lastSuccessAt: null,
                      providerUpdatedAt: null,
                      freshness: "unavailable",
                      attribution: null,
                  }),
              }
    try {
        if (server.provider === "hll_crcon" && server.snapshot) {
            const served = await ports.hllLive(panel, server.connectionId)
            if (served.kind === "ready")
                return {
                    facts: hllLiveFacts(served.envelope.data),
                    busyMs: null,
                }
            if (served.kind === "busy")
                return {
                    facts: fallback(),
                    busyMs: Math.min(served.retryAfterMs, 15_000),
                }
            warnings.push("live_data_unavailable")
        }
        if (server.provider === "wardogs_warcon" && server.snapshot) {
            const served = await ports.warconLive(panel, server.connectionId)
            if (
                served.kind === "ready" &&
                served.envelope.result.view === "live"
            )
                return {
                    facts: wardogsLiveFacts(served.envelope.result.data),
                    busyMs: null,
                }
            warnings.push("live_data_unavailable")
        }
    } catch {
        // Never skip the post because the live read failed (diagnosis 7.1.2).
        warnings.push("live_data_unavailable")
    }
    return { facts: fallback(), busyMs: null }
}

type PanelFile = {
    name: string
    bytes: Uint8Array
    description: string
}

/** The images of one message within Discord's attachment limit, score first (P7-B06). */
function filesOf(images: {
    score: PanelFile | null
    banner: PanelFile | null
    thumbnail: PanelFile | null
}) {
    const planned = (["score", "banner", "thumbnail"] as const).flatMap(
        (role) => {
            const image = images[role]
            return image ? [{ ...image, role }] : []
        }
    )
    return planPanelAttachments(planned).attached.map((image) => ({
        attachment: Buffer.from(image.bytes),
        name: image.name,
        description: image.description.slice(0, 1024),
    }))
}

async function runLive(
    panel: BotPanel,
    pass: GuildPass,
    ports: PanelRunPorts,
    memory: PanelRunMemory,
    handledRequestAt: number | null
): Promise<PanelRunResult> {
    const server = panel.servers[0]
    if (!server) throw new PanelPassError("source_missing")
    if (!server.snapshot) throw new PanelPassError("source_not_collecting")
    const channel = await ports.channelAccess(panel.channelId)
    if (!channel) throw new PanelPassError("channel_missing")
    const warnings: PanelWarning[] = []
    const { facts, busyMs } = await serverFacts(panel, server, ports, warnings)
    // Keep the current card while another reader holds the HLL lease.
    if (busyMs !== null && panel.status?.sentAt)
        return {
            attempt: attempt(pass, {
                handledRequestAt: null,
                nextAt: pass.now + busyMs,
                messages: 1,
            }),
            retryInMs: busyMs,
        }
    const content = resolvePanelContent(panel.content)
    const look = resolvePanelPresentation(panel)
    const paused = isPanelPaused(panel)
    const privateChannel = !channel.everyoneCanView
    const copy = getPanelMessages(pass.language)
    const seedState =
        pass.seeds.find((seed) => seed.connectionId === server.connectionId) ??
        null
    const liveFrom = seedState?.liveFrom ?? server.seedPlan?.liveFrom ?? 40
    const seed =
        seedState && content.seedProgress
            ? {
                  startedAt: seedState.startedAt,
                  liveFrom: seedState.liveFrom,
                  bar: seedProgress(facts.players, seedState.liveFrom).bar,
                  callUrl: seedState.call
                      ? `https://discord.com/channels/${pass.guildId}/${seedState.call.channelId}/${seedState.call.messageId}`
                      : null,
                  channelId: seedState.call?.channelId ?? null,
              }
            : null

    // P4-B06: the password only where @everyone cannot see, checked now.
    const passwordInput = {
        kind: "server",
        switchOn: content.password,
        stored: Boolean(server.join?.hasPassword),
        everyoneCanView: channel.everyoneCanView,
    }
    const password = passwordShown(passwordInput)
        ? await ports.password(panel._id)
        : null
    let passwordNotified = false
    if (
        passwordWithheldNotice({
            ...passwordInput,
            alreadyNotified: Boolean(panel.status?.passwordNotifiedAt),
        })
    ) {
        warnings.push("password_hidden_public_channel")
        await ports.notifyPasswordHidden(panel).catch(() => undefined)
        passwordNotified = true
    } else if (passwordInput.switchOn && channel.everyoneCanView)
        warnings.push("password_hidden_public_channel")
    const passwordReset =
        privateChannel && Boolean(panel.status?.passwordNotifiedAt)

    const [match, clanIds] = await Promise.all([
        ports.runningMatch(server.connectionId).catch(() => null),
        privateChannel && facts.rosterFresh
            ? ports
                  .clanPlayers(
                      facts.roster
                          .map((player) => player.id)
                          .filter((id): id is string => Boolean(id))
                  )
                  .catch(() => [])
            : Promise.resolve([] as string[]),
    ])
    const clanPlayers = clanIds.length
        ? clanPlayersOnServer(facts.roster, new Set(clanIds))
        : null

    const mapKey = facts.map?.key ?? null
    const mapState = nextMapChange(
        memory.maps.get(server.connectionId) ?? null,
        mapKey,
        pass.now
    )
    memory.maps.set(server.connectionId, mapState)
    const newMap = isNewMap(mapState, pass.now)

    const style: PanelStyle = resolvePanelStyle(
        { presentation: { style: panel.presentation?.style ?? null } },
        pass.graphics.defaultStyle
    )
    const graphicsServer =
        pass.graphics.servers.find(
            (entry) => entry.connectionId === server.connectionId
        ) ?? null
    const ownAccent =
        look.accentColor ??
        (style === "b" ? (graphicsServer?.barColor ?? null) : null)
    const accent = resolvePanelAccent({
        style,
        panelAccent: look.accentColor,
        serverBarColor: graphicsServer?.barColor ?? null,
        clanAccent: pass.style?.accentColor ?? null,
    })
    const state = liveServerState(facts, {
        paused,
        seedActive: Boolean(seed),
        liveFrom: seed?.liveFrom ?? liveFrom,
    })
    const mapImage = resolvePanelMapImage({
        game: facts.game,
        mapKey,
        overrides: pass.graphics.mapOverrides,
    })
    const title = panel.title?.trim() || server.name || facts.serverName || "—"
    const showImages = channel.canAttach
    if (!channel.canAttach) warnings.push("attach_files_missing")

    let score: PanelImageAttachment | null = null
    if (
        style === "a" &&
        showImages &&
        state !== "offline" &&
        state !== "paused"
    ) {
        const model = liveScoreImageModel({
            facts,
            state,
            language: pass.language,
            timeZone: pass.timeZone,
            renderedAt: facts.dataAt ?? pass.now,
            accentColor: accent,
            serverName: title,
            newMap,
            background: resolveScoreImageBackground({
                server: graphicsServer?.banner ?? null,
                mapImage,
            }),
            showQueue: content.queue,
            showNextMap: content.nextMap,
            joinCode: server.join?.joinCode ?? null,
        })
        score = model
            ? await ports.scoreImage(keyOf(panel), model).catch(() => null)
            : null
    }
    let banner: {
        name: string
        bytes: Uint8Array
        description: string
    } | null = null
    let bannerUrl: string | null = null
    if (style === "b" && state !== "offline") {
        const own = panelBannerImage(look)
        if (own) bannerUrl = own
        else if (showImages) {
            const model: PanelBannerImage = {
                version: 1,
                language: (["cs", "en", "de"].includes(pass.language)
                    ? pass.language
                    : "en") as PanelBannerImage["language"],
                accentColor: accent,
                clanTag:
                    Array.from(pass.clanName.replace(/[^\p{L}\p{N}]/gu, ""))
                        .slice(0, 3)
                        .join("")
                        .toLocaleUpperCase() || "LOGI",
                clanName: pass.clanName.slice(0, 40) || "Logi",
                subtitle: `${title} · ${copy.live.game[facts.game]}`.slice(
                    0,
                    80
                ),
                background: resolveScoreImageBackground({
                    server: graphicsServer?.banner ?? null,
                    mapImage,
                }),
            }
            banner =
                (await ports
                    .bannerImage(keyOf(panel), model, title, pass.timeZone)
                    .catch(() => null)) ??
                (mapImage && (graphicsServer?.banner.useMapImage ?? true)
                    ? await ports.mapImage(facts.game, mapKey, "banner")
                    : null)
        }
    }
    let thumbnail: MessageMedia | null = null
    let thumbFile: {
        name: string
        bytes: Uint8Array
        description: string
    } | null = null
    if (
        look.layout.showMap &&
        panel.artwork &&
        state !== "offline" &&
        !(style === "a" && score)
    ) {
        if (mapImage?.kind === "override")
            thumbnail = {
                url: mapImage.url,
                description: panelImageCopy(pass.language).alt.map(
                    facts.map?.name ?? ""
                ),
            }
        else if (showImages && mapImage) {
            thumbFile = await ports.mapImage(facts.game, mapKey, "thumb")
            if (thumbFile)
                thumbnail = {
                    url: `attachment://${thumbFile.name}`,
                    description: thumbFile.description,
                }
        }
    }

    const joinUrl = server.join
        ? serverJoinUrl(pass.siteUrl, server.join.slug)
        : null
    const view = liveServerPanelView({
        copy: copy.live,
        language: pass.language,
        panel: {
            id: panel._id,
            revision: panel.revision,
            title,
            description: panel.description ?? null,
            showPlayers: panel.showPlayers,
            showLeaders: panel.showLeaders ?? false,
            reportEnabled: Boolean(panel.reportCategoryId),
            layout: look.layout,
            content,
            accentColor: ownAccent,
            style,
        },
        facts,
        now: pass.now,
        paused,
        privateChannel,
        seed,
        seedChannelId: server.seedPlan?.seedChannelId ?? null,
        liveFrom,
        match,
        clanPlayers,
        server: {
            address: server.join?.address ?? null,
            joinCode: server.join?.joinCode ?? null,
            password,
            joinUrl,
        },
        newMap,
        emoji: pass.emoji,
        images: {
            score: score
                ? {
                      url: `attachment://${score.name}`,
                      description: score.description,
                  }
                : null,
            banner: banner
                ? {
                      url: `attachment://${banner.name}`,
                      description: banner.description,
                  }
                : bannerUrl
                  ? {
                        url: bannerUrl,
                        description: panelImageCopy(pass.language).alt.banner(
                            title
                        ),
                    }
                  : null,
            thumbnail,
        },
        ids: {
            players: `logi:players:${panel._id}:${panel.revision}:0:open`,
            report: `report:open:${panel._id}:${panel.revision}`,
        },
    })
    const files = filesOf({ score, banner, thumbnail: thumbFile })
    const message: MessageCreateOptions = {
        ...messagePayload(view, {
            language: pass.language,
            style: pass.style,
            chipIcons: chipIcons(pass.emoji),
        }),
        ...(files.length ? { files } : {}),
    }
    await ports.publish({
        key: keyOf(panel),
        revision: panel.revision,
        channelId: panel.channelId,
        message,
    })
    return {
        attempt: attempt(pass, {
            handledRequestAt,
            dataAt: facts.dataAt,
            warnings,
            messages: 1,
            nextAt: paused ? null : pass.now + REFRESH_MS,
        }),
        passwordNotified,
        passwordReset,
    }
}

async function runCombined(
    panel: BotPanel,
    pass: GuildPass,
    ports: PanelRunPorts,
    handledRequestAt: number | null
): Promise<PanelRunResult> {
    if (!panel.servers.length) throw new PanelPassError("source_missing")
    const channel = await ports.channelAccess(panel.channelId)
    if (!channel) throw new PanelPassError("channel_missing")
    const copy = getPanelMessages(pass.language)
    const look = resolvePanelPresentation(panel)
    const content = resolvePanelContent(panel.content)
    const warnings: PanelWarning[] = []
    if (!channel.canAttach) warnings.push("attach_files_missing")
    const thumbFiles: PanelFile[] = []
    // Public data only: snapshots, no live roster, no password, no match (P4-B08).
    const rows = panel.servers.map((server) => {
        const facts = server.snapshot
            ? snapshotLiveFacts(server.snapshot)
            : {
                  ...snapshotLiveFacts({
                      id: server.connectionId,
                      guildId: panel.guildId,
                      gameId:
                          server.gameId === "wardogs"
                              ? ("wardogs" as const)
                              : ("hell_let_loose" as const),
                      provider: "hll_crcon" as const,
                      displayName: server.name,
                      state: "unknown" as const,
                      map: null,
                      players: null,
                      capacity: null,
                      providerInstanceId: null,
                      scores: [],
                      capabilities: [],
                      observedAt: null,
                      lastSuccessAt: null,
                      providerUpdatedAt: null,
                      freshness: "unavailable" as const,
                      attribution: null,
                  }),
              }
        const seed = pass.seeds.find(
            (entry) => entry.connectionId === server.connectionId
        )
        return {
            connectionId: server.connectionId,
            title: server.name ?? facts.serverName ?? "—",
            facts,
            paused: false,
            seed:
                seed && content.seedProgress
                    ? { liveFrom: seed.liveFrom }
                    : null,
            liveFrom: server.seedPlan?.liveFrom ?? 40,
            joinUrl:
                content.joinButton && server.join
                    ? serverJoinUrl(pass.siteUrl, server.join.slug)
                    : null,
            joinable: Boolean(
                server.gameId === "wardogs"
                    ? server.join?.joinCode
                    : server.join?.address
            ),
        }
    })
    // Each row carries its current map on the right (P7-B09).
    const servers = await Promise.all(
        rows.map(async (row) => {
            const mapKey = row.facts.map?.key ?? null
            const image =
                look.layout.showMap && panel.artwork && mapKey
                    ? resolvePanelMapImage({
                          game: row.facts.game,
                          mapKey,
                          overrides: pass.graphics.mapOverrides,
                      })
                    : null
            let thumbnail: MessageMedia | null = null
            if (image?.kind === "override")
                thumbnail = {
                    url: image.url,
                    description: panelImageCopy(pass.language).alt.map(
                        row.facts.map?.name ?? ""
                    ),
                }
            else if (image && channel.canAttach) {
                const file = await ports
                    .mapImage(row.facts.game, mapKey, "thumb")
                    .catch(() => null)
                if (file) {
                    thumbFiles.push(file)
                    thumbnail = {
                        url: `attachment://${file.name}`,
                        description: file.description,
                    }
                }
            }
            return { ...row, thumbnail }
        })
    )
    const view = combinedPanelView({
        copy: copy.live,
        language: pass.language,
        clanName: pass.clanName,
        title: panel.title ?? null,
        description: panel.description ?? null,
        accentColor: look.accentColor,
        footerTiming: content.footerTiming,
        servers,
        now: pass.now,
        banner: null,
    })
    if (isPanelPaused(panel) && view.header)
        view.header.chips = [{ label: copy.live.state.paused, tone: "neutral" }]
    // Attach only the maps the view shows; a loose file would appear under it.
    const shown = new Set(
        view.blocks.flatMap((block) =>
            block.kind === "fields"
                ? block.items.flatMap((item) =>
                      item.thumbnail?.url.startsWith("attachment://")
                          ? [item.thumbnail.url.slice("attachment://".length)]
                          : []
                  )
                : []
        )
    )
    const files = planPanelAttachments(
        thumbFiles
            .filter((file) => shown.has(file.name))
            .map((file) => ({ ...file, role: "thumbnail" as const }))
    ).attached.map((file) => ({
        attachment: Buffer.from(file.bytes),
        name: file.name,
        description: file.description.slice(0, 1024),
    }))
    await ports.publish({
        key: keyOf(panel),
        revision: panel.revision,
        channelId: panel.channelId,
        message: {
            ...messagePayload(view, {
                language: pass.language,
                style: pass.style,
                chipIcons: chipIcons(pass.emoji),
            }),
            ...(files.length ? { files } : {}),
        },
    })
    const dataAt = Math.max(
        0,
        ...servers.map((server) => server.facts.dataAt ?? 0)
    )
    return {
        attempt: attempt(pass, {
            handledRequestAt,
            dataAt: dataAt || null,
            warnings,
            messages: 1,
            nextAt: isPanelPaused(panel) ? null : pass.now + REFRESH_MS,
        }),
    }
}

async function runResults(
    panel: BotPanel,
    pass: GuildPass,
    ports: PanelRunPorts,
    handledRequestAt: number | null,
    enabled: boolean
): Promise<PanelRunResult> {
    const copy = getPanelMessages(pass.language)
    const events = getEventMessages(pass.language)
    const look = resolvePanelPresentation(panel)
    const game = panel.gameId === "wardogs" ? "wardogs" : "hell_let_loose"
    const bindings = new Map(
        (await ports.bindings()).map((binding) => [binding.key, binding])
    )
    const icons = {
        allies: pass.emoji.allies,
        axis: pass.emoji.axis,
        valkyra: pass.emoji.valkyra,
        manticore: pass.emoji.manticore,
        lonestar: pass.emoji.lonestar,
    }
    let messages = 0
    let latest = 0
    const sideName = (label: string) => {
        const key = label.trim().toLowerCase()
        return key === "allies"
            ? copy.live.allies
            : key === "axis"
              ? copy.live.axis
              : label
    }
    await synchronizeResults(
        {
            id: panel._id,
            enabled,
            createdAt: panel.createdAt,
            channelId: panel.channelId,
        },
        {
            bindings: async () => [...bindings.keys()],
            page: (cursor) => ports.resultsPage(panel._id, cursor),
            publish: async (key, channelId, event) => {
                if (!channelId || !event?.result) {
                    await ports.publish({
                        key,
                        revision: panel.revision,
                        channelId: null,
                        message: {},
                    })
                    return
                }
                const view = resultCardView({
                    copy: copy.results,
                    game,
                    gameName: copy.live.game[game],
                    locale: panelImageCopy(pass.language).locale,
                    timeZone: pass.timeZone,
                    event: {
                        id: event.id,
                        name: event.name,
                        result: event.result,
                        card: event.card ?? null,
                        matchUrl: event.card?.publicMatch
                            ? new URL(
                                  `/${["cs", "de"].includes(pass.language) ? pass.language : "en"}/matches/${encodeURIComponent(event.id)}`,
                                  pass.siteUrl
                              ).href
                            : null,
                    },
                    mapLabel:
                        formatMapLabel(
                            event.map,
                            isGameId(game) ? game : undefined,
                            events
                        ) ?? null,
                    sideName,
                    sideSign: (label) => factionEmblem(label, icons),
                    compact: look.layout.compact,
                    showMap: look.layout.showMap,
                    accentColor: look.accentColor,
                })
                const message = messagePayload(view, {
                    language: pass.language,
                    style: pass.style,
                    chipIcons: chipIcons(pass.emoji),
                })
                messages++
                latest = Math.max(
                    latest,
                    Date.parse(event.result.reviewedAt ?? "") || 0
                )
                const binding = bindings.get(key)
                // An unchanged card is checked in Discord only now and then.
                if (
                    binding?.messageId &&
                    binding.channelId === channelId &&
                    binding.hash === publicationHash(message) &&
                    binding.lastSuccessAt !== null &&
                    pass.now - binding.lastSuccessAt < RESULT_RECHECK_MS
                )
                    return
                await ports.publish({
                    key,
                    revision: panel.revision,
                    channelId,
                    message,
                })
            },
        }
    )
    return {
        attempt: attempt(pass, {
            handledRequestAt,
            dataAt: latest || null,
            messages,
        }),
    }
}

async function runCompetition(
    panel: BotPanel,
    pass: GuildPass,
    ports: PanelRunPorts,
    handledRequestAt: number | null
): Promise<PanelRunResult> {
    if (!panel.competitionId) throw new PanelPassError("competition_missing")
    const data = await ports.competition(panel.competitionId)
    if (!data) throw new PanelPassError("competition_missing")
    const copy = getPanelMessages(pass.language)
    const look = resolvePanelPresentation(panel)
    const locale = panelImageCopy(pass.language).locale
    const language = ["cs", "de"].includes(pass.language) ? pass.language : "en"
    const url = new URL(
        `/${language}/competitions/${encodeURIComponent(data.slug)}`,
        pass.siteUrl
    ).href
    const wanted = new Set<string>()
    for (const table of data.tables) {
        const key = `${keyOf(panel)}:division:${table.divisionId}`
        wanted.add(key)
        await ports.publish({
            key,
            revision: panel.revision,
            channelId: panel.channelId,
            message: messagePayload(
                competitionTableView({
                    copy: copy.competition,
                    locale,
                    timeZone: pass.timeZone,
                    table: { ...table, url },
                    accentColor: look.accentColor,
                }),
                { language: pass.language, style: pass.style }
            ),
        })
    }
    for (const binding of await ports.bindings())
        if (
            binding.key.startsWith(`${keyOf(panel)}:division:`) &&
            !wanted.has(binding.key)
        )
            await ports.publish({
                key: binding.key,
                revision: panel.revision,
                channelId: null,
                message: {},
            })
    return {
        attempt: attempt(pass, {
            handledRequestAt,
            dataAt: Math.max(0, ...data.tables.map((t) => t.updatedAt)) || null,
            messages: data.tables.length,
        }),
    }
}

/** Takes every message of a panel out of Discord. */
async function withdraw(panel: BotPanel, ports: PanelRunPorts) {
    let removed = 0
    for (const binding of await ports.bindings()) {
        if (!ownsKey(panel, binding.key) || !binding.messageId) continue
        await ports.publish({
            key: binding.key,
            revision: panel.revision,
            channelId: null,
            message: {},
        })
        removed++
    }
    return removed
}

/**
 * One pass over one panel. Returns null when there was nothing to do (a
 * paused panel already drawn, an unsent panel with nothing in Discord).
 */
export async function runPanel(
    panel: BotPanel,
    pass: GuildPass,
    ports: PanelRunPorts,
    memory: PanelRunMemory
): Promise<PanelRunResult | null> {
    const kind = normalizePanelKind(panel.kind)
    if (!kind) return null
    const requestPending = isRequestPending(
        panel.requestedAt,
        panel.status?.handledRequestAt
    )
    const handledRequestAt = requestPending ? (panel.requestedAt ?? null) : null
    const stateKey = panelStateKey(panel)
    const work = panelWork({
        draft: Boolean(panel.draft),
        paused: isPanelPaused(panel),
        removing: Boolean(panel.removing),
        requestPending,
        pausedDrawn: memory.pausedDrawn.get(panel._id) === stateKey,
    })
    try {
        switch (work) {
            case "skip":
                return null
            case "remove_panel":
                await withdraw(panel, ports)
                await ports.purge(panel._id)
                memory.pausedDrawn.delete(panel._id)
                return null
            case "withdraw": {
                const removed = await withdraw(panel, ports)
                if (!removed && !requestPending) return null
                return {
                    attempt: attempt(pass, {
                        handledRequestAt,
                        nextAt: null,
                        messages: 0,
                    }),
                }
            }
        }
        let result: PanelRunResult
        switch (kind) {
            case "server":
                result = await runLive(
                    panel,
                    pass,
                    ports,
                    memory,
                    handledRequestAt
                )
                break
            case "servers":
                result = await runCombined(panel, pass, ports, handledRequestAt)
                break
            case "results":
                // A paused results panel keeps its cards as they are.
                if (work === "render_paused") {
                    memory.pausedDrawn.set(panel._id, stateKey)
                    return {
                        attempt: attempt(pass, {
                            handledRequestAt,
                            nextAt: null,
                            messages: (await ports.bindings()).filter(
                                (binding) =>
                                    ownsKey(panel, binding.key) &&
                                    binding.messageId
                            ).length,
                        }),
                    }
                }
                result = await runResults(
                    panel,
                    pass,
                    ports,
                    handledRequestAt,
                    true
                )
                break
            case "calendar":
                // The calendar redraws with the guild sync on every change;
                // a request (send, refresh, retry) redraws it now.
                if (!requestPending) return null
                await ports.refreshCalendar()
                result = {
                    attempt: attempt(pass, {
                        handledRequestAt,
                        nextAt: null,
                        messages: 1,
                    }),
                }
                break
            case "competition":
                result = await runCompetition(
                    panel,
                    pass,
                    ports,
                    handledRequestAt
                )
                break
            case "league": {
                if (!ports.league) throw new PanelPassError("unsupported_kind")
                const messages = await ports.league(panel, pass)
                result = {
                    attempt: attempt(pass, { handledRequestAt, messages }),
                }
                break
            }
        }
        if (work === "render_paused")
            memory.pausedDrawn.set(panel._id, stateKey)
        else memory.pausedDrawn.delete(panel._id)
        return result
    } catch (error) {
        const failure = classifyPanelError(error, pass.now)
        if (!failure) return null
        return {
            attempt: attempt(pass, {
                ok: false,
                error: failure,
                handledRequestAt,
                nextAt: pass.now + 30_000,
            }),
        }
    }
}
