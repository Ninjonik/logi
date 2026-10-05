import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    SectionBuilder,
    SeparatorBuilder,
    ThumbnailBuilder,
    MessageFlags,
    TextDisplayBuilder,
    escapeMarkdown,
    type MessageCreateOptions,
} from "discord.js"
import {
    NEUTRAL_FACTION_MARKER,
    panelAccentColor,
    panelBannerImage,
    panelFactionIcons,
    panelFactionOf,
    resolvePanelPresentation,
    type PanelFactionEmoji,
    type PanelPresentationCarrier,
} from "../../../src/domain/discord-publications/panel-presentation"
import type { ResultCardFacts } from "../../../src/domain/discord-publications/result-card"
import { DEFAULT_MESSAGE_ACCENT_COLOR } from "../../../src/domain/discord-messages/format"
import { resolveClanOutcome } from "../../../src/domain/discord-messages/match-result"
import { factionEmblem } from "../../../src/domain/discord-messages/faction-emblem"
import type { WarconRead } from "../../../src/domain/game-data/warcon-contracts"
import type { ServerSnapshot } from "../../../src/domain/game-data/contracts"
import { playerLeaders } from "../../../src/domain/game-data/player-leaders"
import { getClanDiscordMessages } from "../../../src/lib/clan-language"
import { hllMapArtwork } from "../../../src/domain/game-data/hll-live"
import { isGameId } from "../../../src/domain/games/game"
import { panelCopy, type PanelCopy } from "./copy"
import { playerControl } from "./player-details"
import { formatMapLabel } from "../map-label"
export type LiveData = Extract<WarconRead, { view: "live" }>["data"]
type Panel = PanelPresentationCarrier & {
    id: string
    revision: number
    gameId: string
    enabled: boolean
    showPlayers: boolean
    showLeaders?: boolean
    reportCategoryId?: string
    artwork: boolean
}
/** Runtime defaults (installed application emoji) and workspace overrides per faction. */
export type FactionIcons = PanelFactionEmoji
const clean = (value: string | null | undefined, max = 100) =>
    escapeMarkdown(
        (value ?? "—")
            .replace(/@/g, "＠")
            .replace(/[\r\n<>]/g, " ")
            .slice(0, max)
    )
const count = (value: number | null | undefined) =>
    value == null ? "—" : String(value)
const at = (value: string | null | undefined, copy: PanelCopy = panelCopy()) =>
    value && Number.isFinite(Date.parse(value))
        ? `<t:${Math.floor(Date.parse(value) / 1000)}:R>`
        : copy.unknownTime
