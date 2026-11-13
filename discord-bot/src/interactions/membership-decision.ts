import {
    LabelBuilder,
    MessageFlags,
    ModalBuilder,
    TextDisplayBuilder,
    TextInputBuilder,
    TextInputStyle,
    type ButtonInteraction,
    type ChatInputCommandInteraction,
    type Guild,
    type ModalSubmitInteraction,
    type ThreadChannel,
    type Client,
} from "discord.js"

import {
    APPLICATION_DECISION_PREFIX,
    APPLICATION_REJECT_PREFIX,
    applicationCardView,
    applicationDecidedCardView,
    applicationDecisionDmView,
    closeApplicationReplyView,
    decisionErrors,
} from "../../../src/domain/membership/application-views"
import {
    isApplicationOutcome,
    mercenaryCategoryFor,
    type ApplicationOutcome,
    type AssignmentType,
} from "../../../src/domain/membership/application-decision"
import {
    decideApplication,
    type DecideApplicationResult,
} from "../../../src/application/membership/decide-application"
import {
    unknownErrorCard,
    type MessageView,
} from "../../../src/domain/discord-messages/message-view"
import { isMessageEnabled } from "../../../src/domain/discord-messages/notification-settings"
import { syncsMembershipRoles } from "../../../src/domain/membership/membership-options"
import { getApplicationMessages } from "../../../src/lib/clan-language/application"
import { fillTemplate } from "../../../src/domain/discord-messages/format"
import { getSystemMessages } from "../../../src/lib/clan-language/system"

import {
    applicationRefs,
    claimApplicationDecision,
    loadApplicationThreadContext,
    markApplicationUndecided,
    releaseApplicationDecision,
    type ApplicationThreadContext,
} from "./membership-application-store"
import {
    editPayload,
    interactionReplyPayload,
    messagePayload,
    type MessageKitOptions,
} from "../ui/message-kit"
import { checkCloseAuthority, type CloseAuthority } from "./close-authority"
import { applicationStateCache } from "./membership-application-cache"
import { replyPrivately, reportToErrorsChannel } from "../ui/replies"
import { missingDiscordResource } from "../runtime/discord-resource"
import { MembershipEffects } from "../runtime/membership-effects"
import { threadUrl } from "./membership-application-create"
import { dmSettingsUrl } from "../events/match-context"
import type { InteractionFeature } from "./registry"
import { clanReplyKit } from "../runtime/clan-kit"
import { revalidateAppData } from "../cache"
import { env } from "../environment"
import { convex } from "../convex"
import { logWarn } from "../log"

/**
 * Decisions on an application (L6-45..L6-51, L4-30..L4-34, M3-37..M3-43):
 * the five buttons on the thread card, the "Zamítnutí…" reason window and
 * `/close_application`. Everyone in the thread sees the buttons; a click is
 * checked freshly against Discord (category support or Logi admins), the
 * same check as `/close_ticket` (M3-04).
 */

const REJECT_REASON = "reason"

type Decider = { id: string; name: string }

function kitOf(context: ApplicationThreadContext) {
    return {
        language: context.config.defaultLanguage,
        style: context.config.messageStyle,
    }
}

const membersUrl = (context: ApplicationThreadContext) =>
    context.guildRecordId
        ? `${env.appSiteUrl}/${context.config.defaultLanguage}/dashboard/servers/${context.guildRecordId}/users`
        : undefined

const categoryLabelOf = (context: ApplicationThreadContext) =>
    context.category?.label?.trim() || context.application.categoryLabel

const applicantNameOf = (context: ApplicationThreadContext) =>
    context.application.applicantName?.trim() ||
    context.application.inGameName?.trim() ||
    `#${context.application.applicationNumber}`

/**
 * The clan's mercenary category for "Přijmout jako žoldáka" (L6-B08): the
 * role it grants is that category's, never the applicant's member category.
 */
