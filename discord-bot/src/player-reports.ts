import {
    ActionRowBuilder,
    ChannelType,
    MessageFlags,
    ModalBuilder,
    TextDisplayBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionFlagsBits,
    type Client,
    type ButtonInteraction,
    type StringSelectMenuInteraction,
    type ModalSubmitInteraction,
    type Guild,
    type MessageCreateOptions,
    type TextChannel,
    type ThreadChannel,
} from "discord.js"
import {
    reportFailureView,
    reportPickerView,
    reportSavedView,
    reportSentView,
    reportThreadName,
    reportThreadView,
    type ReportFailure,
    type ReportThreadContext,
} from "../../src/domain/player-reports/report-views"
import {
    reportSubmissionSchema,
    type ReportObservation,
} from "../../src/domain/player-reports/report"
import {
    makeFunctionReference,
    type FunctionReturnType,
    type ApiFromModules,
} from "convex/server"
import {
    editPayload,
    interactionReplyPayload,
    renderMessageView,
} from "./ui/message-kit"
import {
    findPublicationMessage,
    publicationComponentId,
} from "./sync/publication-marker"
import { deliverPlayerReport } from "../../src/application/player-reports/deliver-report"
import type { MessageStyle } from "../../src/domain/discord-messages/message-style"
import { listReportMembers } from "./interactions/tickets-report-members"
import { interactionLanguage, reportToErrorsChannel } from "./ui/replies"
import { getSystemMessages } from "../../src/lib/clan-language/system"
import { getPanelMessages } from "../../src/lib/clan-language/panels"
import type * as drafts from "../../convex/playerReportDrafts"
import { readReportObservation } from "./public-panels/worker"
import { clanStyleForGuild } from "./runtime/clan-language"
import type * as reports from "../../convex/playerReports"
import { env } from "./environment"
import { convex } from "./convex"

/**
 * "Nahlásit hráče" (L3-58..68, L3-B09): a fully private flow in the clan
 * language. The picker and the form are seen only by the reporter; the
 * report goes to a private thread "Hlášení #17 · Hans_88" with the staff,
 * who are pinged once. Each failure has its own sentence; causes only an
 * admin can fix go to the errors channel.
 */
type ReportsApi = ApiFromModules<{
    playerReports: typeof reports
    playerReportDrafts: typeof drafts
}>
type Entry = NonNullable<
    FunctionReturnType<ReportsApi["playerReports"]["entry"]>
>
type Draft = NonNullable<
    FunctionReturnType<ReportsApi["playerReportDrafts"]["draft"]>
>
type Claimed = Extract<
    FunctionReturnType<ReportsApi["playerReports"]["claim"]>,
    { kind: "claimed" }
>
type Scope = { guildId: string; reporterId: string }
/** The draft flow lives in `playerReportDrafts`; the delivery steps and polling in `playerReports`. */
const DRAFT_FUNCTIONS = new Set(["createDraft", "draft", "submit"])
const modulePath = (name: string) =>
    `${DRAFT_FUNCTIONS.has(name) ? "playerReportDrafts" : "playerReports"}:${name}`
const query = <T>(name: string, args: Record<string, unknown>): Promise<T> =>
    convex.query(makeFunctionReference<"query">(modulePath(name)), {
        secret: env.internalSecret,
        ...args,
    })
const mutation = <T>(name: string, args: Record<string, unknown>): Promise<T> =>
    convex.mutation(makeFunctionReference<"mutation">(modulePath(name)), {
        secret: env.internalSecret,
        ...args,
    })
type Policy = Pick<
    Entry,
    | "guildId"
    | "channelId"
    | "parentChannelId"
    | "supportRoleIds"
    | "dashboardAdminRoleId"
>

/** A failure with its own sentence (L3-64). */
class ReportFailureError extends Error {
    constructor(readonly failure: ReportFailure) {
        super(`Report failed: ${failure}`)
    }
}

