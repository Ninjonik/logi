import {
    ActionRowBuilder,
    ChannelSelectMenuBuilder,
    ChannelType,
    LabelBuilder,
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    type AutocompleteInteraction,
    type ButtonInteraction,
    type ChannelSelectMenuInteraction,
    type ChatInputCommandInteraction,
    type InteractionEditReplyOptions,
    type MessageCreateOptions,
    type ModalSubmitInteraction,
} from "discord.js"
import {
    buildStatsView,
    statsErrorCard,
    statsPublishable,
    statsSharePromptView,
    type StatsButtonAction,
    type StatsErrorKey,
    type StatsView,
} from "../../../src/domain/player-stats/stats-reply"
import {
    readPlayerStats,
    type PlayerStatsPorts,
    type PlayerStatsResult,
    type StatsRequest,
} from "../../../src/application/game-data/read-player-stats"
import {
    resolveStatsShareChannel,
    statsCommandAccess,
    type StatsCommandSettings,
} from "../../../src/domain/player-stats/command-settings"
import {
    hllProfileUrl,
    parseSteamId,
    statsGameSchema,
    statsPeriodSchema,
} from "../../../src/domain/player-stats/player-stats"
import {
    discordMessageUrl,
    shareDeniedCard,
    sharedDoneCard,
} from "../../../src/domain/discord-commands/share-view"
import {
    errorCard,
    type MessageView,
} from "../../../src/domain/discord-messages/message-view"
import type { PanelFactionEmoji } from "../../../src/domain/discord-publications/panel-presentation"
import type { MessageStyle } from "../../../src/domain/discord-messages/message-style"
import { getIntlLocaleForClanLanguage } from "../../../src/lib/clan-language/core"
import { checkCommandAccess, type AccessDeps } from "../commands/access"
import { statsCopy } from "../../../src/domain/player-stats/stats-copy"
import { editPayload, messagePayload } from "../ui/message-kit"
import { replyPrivately } from "../ui/replies"
import { randomBytes } from "node:crypto"

/** Where a shared card landed. */
export type StatsShareResult = { messageId: string; url?: string }

export type StatsPorts = PlayerStatsPorts & {
    link: (
        request: StatsRequest,
        steamId: string,
        name: string,
        expected: string[]
    ) => Promise<void>
    /** Posts the shared card after a fresh permission check; throws `share_denied`. */
    share: (
        request: StatsRequest,
        channelId: string,
        payload: MessageCreateOptions
    ) => Promise<StatsShareResult>
    /** Workspace switches for the command; undefined keeps the defaults. */
    settings: (guildId: string) => Promise<StatsCommandSettings | undefined>
    /** The command group, extra roles and channels (`commands/access.ts`). */
    access: AccessDeps
    /** Installed faction application emoji; empty means the fallbacks. */
    factionEmoji?: () => Promise<PanelFactionEmoji>
    now?: () => number
}

type State = {
    id: string
    request: StatsRequest
    language: string
    locale: string
    timeZone?: string
    style?: MessageStyle
    expires: number
    result?: PlayerStatsResult
    view: StatsView
    channelId?: string
    shareEnabled: boolean
    busy: boolean
    shared: boolean
    modalIds?: string[]
}

const ERROR_CODES: Record<string, StatsErrorKey> = {
    linked_only: "hll_only",
    link_changed: "link_changed",
    already_linked: "already_linked",
    invalid_steam: "invalid_steam",
    forbidden: "forbidden",
}

/** The private error card of a failed read, without codes or English (M2-04). */
function errorKey(value: unknown, request: StatsRequest): StatsErrorKey {
    const message = value instanceof Error ? value.message : ""
    if (/\bunconfigured_guild\b/.test(message)) return "not_configured"
    const known = ERROR_CODES[message]
    if (known) return known
    if (/stats_timeout|stats_busy|unavailable|network|fetch/i.test(message))
        return request.game === "hll" ? "unavailable_hll" : "unavailable_warcon"
    return "incomplete"
}

