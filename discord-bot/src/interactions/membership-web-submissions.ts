import { TaskOwner } from "../runtime/task-owner"
import type { Client, Guild } from "discord.js"

import { applicationConfirmationDmView } from "../../../src/domain/membership/application-views"
import { getApplicationMessages } from "../../../src/lib/clan-language/application"

import {
    applicationRefs,
    claimApplicationSubmission,
    releaseApplicationSubmission,
} from "./membership-application-store"
import {
    createApplicationThread,
    threadUrl,
} from "./membership-application-create"
import { applicationStateCache } from "./membership-application-cache"
import { MembershipEffects } from "../runtime/membership-effects"
import { dmSettingsUrl } from "../events/match-context"
import { logError, logInfo, logWarn } from "../log"
import { messagePayload } from "../ui/message-kit"
import { env } from "../environment"
import { convex } from "../convex"

/**
 * Variant B (N4-42, L6-17, L6-B10): applications sent from the Logi web wait
 * in Convex; the bot creates the same thread and card as for the Discord
 * windows. A claim prevents concurrent processing while its lease is active.
 * An expired claim does not prove whether Discord created a thread before a
 * crash; durable provisioning recovery is still required.
 */

type Queued = { draftId: string; guildId: string; creatorId: string }

async function fetchGuild(
    client: Client,
    guildId: string
): Promise<Guild | null> {
    return (
        client.guilds.cache.get(guildId) ??
        (await client.guilds.fetch(guildId).catch(() => null))
    )
}

export async function processSubmission(client: Client, item: Queued) {
    const claim = await claimApplicationSubmission({
        guildId: item.guildId,
        userId: item.creatorId,
        draftId: item.draftId,
        source: "web",
    })
    if (!claim.ok) return
    const guild = await fetchGuild(client, item.guildId)
    if (!guild) {
        await releaseApplicationSubmission(
            item.draftId,
            claim.submission.claimToken,
            "guild"
        )
        return
    }
    const member = await guild.members
        .fetch({ user: item.creatorId, force: true })
        .catch(() => null)
    if (!member) {
        // A private thread can only hold members of the server.
        await releaseApplicationSubmission(
            item.draftId,
            claim.submission.claimToken,
            "not-member"
        )
        return
    }
    const result = await createApplicationThread({
        guild,
        applicant: {
            id: member.id,
            name: member.displayName,
            tag: member.user.tag,
            avatar: member.user.displayAvatarURL(),
        },
        submission: claim.submission,
    })
    if (!result.ok) {
        await releaseApplicationSubmission(
            item.draftId,
            claim.submission.claimToken,
            result.failedAt
        )
        return
    }
    logInfo("membership", "Created a web application thread", {
        guildId: guild.id,
        threadId: result.threadId,
    })
    // The applicant's draft is gone and the application is open now.
    applicationStateCache.update(guild.id, item.creatorId, {
        draft: null,
        openApplication: { number: result.number, threadId: result.threadId },
    })
    const config = claim.submission.config
    const effects = new MembershipEffects({
        key: `application-open:${item.draftId}`,
        kind: "application-open",
        guildId: guild.id,
        subjectId: item.draftId,
        actorId: item.creatorId,
    })
    if (config.membershipSettings?.sendConfirmationDm === false) {
        await effects.skip(`confirmation-dm:${item.creatorId}`)
        await effects.complete()
        return
    }
    await effects
        .effect(
            `confirmation-dm:${item.creatorId}`,
            "send",
            () =>
                member.send(
                    messagePayload(
                        applicationConfirmationDmView(
                            getApplicationMessages(config.defaultLanguage),
                            {
                                clanName:
                                    claim.submission.clanName || guild.name,
                                number: result.number,
                                threadUrl: threadUrl(guild.id, result.threadId),
                                settingsUrl: dmSettingsUrl(
                                    config.defaultLanguage
                                ),
                            }
                        ),
                        {
                            language: config.defaultLanguage,
                            style: config.messageStyle,
                        }
                    )
                ),
            true
        )
        .catch((error) =>
            logWarn(
                "membership-recovery",
                "Application confirmation outcome retained",
                { guildId: guild.id, error }
            )
        )
    await effects.complete()
}

export function startApplicationWebSubmissionWorker(client: Client) {
    const tasks = new TaskOwner()
    let unsubscribe: (() => void) | undefined
    const processing = new Set<string>()
    const run = (items: readonly Queued[]) => {
        for (const item of items) {
            if (tasks.stopped) break
            if (processing.has(item.draftId)) continue
            processing.add(item.draftId)
            void tasks
                .run(() => processSubmission(client, item))
                .catch((error) =>
                    logError("membership", "Web application failed", {
                        guildId: item.guildId,
                        error,
                    })
                )
                .finally(() => processing.delete(item.draftId))
        }
    }
    try {
        const watch = convex.watchQuery(applicationRefs.queuedWeb, {
            secret: env.internalSecret,
        })
        unsubscribe = watch.onUpdate(() => {
            try {
                run((watch.localQueryResult() as Queued[] | undefined) ?? [])
            } catch (error) {
                // Before the backend deploy the query does not exist yet.
                logWarn("membership", "Could not read web applications", {
                    error,
                })
            }
        })
    } catch (error) {
        logWarn("membership", "Web applications are not watched", { error })
    }
    return () => {
        unsubscribe?.()
        return tasks.stop()
    }
}
