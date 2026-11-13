import {
    claimApplicationSubmission,
    loadApplicationThreadContext,
    type ApplicationSubmission,
} from "../interactions/membership-application-store"
import {
    createApplicationThread,
    completeApplicationOpening,
} from "../interactions/membership-application-create"
import {
    deliverTicketClose,
    type TicketThreadContext,
} from "../interactions/close-ticket"
import {
    MembershipEffects,
    type MembershipOperation,
} from "./membership-effects"
import { resumeApplicationDecision } from "../interactions/membership-decision"
import { convexTicketPorts, provisionTicket } from "../interactions/tickets"
import { dmSettingsUrl } from "../events/match-context"
import { makeFunctionReference } from "convex/server"
import { ChannelType, type Client } from "discord.js"
import { startOwnedInterval } from "./task-owner"
import { convex, references } from "../convex"
import type { DiscordConfig } from "../types"
import { env } from "../environment"
import { logWarn } from "../log"
import { z } from "zod"

const answer = z.object({
    questionId: z.string(),
    label: z.string(),
    value: z.string(),
})
const ticketRequest = z.object({
    categoryId: z.string(),
    answers: z.array(answer),
    authorName: z.string(),
    userTag: z.string(),
})
const applicationRequest = z.object({
    applicant: z.object({
        id: z.string(),
        name: z.string(),
        tag: z.string(),
        avatar: z.string(),
    }),
    source: z.enum(["discord", "web"]),
    categoryId: z.string(),
    gameId: z.string(),
    games: z.array(z.string()),
    inGameName: z.string(),
    accounts: z.object({
        steamVerified: z.boolean(),
        steam: z.string().optional(),
        epic: z.string().optional(),
        xbox: z.string().optional(),
        playstation: z.string().optional(),
    }),
    answers: z.array(
        answer.extend({
            kind: z.enum([
                "custom",
                "source",
                "age",
                "specialization",
                "referrer",
            ]),
        })
    ),
    initialStatus: z.enum(["pending", "recruit"]),
})
export type MembershipWorkflow = MembershipOperation & {
    source?: "discord" | "web" | null
    id: string
    token: string
    threadId: string | null
}