type Interaction =
    ButtonInteraction | ChannelSelectMenuInteraction | ModalSubmitInteraction

/**
 * `/stats` (board M2 1.2): a private card in the clan language with three
 * numbers, the selected view as the one primary button and "Sdílet" grey;
 * every view reads fresh data (no "Obnovit"); "Přidat Steam" only when the
 * Steam account is missing; "Sdílet" posts the same view to the default or
 * chosen channel after a fresh permission check, naming who shared it.
 */
export function createStatsController(ports: StatsPorts) {
    const states = new Map<string, State>(),
        now = ports.now ?? Date.now
    const commandsAt = new Map<string, number>()
    const self = (s: State) =>
        s.request.requesterId === s.request.targetId && !s.request.playerId
    const control = (s: State, action: string) => `stats:${s.id}:${action}`
    const kit = (s: State) => ({ language: s.language, style: s.style })

    async function view(s: State, shared = false): Promise<MessageView> {
        const copy = statsCopy(s.language)
        const result = s.result!
        const steamId =
            result.kind === "hll" || result.kind === "wardogs"
                ? result.steamId
                : undefined
        return buildStatsView({
            copy,
            locale: s.locale,
            timeZone: s.timeZone,
            game: s.request.game,
            period: s.request.period,
            result,
            view: s.view,
            self: self(s),
            controls: shared
                ? undefined
                : {
                      id: (action: StatsButtonAction) => control(s, action),
                      share:
                          s.shareEnabled &&
                          !s.shared &&
                          statsPublishable(result),
                  },
            shared: shared
                ? { userId: s.request.requesterId, at: now() }
                : undefined,
            factionEmoji:
                (await ports.factionEmoji?.().catch(() => ({}))) ?? {},
            hllProfileUrl:
                result.kind === "hll" && steamId
                    ? hllProfileUrl(steamId, s.request.period)
                    : undefined,
        })
    }

    async function refresh(
        s: State,
        edit: (value: InteractionEditReplyOptions) => Promise<unknown>
    ) {
        try {
            s.result = await readPlayerStats(s.request, ports)
            await edit(editPayload(await view(s), kit(s)))
        } catch (e) {
            s.result = undefined
            await edit(
                editPayload(
                    statsErrorCard(
                        statsCopy(s.language),
                        errorKey(e, s.request)
                    ),
                    kit(s)
                )
            )
        }
    }

    async function state(i: Interaction) {
        const match = /^stats:([a-f0-9]{16}):([a-z]+)$/.exec(i.customId),
            s = match ? states.get(match[1]!) : null
        if (!s || s.expires < now()) {
            // After a restart the state is gone; the server still has a language.
            const config = s
                ? null
                : await ports.access.configs.get(i.guildId).catch(() => null)
            const language = s?.language ?? config?.language
            await replyPrivately(
                i,
                statsErrorCard(statsCopy(language), "expired"),
                { language }
            )
            return null
        }
        if (
            s.request.requesterId !== i.user.id ||
            s.request.guildId !== i.guildId
        ) {
            await replyPrivately(
                i,
                statsErrorCard(statsCopy(s.language), "own_only"),
                kit(s)
            )
            return null
        }
        if (s.busy) {
            await replyPrivately(
                i,
                statsErrorCard(statsCopy(s.language), "busy"),
                kit(s)
            )
            return null
        }
        // Reserve synchronously, before awaiting Discord's acknowledgement.
        s.busy = true
        return { s, action: match![2]! }
    }

    /** "Kam kartu poslat?" with a channel select and "Zpět" (M2-24). */
    function sharePrompt(s: State): InteractionEditReplyOptions {
        const copy = statsCopy(s.language)
        const payload = editPayload(
            statsSharePromptView(copy, control(s, "overview")),
            kit(s)
        )
        const container = payload.components[0]!
        // The kit has no channel select; it goes above the "Zpět" row.
        container.spliceComponents(
            1,
            0,
            new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId(control(s, "channel"))
                    .setPlaceholder(copy.shareFlow.selectChannel)
                    .addChannelTypes(
                        ChannelType.GuildText,
                        ChannelType.GuildAnnouncement
                    )
            )
        )
        return payload
    }

    async function share(
        s: State,
        channelId: string,
        edit: (value: InteractionEditReplyOptions) => Promise<unknown>
    ) {
        const copy = statsCopy(s.language)
        if (s.shared) {
            await edit(
                editPayload(
                    errorCard({
                        title: copy.shareFlow.alreadyTitle,
                        body: copy.shareFlow.alreadyBody,
                    }),
                    kit(s)
                )
            )
            return
        }
        s.result = await readPlayerStats(s.request, ports)
        if (!statsPublishable(s.result)) {
            await edit(editPayload(await view(s), kit(s)))
            return
        }
        // Claim before send; an uncertain Discord response is never blindly retried.
        s.shared = true
        try {
            const posted = await ports.share(
                s.request,
                channelId,
                messagePayload(await view(s, true), kit(s))
            )
            await edit(
                editPayload(
                    sharedDoneCard({
                        title: copy.shareFlow.sharedTitle,
                        viewMessage: copy.shareFlow.viewMessage,
                        channelId,
                        messageUrl:
                            posted.url ??
                            discordMessageUrl(
                                s.request.guildId,
                                channelId,
                                posted.messageId
                            ),
                    }),
                    kit(s)
                )
            )
        } catch (e) {
            const denied = e instanceof Error && e.message === "share_denied"
            // Nothing was posted: the person may pick another channel.
            if (denied) s.shared = false
            await edit(
                editPayload(
                    denied
                        ? shareDeniedCard({
                              title: copy.shareFlow.deniedTitle,
                              body: copy.shareFlow.deniedBody,
                              channelId,
                              action: {
                                  kind: "action",
                                  id: control(s, "choose"),
                                  label: copy.shareFlow.chooseOther,
                                  style: "primary",
                              },
                          })
                        : errorCard({
                              title: copy.shareFlow.failedTitle,
                              body: copy.shareFlow.failedBody,
                          }),
                    kit(s)
                )
            )
        }
    }

    return {
        async command(i: ChatInputCommandInteraction) {
            await i.deferReply({ flags: MessageFlags.Ephemeral })
            const access = await checkCommandAccess(i, "stats", ports.access)
            if (!access) return
            const language = access.language,
                copy = statsCopy(language),
                options = { language, style: access.config?.messageStyle }
            const game = statsGameSchema.safeParse(i.options.getString("game")),
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
                await replyPrivately(
                    i,
                    statsErrorCard(copy, "invalid"),
                    options
                )
                return
            }
            if (game.data === "hll" && (playerId || sourceId)) {
                await replyPrivately(
                    i,
                    statsErrorCard(copy, "hll_only"),
                    options
                )
                return
            }
            const settings = await ports
                .settings(i.guildId)
                .catch(() => undefined)
            // The command switch is part of the access check; a game can be off.
            if (statsCommandAccess(settings, game.data) === "game_disabled") {
                await replyPrivately(
                    i,
                    statsErrorCard(copy, "game_disabled", {
                        gameLabel: copy.games[game.data],
                    }),
                    options
                )
                return
            }
            const actor = `${i.guildId}:${i.user.id}`
            if (now() - (commandsAt.get(actor) ?? 0) < 3000) {
                await replyPrivately(i, statsErrorCard(copy, "busy"), options)
                return
            }
            commandsAt.set(actor, now())
            while (commandsAt.size > 1000)
                commandsAt.delete(commandsAt.keys().next().value!)
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
                language,
                locale: getIntlLocaleForClanLanguage(language),
                timeZone: access.config?.timeZone,
                style: access.config?.messageStyle,
                expires: now() + 15 * 60_000,
                view: "overview",
                busy: true,
                shared: false,
                shareEnabled:
                    access.access.settings.stats.reply === "privateShare",
                channelId: resolveStatsShareChannel(
                    settings,
                    i.options.getChannel("channel")?.id
                ),
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
                copy = statsCopy(s.language)
            try {
                if (action === "link") {
                    if (!self(s) || !s.result) {
                        await replyPrivately(
                            i,
                            statsErrorCard(copy, "own_only"),
                            kit(s)
                        )
                        return
                    }
                    s.modalIds =
                        s.result.kind === "missing_link" ||
                        s.result.kind === "ambiguous_link"
                            ? [...s.result.account.steamIds]
                            : [s.result.steamId]
                    const input = new TextInputBuilder()
                        .setCustomId("steam")
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setMinLength(17)
                        .setMaxLength(100)
                        .setPlaceholder(copy.modalPlaceholder.slice(0, 100))
                    if (s.modalIds.length === 1) input.setValue(s.modalIds[0]!)
                    await i.showModal(
                        new ModalBuilder()
                            .setCustomId(control(s, "save"))
                            .setTitle(copy.modalTitle)
                            .addLabelComponents(
                                new LabelBuilder()
                                    .setLabel(copy.modalLabel.slice(0, 45))
                                    .setTextInputComponent(input)
                            )
                    )
                    return
                }
                await i.deferUpdate()
                if (action === "share" || action === "choose") {
                    if (!s.shareEnabled) throw new Error("forbidden")
                    if (!(await ports.authorize(s.request)))
                        throw new Error("forbidden")
                    if (action === "share" && s.channelId)
                        await share(s, s.channelId, (v) => i.editReply(v))
                    else await i.editReply(sharePrompt(s))
                } else if (
                    [
                        "overview",
                        "recent",
                        "factions",
                        "weapons",
                        "maps",
                    ].includes(action)
                ) {
                    s.view = action as StatsView
                    await refresh(s, (v) => i.editReply(v))
                }
            } catch (e) {
                await i.editReply(
                    editPayload(
                        statsErrorCard(copy, errorKey(e, s.request)),
                        kit(s)
                    )
                )
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
                if (
                    context.action !== "channel" ||
                    i.values.length !== 1 ||
                    !s.shareEnabled
                )
                    throw new Error("forbidden")
                await share(s, i.values[0]!, (v) => i.editReply(v))
            } catch (e) {
                await i.editReply(
                    editPayload(
                        statsErrorCard(
                            statsCopy(s.language),
                            errorKey(e, s.request)
                        ),
                        kit(s)
                    )
                )
            } finally {
                s.busy = false
            }
        },
        async modal(i: ModalSubmitInteraction) {
            const context = await state(i)
            if (!context) return
            const { s, action } = context,
                copy = statsCopy(s.language),
                steamId = parseSteamId(i.fields.getTextInputValue("steam"))
            try {
                if (action !== "save" || !self(s) || !s.modalIds) {
                    await replyPrivately(
                        i,
                        statsErrorCard(copy, "own_only"),
                        kit(s)
                    )
                    return
                }
                if (!steamId) {
                    await replyPrivately(
                        i,
                        statsErrorCard(copy, "invalid_steam", {
                            retryId: control(s, "link"),
                        }),
                        kit(s)
                    )
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
                const key = errorKey(e, s.request)
                await replyPrivately(
                    i,
                    statsErrorCard(
                        copy,
                        key === "incomplete" ? "link_error" : key
                    ),
                    kit(s)
                )
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
                                    `${r.serverName ?? "?"} · …${r.sourceId.slice(-6)}`
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
                                        `${p.name ?? "?"} · …${p.platformId.slice(-6)}`
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
                            name: name
                                .replace(/[\u0000-\u001f\u007f]/g, " ")
                                .slice(0, 100),
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