/** Semantic faction icon; provider labels such as Alpha/Bravo keep the neutral marker. */
export function factionIcon(name: string | null, icons: FactionIcons) {
    const faction = panelFactionOf(name)
    return (faction ? icons[faction] : undefined) ?? NEUTRAL_FACTION_MARKER
}
/** Packaged map artwork is uploaded only when it will be shown: no banner and a visible map. */
export function panelArtworkWanted(
    panel: PanelPresentationCarrier & { artwork: boolean }
) {
    const look = resolvePanelPresentation(panel)
    return panel.artwork && look.layout.showMap && !panelBannerImage(look)
}
/** Full-width banner image placed above the header. */
export function bannerGallery(url: string, copy: PanelCopy = panelCopy()) {
    return new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder()
            .setURL(url)
            .setDescription(copy.panelBanner)
    )
}
export function artworkPath(game: string, map?: string | null) {
    const key = map?.trim().toLowerCase()
    if (
        game === "wardogs" &&
        key &&
        ["bakurani", "ozeti", "zestafona"].includes(key)
    )
        return `/maps/wardogs/${key}.webp`
    return game === "wardogs"
        ? "/img/games/wardogs.jpg"
        : game === "hell_let_loose"
          ? hllMapArtwork(map)
          : null
}
export function renderPanel(
    panel: Panel,
    snapshot: ServerSnapshot | null,
    live: LiveData | null,
    icons: FactionIcons = {},
    assetOrigin?: string,
    attachmentUrl?: string,
    language?: string
): MessageCreateOptions {
    const copy = panelCopy(language)
    const look = resolvePanelPresentation(panel)
    const { layout } = look
    const marks = panelFactionIcons(look, icons)
    const status = live?.status
    const map = status?.map ?? snapshot?.map
    const age = live ? live.freshness : (snapshot?.freshness ?? "unavailable")
    const label = panel.enabled
        ? age === "fresh"
            ? copy.liveInProgress
            : copy.lastKnownData(copy.freshness(age))
        : copy.paused
    // The accent replaces the live color; stale and paused cards keep the warning.
    const container = new ContainerBuilder().setAccentColor(
        panel.enabled && age === "fresh"
            ? panelAccentColor(look, 0x77b255)
            : 0xd99a37
    )
    const game = panel.gameId === "wardogs" ? "WARDOGS" : "HELL LET LOOSE"
    const server = clean(status?.serverName ?? snapshot?.displayName)
    const facts = panel.enabled
        ? [
              layout.showMap ? `🗺️ **${clean(map)}**` : null,
              layout.showPlayerCount
                  ? copy.playerCount(
                        count(status?.playerCount ?? snapshot?.players),
                        count(status?.maxPlayers ?? snapshot?.capacity)
                    )
                  : null,
          ].filter((fact): fact is string => fact !== null)
        : []
    const header = new TextDisplayBuilder().setContent(
        layout.compact
            ? `**${game} · ${server}**\n-# ${[label, ...facts].join(" · ")}`
            : `### ${game} · ${copy.serverLive}\n**${server}**\n${label}${facts.length ? `\n${facts.join("  ·  ")}` : ""}`
    )
    const banner = panelBannerImage(look)
    if (banner) container.addMediaGalleryComponents(bannerGallery(banner, copy))
    // A banner replaces the map thumbnail; hiding the map hides its artwork.
    const art =
        !banner &&
        layout.showMap &&
        panel.artwork &&
        artworkPath(panel.gameId, map)
    const image =
        art &&
        (attachmentUrl?.startsWith("attachment://")
            ? attachmentUrl
            : assetOrigin?.startsWith("https://")
              ? new URL(art, assetOrigin).href
              : null)
    if (image)
        container.addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(header)
                .setThumbnailAccessory(
                    new ThumbnailBuilder()
                        .setURL(image)
                        .setDescription(clean(map ?? copy.gameArtwork))
                )
        )
    else container.addTextDisplayComponents(header)
    if (panel.enabled) {
        const withLeaders = Boolean(panel.showLeaders && live)
        if (layout.showScoreboard) {
            const scores =
                status?.scores.map((s) => ({
                    label: s.name,
                    score: s.score,
                })) ??
                snapshot?.scores ??
                []
            if (!layout.compact)
                container.addSeparatorComponents(new SeparatorBuilder())
            const teamRows = scores.slice(0, 8).map((s) => {
                const score = `${factionIcon(s.label, marks)} **${clean(s.label, 40)}** · **${count(s.score)}** ${copy.points}`
                if (!panel.showLeaders || !live) return score
                const kills = playerLeaders(live.players, "kills", s.label)[0]
                const cash = playerLeaders(live.players, "cash", s.label)[0]
                return `${score}\n-# ⚔ ${kills ? `${clean(kills.name, 28)} · ${count(kills.kills)} ${copy.kills}` : "—"}  |  💵 ${cash ? `${clean(cash.name, 28)} · ${count(cash.cash)} ${copy.cash}` : "—"}`
            })
            const observed = `-# ${copy.scoreObserved(at(live?.statusAt ?? snapshot?.observedAt, copy))}`
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    layout.compact
                        ? `${teamRows.join(withLeaders ? "\n" : "  ·  ") || copy.scoresUnavailable}\n${observed}`
                        : `**${withLeaders ? copy.factionScoreAndLeaders : copy.factionScore}**\n${teamRows.join("\n\n") || copy.scoresUnavailable}\n${observed}`
                )
            )
        }
        if (live && withLeaders) {
            if (!layout.compact)
                container.addSeparatorComponents(new SeparatorBuilder())
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**${copy.liveLeaders(copy.freshness(live.playersFreshness))}**\n-# ${copy.currentPlayersObserved(at(live.playersAt, copy))}`
                )
            )
            for (const metric of ["kills", "cash"] as const) {
                const leaders = playerLeaders(live.players, metric)
                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `### ${metric === "kills" ? copy.topKills : copy.topCash}\n${leaders.map((p, i) => `${["🥇", "🥈", "🥉"][i]} **${clean(p.name, 28)}** · **${count(p[metric])}** ${copy[metric]} · ${factionIcon(p.faction, marks)} ${clean(p.faction, 20)}`).join("\n") || (live.playersFreshness === "fresh" ? copy.noPlayers : copy.playerDataUnavailable)}`
                    )
                )
            }
        }
        if (panel.showPlayers && live)
            container.addActionRowComponents(
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setCustomId(
                            playerControl(panel.id, panel.revision, 0, "open")
                        )
                        .setLabel(copy.playersButton)
                        .setStyle(ButtonStyle.Secondary)
                )
            )
    }
    if (panel.enabled && panel.reportCategoryId)
        container.addActionRowComponents(
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`report:open:${panel.id}:${panel.revision}`)
                    .setLabel(copy.reportButton)
                    .setStyle(ButtonStyle.Danger)
            )
        )
    return {
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] },
    }
}
export function renderPlayers(
    panel: PanelPresentationCarrier & { id: string; revision: number },
    live: LiveData,
    requestedPage: number,
    language?: string
) {
    const copy = panelCopy(language)
    const size = 8
    const pages = Math.max(1, Math.ceil(live.players.length / size))
    const page = Math.max(0, Math.min(Math.floor(requestedPage), pages - 1))
    // Only workspace overrides mark factions here; without one the page is unchanged.
    const overrides = resolvePanelPresentation(panel).factionEmoji
    const rows = (marked: boolean) =>
        live.players.slice(page * size, (page + 1) * size).map((p) => {
            const faction = panelFactionOf(p.faction)
            const emoji = marked && faction ? overrides[faction] : undefined
            return `**${clean(p.name, 45)}** · ${emoji ? `${emoji} ` : ""}${clean(p.faction, 20)}\n⚔ ${p.kills} ${copy.kills} · ☠ ${p.deaths} ${copy.deaths} · 💵 ${p.cash} ${copy.cash} · 📶 ${count(p.ping)} ms`
        })
    const content = (lines: string[]) =>
        `**${copy.playersPage(copy.freshness(live.playersFreshness), page + 1, pages)}**\n${copy.observed(at(live.playersAt, copy))}\n${lines.join("\n\n") || (live.playersFreshness === "fresh" ? copy.noPlayers : copy.playerDataUnavailable)}`
    const marked = content(rows(true))
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(
                playerControl(
                    panel.id,
                    panel.revision,
                    Math.max(0, page - 1),
                    "previous"
                )
            )
            .setLabel(copy.previous)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0),
        new ButtonBuilder()
            .setCustomId(
                playerControl(
                    panel.id,
                    panel.revision,
                    Math.min(pages - 1, page + 1),
                    "next"
                )
            )
            .setLabel(copy.next)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === pages - 1)
    )
    return {
        // Long custom emoji are dropped rather than exceed Discord's content limit.
        content: marked.length <= 2000 ? marked : content(rows(false)),
        components: [row],
        allowedMentions: { parse: [] as never[] },
    }
}
/** Short team code for a participant (by side), else its localized side. */
function participantName(
    label: string,
    teams: ResultCardFacts["teams"],
    copy: PanelCopy
) {
    const key = label.trim().toLowerCase()
    const team = teams.find((item) => item.side?.trim().toLowerCase() === key)
    if (team) return clean(team.code, 30)
    const faction = panelFactionOf(label)
    return faction === "allies"
        ? copy.hllAllies
        : faction === "axis"
          ? copy.hllAxis
          : clean(label, 60)
}
/**
 * Reviewed result card: a small "RESULT · CATEGORY" label, the teams with
 * their faction emblems around the score, then the clan's outcome, the map and
 * who confirmed it, and "Match details" when a public match page exists.
 * Values the result does not record are left out, never guessed.
 */
