import type { MessageCreateOptions } from "discord.js"

import {
    DEFAULT_LEAGUE_PANEL_OPTIONS,
    LEAGUE_PANEL_ORDER,
    leaguePanelKey,
    leaguePanelOptionsSchema,
    type LeagueFixturesView,
    type LeaguePanelOptions,
    type LeaguePanelPart,
    type LeagueStandingsView,
} from "../../../src/domain/wardogs-league/panels"
import {
    panelMapKey,
    planPanelAttachments,
    resolvePanelMapImage,
} from "../../../src/domain/discord-publications/panel-graphics"
import type {
    BotPanel,
    GuildPass,
    LeaguePassResult,
    PanelRunPorts,
} from "../public-panels/panel-runner"
import {
    isRequestPending,
    type PanelWarning,
} from "../../../src/domain/discord-publications/panel-delivery"
import { resolvePanelPresentation } from "../../../src/domain/discord-publications/panel-presentation"
import {
    fixturesPayload,
    standingsPayload,
    type LeagueRenderContext,
} from "./render"
import type { MessageMedia } from "../../../src/domain/discord-messages/message-view"
import { panelChipIcons } from "../../../src/domain/discord-publications/live-panel"
import { panelPartKeyPrefix } from "../../../src/domain/discord-publications/keys"
import { isPanelPaused } from "../../../src/domain/discord-publications/settings"
import { getLeagueMessages } from "../../../src/lib/clan-language/league"
import { PanelPassError } from "../public-panels/panel-errors"

/**
 * One pass over a WD League panel (`PanelRunPorts.league`, PANELS-API §5):
 * the two messages "tabulka" and "nejbližší zápasy" with the recent results,
 * keyed `panel:<id>:standings` and `panel:<id>:fixtures`, posted once in that
 * order and then edited (P6-13, P6-B07). A part switched off in the editor is
 * withdrawn; when Wardogs League is turned off the bot deletes both messages
 * (L3-55). A paused panel keeps its content with the "Pozastaveno" chip
 * (L3-54); the runner then stops refreshing it.
 */
export type LeaguePanelData = {
    enabled: boolean
    standings: LeagueStandingsView | null
    fixtures: LeagueFixturesView | null
}

export type LeagueRunPorts = Pick<
    PanelRunPorts,
    "publish" | "bindings" | "channelAccess" | "mapImage"
> & {
    /** `leagueDiscoveryPanels:forGuild` for this panel's options. */
    data: (options: LeaguePanelOptions) => Promise<LeaguePanelData>
}

/** The stored League options of a panel; missing or invalid ones read the defaults (P2-B15). */
export function leagueOptionsOf(panel: BotPanel): LeaguePanelOptions {
    const parsed = leaguePanelOptionsSchema.safeParse(panel.league)
    return parsed.success ? parsed.data : { ...DEFAULT_LEAGUE_PANEL_OPTIONS }
}

const withdrawAll = async (
    panel: BotPanel,
    ports: LeagueRunPorts,
    parts: readonly LeaguePanelPart[]
) => {
    const bindings = await ports.bindings(panelPartKeyPrefix(panel._id))
    for (const part of parts) {
        const key = leaguePanelKey(panel._id, part)
        if (
            bindings.some((binding) => binding.key === key && binding.messageId)
        )
            await ports.publish({
                key,
                revision: panel.revision,
                channelId: null,
                message: {},
            })
    }
}

/** Map images of the shown fixtures whose map is known (P6-24). */
async function fixtureThumbnails(
    view: LeagueFixturesView,
    panel: BotPanel,
    pass: GuildPass,
    ports: LeagueRunPorts,
    canAttach: boolean
) {
    const look = resolvePanelPresentation(panel)
    const copy = getLeagueMessages(pass.language).fixtures
    const thumbnails = new Map<string, MessageMedia>()
    const files: Array<{
        name: string
        bytes: Uint8Array
        description: string
    }> = []
    if (!panel.artwork || !look.layout.showMap) return { thumbnails, files }
    for (const fixture of view.fixtures) {
        if (!fixture.map) continue
        const mapKey = panelMapKey("wardogs", fixture.map.name)
        const image = resolvePanelMapImage({
            game: "wardogs",
            mapKey,
            overrides: pass.graphics.mapOverrides,
        })
        // P8-30: the clan's own map image is attached like Logi's art.
        if (image && canAttach) {
            const file = await ports
                .mapImage("wardogs", mapKey, "thumb")
                .catch(() => null)
            if (!file) continue
            if (!files.some((entry) => entry.name === file.name))
                files.push(file)
            thumbnails.set(fixture.matchId, {
                url: `attachment://${file.name}`,
                description: copy.mapAlt(fixture.map.name),
            })
        }
    }
    return { thumbnails, files }
}