async function verifyAccess(guild: Guild, policy: Policy, reporterId: string) {
    if (guild.id !== policy.guildId) throw new ReportFailureError("expired")
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
    if (parent?.type !== ChannelType.GuildText)
        throw new ReportFailureError("admin")
    if (
        !source?.permissionsFor(member)?.has(visibility) ||
        !parent.permissionsFor(member)?.has(visibility)
    )
        throw new ReportFailureError("no_access")
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
            ])
    )
        throw new ReportFailureError("admin")
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
            throw new ReportFailureError("admin")
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
        throw new ReportFailureError("admin")
    return { parent, staff }
}

/** Localized side of a reported player ("Osa"); null when unknown. */
function sideNameFor(language: string | undefined) {
    const copy = getPanelMessages(language).live
    return (team: string | null) => {
        const key = team?.trim().toLowerCase()
        if (!key) return null
        return key === "allies" || key === "allied"
            ? copy.allies
            : key === "axis"
              ? copy.axis
              : team!.trim()
    }
}

/** The private picker "Koho chceš nahlásit?" (L3-58..60). */
export function buildReportPicker(
    id: string,
    observation: ReportObservation,
    requestedPage = 0,
    language?: string,
    /** The clan's colour and icon density (L3-58). */
    style: MessageStyle | null = null
) {
    return editPayload(
        reportPickerView({
            copy: getPanelMessages(language).report,
            draftId: id,
            serverTitle: observation.serverName ?? "—",
            observation,
            page: requestedPage,
            sideName: sideNameFor(language),
        }),
        { language, style }
    )
}

/** "Nahlásit hráče Hans_88" with placeholders (L3-61). */
export function reportModal(
    id: string,
    choice: number,
    player: string | null,
    language?: string
) {
    const copy = getPanelMessages(language).report
    const title =
        choice === -1 || !player
            ? copy.modalTitleOther
            : copy.modalTitle(player)
    const modal = new ModalBuilder()
        .setCustomId(`report:submit:${id}:${choice}`)
        .setTitle(
            title.length <= 45
                ? title
                : `${Array.from(title).slice(0, 44).join("")}…`
        )
    const input = (
        id: string,
        label: string,
        max: number,
        options: {
            required?: boolean
            paragraph?: boolean
            placeholder?: string
        } = {}
    ) => {
        const field = new TextInputBuilder()
            .setCustomId(id)
            .setLabel(label)
            .setStyle(
                options.paragraph
                    ? TextInputStyle.Paragraph
                    : TextInputStyle.Short
            )
            .setMaxLength(max)
            .setRequired(options.required ?? true)
        if (options.placeholder) field.setPlaceholder(options.placeholder)
        return new ActionRowBuilder<TextInputBuilder>().addComponents(field)
    }
    if (choice === -1)
        modal.addComponents(input("player", copy.playerField, 200))
    modal.addComponents(
        input("reason", copy.reasonField, 1000, {
            paragraph: true,
            placeholder: copy.reasonPlaceholder,
        }),
        input("incident", copy.whenField, 100, {
            required: false,
            placeholder: copy.whenPlaceholder,
        }),
        input("evidence", copy.evidenceField, 1000, {
            required: false,
            placeholder: copy.evidencePlaceholder,
        })
    )
    return modal
}

/**
 * The first message of the private thread (L3-65..67): the staff ping above
 * the card, the card tagged invisibly so an uncertain send is found again.
 */
