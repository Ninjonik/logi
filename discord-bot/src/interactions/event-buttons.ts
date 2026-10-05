import {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    type ButtonInteraction,
    type GuildMember,
    type StringSelectMenuInteraction,
} from "discord.js"

import {
    buildEventSignupActions,
    formatSignupResultMessage,
    getSignupActionEmoji,
    resolveEventSignupSelection,
} from "../../../src/lib/event-signup"
import {
    SIGNUP_GENERAL,
    SIGNUP_NOT_ATTENDING,
    SIGNUP_PRIMARY_GROUP,
    TRAINING_ATTEND,
} from "../constants"
import { getResolvedMemberStatus } from "../../../src/domain/assignments/policy"
import { getClanDiscordMessages } from "../../../src/lib/clan-language"
import { buildRosterAssignmentReply } from "./roster-assignment"
import type { EventInteractionContext } from "../types"
import { convex, references } from "../convex"
import { revalidateAppData } from "../cache"
import { env } from "../environment"
import { logInfo } from "../log"

type InteractionHandlerOptions = {
    enqueueEventSync: (eventId: string) => void
    triggerPollSoon: () => void
}

type SignupInteraction = ButtonInteraction | StringSelectMenuInteraction

async function loadSignupContext(
    interaction: SignupInteraction,
    eventId: string,
    customIdGuildId?: string
) {
    const guildId =
        interaction.guildId ??
        customIdGuildId ??
        (
            (await convex.query(references.getEventInteractionContext, {
                secret: env.internalSecret,
                eventId: eventId as never,
            })) as EventInteractionContext | null
        )?.event.guildId
    if (!guildId) return null
    return (await convex.query(references.getEventSignupContext, {
        secret: env.internalSecret,
        guildId,
        eventId: eventId as never,
    })) as EventInteractionContext | null
}

async function resolveInteractionMember(
    interaction: SignupInteraction,
    guildId: string
) {
    if (interaction.guildId === guildId) {
        return interaction.member as GuildMember | null
    }

    const guild = await interaction.client.guilds
        .fetch(guildId)
        .catch(() => null)
    return guild
        ? await guild.members.fetch(interaction.user.id).catch(() => null)
        : null
}

function buildSignupSelectionRow(
    context: EventInteractionContext,
    member: GuildMember | null,
    userId: string,
    messages: ReturnType<typeof getClanDiscordMessages>
) {
    const assignment = context.assignments?.find(
        (item) => item.userId === userId
    )
    const resolvedMembershipStatus =
        assignment?.type && assignment.status
            ? getResolvedMemberStatus(assignment.type, assignment.status)
            : null
    const membershipStatus =
        resolvedMembershipStatus && resolvedMembershipStatus !== "pending"
            ? resolvedMembershipStatus
            : null
    const available = buildEventSignupActions(
        context.event,
        context.groups,
        messages.buttons
    ).filter(
        (action) =>
            resolveEventSignupSelection({
                event: context.event,
                groups: context.groups,
                memberRoleIds: member ? [...member.roles.cache.keys()] : null,
                assignedGroupIds: assignment
                    ? [
                          assignment.primaryGroupId,
                          ...(assignment.secondaryGroupIds ?? []),
                      ].filter((id): id is string => Boolean(id))
                    : [],
                membershipStatus,
                actionId: action.id,
                labels: messages.interaction,
            }).ok
    )

    return available.length
        ? new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
              new StringSelectMenuBuilder()
                  .setCustomId(
                      `signup:${context.event.id}:select:${context.event.guildId}`
                  )
                  .setPlaceholder(messages.embed.chooseSignup)
                  .addOptions(
                      available.slice(0, 25).map((action) => ({
                          label: action.label.slice(0, 100),
                          value: action.id,
                          ...(getSignupActionEmoji(action.id, available)
                              ? {
                                    emoji: getSignupActionEmoji(
                                        action.id,
                                        available
                                    ),
                                }
                              : {}),
                      }))
                  )
          )
        : null
}

