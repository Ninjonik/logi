import { ChannelType, type Guild, type TextChannel } from "discord.js"

import {
    submitApplication,
    type SubmitApplicationResult,
} from "../../../src/application/membership/submit-application"
import { applicationCardView } from "../../../src/domain/membership/application-views"
import { getApplicationMessages } from "../../../src/lib/clan-language/application"
import { fillTemplate } from "../../../src/domain/discord-messages/format"

import {
    applicationRefs,
    type ApplicationSubmission,
} from "./membership-application-store"
import { buildMembershipApplicationWelcomeContent } from "./membership-welcome"
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

export async function createApplicationThread(input: {
    guild: Guild
    applicant: Applicant
    submission: ApplicationSubmission
}): Promise<SubmitApplicationResult> {
    const { guild, applicant, submission } = input
    const config = submission.config
    const settings = config.membershipSettings
    const category = submission.category
    const copy = getApplicationMessages(config.defaultLanguage)
    const secret = env.internalSecret
    const report = (step: string, error: unknown) =>
        void reportToErrorsChannel({
            client: guild.client,
            guildId: guild.id,
            error,
            action: `Create a membership application (${step})`,
            location: "Membership applications",
            scope: "interaction",
            target: category.label?.trim() || category.id,
            details: { user: applicant.tag, categoryId: category.id },
        })
    let thread: Awaited<ReturnType<TextChannel["threads"]["create"]>> | null =
        null
    let assignment: string | null = null
    const supportRoleIds = category.supportRoleIds ?? []
    const mentionRoles = settings?.mentionSupportRoles !== false

    return await submitApplication({
        createAssignment: async () => {
            assignment = (await convex.mutation(
                applicationRefs.upsertAssignment,
                {
                    secret,
                    roleActor: { userId: applicant.id, kind: "application" },
                    serverDiscordId: guild.id,
                    userId: applicant.id,
                    gameId: category.gameId,
                    type: category.assignmentType,
                    status: submission.initialStatus,
                    membershipCategoryId: category.id,
                    primaryGroupId: undefined,
                    secondaryGroupIds: [],
                    paused: false,
                    pausedNote: undefined,
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
        removeAssignment: async (assignmentId) => {
            await convex.mutation(applicationRefs.removeAssignment, {
                secret,
                assignmentId,
                roleActor: { userId: applicant.id, kind: "rollback" },
                roleGuildId: guild.id,
            })
            await revalidateAppData({
                type: "assignment-changed",
                serverId: guild.id,
                userId: applicant.id,
                assignmentId,
            })
        },
        createThread: async () => {
            const parentId = settings?.applicationParentChannelId
            const parent = parentId
                ? await guild.channels.fetch(parentId).catch(() => null)
                : null
            if (!parent || parent.type !== ChannelType.GuildText)
                throw new Error(
                    "The application thread channel is not a text channel."
                )
            thread = await (parent as TextChannel).threads.create({
                name: applicationThreadName(copy.threadName, applicant.name),
                autoArchiveDuration: 10080,
                type: ChannelType.PrivateThread,
                invitable: false,
                reason: `Application ${category.id} by ${applicant.tag}`,
            })
            return { id: thread.id }
        },
        deleteThread: async () => {
            await thread?.delete(
                "Membership application record creation failed"
            )
        },
        addMembers: async (threadId) => {
            if (!thread || thread.id !== threadId) return
            await guild.members.fetch().catch(() => null)
            const support =
                settings?.inviteSupportMembersIndividually === false
                    ? []
                    : resolveSupportMemberIds(guild, supportRoleIds)
            for (const memberId of new Set([applicant.id, ...support]))
                await thread.members.add(memberId).catch((error) => {
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
        },
        recordApplication: async ({ threadId, assignmentId }) => {
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
            const welcome = buildMembershipApplicationWelcomeContent({
                applicantId: applicant.id,
                supportRoleIds,
                categoryLabel: category.label?.trim() || category.id,
                welcomeMessage: settings?.applicationWelcomeMessage,
                defaultWelcome: copy.welcome,
                mentionSupportRoles: mentionRoles,
            })
            await thread.send({
                content: welcome,
                // Only the applicant and the category's support roles are pinged.
                allowedMentions: {
                    users: [applicant.id],
                    roles: mentionRoles ? supportRoleIds.slice(0, 100) : [],
                },
            })
            return true
        },
        sendCard: async (_threadId, number) => {
            if (!thread) return null
            const message = await thread.send(
                messagePayload(
                    applicationCardView(copy, {
                        number,
                        games: submission.games,
                        applicantId: applicant.id,
                        applicantName: applicant.name,
                        categoryLabel: category.label?.trim() || category.id,
                        submittedAt: new Date().toISOString(),
                        timeZone: config.timezone || "UTC",
                        inGameName: submission.inGameName,
                        accounts: submission.accounts,
                        answers: submission.answers,
                        status: submission.initialStatus,
                        supportRoleIds,
                    }),
                    {
                        language: config.defaultLanguage,
                        style: config.messageStyle,
                    }
                )
            )
            return message.id
        },
        storeCardMessage: async (threadId, messageId) => {
            await convex.mutation(applicationRefs.storeCard, {
                secret,
                threadId,
                transcriptMessageId: messageId,
            })
        },
        linkAccounts: async () => {
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
        },
        report,
    })
}