export function mercenaryCategoryOf(context: ApplicationThreadContext) {
    const application = context.application
    return mercenaryCategoryFor(
        context.config.membershipSettings?.categories ?? [],
        {
            categoryId: application.categoryId,
            gameId: application.gameId ?? "hell_let_loose",
            games: application.games,
        }
    )
}

function roleNames(guild: Guild, roleIds: readonly string[]) {
    return roleIds
        .map((roleId) => guild.roles.cache.get(roleId)?.name)
        .filter((name): name is string => Boolean(name))
}

/** The card as it stands while undecided, for an edit in place (L6-49). */
function openCardView(context: ApplicationThreadContext): MessageView {
    const application = context.application
    const copy = getApplicationMessages(context.config.defaultLanguage)
    return applicationCardView(copy, {
        number: application.applicationNumber,
        games: application.games ?? [application.gameId ?? "hell_let_loose"],
        applicantId: application.creatorId,
        applicantName: applicantNameOf(context),
        categoryLabel: categoryLabelOf(context),
        submittedAt: application.openedAt,
        timeZone: context.config.timezone || "UTC",
        inGameName: application.inGameName,
        accounts: application.accounts ?? { steamVerified: false },
        answers: application.answers.map((answer) => ({
            questionId: answer.questionId,
            kind: answer.kind ?? "custom",
            label: answer.label,
            value: answer.value,
        })),
        supportRoleIds: context.category?.supportRoleIds ?? [],
        mercenaryAvailable: mercenaryCategoryOf(context) !== null,
        undecided:
            application.undecidedAt && application.undecidedByName
                ? {
                      name: application.undecidedByName,
                      at: application.undecidedAt,
                  }
                : undefined,
    })
}

type DecisionTarget = {
    guild: Guild
    thread: ThreadChannel
    decider: Decider
    /** Edits the card in place; false when the decision should be posted instead. */
    editCard(view: MessageView): Promise<boolean>
}