export async function handleEventSignupPickerInteraction(
    interaction: ButtonInteraction
) {
    const [, eventId, customIdGuildId] = interaction.customId.split(":")
    const context = await loadSignupContext(
        interaction,
        eventId ?? "",
        customIdGuildId
    )
    if (!context) {
        await interaction.reply({
            content:
                getClanDiscordMessages("en").interaction
                    .unableToLoadEventContext,
            ephemeral: Boolean(interaction.guildId),
        })
        return
    }
    const member = await resolveInteractionMember(
        interaction,
        context.event.guildId
    )
    const messages = getClanDiscordMessages(context.config.defaultLanguage)
    const selectionRow = buildSignupSelectionRow(
        context,
        member,
        interaction.user.id,
        messages
    )
    if (!selectionRow) {
        await interaction.reply({
            content: messages.interaction.missingRequiredRole,
            ephemeral: Boolean(interaction.guildId),
        })
        return
    }
    await interaction.reply({
        content: messages.embed.chooseSignup,
        components: [selectionRow],
        ephemeral: Boolean(interaction.guildId),
    })
}

export async function handleCheckSignupInteraction(
    interaction: ButtonInteraction
) {
    const [, eventId, customIdGuildId] = interaction.customId.split(":")
    const context = await loadSignupContext(
        interaction,
        eventId ?? "",
        customIdGuildId
    )
    if (!context) {
        await interaction.reply({
            content:
                getClanDiscordMessages("en").interaction
                    .unableToLoadEventContext,
            ephemeral: Boolean(interaction.guildId),
        })
        return
    }

    const messages = getClanDiscordMessages(context.config.defaultLanguage)
    const participant = context.event.participants.find(
        (item) => item.userId === interaction.user.id
    )
    const legacySignup = context.event.signUps.find(
        (item) => item.userId === interaction.user.id
    )
    const signup = participant
        ? participant.status === "attending"
            ? participant
            : null
        : legacySignup?.group === SIGNUP_NOT_ATTENDING
          ? null
          : legacySignup

    if (!signup) {
        await interaction.reply({
            content: messages.interaction.signupStatusNotSignedUp,
            ephemeral: Boolean(interaction.guildId),
        })
        return
    }

    const group = signup.group
    const groupLabel =
        group === SIGNUP_GENERAL || group === TRAINING_ATTEND || !group
            ? messages.embed.attending
            : (context.groups.find((item) => item.id === group)?.name ?? group)
    await interaction.reply({
        content: messages.interaction.signupStatusSignedUp.replace(
            "{group}",
            groupLabel
        ),
        ephemeral: Boolean(interaction.guildId),
    })
}

export async function handleRosterAssignmentInteraction(
    interaction: ButtonInteraction
) {
    const eventId = interaction.customId.replace("roster-assignment:", "")
    const context = (await convex.query(references.getEventInteractionContext, {
        secret: env.internalSecret,
        eventId: eventId as never,
    })) as EventInteractionContext | null
    // The reply can carry the server password, so it must come from the
    // event's own guild and stay private to the player who asked.
    if (
        !context ||
        (interaction.guildId && interaction.guildId !== context.event.guildId)
    ) {
        await interaction.reply({
            content: getClanDiscordMessages(context?.config.defaultLanguage)
                .interaction.unableToLoadEventContext,
            ephemeral: true,
        })
        return
    }
    await interaction.reply({
        ...buildRosterAssignmentReply({
            config: context.config,
            event: context.event,
            roster: context.roster,
            userId: interaction.user.id,
            categoryColor: context.categoryColor,
        }),
        ephemeral: true,
    })
}

const signupInteractionLocks = new Map<string, Promise<void>>()

