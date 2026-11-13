import { ChannelType, type Guild, type TextChannel } from "discord.js"

import {
    submitApplication,
    type SubmitApplicationResult,
    type SubmitApplicationStep,
} from "../../../src/application/membership/submit-application"
import {
    applicationCardView,
    applicationConfirmationDmView,
} from "../../../src/domain/membership/application-views"
import { mercenaryCategoryFor } from "../../../src/domain/membership/application-decision"
import type { BotErrorSource } from "../../../src/domain/discord-messages/bot-errors"
import { getApplicationMessages } from "../../../src/lib/clan-language/application"
import { fillTemplate } from "../../../src/domain/discord-messages/format"

import {
    applicationRefs,
    type ApplicationSubmission,
} from "./membership-application-store"
import {
    MembershipEffects,
    MembershipEffectLeaseLost,
} from "../runtime/membership-effects"
import { buildMembershipApplicationWelcomeContent } from "./membership-welcome"
import { missingDiscordResource } from "../runtime/discord-resource"
import { dmSettingsUrl } from "../events/match-context"
import { reportToErrorsChannel } from "../ui/replies"
import { messagePayload } from "../ui/message-kit"
import { resolveSupportMemberIds } from "./shared"
import { revalidateAppData } from "../cache"
import { env } from "../environment"
import { convex } from "../convex"
import { logWarn } from "../log"

/**
 * Creates the application's private thread with its intro and card after
 * the final submit (L6-41..L6-46, L6-B04), for the Discord windows and the
 * web form alike.
 */

export type Applicant = {
    id: string
    name: string
    tag: string
    avatar: string
}

/** "přihláška-hráč-17": the thread name of an applicant. */
export function applicationThreadName(template: string, applicantName: string) {
    const slug =
        applicantName
            .normalize("NFC")
            .toLocaleLowerCase()
            .replace(/[^\p{L}\p{N}]+/gu, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 80) || "hrac"
    return fillTemplate(template, { name: slug }).slice(0, 100)
}

export const threadUrl = (guildId: string, threadId: string) =>
    `https://discord.com/channels/${guildId}/${threadId}`

/** The original applicant is the only confirmation recipient, including on resume. */
export async function completeApplicationOpening(input: {
    guild: Guild
    applicantId: string
    submission: ApplicationSubmission
    number: number
    threadId: string
    assertRecovery?: () => Promise<void>
}) {
    const { guild, applicantId, submission, number, threadId } = input
    const effects = new MembershipEffects(
        {
            key: `application-open:${submission.draftId}`,
            kind: "application-open",
            guildId: guild.id,
            subjectId: submission.draftId,
            actorId: applicantId,
        },
        undefined,
        input.assertRecovery
    )
    if (submission.config.membershipSettings?.sendConfirmationDm !== false) {
        const member = await guild.members.fetch({
            user: applicantId,
            force: true,
        })
        await effects
            .effect(
                `confirmation-dm:${applicantId}`,
                "send",
                () =>
                    member.send(
                        messagePayload(
                            applicationConfirmationDmView(
                                getApplicationMessages(
                                    submission.config.defaultLanguage
                                ),
                                {
                                    clanName: submission.clanName || guild.name,
                                    number,
                                    threadUrl: threadUrl(guild.id, threadId),
                                    settingsUrl: dmSettingsUrl(
                                        submission.config.defaultLanguage
                                    ),
                                }
                            ),
                            {
                                language: submission.config.defaultLanguage,
                                style: submission.config.messageStyle,
                            }
                        )
                    ),
                true
            )
            .catch((error) =>
                logWarn(
                    "membership-recovery",
                    "Application confirmation retained for reconciliation",
                    { guildId: guild.id, error }
                )
            )
    } else await effects.skip(`confirmation-dm:${applicantId}`)
    await effects.complete()
}

/** The errors-channel entry of each failed step (board L5 1.1). */
const SUBMIT_STEP_SOURCES: Record<SubmitApplicationStep, BotErrorSource> = {
    assignment: "applicationOpen",
    thread: "applicationOpen",
    record: "applicationOpen",
    members: "applicationRecruiters",
    intro: "applicationIntro",
    card: "applicationIntro",
    accounts: "general",
}

