import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    EmbedBuilder,
    MessageFlags,
    ModalBuilder,
    StringSelectMenuBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionFlagsBits,
    escapeMarkdown,
    type Client,
    type ButtonInteraction,
    type StringSelectMenuInteraction,
    type ModalSubmitInteraction,
    type Guild,
    type TextChannel,
    type ThreadChannel,
} from "discord.js"
import {
    reportSubmissionSchema,
    type ReportObservation,
} from "../../src/domain/player-reports/report"
import {
    makeFunctionReference,
    type FunctionReturnType,
    type ApiFromModules,
} from "convex/server"
import { deliverPlayerReport } from "../../src/application/player-reports/deliver-report"
import { listReportMembers } from "./interactions/report-members"
import { readReportObservation } from "./public-panels/worker"
import type * as reports from "../../convex/playerReports"
import { env } from "./environment"
import { convex } from "./convex"

type ReportsApi = ApiFromModules<{
    playerReports: typeof reports
}>["playerReports"]
type Entry = NonNullable<FunctionReturnType<ReportsApi["entry"]>>
type Draft = NonNullable<FunctionReturnType<ReportsApi["draft"]>>
type Claimed = Extract<
    FunctionReturnType<ReportsApi["claim"]>,
    { kind: "claimed" }
>
type Scope = { guildId: string; reporterId: string }
const query = <T>(name: string, args: Record<string, unknown>): Promise<T> =>
    convex.query(makeFunctionReference<"query">(`playerReports:${name}`), {
        secret: env.internalSecret,
        ...args,
    })
const mutation = <T>(name: string, args: Record<string, unknown>): Promise<T> =>
    convex.mutation(
        makeFunctionReference<"mutation">(`playerReports:${name}`),
        { secret: env.internalSecret, ...args }
    )
const clean = (v: string | null | undefined, max = 1000) =>
    escapeMarkdown((v || "—").replace(/@/g, "＠").replace(/[<>]/g, "")).slice(
        0,
        max
    )
type Policy = Pick<
    Entry,
    | "guildId"
    | "channelId"
    | "parentChannelId"
    | "supportRoleIds"
    | "dashboardAdminRoleId"
>

async function verifyAccess(guild: Guild, policy: Policy, reporterId: string) {
    if (guild.id !== policy.guildId) throw Error("wrong_guild")
    await guild.fetch()
    const [source, parent, member, all] = await Promise.all([
        guild.channels.fetch(policy.channelId, { force: true }),
        guild.channels.fetch(policy.parentChannelId, { force: true }),
        guild.members.fetch({ user: reporterId, force: true }),
        listReportMembers(async (after) => [
            ...(
                await guild.members.list({
                    limit: 1000,
                    ...(after ? { after } : {}),
                })
            ).values(),
        ]),
        guild.roles.fetch(),
    ])
    const visibility = [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ReadMessageHistory,
    ]
    if (
        !source?.permissionsFor(member)?.has(visibility) ||
        parent?.type !== ChannelType.GuildText ||
        !parent.permissionsFor(member)?.has(visibility)
    )
        throw Error("reporter_access_unavailable")
    const me = await guild.members.fetchMe({ force: true })
    if (
        !parent
            .permissionsFor(me)
            ?.has([
                ...visibility,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.CreatePrivateThreads,
                PermissionFlagsBits.SendMessagesInThreads,
                PermissionFlagsBits.ManageThreads,
                PermissionFlagsBits.EmbedLinks,
            ])
    )
        throw Error("private_thread_permissions_missing")
    const staff: string[] = []
    for (const candidate of all.values()) {
        const permitted =
            candidate.permissions.has(PermissionFlagsBits.Administrator) ||
            (!!policy.dashboardAdminRoleId &&
                candidate.roles.cache.has(policy.dashboardAdminRoleId)) ||
            policy.supportRoleIds.some((role) =>
                candidate.roles.cache.has(role)
            )
        const permissions = parent.permissionsFor(candidate)
        if (
            candidate.id !== me.id &&
            candidate.id !== reporterId &&
            !permitted &&
            permissions?.has([...visibility, PermissionFlagsBits.ManageThreads])
        )
            throw Error("nonstaff_can_manage_private_threads")
        if (
            permitted &&
            !candidate.user.bot &&
            permissions?.has([
                ...visibility,
                PermissionFlagsBits.SendMessagesInThreads,
            ])
        )
            staff.push(candidate.id)
    }
    if (!staff.length || staff.length > 80)
        throw Error("staff_access_unavailable")
    return { parent, staff }
}