export async function handleEventButtonInteraction(
    interaction: SignupInteraction,
    options: InteractionHandlerOptions
) {
    const [, eventId, encodedGroupId, customIdGuildId] =
        interaction.customId.split(":")
    const requestedGroupId = interaction.isStringSelectMenu()
        ? (interaction.values[0] ?? "")
        : decodeURIComponent(encodedGroupId ?? "")

    if (
        interaction.isButton() &&
        interaction.customId.startsWith("attendance:")
    ) {
        await interaction.deferReply({
            ephemeral: Boolean(interaction.guildId),
        })
        const context = (await convex.query(
            references.getEventInteractionContext,
            {
                secret: env.internalSecret,
                eventId: eventId as never,
            }
        )) as EventInteractionContext | null

        if (!context) {
            // The reply is already deferred; a second reply would throw.
            await interaction.editReply({
                content:
                    getClanDiscordMessages("en").interaction
                        .unableToLoadEventContext,
            })
            return
        }

        await handleAttendanceInteraction(interaction, context, options)
        return
    }

    const context = await loadSignupContext(
        interaction,
        eventId,
        customIdGuildId
    )
    if (!context) {
        await interaction.reply({
            content:
                getClanDiscordMessages("en").interaction
                    .unableToLoadEventContext,
            ephemeral: Boolean(interaction.guildId),
        })
        return
    }

    const lockKey = `${context.event.guildId}:${eventId}:${interaction.user.id}`
    const previous = signupInteractionLocks.get(lockKey)
    let releaseLock: (() => void) | undefined
    const current = new Promise<void>((resolve) => {
        releaseLock = resolve
    })
    signupInteractionLocks.set(lockKey, current)

    if (previous) {
        await previous.catch(() => undefined)
    }

    try {
        const member = await resolveInteractionMember(
            interaction,
            context.event.guildId
        )
        const messages = getClanDiscordMessages(context.config.defaultLanguage)
        const assignment = context.assignments?.find(
            (item) => item.userId === interaction.user.id
        )
        const candidateGroupIds =
            requestedGroupId === SIGNUP_PRIMARY_GROUP
                ? [
                      ...new Set(
                          [
                              assignment?.primaryGroupId,
                              ...(assignment?.secondaryGroupIds ?? []),
                          ].filter((groupId): groupId is string =>
                              Boolean(groupId)
                          )
                      ),
                  ]
                : [requestedGroupId]
        const resolvedMembershipStatus =
            assignment?.type && assignment.status
                ? getResolvedMemberStatus(assignment.type, assignment.status)
                : null
        const membershipStatus =
            resolvedMembershipStatus && resolvedMembershipStatus !== "pending"
                ? resolvedMembershipStatus
                : null
        const assignedGroupIds = assignment
            ? [
                  assignment.primaryGroupId,
                  ...(assignment.secondaryGroupIds ?? []),
              ].filter((groupId): groupId is string => Boolean(groupId))
            : []
        const labels = {
            registrationClosed: messages.interaction.registrationClosed,
            invalidSignupButton: messages.interaction.invalidSignupButton,
            unableToResolveMembership:
                messages.interaction.unableToResolveMembership,
            missingRequiredRole: messages.interaction.missingRequiredRole,
            membershipStatusNotAllowed:
                messages.interaction.membershipStatusNotAllowed,
            signupUpdated: messages.interaction.signupUpdated,
            markedNotAttending: messages.interaction.markedNotAttending,
        }
        let resolvedGroupId = candidateGroupIds[0] ?? ""
        let resolved: ReturnType<typeof resolveEventSignupSelection> | null =
            null
        let lastError = labels.invalidSignupButton

        for (const candidateGroupId of candidateGroupIds.length > 0
            ? candidateGroupIds
            : [""]) {
            const candidate = resolveEventSignupSelection({
                event: context.event,
                groups: context.groups,
                memberRoleIds: member ? [...member.roles.cache.keys()] : null,
                assignedGroupIds,
                membershipStatus,
                actionId: candidateGroupId,
                labels,
            })
            if (candidate.ok) {
                resolved = candidate
                resolvedGroupId = candidateGroupId
                break
            }
            lastError = candidate.error
        }

        if (!resolved) {
            const selectionRow =
                requestedGroupId === SIGNUP_PRIMARY_GROUP
                    ? buildSignupSelectionRow(
                          context,
                          member,
                          interaction.user.id,
                          messages
                      )
                    : null
            await interaction.reply({
                content: selectionRow
                    ? messages.interaction.noCompatibleSignupGroup
                    : lastError,
                components: selectionRow ? [selectionRow] : [],
                ephemeral: Boolean(interaction.guildId),
            })
            return
        }

        const result = (await convex.mutation(references.toggleSignUp, {
            secret: env.internalSecret,
            eventId: eventId as never,
            userId: interaction.user.id,
            group: resolved.group,
        })) as { appliedSignupLabel: string; removed: boolean }
        await revalidateAppData({
            type: "event-changed",
            serverId: context.event.guildId,
            eventId,
        })

        options.enqueueEventSync(eventId)
        options.triggerPollSoon()
        logInfo("interaction", "Queued event sync after signup change", {
            eventId,
            userId: interaction.user.id,
            guildId: context.event.guildId,
        })

        const actions = buildEventSignupActions(
            context.event,
            context.groups,
            messages.buttons
        )
        const emoji = getSignupActionEmoji(resolvedGroupId, actions)
        const selectionRow =
            requestedGroupId === SIGNUP_PRIMARY_GROUP
                ? buildSignupSelectionRow(
                      context,
                      member,
                      interaction.user.id,
                      messages
                  )
                : null

        await interaction.reply({
            content: [
                formatSignupResultMessage({
                    removed: result.removed,
                    appliedSignupLabel: result.appliedSignupLabel,
                    labels: { ...messages.interaction, ...messages.buttons },
                    emoji,
                }),
                ...(selectionRow
                    ? [messages.interaction.changeSignupSelection]
                    : []),
            ].join("\n"),
            ...(selectionRow ? { components: [selectionRow] } : {}),
            ephemeral: Boolean(interaction.guildId),
        })
    } finally {
        releaseLock?.()
        if (signupInteractionLocks.get(lockKey) === current) {
            signupInteractionLocks.delete(lockKey)
        }
    }
}

