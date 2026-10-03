import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelSelectMenuBuilder,
    ChannelType,
    MessageFlags,
    ModalBuilder,
    SlashCommandBuilder,
    TextInputBuilder,
    TextInputStyle,
    type AutocompleteInteraction,
    type ButtonInteraction,
    type ChannelSelectMenuInteraction,
    type ChatInputCommandInteraction,
    type InteractionEditReplyOptions,
    type ModalSubmitInteraction,
} from "discord.js"
import {
    readPlayerStats,
    type PlayerStatsPorts,
    type PlayerStatsResult,
    type StatsRequest,
} from "../../../src/application/game-data/read-player-stats"
import {
    hllProfileUrl,
    parseSteamId,
    statsGameSchema,
    statsPeriodSchema,
} from "../../../src/domain/player-stats/player-stats"
import { renderStats, safeStatsText, type StatsView } from "./stats-render"
import { randomBytes } from "node:crypto"
import { statsCopy } from "./stats-copy"

type Payload = ReturnType<typeof renderStats> & {
    files?: Array<{ attachment: string; name: string }>
}
export type StatsPorts = PlayerStatsPorts & {
    link: (
        request: StatsRequest,
        steamId: string,
        name: string,
        expected: string[]
    ) => Promise<void>
    share: (
        request: StatsRequest,
        channelId: string,
        payload: Payload
    ) => Promise<void>
    artwork: (
        game: string,
        map?: string | null
    ) => Promise<{ path: string; name: string; url: string } | null>
    now?: () => number
}
type State = {
    id: string
    request: StatsRequest
    locale: string
    expires: number
    result?: PlayerStatsResult
    view: StatsView
    channelId?: string
    busy: boolean
    shared: boolean
    modalIds?: string[]
}
const gameNames = { hll: "hell_let_loose", wardogs: "wardogs" }

export function buildStatsCommand() {
    const c = statsCopy("en"),
        local = (key: keyof typeof c) => ({
            cs: statsCopy("cs")[key],
            de: statsCopy("de")[key],
        })
    return new SlashCommandBuilder()
        .setName("stats")
        .setDescription(c.description)
        .setDescriptionLocalizations(local("description"))
        .setDMPermission(false)
        .addStringOption((o) =>
            o
                .setName("game")
                .setDescription(c.game)
                .setDescriptionLocalizations(local("game"))
                .setRequired(true)
                .addChoices(
                    { name: "Hell Let Loose", value: "hll" },
                    { name: "Wardogs", value: "wardogs" }
                )
        )
        .addUserOption((o) =>
            o
                .setName("member")
                .setDescription(c.member)
                .setDescriptionLocalizations(local("member"))
        )
        .addStringOption((o) =>
            o
                .setName("player")
                .setDescription(c.player)
                .setDescriptionLocalizations(local("player"))
                .setMaxLength(100)
                .setAutocomplete(true)
        )
        .addStringOption((o) =>
            o
                .setName("period")
                .setDescription(c.period)
                .setDescriptionLocalizations(local("period"))
                .addChoices(
                    {
                        name: "7 days",
                        value: "7d",
                        name_localizations: { cs: "7 dní", de: "7 Tage" },
                    },
                    {
                        name: "30 days",
                        value: "30d",
                        name_localizations: { cs: "30 dní", de: "30 Tage" },
                    },
                    {
                        name: "90 days",
                        value: "90d",
                        name_localizations: { cs: "90 dní", de: "90 Tage" },
                    },
                    {
                        name: c.all,
                        value: "all",
                        name_localizations: local("all"),
                    }
                )
        )
        .addStringOption((o) =>
            o
                .setName("server")
                .setDescription(c.server)
                .setDescriptionLocalizations(local("server"))
                .setMaxLength(64)
                .setAutocomplete(true)
        )
        .addChannelOption((o) =>
            o
                .setName("channel")
                .setDescription(c.channel)
                .setDescriptionLocalizations(local("channel"))
                .addChannelTypes(
                    ChannelType.GuildText,
                    ChannelType.GuildAnnouncement
                )
        )
}