/** Runs one decision with the shared use case and Discord as its ports. */
async function runDecision(
    context: ApplicationThreadContext,
    target: DecisionTarget,
    outcome: ApplicationOutcome,
    reason: string | undefined,
    committed = false,
    assertRecovery?: () => Promise<void>
): Promise<DecideApplicationResult> {
    const { guild, thread, decider } = target
    const application = context.application
    const copy = getApplicationMessages(context.config.defaultLanguage)
    const options = kitOf(context)
    const secret = env.internalSecret
    const settings = context.config.membershipSettings
    const category = context.category
    const categoryType: AssignmentType =
        context.assignment?.type ??
        category?.assignmentType ??
        application.assignmentType
    const decidedAt = application.closedAt ?? new Date().toISOString()
    const mercenary = mercenaryCategoryOf(context)
    const applicationGame = application.gameId ?? "hell_let_loose"
    let assignmentId = application.assignmentId
    let decidedGame: string = application.decisionGameId ?? applicationGame
    let decisionClaimToken: string | undefined
    const effects = new MembershipEffects(
        {
            expectedKeys: [
                "decision-card",
                "rename",
                "lock",
                "archive",
                ...(isMessageEnabled(context.config, "applicationCloseDm")
                    ? [`dm:${application.creatorId}`]
                    : []),
            ],
            key: `application-close:${application.threadId}`,
            kind: "application-close",
            guildId: guild.id,
            subjectId: application.threadId,
            actorId: decider.id,
        },
        undefined,
        assertRecovery
    )

    const result = await decideApplication(
        {
            claim: async () => {
                if (committed) return "ok"
                const claim = await claimApplicationDecision(
                    application.threadId
                )
                if (claim.ok) {
                    if (!claim.claimToken)
                        throw new Error(
                            "Decision claim requires the updated backend"
                        )
                    decisionClaimToken = claim.claimToken
                }
                return claim.ok ? "ok" : claim.reason
            },
            release: () => {
                if (!decisionClaimToken)
                    throw new Error("Decision claim token missing")
                return releaseApplicationDecision(
                    application.threadId,
                    decisionClaimToken
                )
            },
            commit: async () => {
                if (committed) return
                if (!decisionClaimToken)
                    throw new Error("Decision claim token missing")
                const committedResponse = (await convex.mutation(
                    applicationRefs.commitDecision,
                    {
                        secret,
                        threadId: application.threadId,
                        claimToken: decisionClaimToken,
                        actorId: decider.id,
                        outcome,
                        reason,
                    }
                )) as { assignmentId: string | null; gameId: string }
                assignmentId = committedResponse.assignmentId ?? undefined
                decidedGame = committedResponse.gameId
                await revalidateAppData({
                    type: "assignment-changed",
                    serverId: guild.id,
                    userId: application.creatorId,
                    assignmentId: assignmentId ?? "",
                })
            },
            showDecision: async (roles) => {
                const view = applicationDecidedCardView(copy, {
                    number: application.applicationNumber,
                    applicantName: applicantNameOf(context),
                    outcome,
                    deciderId: decider.id,
                    decidedAt,
                    timeZone: context.config.timezone || "UTC",
                    reason,
                    rolesAfter: roles.after,
                    rolesAdded: roles.added,
                    rolesRemoved: roles.removed,
                })
                await effects.effect("decision-card", "send", async () => {
                    if (await target.editCard(view)) return
                    return thread.send(messagePayload(view, options))
                })
            },
            sendDm: async (roles) => {
                // "DM po rozhodnutí o přihlášce" in Zprávy a panely (N1-39).
                if (!isMessageEnabled(context.config, "applicationCloseDm")) {
                    const receipt = await effects.skip(
                        `dm:${application.creatorId}`
                    )
                    return receipt.state === "uncertain"
                        ? "uncertain"
                        : receipt.state === "confirmed"
                          ? "sent"
                          : receipt.state === "refused"
                            ? "failed"
                            : "off"
                }
                const creator = await guild.client.users.fetch(
                    application.creatorId
                )
                if (!creator) return "failed"
                const ticketChannel = context.ticketChannelId
                    ? guild.channels.cache.get(context.ticketChannelId)
                    : undefined
                const receipt = await effects.effect(
                    `dm:${application.creatorId}`,
                    "send",
                    () =>
                        creator.send(
                            messagePayload(
                                applicationDecisionDmView(copy, {
                                    clanName: context.clanName || guild.name,
                                    number: application.applicationNumber,
                                    outcome,
                                    gameId: decidedGame,
                                    reason,
                                    // Mentions do not render outside the server (L2-B13).
                                    roleNames: roleNames(guild, roles.after),
                                    threadUrl: threadUrl(guild.id, thread.id),
                                    ticketChannelName:
                                        ticketChannel?.name ?? null,
                                    settingsUrl: dmSettingsUrl(
                                        context.config.defaultLanguage
                                    ),
                                }),
                                options
                            )
                        ),
                    true
                )
                return receipt.state === "confirmed"
                    ? "sent"
                    : receipt.state === "skipped"
                      ? "off"
                      : "failed"
            },
            finishThread: async () => {
                const auditReason = reason ?? copy.card.closedFooter
                const failures: unknown[] = []
                {
                    const name = thread.name.startsWith(
                        fillTemplate(copy.closedThreadName, { name: "" })
                    )
                        ? thread.name
                        : fillTemplate(copy.closedThreadName, {
                              name: thread.name,
                          }).slice(0, 100)
                    await effects
                        .effect(
                            "rename",
                            "reconcile",
                            async () => {
                                if (thread.name !== name)
                                    await thread.setName(name)
                            },
                            false,
                            {
                                threadId: thread.id,
                                action: "rename",
                                value: name,
                            }
                        )
                        .catch((error) => failures.push(error))
                }
                await effects
                    .effect(
                        "lock",
                        "reconcile",
                        async () => {
                            await thread.setLocked(true, auditReason)
                        },
                        false,
                        { threadId: thread.id, action: "lock" }
                    )
                    .catch((error) => failures.push(error))
                await effects
                    .effect(
                        "archive",
                        "reconcile",
                        async () => {
                            await thread.setArchived(true, auditReason)
                        },
                        false,
                        { threadId: thread.id, action: "archive" }
                    )
                    .catch((error) => failures.push(error))
                if (failures.length)
                    throw new Error(
                        "Application thread reconciliation incomplete"
                    )
            },
            report: (step, error) => {
                // A closed DM is the applicant's choice, not an admin's to fix;
                // the decider's reply says so (L4-34).
                if (step === "dm") {
                    logWarn(
                        "membership-recovery",
                        "Decision DM remains unconfirmed",
                        { guildId: guild.id, threadId: thread.id, error }
                    )
                    return
                }
                void reportToErrorsChannel({
                    client: guild.client,
                    guildId: guild.id,
                    error,
                    source:
                        step === "card"
                            ? "applicationIntro"
                            : "applicationRename",
                    channelId: thread.parentId ?? undefined,
                    userId: application.creatorId,
                    categoryLabel: application.categoryLabel,
                    number: application.applicationNumber,
                })
            },
        },
        {
            outcome,
            categoryType,
            before: context.assignment?.status ?? null,
            mercenaryCategory: mercenary,
            policy: {
                clanRoleId: context.config.clanRoleId,
                roleSync: syncsMembershipRoles(settings),
                category: {
                    recruitRoleIds: category?.recruitRoleIds ?? [],
                    finalRoleIds: category?.finalRoleIds ?? [],
                    includeClanRoleForRecruit:
                        category?.includeClanRoleForRecruit,
                    includeClanRoleForFinal: category?.includeClanRoleForFinal,
                },
                mercenaryCategory: mercenary,
            },
        }
    )
    // The panel opens from a short-lived applicant cache to meet Discord's
    // interaction deadline. A decision changes both its open-application and
    // membership facts, so never let that stale snapshot block a reapplication.
    if (result.status === "decided") {
        applicationStateCache.forget(guild.id, application.creatorId)
        await effects.complete()
    }
    return result
}