/** Only durable upgraded operations enter here; legacy work is inspection-only. */
export async function resumeMembershipWorkflow(
    client: Client,
    row: MembershipWorkflow,
    assertRecovery: () => Promise<void> = async () => {}
) {
    const guild = await client.guilds.fetch(row.guildId)
    if (row.kind === "application-close") {
        if (!row.threadId) throw new Error("Application thread missing")
        await resumeApplicationDecision(
            client,
            row.threadId,
            row.actorId,
            assertRecovery
        )
        return
    }
    if (row.kind === "ticket-close") {
        if (!row.threadId) throw new Error("Ticket thread missing")
        const context = (await convex.query(references.getTicketThreadContext, {
            secret: env.internalSecret,
            threadId: row.threadId,
        })) as TicketThreadContext | null
        if (
            !context ||
            context.ticket.guildId !== row.guildId ||
            context.ticket.status !== "closed" ||
            context.ticket.closedByUserId !== row.actorId
        )
            throw new Error("Committed ticket close not found")
        const channel = await guild.channels.fetch(row.threadId)
        if (!channel?.isThread() || channel.ownerId !== client.user?.id)
            throw new Error("Ticket thread ownership could not be verified")
        const actor = await client.users.fetch(row.actorId)
        const effects = new MembershipEffects(
            {
                ...row,
                expectedKeys: [
                    "close-card",
                    "rename",
                    "lock",
                    "archive",
                    ...(context.config.ticketCloseDmEnabled === false
                        ? []
                        : [`dm:${context.ticket.creatorId}`]),
                ],
            },
            undefined,
            assertRecovery
        )
        const result = await deliverTicketClose({
            context,
            channel,
            threadId: row.threadId,
            guildId: row.guildId,
            client,
            actorId: row.actorId,
            actorName: actor.globalName ?? actor.username,
            clan: guild.name,
            reason: context.ticket.closeReason,
            closedAt: Date.parse(context.ticket.closedAt ?? ""),
            effects,
            settingsUrl: dmSettingsUrl,
        })
        await Promise.all(result.reports)
        await effects.complete()
        return
    }
    const member = await guild.members.fetch({ user: row.actorId, force: true })
    const config = (await convex.query(references.getConfigByDiscordGuildId, {
        secret: env.internalSecret,
        guildId: row.guildId,
    })) as DiscordConfig | null
    if (!config) throw new Error("Membership recovery configuration missing")
    if (row.kind === "ticket-open") {
        const request = ticketRequest.parse(
            JSON.parse(row.requestJson ?? "null")
        )
        const category = config.ticketSettings?.categories.find(
            (item) => item.id === request.categoryId
        )
        if (!config.ticketSettings?.enabled || !category)
            throw new Error("Ticket recovery category disabled or missing")
        if (row.threadId) {
            const existing = (await convex.query(
                references.getTicketThreadContext,
                { secret: env.internalSecret, threadId: row.threadId }
            )) as TicketThreadContext | null
            if (existing?.ticket.status === "closed")
                throw new Error("Ticket opening superseded by closure")
        }
        const parentId = config.ticketSettings.ticketParentChannelId
        const parent = parentId ? await guild.channels.fetch(parentId) : null
        if (!parent || parent.type !== ChannelType.GuildText)
            throw new Error("Ticket recovery parent unavailable")
        await provisionTicket({
            guild,
            guildId: row.guildId,
            parent,
            config,
            category,
            answers: request.answers,
            ports: {
                ...convexTicketPorts,
                effects: (operation) =>
                    new MembershipEffects(operation, undefined, assertRecovery),
            },
            assertRecovery,
            userId: row.actorId,
            userTag: request.userTag,
            authorName: request.authorName,
            operationKey: row.key,
            subjectId: row.subjectId,
            fail: async (report) => {
                throw report.error
            },
        })
        return
    }
    const context = row.threadId
        ? await loadApplicationThreadContext(row.threadId)
        : null
    let submission: ApplicationSubmission
    let resume: { assignmentId: string } | undefined
    let applicant = {
        id: member.id,
        name: member.displayName,
        tag: member.user.tag,
        avatar: member.user.displayAvatarURL(),
    }
    if (context) {
        if (
            context.application.guildId !== row.guildId ||
            context.application.creatorId !== row.actorId ||
            context.application.status !== "open" ||
            !context.application.assignmentId
        )
            throw new Error("Application opening superseded or changed scope")
        const request = applicationRequest.parse(
            JSON.parse(row.requestJson ?? "null")
        )
        if (request.applicant.id !== row.actorId)
            throw new Error("Application applicant scope mismatch")
        const category = config.membershipSettings?.categories.find(
            (item) =>
                item.id === request.categoryId &&
                (item.gameId ?? "hell_let_loose") === request.gameId
        )
        if (!config.membershipSettings?.enabled || !category)
            throw new Error("Application recovery category disabled or missing")
        submission = {
            ...request,
            draftId: row.subjectId,
            claimToken: "committed-record",
            config,
            category,
            clanName: context.clanName,
            guildRecordId: context.guildRecordId,
        }
        resume = { assignmentId: context.application.assignmentId }
        applicant = request.applicant
    } else {
        const source = row.requestJson
            ? applicationRequest.parse(JSON.parse(row.requestJson)).source
            : (row.source ?? "web")
        await assertRecovery()
        const claim = await claimApplicationSubmission({
            guildId: row.guildId,
            userId: row.actorId,
            draftId: row.subjectId,
            source,
        })
        if (!claim.ok)
            throw new Error(
                `Application recovery not claimable: ${claim.reason}`
            )
        submission = claim.submission
    }
    const result = await createApplicationThread({
        guild,
        applicant,
        submission,
        resume,
        assertRecovery,
    })
    if (!result.ok)
        throw new Error(`Application recovery incomplete: ${result.failedAt}`)
    await completeApplicationOpening({
        guild,
        applicantId: row.actorId,
        submission,
        number: result.number,
        threadId: result.threadId,
        assertRecovery,
    })
}

export function startMembershipWorkflowRecovery(client: Client) {
    const call = (name: string, args: Record<string, unknown> = {}) =>
        convex.mutation(
            makeFunctionReference<"mutation">(
                `discordMembershipEffects:${name}`
            ),
            { secret: env.internalSecret, ...args }
        )
    let stopped = false
    const stop = startOwnedInterval(
        async () => {
            for (let i = 0; i < 5 && !stopped; i++) {
                const row = (await call(
                    "claimWorkflow"
                )) as MembershipWorkflow | null
                if (!row) break
                let lost = false
                const heartbeat = async () => {
                    if (
                        lost ||
                        !(await call("workflowHeartbeat", {
                            operationId: row.id,
                            token: row.token,
                        }))
                    ) {
                        lost = true
                        throw new Error("Membership workflow lease lost")
                    }
                }
                await heartbeat()
                const stopHeartbeat = startOwnedInterval(
                    heartbeat,
                    30_000,
                    () => {
                        lost = true
                    },
                    false
                )
                try {
                    await resumeMembershipWorkflow(client, row, heartbeat)
                } catch (error) {
                    logWarn(
                        "membership-recovery",
                        "Interrupted workflow retained for reconciliation",
                        { operationId: row.id, kind: row.kind, error }
                    )
                } finally {
                    await stopHeartbeat()
                }
                if (lost) throw new Error("Membership workflow ownership lost")
                await call("finishWorkflow", {
                    operationId: row.id,
                    token: row.token,
                })
            }
        },
        60_000,
        (error) =>
            logWarn("membership-recovery", "Workflow recovery pass failed", {
                error,
            })
    )
    return () => {
        stopped = true
        return stop()
    }
}