export async function createApplicationThread(input: {
    guild: Guild
    applicant: Applicant
    submission: ApplicationSubmission
    resume?: { assignmentId: string }
    assertRecovery?: () => Promise<void>
}): Promise<SubmitApplicationResult> {
    const { guild, applicant, submission } = input
    const config = submission.config
    const settings = config.membershipSettings
    const category = submission.category
    const copy = getApplicationMessages(config.defaultLanguage)
    const secret = env.internalSecret
    const report = (step: SubmitApplicationStep, error: unknown) =>
        void reportToErrorsChannel({
            client: guild.client,
            guildId: guild.id,
            error,
            source: SUBMIT_STEP_SOURCES[step],
            channelId: settings?.applicationParentChannelId,
            userId: applicant.id,
            categoryLabel: category.label?.trim() || category.id,
        })
    let thread: Awaited<ReturnType<TextChannel["threads"]["create"]>> | null =
        null
    let assignment: string | null = null
    const supportRoleIds = category.supportRoleIds ?? []
    const mentionRoles = settings?.mentionSupportRoles !== false
    const effects = new MembershipEffects(
        {
            expectedKeys: [
                "thread",
                "members",
                "intro",
                "card",
                "store-card",
                "accounts",
                ...(settings?.sendConfirmationDm === false
                    ? []
                    : [`confirmation-dm:${applicant.id}`]),
            ],
            requestJson: JSON.stringify({
                applicant,
                source: submission.source,
                categoryId: category.id,
                gameId: category.gameId ?? "hell_let_loose",
                games: submission.games,
                inGameName: submission.inGameName,
                accounts: submission.accounts,
                answers: submission.answers,
                initialStatus: submission.initialStatus,
            }),
            key: `application-open:${submission.draftId}`,
            kind: "application-open",
            guildId: guild.id,
            subjectId: submission.draftId,
            actorId: applicant.id,
        },
        undefined,
        input.assertRecovery
    )

    return await submitApplication({
        createAssignment: async () => {
            await input.assertRecovery?.()
            if (input.resume) {
                assignment = input.resume.assignmentId
                return assignment
            }
            assignment = (await convex.mutation(
                applicationRefs.prepareSubmission,
                {
                    secret,
                    draftId: submission.draftId,
                    claimToken: submission.claimToken,
                }
            )) as string
            await revalidateAppData({
                type: "assignment-changed",
                serverId: guild.id,
                userId: applicant.id,
                assignmentId: assignment,
            })
            return assignment
        },
        createThread: async () => {
            const parentId = settings?.applicationParentChannelId
            const parent = parentId
                ? await guild.channels
                      .fetch(parentId)
                      .catch(missingDiscordResource(10003))
                : null
            if (!parent || parent.type !== ChannelType.GuildText)
                throw new Error(
                    "The application thread channel is not a text channel."
                )
            const receipt = await effects.effect("thread", "send", async () => {
                thread = await (parent as TextChannel).threads.create({
                    name: applicationThreadName(
                        copy.threadName,
                        applicant.name
                    ),
                    autoArchiveDuration: 10080,
                    type: ChannelType.PrivateThread,
                    invitable: false,
                    reason: `Application ${category.id} by ${applicant.tag}`,
                })
                return { id: thread.id }
            })
            if (!thread && receipt.resourceId) {
                const recovered = await guild.channels.fetch(receipt.resourceId)
                if (!recovered?.isThread())
                    throw new Error(
                        "Remembered application thread is unavailable"
                    )
                if (
                    recovered.ownerId !== guild.client.user?.id ||
                    recovered.parentId !== parent.id
                )
                    throw new Error(
                        "Remembered application thread ownership or parent mismatch"
                    )
                thread = recovered
            }
            if (!thread)
                throw new Error(
                    "Application thread outcome requires reconciliation"
                )
            return { id: thread.id }
        },
        addMembers: async (threadId) => {
            if (!thread || thread.id !== threadId) return
            const activeThread = thread
            await effects.effect("members", "reconcile", async () => {
                if (
                    settings?.inviteSupportMembersIndividually !== false &&
                    supportRoleIds.length
                )
                    await guild.members.fetch()
                const support =
                    settings?.inviteSupportMembersIndividually === false
                        ? []
                        : resolveSupportMemberIds(guild, supportRoleIds)
                for (const memberId of new Set([applicant.id, ...support]))
                    await effects
                        .effect(
                            `member:${memberId}`,
                            "reconcile",
                            async () => {
                                await activeThread.members.add(memberId)
                            },
                            false,
                            { threadId, action: "member", value: memberId }
                        )
                        .catch((error) => {
                            if (error instanceof MembershipEffectLeaseLost)
                                throw error
                            logWarn(
                                "interaction",
                                "Failed to add an application thread member",
                                {
                                    guildId: guild.id,
                                    threadId,
                                    memberId,
                                    error,
                                }
                            )
                        })
            })
        },
        recordApplication: async ({ threadId, assignmentId }) => {
            await input.assertRecovery?.()
            const response = (await convex.mutation(
                applicationRefs.createThread,
                {
                    secret,
                    guildId: guild.id,
                    threadId,
                    parentChannelId: settings?.applicationParentChannelId ?? "",
                    creatorId: applicant.id,
                    categoryId: category.id,
                    gameId: category.gameId,
                    assignmentType: category.assignmentType,
                    assignmentId,
                    answers: submission.answers.map((answer) => ({
                        questionId: answer.questionId,
                        label: answer.label.slice(0, 100),
                        value: answer.value.slice(0, 1000),
                        kind: answer.kind,
                    })),
                    draftId: submission.draftId,
                    submissionClaimToken: submission.claimToken,
                    source: submission.source,
                    applicantName: applicant.name,
                    games: submission.games,
                    inGameName: submission.inGameName || undefined,
                    accounts: submission.accounts,
                }
            )) as { application: { applicationNumber: number } }
            return { number: response.application.applicationNumber }
        },
        sendIntro: async () => {
            if (!thread) return false
            const activeThread = thread
            const welcome = buildMembershipApplicationWelcomeContent({
                applicantId: applicant.id,
                supportRoleIds,
                categoryLabel: category.label?.trim() || category.id,
                welcomeMessage: settings?.applicationWelcomeMessage,
                defaultWelcome: copy.welcome,
                mentionSupportRoles: mentionRoles,
            })
            await effects.effect("intro", "send", () =>
                activeThread.send({
                    content: welcome,
                    // Only the applicant and the category's support roles are pinged.
                    allowedMentions: {
                        users: [applicant.id],
                        roles: mentionRoles ? supportRoleIds.slice(0, 100) : [],
                    },
                })
            )
            return true
        },
        sendCard: async (_threadId, number) => {
            if (!thread) return null
            const activeThread = thread
            const message = await effects.effect("card", "send", () =>
                activeThread.send(
                    messagePayload(
                        applicationCardView(copy, {
                            number,
                            games: submission.games,
                            applicantId: applicant.id,
                            applicantName: applicant.name,
                            categoryLabel:
                                category.label?.trim() || category.id,
                            submittedAt: new Date().toISOString(),
                            timeZone: config.timezone || "UTC",
                            inGameName: submission.inGameName,
                            accounts: submission.accounts,
                            answers: submission.answers,
                            supportRoleIds,
                            // "Přijmout jako žoldáka" needs the clan's mercenary category.
                            mercenaryAvailable:
                                mercenaryCategoryFor(
                                    settings?.categories ?? [],
                                    {
                                        categoryId: category.id,
                                        gameId:
                                            category.gameId ?? "hell_let_loose",
                                        games: submission.games,
                                    }
                                ) !== null,
                        }),
                        {
                            language: config.defaultLanguage,
                            style: config.messageStyle,
                        }
                    )
                )
            )
            return message.resourceId ?? null
        },
        storeCardMessage: async (threadId, messageId) => {
            await effects.effect("store-card", "reconcile", async () => {
                await convex.mutation(applicationRefs.storeCard, {
                    secret,
                    threadId,
                    transcriptMessageId: messageId,
                })
            })
        },
        linkAccounts: async () => {
            await effects.effect("accounts", "reconcile", async () => {
                const accounts = submission.accounts
                for (const platform of [
                    "steam",
                    "epic",
                    "xbox",
                    "playstation",
                ] as const) {
                    const id = accounts[platform]
                    // A verified Steam account is already Logi's; typed ones are claims (/link).
                    if (!id || (platform === "steam" && accounts.steamVerified))
                        continue
                    await convex.mutation(applicationRefs.linkPlatform, {
                        secret,
                        userId: applicant.id,
                        userName: applicant.name,
                        userAvatar: applicant.avatar,
                        platformId: `${platform}:${id}`,
                    })
                }
            })
        },
        report,
    })
}
