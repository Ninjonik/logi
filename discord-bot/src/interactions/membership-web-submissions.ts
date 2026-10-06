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
import { logError, logInfo, logWarn } from "../log"
import { messagePayload } from "../ui/message-kit"
import { env } from "../environment"
import { convex } from "../convex"

/**
 * Variant B (N4-42, L6-17, L6-B10): applications sent from the Logi web wait
 * in Convex; the bot creates the same thread and card as for the Discord
 * windows. Each submission is claimed once, so a repeated watch update or a
 * restart never creates a second thread.
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

async function processSubmission(client: Client, item: Queued) {
    const guild = await fetchGuild(client, item.guildId)
    if (!guild) {
        await releaseApplicationSubmission(item.draftId, "guild")
        return
    }
    const claim = await claimApplicationSubmission({
        guildId: item.guildId,
        userId: item.creatorId,
        draftId: item.draftId,
        source: "web",
    })
    if (!claim.ok) return
    const member = await guild.members
        .fetch({ user: item.creatorId, force: true })
        .catch(() => null)
    if (!member) {
        // A private thread can only hold members of the server.
        await releaseApplicationSubmission(item.draftId, "not-member")
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
        await releaseApplicationSubmission(item.draftId, result.failedAt)
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
    if (config.membershipSettings?.sendConfirmationDm === false) return
    await member
        .send(
            messagePayload(
                applicationConfirmationDmView(
                    getApplicationMessages(config.defaultLanguage),
                    {
                        clanName: claim.submission.clanName || guild.name,
                        number: result.number,
                        threadUrl: threadUrl(guild.id, result.threadId),
                        settingsUrl: `${env.appSiteUrl}/${config.defaultLanguage}/dashboard/settings/user`,
                    }
                ),
                { language: config.defaultLanguage, style: config.messageStyle }
            )
        )
        .catch(() => null)
}

export function startApplicationWebSubmissionWorker(client: Client) {
    const processing = new Set<string>()
    const run = (items: readonly Queued[]) => {
        for (const item of items) {
            if (processing.has(item.draftId)) continue
            processing.add(item.draftId)
            void processSubmission(client, item)
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
        watch.onUpdate(() => {
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
}