export function buildReportThreadMessage(
    claim: Pick<
        Claimed,
        "contextJson" | "marker" | "createdAt" | "reportNumber"
    >,
    reporterId: string,
    options: {
        language?: string
        staffRoleIds: string[]
        serverTitle?: string | null
        /** The clan's colour and icon density, as on the ticket cards (L3-65). */
        style?: MessageStyle | null
    }
): MessageCreateOptions {
    const copy = getPanelMessages(options.language)
    const context = JSON.parse(claim.contextJson) as ReportThreadContext
    const observed = context.observedAt
        ? `<t:${Math.floor(Date.parse(context.observedAt) / 1000)}:f>`
        : null
    const view = reportThreadView({
        copy: copy.report,
        number: claim.reportNumber ?? 0,
        context,
        reporterId,
        sideName: sideNameFor(options.language)(context.player.team),
        observedText: observed,
        serverTitle: options.serverTitle ?? null,
    })
    const { container } = renderMessageView(view, {
        language: options.language,
        style: options.style ?? null,
    })
    const roles = options.staffRoleIds.slice(0, 5)
    return {
        components: [
            ...(roles.length
                ? [
                      new TextDisplayBuilder().setContent(
                          roles.map((role) => `<@&${role}>`).join(" ")
                      ),
                  ]
                : []),
            { ...container.toJSON(), id: publicationComponentId(claim.marker) },
        ],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [], roles },
    }
}