export function createStatsController(ports: StatsPorts) {
    const states = new Map<string, State>(),
        now = ports.now ?? Date.now
    const commandsAt = new Map<string, number>()
    const error = (value: unknown, locale: string) => {
        const c = statsCopy(locale),
            key = value instanceof Error ? value.message : ""
        if (/\bunconfigured_guild\b/.test(key)) return c.notConfigured
        return key === "linked_only"
            ? c.hllOnly
            : key === "link_changed"
              ? c.linkChanged
              : key === "already_linked"
                ? c.alreadyLinked
                : key === "invalid_steam"
                  ? c.invalidSteam
                  : key === "forbidden"
                    ? c.forbidden
                    : key === "share_denied"
                      ? c.shareDenied
                      : c.incomplete
    }
    const self = (s: State) =>
        s.request.requesterId === s.request.targetId && !s.request.playerId
    const control = (s: State, action: string) => `stats:${s.id}:${action}`
    const button = (s: State, action: string, label: string) =>
        new ButtonBuilder()
            .setCustomId(control(s, action))
            .setLabel(label)
            .setStyle(ButtonStyle.Secondary)
    const publishable = (s: State) =>
        s.result?.kind === "wardogs"
            ? !!s.result.stats
            : s.result?.kind === "hll"
              ? !!s.result.read.profile &&
                ["ok", "stale"].includes(s.result.read.status)
              : false
    async function payload(
        s: State,
        controls = true
    ): Promise<Payload & { components: ActionRowBuilder<ButtonBuilder>[] }> {
        const c = statsCopy(s.locale),
            r = s.result!
        const art = publishable(s)
            ? await ports.artwork(
                  gameNames[s.request.game],
                  r.kind === "wardogs" ? r.stats?.recent[0]?.map : null
              )
            : null
        const data = renderStats({
            game: s.request.game,
            period: s.request.period,
            locale: s.locale,
            result: r,
            view: s.view,
            self: self(s),
            imageUrl: art?.url,
        })
        const components: ActionRowBuilder<ButtonBuilder>[] = []
        if (controls) {
            const navigation =
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    button(s, "overview", c.overview),
                    button(s, "refresh", c.refresh)
                )
            if (publishable(s))
                navigation.addComponents(
                    button(s, "recent", c.recent),
                    button(
                        s,
                        s.request.game === "hll" ? "weapons" : "factions",
                        s.request.game === "hll" ? c.weapons : c.factions
                    )
                )
            if (publishable(s) && s.request.game === "hll")
                navigation.addComponents(button(s, "maps", c.maps))
            components.push(navigation)
            const actions = new ActionRowBuilder<ButtonBuilder>()
            if (self(s)) actions.addComponents(button(s, "link", c.add))
            if (publishable(s) && !s.shared)
                actions.addComponents(
                    button(s, "share", c.share).setStyle(ButtonStyle.Primary)
                )
            if (r.kind === "hll")
                actions.addComponents(
                    new ButtonBuilder()
                        .setStyle(ButtonStyle.Link)
                        .setLabel(c.viewProfile)
                        .setURL(hllProfileUrl(r.steamId, s.request.period))
                )
            if (actions.components.length) components.push(actions)
        } else if (r.kind === "hll")
            components.push(
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setStyle(ButtonStyle.Link)
                        .setLabel(c.viewProfile)
                        .setURL(hllProfileUrl(r.steamId, s.request.period))
                )
            )
        return {
            ...data,
            files: art ? [{ attachment: art.path, name: art.name }] : [],
            components,
        }
    }
    async function refresh(
        s: State,
        edit: (value: InteractionEditReplyOptions) => Promise<unknown>
    ) {
        try {
            s.result = await readPlayerStats(s.request, ports)
            await edit({ ...(await payload(s)), content: "", attachments: [] })
        } catch (e) {
            s.result = undefined
            await edit({
                content: error(e, s.locale),
                embeds: [],
                components: [],
                attachments: [],
            })
        }
    }
    async function state(
        i:
            | ButtonInteraction
            | ChannelSelectMenuInteraction
            | ModalSubmitInteraction
    ) {
        const match = /^stats:([a-f0-9]{16}):([a-z]+)$/.exec(i.customId),
            s = match ? states.get(match[1]) : null,
            c = statsCopy(i.locale)
        if (!s || s.expires < now()) {
            await i.reply({ content: c.expired, flags: MessageFlags.Ephemeral })
            return null
        }
        if (
            s.request.requesterId !== i.user.id ||
            s.request.guildId !== i.guildId
        ) {
            await i.reply({ content: c.ownOnly, flags: MessageFlags.Ephemeral })
            return null
        }
        if (s.busy) {
            await i.reply({
                content: c.unavailable,
                flags: MessageFlags.Ephemeral,
            })
            return null
        }
        // Reserve synchronously, before awaiting Discord's acknowledgement.
        s.busy = true
        return { s, action: match![2] }
    }
    async function share(
        s: State,
        channelId: string,
        edit: (value: InteractionEditReplyOptions) => Promise<unknown>
    ) {
        const c = statsCopy(s.locale)
        if (s.shared) {
            await edit({ content: c.shared, components: [] })
            return
        }
        s.result = await readPlayerStats(s.request, ports)
        if (!publishable(s)) {
            await edit({ ...(await payload(s)), attachments: [] })
            return
        }
        // Claim before send; an uncertain Discord response is never blindly retried.
        s.shared = true
        try {
            await ports.share(s.request, channelId, await payload(s, false))
            await edit({ content: c.shared, components: [] })
        } catch (e) {
            await edit({
                content:
                    e instanceof Error && e.message === "share_denied"
                        ? c.shareDenied
                        : c.shareFailed,
                components: [],
            })
        }
    }
    return {
        async command(i: ChatInputCommandInteraction) {
            const c = statsCopy(i.locale),
                game = statsGameSchema.safeParse(i.options.getString("game")),
                period = statsPeriodSchema.safeParse(
                    i.options.getString("period") ?? "30d"
                ),
                member = i.options.getUser("member"),
                playerId = i.options.getString("player") ?? undefined,
                sourceId = i.options.getString("server") ?? undefined
            if (
                !i.guildId ||
                !game.success ||
                !period.success ||
                (member && playerId) ||
                (playerId && !parseSteamId(playerId)) ||
                (sourceId && !/^[a-f0-9]{64}$/.test(sourceId))
            ) {
                await i.reply({
                    content: c.invalid,
                    flags: MessageFlags.Ephemeral,
                })
                return
            }
            if (game.data === "hll" && (playerId || sourceId)) {
                await i.reply({
                    content: c.hllOnly,
                    flags: MessageFlags.Ephemeral,
                })
                return
            }
            const actor = `${i.guildId}:${i.user.id}`
            if (now() - (commandsAt.get(actor) ?? 0) < 3000) {
                await i.reply({
                    content: c.unavailable,
                    flags: MessageFlags.Ephemeral,
                })
                return
            }
            commandsAt.set(actor, now())
            while (commandsAt.size > 1000)
                commandsAt.delete(commandsAt.keys().next().value!)
            await i.deferReply({ flags: MessageFlags.Ephemeral })
            for (const [key, s] of states)
                if (s.expires < now()) states.delete(key)
            while (states.size >= 500)
                states.delete(states.keys().next().value!)
            const s: State = {
                id: randomBytes(8).toString("hex"),
                request: {
                    guildId: i.guildId,
                    requesterId: i.user.id,
                    targetId: member?.id ?? i.user.id,
                    game: game.data,
                    period: period.data,
                    playerId,
                    sourceId,
                },
                locale: i.locale,
                expires: now() + 15 * 60_000,
                view: "overview",
                busy: true,
                shared: false,
                channelId: i.options.getChannel("channel")?.id,
            }
            states.set(s.id, s)
            try {
                await refresh(s, (v) => i.editReply(v))
            } finally {
                s.busy = false
            }
        },
        async button(i: ButtonInteraction) {
            const context = await state(i)
            if (!context) return
            const { s, action } = context,
                c = statsCopy(s.locale)
            try {
                if (action === "link") {
                    if (!self(s) || !s.result) {
                        await i.reply({
                            content: c.ownOnly,
                            flags: MessageFlags.Ephemeral,
                        })
                        return
                    }
                    s.modalIds =
                        s.result.kind === "missing_link" ||
                        s.result.kind === "ambiguous_link"
                            ? [...s.result.account.steamIds]
                            : [s.result.steamId]
                    const input = new TextInputBuilder()
                        .setCustomId("steam")
                        .setLabel(c.input)
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setMinLength(17)
                        .setMaxLength(100)
                    if (s.modalIds.length === 1) input.setValue(s.modalIds[0])
                    await i.showModal(
                        new ModalBuilder()
                            .setCustomId(control(s, "save"))
                            .setTitle(c.modal)
                            .addComponents(
                                new ActionRowBuilder<TextInputBuilder>().addComponents(
                                    input
                                )
                            )
                    )
                    return
                }
                await i.deferUpdate()
                if (action === "share") {
                    if (!(await ports.authorize(s.request)))
                        throw new Error("forbidden")
                    if (s.channelId)
                        await share(s, s.channelId, (v) => i.editReply(v))
                    else
                        await i.editReply({
                            components: [
                                new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
                                    new ChannelSelectMenuBuilder()
                                        .setCustomId(control(s, "channel"))
                                        .setPlaceholder(c.selectChannel)
                                        .addChannelTypes(
                                            ChannelType.GuildText,
                                            ChannelType.GuildAnnouncement
                                        )
                                ),
                                new ActionRowBuilder<ButtonBuilder>().addComponents(
                                    button(s, "overview", c.overview)
                                ),
                            ],
                        })
                } else if (
                    [
                        "overview",
                        "refresh",
                        "recent",
                        "factions",
                        "weapons",
                        "maps",
                    ].includes(action)
                ) {
                    s.view =
                        action === "refresh"
                            ? "overview"
                            : (action as StatsView)
                    await refresh(s, (v) => i.editReply(v))
                }
            } catch (e) {
                await i.editReply({
                    content: error(e, s.locale),
                    components: [],
                })
            } finally {
                s.busy = false
            }
        },
        async channel(i: ChannelSelectMenuInteraction) {
            const context = await state(i)
            if (!context) return
            const { s } = context
            try {
                await i.deferUpdate()
                if (context.action !== "channel" || i.values.length !== 1)
                    throw new Error("forbidden")
                await share(s, i.values[0], (v) => i.editReply(v))
            } catch (e) {
                await i.editReply({
                    content: error(e, s.locale),
                    components: [],
                })
            } finally {
                s.busy = false
            }
        },
        async modal(i: ModalSubmitInteraction) {
            const context = await state(i)
            if (!context) return
            const { s, action } = context,
                c = statsCopy(s.locale),
                steamId = parseSteamId(i.fields.getTextInputValue("steam"))
            try {
                if (action !== "save" || !self(s) || !s.modalIds) {
                    await i.reply({
                        content: c.ownOnly,
                        flags: MessageFlags.Ephemeral,
                    })
                    return
                }
                if (!steamId) {
                    await i.reply({
                        content: c.invalidSteam,
                        flags: MessageFlags.Ephemeral,
                    })
                    return
                }
                await i.deferReply({ flags: MessageFlags.Ephemeral })
                const expected = s.modalIds
                s.modalIds = undefined
                if (!(await ports.authorize(s.request)))
                    throw new Error("forbidden")
                await ports.link(s.request, steamId, i.user.username, expected)
                s.view = "overview"
                await refresh(s, (v) => i.editReply(v))
            } catch (e) {
                const text = error(e, s.locale)
                await i.editReply({
                    content: text === c.incomplete ? c.linkError : text,
                })
            } finally {
                s.busy = false
            }
        },
        async autocomplete(i: AutocompleteInteraction) {
            const focused = i.options.getFocused(true),
                query = String(focused.value).trim().toLowerCase()
            if (
                !i.guildId ||
                i.options.getString("game") !== "wardogs" ||
                !["player", "server"].includes(focused.name)
            ) {
                await i.respond([])
                return
            }
            const request: StatsRequest = {
                guildId: i.guildId,
                requesterId: i.user.id,
                targetId: i.user.id,
                game: "wardogs",
                period: statsPeriodSchema
                    .catch("30d")
                    .parse(i.options.getString("period") ?? "30d"),
            }
            let timer: ReturnType<typeof setTimeout> | undefined
            try {
                const find = async () => {
                    if (!(await ports.authorize(request))) return []
                    const history = await ports.history(request),
                        choices = new Map<string, string>()
                    for (const r of history.records) {
                        if (focused.name === "server") {
                            if (!choices.has(r.sourceId))
                                choices.set(
                                    r.sourceId,
                                    `${r.serverName ?? "Server"} · …${r.sourceId.slice(-6)}`
                                )
                        } else
                            for (const p of r.session.players)
                                if (
                                    p.platform === "steam" &&
                                    parseSteamId(p.platformId) &&
                                    !choices.has(p.platformId)
                                )
                                    choices.set(
                                        p.platformId,
                                        `${p.name ?? "Player"} · …${p.platformId.slice(-6)}`
                                    )
                    }
                    return [...choices]
                        .filter(
                            ([value, name]) =>
                                name.toLowerCase().includes(query) ||
                                value.includes(query)
                        )
                        .slice(0, 25)
                        .map(([value, name]) => ({
                            name: safeStatsText(name).slice(0, 100),
                            value,
                        }))
                }
                const choices = await Promise.race([
                    find(),
                    new Promise<never>((_, reject) => {
                        timer = setTimeout(
                            () => reject(new Error("autocomplete_timeout")),
                            2000
                        )
                    }),
                ])
                if (choices) await i.respond(choices)
            } catch {
                await i.respond([]).catch(() => {})
            } finally {
                if (timer) clearTimeout(timer)
            }
        },
    }
}