export function buildReportPicker(
    id: string,
    observation: ReportObservation,
    requestedPage = 0
) {
    const size = 20,
        pages = Math.max(1, Math.ceil(observation.players.length / size)),
        page = Math.max(0, Math.min(requestedPage, pages - 1))
    const choices = observation.players
        .slice(page * size, (page + 1) * size)
        .map((p, i) => ({
            label: p.name.slice(0, 100),
            description: clean(p.team, 80),
            value: String(page * size + i),
        }))
    choices.push({
        label: "Jiný hráč / Other player",
        description: "Ruční údaj · unverified manual identity",
        value: "-1",
    })
    return {
        content: `**Report Player · soukromé hlášení / private report**\n${clean(observation.serverName, 100)} · ${clean(observation.map, 100)}\nVyber hráče nebo zadej vlastní jméno/ID. Důkazy můžeš přiložit do soukromého ticketu.\nChoose a player or enter a name/ID. Evidence files can be attached in the private ticket.\n${page + 1}/${pages}`,
        components: [
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`report:pick:${id}`)
                    .setPlaceholder("Hráč / Player")
                    .addOptions(choices)
            ),
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `report:page:${id}:${Math.max(0, page - 1)}:prev`
                    )
                    .setLabel("Previous")
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === 0),
                new ButtonBuilder()
                    .setCustomId(
                        `report:page:${id}:${Math.min(pages - 1, page + 1)}:next`
                    )
                    .setLabel("Next")
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page === pages - 1)
            ),
        ],
        allowedMentions: { parse: [] as [] },
    }
}
function reportModal(id: string, choice: number) {
    const modal = new ModalBuilder()
        .setCustomId(`report:submit:${id}:${choice}`)
        .setTitle("Report Player · soukromě / private")
    const input = (
        id: string,
        label: string,
        max: number,
        required = true,
        paragraph = false
    ) =>
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId(id)
                .setLabel(label)
                .setStyle(
                    paragraph ? TextInputStyle.Paragraph : TextInputStyle.Short
                )
                .setMaxLength(max)
                .setRequired(required)
        )
    if (choice === -1)
        modal.addComponents(input("player", "Hráč / Player name or ID", 200))
    modal.addComponents(
        input("reason", "Důvod / Reason (min. 10 znaků)", 1000, true, true),
        input("incident", "Kdy / Approximate incident time", 100, false),
        input("evidence", "Důkazy / Evidence HTTPS link", 1000, false)
    )
    return modal
}
export function buildReportEmbed(
    claim: Pick<Claimed, "contextJson" | "marker" | "createdAt">,
    reporterId: string
) {
    const value = JSON.parse(claim.contextJson) as {
        gameId: string
        connectionId: string
        serverName: string | null
        map: string | null
        observedAt: string | null
        player: {
            name: string
            playerId: string | null
            team: string | null
            provenance: string
        }
        reason: string
        incident: string
        evidence: string
    }
    return new EmbedBuilder()
        .setTitle("Report Player · soukromý ticket / private ticket")
        .setColor(0xe0a13b)
        .setDescription(
            "Hlášení k prověření, nikoli prokázané porušení. / Report for investigation; not a finding of wrongdoing."
        )
        .addFields(
            {
                name: "Hráč / Player",
                value: `**${clean(value.player.name, 200)}**\n${clean(value.player.team, 100)}\n${value.player.playerId ? `ID: ${clean(value.player.playerId, 200)}\n` : ""}${value.player.provenance === "observed" ? "Observed in provider data; not verified Discord identity" : "Manual input · identity unverified"}`,
            },
            {
                name: "Server / Map",
                value: `${clean(value.serverName, 200)}\n${clean(value.map, 200)}\n${value.gameId === "hell_let_loose" ? "Hell Let Loose" : "Wardogs"}`,
            },
            {
                name: "Oznamovatel / Reporter",
                value: `<@${reporterId}>`,
                inline: true,
            },
            {
                name: "Pozorováno / Observed",
                value: clean(value.observedAt, 100),
                inline: true,
            },
            { name: "Důvod / Reason", value: clean(value.reason) },
            { name: "Kdy / Incident", value: clean(value.incident, 100) },
            { name: "Důkazy / Evidence", value: clean(value.evidence) }
        )
        .setFooter({ text: claim.marker })
        .setTimestamp(new Date(claim.createdAt))
}
export async function deliverReport(
    client: Client,
    scope: Scope,
    reportId: string
) {
    let parent: TextChannel | null = null,
        staff: string[] = []
    const threads = new Map<string, ThreadChannel>()
    const getThread = async (id: string) => {
        const thread =
            threads.get(id) ??
            (await client.channels.fetch(id, { force: true }))
        if (
            !thread?.isThread() ||
            thread.type !== ChannelType.PrivateThread ||
            thread.guildId !== scope.guildId ||
            thread.parentId !== parent?.id ||
            thread.invitable !== false ||
            thread.ownerId !== client.user?.id
        )
            throw Error("invalid_private_thread")
        threads.set(id, thread)
        return thread
    }
    return deliverPlayerReport<Claimed>({
        claim: () => mutation("claim", { ...scope, reportId }),
        find: async (claim) => {
            const guild = await client.guilds.fetch(scope.guildId),
                access = await verifyAccess(guild, claim, scope.reporterId)
            parent = access.parent
            staff = access.staff
            if (claim.threadId) {
                await getThread(claim.threadId)
                return claim.threadId
            }
            const active = await parent.threads.fetchActive()
            const found = active.threads.filter(
                (t) =>
                    t.name === claim.marker &&
                    t.parentId === parent!.id &&
                    t.ownerId === client.user?.id
            )
            if (found.size > 1) throw Error("ambiguous_report_threads")
            const thread = found.first()
            if (!thread) return null
            threads.set(thread.id, thread)
            await getThread(thread.id)
            return thread.id
        },
        create: async (claim) => {
            if (!parent) throw Error("missing_parent")
            const thread = await parent.threads.create({
                name: claim.marker,
                type: ChannelType.PrivateThread,
                invitable: false,
                autoArchiveDuration: 1440,
                reason: "Logi private player report",
            })
            threads.set(thread.id, thread)
            return thread.id
        },
        bind: async (claim, threadId) => {
            await mutation("bind", {
                ...scope,
                reportId,
                fence: claim.fence,
                threadId,
            })
        },
        preparePrivateThread: async (claim, threadId) => {
            const thread = await getThread(threadId),
                access = await verifyAccess(
                    thread.guild,
                    claim,
                    scope.reporterId
                )
            staff = access.staff
            if (thread.archived || thread.locked)
                throw Error("report_thread_not_active")
            for (const id of new Set([scope.reporterId, ...staff]))
                await thread.members.add(id)
            const members = await thread.members.fetch()
            const allowedMembers = new Set([
                scope.reporterId,
                ...staff,
                client.user!.id,
            ])
            if (members.some((member) => !allowedMembers.has(member.id)))
                throw Error("unexpected_private_member")
            if (
                !members.has(scope.reporterId) ||
                !staff.every((id) => members.has(id))
            )
                throw Error("private_members_incomplete")
        },
        starter: async (claim, threadId) => {
            const thread = await getThread(threadId),
                messages = await thread.messages.fetch({ limit: 100 })
            const found = messages.find(
                (m) =>
                    m.author.id === client.user?.id &&
                    m.embeds.some((e) => e.footer?.text === claim.marker)
            )
            if (found) return found.id
            if (messages.size >= 100) throw Error("report_history_incomplete")
            return (
                await thread.send({
                    embeds: [buildReportEmbed(claim, scope.reporterId)],
                    allowedMentions: { parse: [] },
                    nonce: reportId.slice(-24),
                    enforceNonce: true,
                })
            ).id
        },
        complete: async (claim, messageId) => {
            await mutation("complete", {
                ...scope,
                reportId,
                fence: claim.fence,
                messageId,
            })
        },
        uncertain: async (claim) => {
            await mutation("uncertain", {
                ...scope,
                reportId,
                fence: claim.fence,
            })
        },
        release: async (claim) => {
            await mutation("release", {
                ...scope,
                reportId,
                fence: claim.fence,
            })
        },
    })
}