/** Replays only effects of a committed decision; it never changes membership. */
export async function resumeApplicationDecision(
    client: Client,
    threadId: string,
    actorId: string,
    assertRecovery?: () => Promise<void>
) {
    const context = await loadApplicationThreadContext(threadId)
    if (
        !context ||
        context.application.status !== "closed" ||
        context.application.closedByUserId !== actorId ||
        !isApplicationOutcome(context.application.closeOutcome)
    )
        throw new Error("Committed application decision not found")
    const guild = await client.guilds.fetch(context.application.guildId)
    const thread = await guild.channels.fetch(threadId)
    if (!thread?.isThread() || thread.ownerId !== client.user?.id)
        throw new Error("Application thread ownership could not be verified")
    const actor = await client.users.fetch(actorId)
    const options = kitOf(context)
    return runDecision(
        context,
        {
            guild,
            thread,
            decider: { id: actorId, name: actor.globalName ?? actor.username },
            editCard: async (view) => {
                const id = context.application.transcriptMessageId
                const card = id
                    ? await thread.messages
                          .fetch(id)
                          .catch(missingDiscordResource(10008))
                    : null
                if (!card) return false
                if (card.author.id !== client.user?.id)
                    throw new Error("Application card ownership mismatch")
                await card.edit(editPayload(view, options))
                return true
            },
        },
        context.application.closeOutcome,
        context.application.closeReason,
        true,
        assertRecovery
    )
}

type Gate =
    | {
          ok: true
          context: ApplicationThreadContext
          thread: ThreadChannel
          guild: Guild
      }
    | { ok: false; view: MessageView; kit: MessageKitOptions }