async function handleAttendanceInteraction(
    interaction: ButtonInteraction,
    context: EventInteractionContext,
    options: InteractionHandlerOptions
) {
    const messages = getClanDiscordMessages(context.config.defaultLanguage)

    if (context.event.status !== "starting") {
        await interaction.editReply({
            content: messages.interaction.attendanceNotOpen,
        })
        return
    }
    if (!context.roster?.published) {
        await interaction.editReply({
            content: messages.interaction.rosterNotPublished,
        })
        return
    }

    const isOnRoster =
        context.roster.squads.some((squad) =>
            squad.players.some((player) => player.id === interaction.user.id)
        ) || context.roster.reservePlayerIds.includes(interaction.user.id)
    if (!isOnRoster) {
        await interaction.editReply({
            content: messages.interaction.notOnRoster,
        })
        return
    }

    await convex.mutation(references.acknowledgeAttendance, {
        secret: env.internalSecret,
        guildId: context.event.guildId,
        eventId: context.event.id as never,
        userId: interaction.user.id,
    })
    if (context.roster) {
        await revalidateAppData({
            type: "roster-changed",
            serverId: context.event.guildId,
            rosterId: context.roster.id,
            eventId: context.event.id,
        })
    } else {
        await revalidateAppData({
            type: "event-changed",
            serverId: context.event.guildId,
            eventId: context.event.id,
        })
    }

    options.enqueueEventSync(context.event.id)
    options.triggerPollSoon()
    logInfo(
        "interaction",
        "Queued event sync after attendance acknowledgement",
        {
            eventId: context.event.id,
            userId: interaction.user.id,
            guildId: interaction.guildId,
        }
    )

    await interaction.editReply({
        content: messages.interaction.attendanceAcknowledged,
    })
}
