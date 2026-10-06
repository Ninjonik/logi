import { makeFunctionReference } from "convex/server"

import type {
    ApplicationAnswers,
    SubmittedAccounts,
    SubmittedAnswer,
    WindowIssue,
    WindowValues,
} from "../../../src/domain/membership/application-plan"
import type {
    ApplicationCategory,
    ApplicationForm,
} from "../../../src/domain/membership/application-form"
import type { ApplicationOutcome } from "../../../src/domain/membership/application-decision"
import type { MessageStyle } from "../../../src/domain/discord-messages/message-style"
import type { PreviousPlayer } from "../../../src/domain/membership/previous-players"
import type { GameId } from "../../../src/domain/games/game"

import type {
    EventInteractionContext,
    MembershipApplicationThreadRecord,
    MembershipCategory,
} from "../types"
import { env } from "../environment"
import { convex } from "../convex"

/**
 * The bot's Convex calls for the clan application (`convex/membershipApplications.ts`
 * and the thread record in `convex/discordMembership.ts`), typed for the
 * interaction modules.
 */

export type ApplicationState = {
    enabled: boolean
    webFormEnabled: boolean
    language: "en" | "cs" | "de"
    timeZone: string
    clanName: string
    guildRecordId: string | null
    panelChannelId: string | null
    parentChannelId: string | null
    ticketChannelId: string | null
    form: ApplicationForm
    categories: ApplicationCategory[]
    openApplication: { number: number; threadId: string } | null
    assignedGames: GameId[]
    draft: {
        id: string
        answers: ApplicationAnswers
        source: "discord" | "web"
        submissionStatus: "queued" | "claimed" | "failed" | null
        submissionError: string | null
    } | null
    verifiedSteamId: string | null
    previousPlayers: PreviousPlayer[]
    linkedPlatformIds: string[]
    messageStyle: MessageStyle | null
}

export type SaveWindowResult =
    | { ok: true; draftId: string; answers: ApplicationAnswers }
    | {
          ok: false
          reason: "disabled" | "expired" | "busy" | "invalid"
          issues?: WindowIssue[]
      }

export type ApplicationSubmission = {
    draftId: string
    source: "discord" | "web"
    config: EventInteractionContext["config"]
    clanName: string
    guildRecordId: string | null
    category: MembershipCategory & ApplicationCategory
    games: GameId[]
    inGameName: string
    accounts: SubmittedAccounts
    answers: SubmittedAnswer[]
    initialStatus: "pending" | "recruit"
}

export type ClaimResult =
    | { ok: true; submission: ApplicationSubmission }
    | {
          ok: false
          reason:
              | "disabled"
              | "expired"
              | "busy"
              | "in-clan"
              | "incomplete"
              | "open-application"
          windowId?: string
          number?: number
          threadId?: string
      }

export type ApplicationThreadContext = {
    config: EventInteractionContext["config"]
    application: MembershipApplicationThreadRecord
    assignment: {
        id?: string
        type: "member" | "reserve_member" | "mercenary"
        status: "pending" | "recruit" | "active"
        membershipCategoryId?: string
    } | null
    category: MembershipCategory | null
    clanName: string
    guildRecordId: string | null
    ticketChannelId: string | null
}

export const applicationRefs = {
    state: makeFunctionReference<"query">(
        "membershipApplications:getApplicationState"
    ),
    saveWindow: makeFunctionReference<"mutation">(
        "membershipApplications:saveApplicationWindow"
    ),
    discard: makeFunctionReference<"mutation">(
        "membershipApplications:discardApplicationDraft"
    ),
    claim: makeFunctionReference<"mutation">(
        "membershipApplications:claimApplicationSubmission"
    ),
    release: makeFunctionReference<"mutation">(
        "membershipApplications:releaseApplicationSubmission"
    ),
    queuedWeb: makeFunctionReference<"query">(
        "membershipApplications:listQueuedWebApplications"
    ),
    claimDecision: makeFunctionReference<"mutation">(
        "membershipApplications:claimApplicationDecision"
    ),
    releaseDecision: makeFunctionReference<"mutation">(
        "membershipApplications:releaseApplicationDecision"
    ),
    markUndecided: makeFunctionReference<"mutation">(
        "membershipApplications:markApplicationUndecided"
    ),
    threadContext: makeFunctionReference<"query">(
        "discordMembership:getMembershipApplicationThreadContext"
    ),
    createThread: makeFunctionReference<"mutation">(
        "discordMembership:createMembershipApplicationThread"
    ),
    storeCard: makeFunctionReference<"mutation">(
        "discordMembership:updateMembershipApplicationTranscriptMessage"
    ),
    close: makeFunctionReference<"mutation">(
        "discordMembership:closeMembershipApplicationThread"
    ),
    upsertAssignment: makeFunctionReference<"mutation">(
        "userAssignments:upsertByServerDiscordId"
    ),
    removeAssignment: makeFunctionReference<"mutation">(
        "userAssignments:remove"
    ),
    linkPlatform: makeFunctionReference<"mutation">(
        "players:linkDiscordPlatformId"
    ),
}

const secret = () => env.internalSecret

export async function loadApplicationState(guildId: string, userId: string) {
    return (await convex.query(applicationRefs.state, {
        secret: secret(),
        guildId,
        userId,
    })) as ApplicationState | null
}

export async function saveApplicationWindow(input: {
    guildId: string
    userId: string
    draftId?: string
    windowId: string
    values: WindowValues
}) {
    return (await convex.mutation(applicationRefs.saveWindow, {
        secret: secret(),
        guildId: input.guildId,
        userId: input.userId,
        windowId: input.windowId,
        values: Object.fromEntries(
            Object.entries(input.values).map(([key, values]) => [
                key,
                [...values],
            ])
        ),
        ...(input.draftId ? { draftId: input.draftId } : {}),
    })) as SaveWindowResult
}

export async function discardApplicationDraft(input: {
    guildId: string
    userId: string
    draftId: string
}) {
    await convex.mutation(applicationRefs.discard, {
        secret: secret(),
        ...input,
    })
}

export async function claimApplicationSubmission(input: {
    guildId: string
    userId: string
    draftId: string
    source: "discord" | "web"
}) {
    return (await convex.mutation(applicationRefs.claim, {
        secret: secret(),
        ...input,
    })) as ClaimResult
}

export async function releaseApplicationSubmission(
    draftId: string,
    error?: string
) {
    await convex.mutation(applicationRefs.release, {
        secret: secret(),
        draftId,
        ...(error ? { error } : {}),
    })
}

export async function loadApplicationThreadContext(threadId: string) {
    return (await convex.query(applicationRefs.threadContext, {
        secret: secret(),
        threadId,
    })) as ApplicationThreadContext | null
}

export type DecisionClaim =
    | { ok: true }
    | { ok: false; reason: "missing" | "busy" }
    | {
          ok: false
          reason: "closed"
          outcome: ApplicationOutcome | "reserve_member" | null
          closedByUserId: string | null
      }

export async function claimApplicationDecision(threadId: string) {
    return (await convex.mutation(applicationRefs.claimDecision, {
        secret: secret(),
        threadId,
    })) as DecisionClaim
}

export async function releaseApplicationDecision(threadId: string) {
    await convex.mutation(applicationRefs.releaseDecision, {
        secret: secret(),
        threadId,
    })
}

export async function markApplicationUndecided(input: {
    threadId: string
    userId: string
    name: string
}) {
    return (await convex.mutation(applicationRefs.markUndecided, {
        secret: secret(),
        ...input,
    })) as { ok: true; at: string } | { ok: false }
}