/** The thread, its application and a fresh role check (L6-51, M3-B05). */
async function decisionGate(
    interaction:
        | ButtonInteraction
        | ModalSubmitInteraction
        | ChatInputCommandInteraction,
    command: boolean
): Promise<Gate> {
    // Before the application is known: the clan's language and colour (M3-06).
    const early = await clanReplyKit(interaction.guildId)
    const fallback = getApplicationMessages(early.language)
    const channel = interaction.channel
    if (!interaction.guild || !channel?.isThread())
        return {
            ok: false,
            view: command
                ? decisionErrors.wrongPlace(fallback)
                : decisionErrors.notTracked(fallback),
            kit: early,
        }
    const context = await loadApplicationThreadContext(channel.id)
    if (!context)
        return {
            ok: false,
            view: command
                ? decisionErrors.wrongPlace(fallback)
                : decisionErrors.notTracked(fallback),
            kit: early,
        }
    const copy = getApplicationMessages(context.config.defaultLanguage)
    const application = context.application
    if (application.status === "closed")
        return {
            ok: false,
            view: decisionErrors.alreadyDecided(copy, {
                number: application.applicationNumber,
                deciderId: application.closedByUserId,
                outcome: isApplicationOutcome(application.closeOutcome)
                    ? application.closeOutcome
                    : application.closeOutcome === "reserve_member"
                      ? "member"
                      : undefined,
                membersUrl: membersUrl(context),
                command,
            }),
            kit: kitOf(context),
        }
    const authority: CloseAuthority = await checkCloseAuthority(
        interaction.guild,
        interaction.user.id,
        {
            dashboardAdminRoleId: context.config.dashboardAdminRoleId,
            supportRoleIds: context.category?.supportRoleIds,
        }
    )
    if (authority !== "allowed")
        return {
            ok: false,
            view:
                authority === "denied"
                    ? decisionErrors.notAllowed(copy, {
                          categoryLabel: categoryLabelOf(context),
                          supportRoleIds:
                              context.category?.supportRoleIds ?? [],
                          title: command
                              ? copy.command.notAllowedTitle
                              : undefined,
                      })
                    : decisionErrors.unverifiable(copy),
            kit: kitOf(context),
        }
    return { ok: true, context, thread: channel, guild: interaction.guild }
}

function deciderOf(
    interaction:
        ButtonInteraction | ModalSubmitInteraction | ChatInputCommandInteraction
): Decider {
    const member = interaction.member
    const displayName =
        member &&
        "displayName" in member &&
        typeof member.displayName === "string"
            ? member.displayName
            : undefined
    return {
        id: interaction.user.id,
        name:
            displayName ??
            interaction.user.globalName ??
            interaction.user.username,
    }
}

/** The reason window of "Zamítnout…" (L6-47). */
export function buildRejectModal(context: ApplicationThreadContext) {
    const copy = getApplicationMessages(context.config.defaultLanguage)
    const name = applicantNameOf(context)
    return new ModalBuilder()
        .setCustomId(
            `${APPLICATION_REJECT_PREFIX}${context.application.threadId}`
        )
        .setTitle(
            fillTemplate(copy.rejectModal.title, {
                number: String(context.application.applicationNumber),
            }).slice(0, 45)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                fillTemplate(copy.rejectModal.body, { name })
            )
        )
        .addLabelComponents(
            new LabelBuilder()
                .setLabel(copy.rejectModal.reason)
                .setDescription(copy.rejectModal.reasonHelp)
                .setTextInputComponent(
                    new TextInputBuilder()
                        .setCustomId(REJECT_REASON)
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true)
                        .setMaxLength(500)
                        .setPlaceholder(copy.rejectModal.reasonPlaceholder)
                )
        )
}

async function replyGate(
    interaction:
        | ButtonInteraction
        | ModalSubmitInteraction
        | ChatInputCommandInteraction,
    gate: Extract<Gate, { ok: false }>
) {
    await replyPrivately(interaction, gate.view, gate.kit)
}