export function renderResult(
    event: {
        id: string
        name: string
        map: string | null
        gameId?: string
        result: {
            status: string
            version: number
            reviewedAt: string | null
            participants: { label: string; score: number | null }[]
        }
        card?: ResultCardFacts | null
        /** Public match page; only passed when the card says one exists. */
        matchUrl?: string
    },
    icons: FactionIcons = {},
    panel?: PanelPresentationCarrier,
    language?: string
): MessageCreateOptions {
    const copy = panelCopy(language)
    const messages = getClanDiscordMessages(language)
    const result = event.result
    const card = event.card ?? null
    const look = resolvePanelPresentation(panel)
    const { layout } = look
    const marks = panelFactionIcons(look, icons)
    const container = new ContainerBuilder().setAccentColor(
        panelAccentColor(look, DEFAULT_MESSAGE_ACCENT_COLOR)
    )
    const banner = panelBannerImage(look)
    if (banner) container.addMediaGalleryComponents(bannerGallery(banner, copy))

    const label = [
        copy.resultLabel,
        card?.category
            ? clean(card.category, 60).toLocaleUpperCase(messages.locale)
            : undefined,
        result.status === "corrected" ? copy.correctedLabel : undefined,
    ]
        .filter(Boolean)
        .join(" · ")
    const teams = card?.teams ?? []
    const participants = result.participants.slice(0, 16)
    const named = (p: { label: string }) =>
        participantName(p.label, teams, copy)
    const emblem = (p: { label: string }) => factionEmblem(p.label, marks)
    const [first, second] = participants
    const scoreLine =
        participants.length === 2 && first && second
            ? [
                  emblem(first),
                  `**${named(first)}**`,
                  ` ${count(first.score)} : ${count(second.score)} `,
                  `**${named(second)}**`,
                  emblem(second),
              ]
                  .filter(Boolean)
                  .join(" ")
            : participants
                  .map((p) =>
                      [emblem(p), `**${named(p)}**`, "·", count(p.score)]
                          .filter(Boolean)
                          .join(" ")
                  )
                  .join(layout.compact ? "  ·  " : "\n")
    const outcome = resolveClanOutcome({
        participants,
        clanSide: card?.side,
        imported: card?.imported,
    })
    const facts = [
        outcome ? `**${copy.outcomes[outcome.outcome]}**` : undefined,
        layout.showMap
            ? formatMapLabel(
                  event.map,
                  isGameId(event.gameId) ? event.gameId : undefined,
                  messages
              )
            : undefined,
        card?.reviewer
            ? copy.confirmedBy(clean(card.reviewer, 80))
            : copy.reviewed(at(result.reviewedAt, copy)),
    ]
        .filter(Boolean)
        .join(" · ")
    // Without team codes the score alone does not say which match it was.
    const name = teams.length ? undefined : `**${clean(event.name)}**`
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            (layout.compact
                ? [`-# ${label}`, name, scoreLine, facts]
                : [`-# ${label}`, name, `## ${scoreLine}`, facts]
            )
                .filter(Boolean)
                .join("\n")
                .slice(0, 4000)
        )
    )
    if (event.matchUrl) {
        container.addActionRowComponents(
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Link)
                    .setURL(event.matchUrl)
                    .setLabel(copy.matchDetail)
            )
        )
    }
    return {
        flags: MessageFlags.IsComponentsV2,
        components: [container],
        allowedMentions: { parse: [] },
    }
}