export async function runLeaguePanels(
    panel: BotPanel,
    pass: GuildPass,
    ports: LeagueRunPorts
): Promise<LeaguePassResult> {
    const options = leagueOptionsOf(panel)
    const data = await ports.data(options)
    if (!data.enabled) {
        await withdrawAll(panel, ports, LEAGUE_PANEL_ORDER)
        throw new PanelPassError("league_disabled")
    }
    const channel = await ports.channelAccess(panel.channelId)
    if (!channel) throw new PanelPassError("channel_missing")
    const warnings: PanelWarning[] = []
    if (!channel.canAttach) warnings.push("attach_files_missing")
    const paused = isPanelPaused(panel)
    const context: LeagueRenderContext = {
        language: pass.language,
        timeZone: pass.timeZone,
        style: pass.style,
        emoji: pass.emoji,
        chipIcons: panelChipIcons(pass.emoji),
        accentColor: resolvePanelPresentation(panel).accentColor,
        paused: paused ? { since: panel.pausedAt ?? null } : null,
        now: pass.now,
    }
    const messages: Partial<Record<LeaguePanelPart, MessageCreateOptions>> = {}
    if (data.standings)
        messages.standings = standingsPayload(data.standings, context)
    if (data.fixtures) {
        const images = await fixtureThumbnails(
            data.fixtures,
            panel,
            pass,
            ports,
            channel.canAttach
        )
        const rendered = fixturesPayload(data.fixtures, context, {
            fixtures: options.fixtures,
            thumbnails: images.thumbnails,
        })
        // Attach only the maps the fitted message still shows.
        const shown = new Set(
            rendered.view.blocks.flatMap((block) =>
                block.kind === "fields"
                    ? block.items.flatMap((item) =>
                          item.thumbnail?.url.startsWith("attachment://")
                              ? [
                                    item.thumbnail.url.slice(
                                        "attachment://".length
                                    ),
                                ]
                              : []
                      )
                    : []
            )
        )
        const files = planPanelAttachments(
            images.files
                .filter((file) => shown.has(file.name))
                .map((file) => ({ ...file, role: "thumbnail" as const }))
        ).attached.map((file) => ({
            attachment: Buffer.from(file.bytes),
            name: file.name,
            description: file.description.slice(0, 1024),
        }))
        messages.fixtures = {
            ...rendered.payload,
            ...(files.length ? { files } : {}),
        }
    }
    // Posted once in the fixed order (P6-B07): when an earlier message has
    // to be created while a later one exists, the later one is re-posted.
    const bindings = await ports.bindings(panelPartKeyPrefix(panel._id))
    const posted = (part: LeaguePanelPart) =>
        bindings.some(
            (binding) =>
                binding.key === leaguePanelKey(panel._id, part) &&
                binding.messageId &&
                binding.channelId === panel.channelId
        )
    const wanted = LEAGUE_PANEL_ORDER.filter((part) => messages[part])
    const firstMissing = wanted.findIndex((part) => !posted(part))
    if (firstMissing >= 0)
        await withdrawAll(
            panel,
            ports,
            wanted.slice(firstMissing + 1).filter(posted)
        )
    await withdrawAll(
        panel,
        ports,
        LEAGUE_PANEL_ORDER.filter((part) => !messages[part])
    )
    // An admin request publishes anew; a timed pass leaves current messages alone.
    const force = isRequestPending(
        panel.requestedAt,
        panel.status?.handledRequestAt
    )
    for (const part of wanted)
        await ports.publish({
            key: leaguePanelKey(panel._id, part),
            revision: panel.revision,
            channelId: panel.channelId,
            message: messages[part]!,
            ...(force ? { force } : {}),
        })
    const dataAt = [data.standings?.dataAt, data.fixtures?.dataAt]
        .map((value) => (value ? Date.parse(value) : NaN))
        .filter(Number.isFinite)
    return {
        messages: wanted.length,
        dataAt: dataAt.length ? Math.max(...dataAt) : null,
        warnings,
    }
}