/** The five buttons on the card (L6-45). */
export async function handleDecisionButton(interaction: ButtonInteraction) {
    const action = interaction.customId.slice(
        APPLICATION_DECISION_PREFIX.length
    )
    const gate = await decisionGate(interaction, false)
    if (!gate.ok) {
        await replyGate(interaction, gate)
        return
    }
    const { context, thread, guild } = gate
    const options = kitOf(context)
    if (action === "reject") {
        await interaction.showModal(buildRejectModal(context))
        return
    }
    if (action === "undecided") {
        const decider = deciderOf(interaction)
        const marked = await markApplicationUndecided({
            threadId: thread.id,
            userId: decider.id,
            name: decider.name,
        })
        if (!marked.ok) {
            await interaction.deferUpdate()
            return
        }
        // Who and when only; the thread stays open and nothing is sent (L6-49).
        await interaction.update(
            editPayload(
                openCardView({
                    ...context,
                    application: {
                        ...context.application,
                        undecidedByUserId: decider.id,
                        undecidedByName: decider.name,
                        undecidedAt: marked.at,
                    },
                }),
                options
            )
        )
        return
    }
    if (action !== "member" && action !== "recruit" && action !== "mercenary")
        return
    // A card posted before the clan removed its mercenary category.
    if (action === "mercenary" && !mercenaryCategoryOf(context)) {
        await replyPrivately(
            interaction,
            decisionErrors.noMercenaryCategory(
                getApplicationMessages(context.config.defaultLanguage)
            ),
            options
        )
        return
    }
    await interaction.deferUpdate()
    const result = await safeDecision(interaction, context, () =>
        runDecision(
            context,
            {
                guild,
                thread,
                decider: deciderOf(interaction),
                editCard: async (view) => {
                    await interaction.editReply(editPayload(view, options))
                    return true
                },
            },
            action,
            undefined
        )
    )
    if (result) await reportDecisionResult(interaction, context, result)
}

/**
 * After `deferUpdate` the card is the interaction's message: a thrown error
 * must not reach the generic error path, which could remove that message.
 * The decider gets the private unknown-error card instead.
 */
async function safeDecision(
    interaction: ButtonInteraction | ModalSubmitInteraction,
    context: ApplicationThreadContext,
    run: () => Promise<DecideApplicationResult>
) {
    try {
        return await run()
    } catch (error) {
        void reportToErrorsChannel({
            client: interaction.client,
            guildId: interaction.guildId,
            error,
            source: "general",
            categoryLabel: context.application.categoryLabel,
            number: context.application.applicationNumber,
        })
        const copy = getSystemMessages(context.config.defaultLanguage).errors
        await interaction
            .followUp(
                interactionReplyPayload(
                    unknownErrorCard({
                        title: copy.unknownTitle,
                        body: copy.unknownBody,
                    }),
                    kitOf(context)
                )
            )
            .catch(() => null)
        return null
    }
}

/** The reason window of "Zamítnout…" sent. */
export async function handleRejectModal(interaction: ModalSubmitInteraction) {
    const gate = await decisionGate(interaction, false)
    if (!gate.ok) {
        await replyGate(interaction, gate)
        return
    }
    const { context, thread, guild } = gate
    const options = kitOf(context)
    const reason =
        interaction.fields.getTextInputValue(REJECT_REASON).trim() || undefined
    const fromCard =
        interaction.isFromMessage() &&
        interaction.message.id === context.application.transcriptMessageId
    if (fromCard) await interaction.deferUpdate()
    else await interaction.deferReply({ flags: MessageFlags.Ephemeral })
    const result = await safeDecision(interaction, context, () =>
        runDecision(
            context,
            {
                guild,
                thread,
                decider: deciderOf(interaction),
                editCard: async (view) => {
                    if (!fromCard) return false
                    await interaction.editReply(editPayload(view, options))
                    return true
                },
            },
            "denied",
            reason
        )
    )
    if (result) await reportDecisionResult(interaction, context, result)
}