/** The thread's name: "Hlášení #17 · Hans_88"; older reports keep their marker. */
export function reportThreadTitle(
    claim: Pick<Claimed, "contextJson" | "marker" | "reportNumber">,
    language?: string
) {
    if (claim.reportNumber == null) return claim.marker
    const context = JSON.parse(claim.contextJson) as ReportThreadContext
    return reportThreadName(
        getPanelMessages(language).report,
        claim.reportNumber,
        context.player.name
    )
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
            const names = new Set([
                claim.marker,
                reportThreadTitle(claim, claim.language),
            ])
            const active = await parent.threads.fetchActive()
            const found = active.threads.filter(
                (t) =>
                    names.has(t.name) &&
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
                name: reportThreadTitle(claim, claim.language),
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
            const tagged = findPublicationMessage(
                messages.values(),
                claim.marker,
                client.user?.id
            )
            if (tagged) return tagged
            // Reports started before the redesign carry the marker in an embed footer.
            const legacy = messages.find(
                (m) =>
                    m.author.id === client.user?.id &&
                    m.embeds.some((e) => e.footer?.text === claim.marker)
            )
            if (legacy) return legacy.id
            if (messages.size >= 100) throw Error("report_history_incomplete")
            return (
                await thread.send({
                    ...buildReportThreadMessage(claim, scope.reporterId, {
                        language: claim.language,
                        staffRoleIds: claim.supportRoleIds,
                        style: await clanStyleForGuild(scope.guildId),
                    }),
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

/**
 * Which sentence a failure gets. Backend refusals name their reason; a
 * form value Zod rejects names its field; anything else is "Hlášení teď
 * nejde poslat" without guessing.
 */
export function reportFailureOf(error: unknown): ReportFailure {
    if (error instanceof ReportFailureError) return error.failure
    const message = error instanceof Error ? error.message : ""
    if (message.includes("Three reports are already open")) return "limit"
    if (message.includes("Wait one minute")) return "wait"
    if (message.includes("Too many report forms")) return "too_many_forms"
    if (
        message.includes("expired") ||
        message.includes("configuration changed") ||
        message.includes("Report panel changed")
    )
        return "expired"
    const issues =
        typeof error === "object" && error && "issues" in error
            ? (error as { issues: Array<{ path: PropertyKey[] }> }).issues
            : null
    if (issues?.length) {
        const field = String(issues[0]!.path[0] ?? "")
        if (field === "reason") return "reason"
        if (field === "evidence") return "evidence"
        if (field === "manualPlayer") return "player"
    }
    return "unavailable"
}

export async function handlePlayerReport(
    interaction:
        ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction
) {
    if (!interaction.customId.startsWith("report:")) return false
    const language = await interactionLanguage(interaction.guildId)
    // L3-58: private replies carry the clan's own colour, as its panels do.
    const style = await clanStyleForGuild(interaction.guildId)
    const kit = { language, style }
    const copy = getPanelMessages(language).report
    const fail = async (failure: ReportFailure, error?: unknown) => {
        const view = reportFailureView(
            copy,
            failure,
            getSystemMessages(language).errors.adminNotified
        )
        if (interaction.deferred || interaction.replied)
            await interaction.editReply(editPayload(view, kit))
        else await interaction.reply(interactionReplyPayload(view, kit))
        if (failure === "admin" && interaction.guildId)
            await reportToErrorsChannel({
                client: interaction.client,
                guildId: interaction.guildId,
                error,
                action: "Create a player report thread",
                location: "Player reports",
                scope: "player-report",
            })
    }
    if (!interaction.guildId || !interaction.guild) {
        await fail("expired")
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
            await fail("expired")
            return true
        }
        // The form's title names the chosen player (L3-61).
        const draft = await query<Draft | null>("draft", {
            ...scope,
            draftId: match[1],
        }).catch(() => null)
        const player =
            choice >= 0
                ? (draft?.observation.players[choice]?.name ?? null)
                : null
        await interaction.showModal(
            reportModal(match[1]!, choice, player, language)
        )
        return true
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral })
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
                const entry = await query<Entry | null>("entry", args)
                if (!entry) throw new ReportFailureError("expired")
                await verifyAccess(interaction.guild, entry, scope.reporterId)
                const observation = await readReportObservation(
                    scope.guildId,
                    open[1]!,
                    Number(open[2])
                )
                await verifyAccess(interaction.guild, entry, scope.reporterId)
                const id = await mutation<string>("createDraft", {
                    ...args,
                    interactionId: interaction.id,
                    observationJson: JSON.stringify(observation),
                })
                await interaction.editReply(
                    buildReportPicker(id, observation, 0, language, style)
                )
            } else if (page) {
                const data = await query<Draft | null>("draft", {
                    ...scope,
                    draftId: page[1],
                })
                if (!data || data.channelId !== interaction.channelId)
                    throw new ReportFailureError("expired")
                await verifyAccess(interaction.guild, data, scope.reporterId)
                await interaction.editReply(
                    buildReportPicker(
                        page[1]!,
                        data.observation,
                        Number(page[2]),
                        language,
                        style
                    )
                )
            } else throw new ReportFailureError("expired")
        } else {
            const match =
                /^report:submit:([a-zA-Z0-9_-]{1,64}):(-1|\d{1,3})$/.exec(
                    interaction.customId
                )
            if (!match) throw new ReportFailureError("expired")
            const data = await query<Draft | null>("draft", {
                ...scope,
                draftId: match[1],
            })
            if (!data || data.channelId !== interaction.channelId)
                throw new ReportFailureError("expired")
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
            if (result.kind === "open") {
                const thread = await interaction.client.channels
                    .fetch(result.threadId)
                    .catch(() => null)
                await interaction.editReply(
                    editPayload(
                        reportSentView({
                            copy,
                            threadName:
                                thread && "name" in thread && thread.name
                                    ? thread.name
                                    : copy.threadName("…", ""),
                            threadUrl: `https://discord.com/channels/${scope.guildId}/${result.threadId}`,
                        }),
                        kit
                    )
                )
            } else
                await interaction.editReply(
                    editPayload(reportSavedView(copy), kit)
                )
        }
    } catch (error) {
        // Never log report text, provider responses, interaction tokens or raw errors.
        const failure = reportFailureOf(error)
        console.warn("[player-reports] Interaction unavailable", { failure })
        await fail(failure, error)
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
                try {
                    const items = await query<
                        { reportId: string; reporterId: string }[]
                    >("pending", { guildId: guild.id })
                    for (const item of items)
                        await deliverReport(
                            client,
                            { guildId: guild.id, reporterId: item.reporterId },
                            item.reportId
                        )
                } catch {
                    console.warn(
                        "[player-reports] Recovery unavailable; will retry."
                    )
                }
            }
        } finally {
            running = false
        }
    }
    const timer = setInterval(() => void tick(), 30_000)
    timer.unref()
    void tick()
    return () => clearInterval(timer)
}