export async function handlePlayerReport(
    interaction:
        ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction
) {
    if (!interaction.customId.startsWith("report:")) return false
    if (!interaction.guildId || !interaction.guild) {
        await interaction.reply({
            content: "Use the current server panel in its Discord channel.",
            flags: MessageFlags.Ephemeral,
        })
        return true
    }
    const scope = {
        guildId: interaction.guildId,
        reporterId: interaction.user.id,
    }
    if (interaction.isStringSelectMenu()) {
        const match = /^report:pick:([a-zA-Z0-9_-]{1,64})$/.exec(
                interaction.customId
            ),
            choice = Number(interaction.values[0])
        if (
            !match ||
            !Number.isInteger(choice) ||
            choice < -1 ||
            choice > 299
        ) {
            await interaction.reply({
                content: "Invalid report selection.",
                flags: MessageFlags.Ephemeral,
            })
            return true
        }
        await interaction.showModal(reportModal(match[1], choice))
        return true
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral })
    let stage = "resolve_control"
    try {
        if (interaction.isButton()) {
            const open = /^report:open:([a-zA-Z0-9_-]{1,64}):(\d{1,16})$/.exec(
                    interaction.customId
                ),
                page =
                    /^report:page:([a-zA-Z0-9_-]{1,64}):(\d{1,2}):(prev|next)$/.exec(
                        interaction.customId
                    )
            if (open) {
                const args = {
                    ...scope,
                    panelId: open[1],
                    revision: Number(open[2]),
                    channelId: interaction.channelId,
                }
                stage = "load_configuration"
                const entry = await query<Entry | null>("entry", args)
                if (!entry) throw Error("unavailable")
                stage = "verify_access"
                await verifyAccess(interaction.guild, entry, scope.reporterId)
                stage = "read_players"
                const observation = await readReportObservation(
                    scope.guildId,
                    open[1],
                    Number(open[2])
                )
                stage = "recheck_access"
                await verifyAccess(interaction.guild, entry, scope.reporterId)
                stage = "save_draft"
                const id = await mutation<string>("createDraft", {
                    ...args,
                    interactionId: interaction.id,
                    observationJson: JSON.stringify(observation),
                })
                stage = "show_picker"
                await interaction.editReply(buildReportPicker(id, observation))
            } else if (page) {
                const data = await query<Draft | null>("draft", {
                    ...scope,
                    draftId: page[1],
                })
                if (!data || data.channelId !== interaction.channelId)
                    throw Error("expired")
                await verifyAccess(interaction.guild, data, scope.reporterId)
                await interaction.editReply(
                    buildReportPicker(
                        page[1],
                        data.observation,
                        Number(page[2])
                    )
                )
            } else throw Error("invalid_control")
        } else {
            const match =
                /^report:submit:([a-zA-Z0-9_-]{1,64}):(-1|\d{1,3})$/.exec(
                    interaction.customId
                )
            if (!match) throw Error("invalid_control")
            const data = await query<Draft | null>("draft", {
                ...scope,
                draftId: match[1],
            })
            if (!data || data.channelId !== interaction.channelId)
                throw Error("expired")
            await verifyAccess(interaction.guild, data, scope.reporterId)
            const submission = reportSubmissionSchema.parse({
                choice: Number(match[2]),
                manualPlayer:
                    Number(match[2]) === -1
                        ? interaction.fields.getTextInputValue("player")
                        : "",
                reason: interaction.fields.getTextInputValue("reason"),
                incident: interaction.fields.getTextInputValue("incident"),
                evidence: interaction.fields.getTextInputValue("evidence"),
            })
            const reportId = await mutation<string>("submit", {
                ...scope,
                draftId: match[1],
                submissionJson: JSON.stringify(submission),
            })
            const result = await deliverReport(
                interaction.client,
                scope,
                reportId
            )
            await interaction.editReply({
                content:
                    result.kind === "open"
                        ? `Soukromý ticket / Private ticket: https://discord.com/channels/${scope.guildId}/${result.threadId}`
                        : "Hlášení je uložené, ale vytvoření ticketu čeká na ověření. Bot zkusí dohledat původní vlákno; pokud chybí, je nutná kontrola správce. / Report saved; thread recovery or staff review is required.",
                components: [],
                allowedMentions: { parse: [] },
            })
        }
    } catch (error) {
        // Never log report text, provider responses, interaction tokens or raw errors.
        const discordCode =
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            typeof error.code === "number"
                ? error.code
                : undefined
        console.warn("[player-reports] Interaction unavailable", {
            stage,
            discordCode,
        })
        if (
            discordCode === 50035 &&
            typeof error === "object" &&
            error !== null &&
            "rawError" in error
        ) {
            const collect = (value: unknown, path = ""): string[] => {
                if (!value || typeof value !== "object") return []
                return Object.entries(value).flatMap(([key, item]) =>
                    key === "_errors" && Array.isArray(item)
                        ? item.map(
                              (e) =>
                                  `${path}:${typeof e?.code === "string" ? e.code.replace(/[^A-Z0-9_]/g, "") : "invalid"}`
                          )
                        : collect(
                              item,
                              `${path}.${key.replace(/[^a-zA-Z0-9_]/g, "")}`
                          )
                )
            }
            console.warn(
                "[player-reports] Invalid Discord form paths",
                collect(error.rawError)
            )
        }
        await interaction.editReply({
            content:
                "Hlášení nelze odeslat. Otevři aktuální panel, zkontroluj důvod (10–1000 znaků), HTTPS odkaz a limit 3 otevřených hlášení. Správce musí ověřit přístup do soukromých ticketů. / Reporting unavailable: reopen the current panel, check the reason/evidence and report limits, or ask staff to verify private-ticket access.",
            components: [],
        })
    }
    return true
}
export function startReportRecovery(client: Client) {
    let running = false
    const tick = async () => {
        if (running) return
        running = true
        try {
            for (const guild of client.guilds.cache.values()) {
                const items = await query<
                    { reportId: string; reporterId: string }[]
                >("pending", { guildId: guild.id })
                for (const item of items)
                    await deliverReport(
                        client,
                        { guildId: guild.id, reporterId: item.reporterId },
                        item.reportId
                    )
            }
        } catch {
            console.warn("[player-reports] Recovery unavailable; will retry.")
        } finally {
            running = false
        }
    }
    const timer = setInterval(() => void tick(), 30_000)
    timer.unref()
    void tick()
    return () => clearInterval(timer)
}