/** A busy, closed or undeliverable outcome is told privately to the decider. */
async function reportDecisionResult(
    interaction: ButtonInteraction | ModalSubmitInteraction,
    context: ApplicationThreadContext,
    result: DecideApplicationResult
) {
    const copy = getApplicationMessages(context.config.defaultLanguage)
    const options = kitOf(context)
    if (result.status === "decided") {
        if (result.dm === "failed" || result.dm === "uncertain")
            await interaction.followUp(
                interactionReplyPayload(
                    {
                        accent: "clan",
                        ephemeral: true,
                        blocks: [
                            {
                                kind: "text",
                                markdown:
                                    result.dm === "uncertain"
                                        ? copy.command.dmUncertain
                                        : copy.decision.dmFailed,
                            },
                        ],
                    },
                    options
                )
            )
        else if (interaction.deferred && interaction.ephemeral)
            await interaction.deleteReply().catch(() => null)
        return
    }
    if (result.status === "no-mercenary-category") {
        await interaction.followUp(
            interactionReplyPayload(
                decisionErrors.noMercenaryCategory(copy),
                options
            )
        )
        return
    }
    const fresh = await loadApplicationThreadContext(
        context.application.threadId
    )
    await interaction.followUp(
        interactionReplyPayload(
            decisionErrors.alreadyDecided(copy, {
                number: context.application.applicationNumber,
                deciderId: fresh?.application.closedByUserId,
                outcome: isApplicationOutcome(fresh?.application.closeOutcome)
                    ? fresh?.application.closeOutcome
                    : undefined,
                membersUrl: membersUrl(context),
            }),
            options
        )
    )
}

/** `/close_application`, the backup with the same outcomes and check (L6-B09). */
export async function handleCloseApplicationCommand(
    interaction: ChatInputCommandInteraction
) {
    const gate = await decisionGate(interaction, true)
    if (!gate.ok) {
        await replyGate(interaction, gate)
        return
    }
    const { context, thread, guild } = gate
    const options = kitOf(context)
    const copy = getApplicationMessages(context.config.defaultLanguage)
    const raw = interaction.options.getString("outcome", true)
    const outcome: ApplicationOutcome = isApplicationOutcome(raw)
        ? raw
        : "pending"
    const reason = interaction.options.getString("reason")?.trim() || undefined
    await interaction.deferReply({ flags: MessageFlags.Ephemeral })
    if (outcome === "mercenary" && !mercenaryCategoryOf(context)) {
        await interaction.editReply(
            editPayload(decisionErrors.noMercenaryCategory(copy), options)
        )
        return
    }
    const result = await runDecision(
        context,
        {
            guild,
            thread,
            decider: deciderOf(interaction),
            // A thread made with the windows has a card to edit; older ones get a new message.
            editCard: async (view) => {
                const cardId = context.application.transcriptMessageId
                const card = cardId
                    ? await thread.messages
                          .fetch(cardId)
                          .catch(missingDiscordResource(10008))
                    : null
                if (
                    !card ||
                    !card.flags.has(MessageFlags.IsComponentsV2) ||
                    card.author.id !== guild.client.user?.id
                )
                    return false
                await card.edit(editPayload(view, options))
                return true
            },
        },
        outcome,
        reason
    )
    if (result.status === "no-mercenary-category") {
        await interaction.editReply(
            editPayload(decisionErrors.noMercenaryCategory(copy), options)
        )
        return
    }
    if (result.status !== "decided") {
        const fresh = await loadApplicationThreadContext(thread.id)
        await interaction.editReply(
            editPayload(
                decisionErrors.alreadyDecided(copy, {
                    number: context.application.applicationNumber,
                    outcome: isApplicationOutcome(
                        fresh?.application.closeOutcome
                    )
                        ? fresh?.application.closeOutcome
                        : undefined,
                    membersUrl: membersUrl(context),
                    command: true,
                }),
                options
            )
        )
        return
    }
    await interaction.editReply(
        editPayload(
            closeApplicationReplyView(copy, {
                number: context.application.applicationNumber,
                outcome,
                applicantName: applicantNameOf(context),
                addedRoleNames: roleNames(guild, result.roles.added),
                dm: result.dm,
            }),
            options
        )
    )
}

export const membershipDecisionInteractions: InteractionFeature = {
    name: "membership-decision",
    register(registry) {
        registry
            .button(APPLICATION_DECISION_PREFIX, handleDecisionButton)
            .modal(APPLICATION_REJECT_PREFIX, handleRejectModal)
            .command("close_application", handleCloseApplicationCommand)
    },
}
