import { v } from "convex/values"

import {
    EMPTY_APPLICATION_ANSWERS,
    nextWindow,
    planApplication,
    submitWindow,
    submittedAccounts,
    submittedAnswers,
    type ApplicationAnswers,
} from "../src/domain/membership/application-plan"
import {
    APPLICATION_DRAFT_TTL_MS,
    categoryGame,
    resolveApplicationForm,
    type ApplicationCategory,
} from "../src/domain/membership/application-form"
import {
    internalMutation,
    mutation,
    query,
    type MutationCtx,
    type QueryCtx,
} from "./_generated/server"
import {
    activeDashboardSession,
    assertSessionGateway,
} from "./dashboardSessionStore"
import { skipsPendingOnApply } from "../src/domain/membership/membership-options"
import { findPreviousPlayers } from "../src/domain/membership/previous-players"
import { getApplicationMessages } from "../src/lib/clan-language/application"
import { formatAnswer } from "../src/domain/membership/application-answers"
import { assertInternalSecret, normalizeConfigDoc } from "./discord_shared"
import { authorizeDashboardAdmin, dashboardActor } from "./dashboardActor"
import { matchesGameScope, type GameId } from "../src/domain/games/game"
import { attachableAsset, syncAssetReferences } from "./imageAssets"
import { getGuildByDiscordId, getUserByDiscordId } from "./identity"
import type { Doc, Id } from "./_generated/dataModel"

/**
 * The clan application in several windows (boards L6, N4): drafts saved after
 * every window and kept 24 h, the submit claim the bot turns into a thread,
 * the web form behind its switch (Variant B) and the decision bookkeeping of
 * the thread card. Validation is the shared domain rule
 * (`src/domain/membership/application-plan.ts`) for Discord and the web.
 */

type Ctx = Pick<QueryCtx, "db">

const sourceValidator = v.union(v.literal("discord"), v.literal("web"))
const valuesValidator = v.record(v.string(), v.array(v.string()))

/** Bounds the raw window values before any rule reads them. */
function assertBoundedValues(values: Record<string, string[]>) {
    const entries = Object.entries(values)
    if (
        entries.length > 12 ||
        entries.some(
            ([key, list]) =>
                key.length > 70 ||
                list.length > 25 ||
                list.some((value) => value.length > 1100)
        )
    )
        throw new Error("Application window values are too large.")
}

async function configOf(ctx: Ctx, guildId: string) {
    return await ctx.db
        .query("discordConfigs")
        .withIndex("guildId", (q) => q.eq("guildId", guildId))
        .unique()
}

/** The clan's form, categories and copy, or null without membership settings. */
async function applicationSetup(ctx: Ctx, guildId: string) {
    const config = await configOf(ctx, guildId)
    const settings = config?.membershipSettings
    if (!config || !settings) return null
    const categories = settings.categories as ApplicationCategory[]
    const copy = getApplicationMessages(config.defaultLanguage)
    const form = resolveApplicationForm(
        settings.applicationForm,
        categories,
        copy.defaultForm
    )
    return { config, settings, categories, form, copy }
}

/** The applicant's newest draft that has not expired. */
async function liveDraft(ctx: Ctx, guildId: string, creatorId: string) {
    const drafts = await ctx.db
        .query("membershipApplicationFormDrafts")
        .withIndex("guildId_creatorId", (q) =>
            q.eq("guildId", guildId).eq("creatorId", creatorId)
        )
        .collect()
    const now = Date.now()
    return (
        drafts
            .filter((draft) => draft.expiresAt > now)
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null
    )
}

async function ownDraft(
    ctx: Ctx,
    draftId: string,
    guildId: string,
    creatorId: string
) {
    const id = ctx.db.normalizeId("membershipApplicationFormDrafts", draftId)
    const draft = id ? await ctx.db.get(id) : null
    return draft &&
        draft.guildId === guildId &&
        draft.creatorId === creatorId &&
        draft.expiresAt > Date.now()
        ? draft
        : null
}

function draftAnswers(
    draft: Doc<"membershipApplicationFormDrafts">
): ApplicationAnswers {
    return {
        games: draft.games,
        categoryId: draft.categoryId,
        inGameName: draft.inGameName,
        accounts: { ...draft.accounts },
        answers: Object.fromEntries(
            draft.answers.map((answer) => [answer.questionId, answer.values])
        ),
        completedWindows: draft.completedWindows,
    }
}

function draftPatch(answers: ApplicationAnswers) {
    return {
        games: answers.games,
        categoryId: answers.categoryId,
        inGameName: answers.inGameName,
        accounts: {
            ...(answers.accounts.steam
                ? { steam: answers.accounts.steam }
                : {}),
            ...(answers.accounts.epic ? { epic: answers.accounts.epic } : {}),
            ...(answers.accounts.xbox ? { xbox: answers.accounts.xbox } : {}),
            ...(answers.accounts.playstation
                ? { playstation: answers.accounts.playstation }
                : {}),
            ...(answers.accounts.previousPlayer
                ? { previousPlayer: answers.accounts.previousPlayer }
                : {}),
        },
        answers: Object.entries(answers.answers).map(
            ([questionId, values]) => ({ questionId, values })
        ),
        completedWindows: answers.completedWindows,
    }
}

/** The applicant's active verified Steam account (v0.9), if any. */
async function verifiedSteam(ctx: Ctx, discordUserId: string) {
    const user = await getUserByDiscordId(ctx, discordUserId)
    if (!user) return null
    const links = await ctx.db
        .query("platformIdentityLinks")
        .withIndex("userRecordId_verifiedAt", (q) =>
            q.eq("userRecordId", user._id)
        )
        .order("desc")
        .take(20)
    return (
        links.find(
            (link) =>
                link.active &&
                link.revokedAt === null &&
                link.platform === "steam"
        )?.platformId ?? null
    )
}

/** "Našli jsme tě na serverech klanu?" from the clan's retained history (L6-B06). */
async function previousPlayersFor(ctx: Ctx, guildId: string, name?: string) {
    if (!name?.trim()) return []
    const games = await ctx.db
        .query("serverGameHistory")
        .withIndex("guildId_endedAt", (q) => q.eq("guildId", guildId))
        .order("desc")
        .take(60)
    return findPreviousPlayers(
        games.map((game) => ({
            endedAt: game.endedAt,
            serverName: game.serverName,
            players: game.session.players,
        })),
        name
    )
}

async function openApplicationOf(ctx: Ctx, guildId: string, userId: string) {
    const applications = await ctx.db
        .query("membershipApplicationThreads")
        .withIndex("guildId", (q) => q.eq("guildId", guildId))
        .collect()
    const open = applications.find(
        (application) =>
            application.creatorId === userId && application.status === "open"
    )
    return open
        ? { number: open.applicationNumber, threadId: open.threadId }
        : null
}

async function assignedGamesOf(ctx: Ctx, guildId: string, userId: string) {
    const assignments = await ctx.db
        .query("userAssignments")
        .withIndex("serverId_userId", (q) =>
            q.eq("serverId", guildId).eq("userId", userId)
        )
        .collect()
    return assignments.map(
        (assignment) => assignment.gameId ?? "hell_let_loose"
    )
}

/** Everything the bot and the web need to show the applicant's form. */
async function applicationState(ctx: Ctx, guildId: string, userId: string) {
    const setup = await applicationSetup(ctx, guildId)
    if (!setup) return null
    const [
        guild,
        draft,
        verifiedSteamId,
        openApplication,
        assignedGames,
        user,
    ] = await Promise.all([
        getGuildByDiscordId(ctx, guildId),
        liveDraft(ctx, guildId, userId),
        verifiedSteam(ctx, userId),
        openApplicationOf(ctx, guildId, userId),
        assignedGamesOf(ctx, guildId, userId),
        getUserByDiscordId(ctx, userId),
    ])
    const answers = draft ? draftAnswers(draft) : EMPTY_APPLICATION_ANSWERS
    return {
        enabled: setup.settings.enabled,
        webFormEnabled: setup.settings.webFormEnabled === true,
        language: setup.config.defaultLanguage ?? "en",
        timeZone: setup.config.timezone ?? "UTC",
        clanName: guild?.name ?? "",
        guildRecordId: guild ? String(guild._id) : null,
        panelChannelId: setup.settings.submitChannelId ?? null,
        parentChannelId: setup.settings.applicationParentChannelId ?? null,
        ticketChannelId: setup.config.ticketSettings?.enabled
            ? (setup.config.ticketSettings.submitChannelId ?? null)
            : null,
        form: setup.form,
        categories: setup.categories,
        openApplication,
        assignedGames,
        draft: draft
            ? {
                  id: String(draft._id),
                  answers,
                  source: draft.source,
                  submissionStatus: draft.submissionStatus ?? null,
                  submissionError: draft.submissionError ?? null,
              }
            : null,
        verifiedSteamId,
        previousPlayers: await previousPlayersFor(
            ctx,
            guildId,
            answers.inGameName
        ),
        linkedPlatformIds: user?.platformIds ?? [],
        messageStyle: setup.config.messageStyle ?? null,
    }
}

export type ApplicationState = NonNullable<
    Awaited<ReturnType<typeof applicationState>>
>

/** The applicant's form state for the bot (internal secret). */
export const getApplicationState = query({
    args: { secret: v.string(), guildId: v.string(), userId: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        return await applicationState(ctx, args.guildId, args.userId)
    },
})

type SaveResult =
    | { ok: true; draftId: string; answers: ApplicationAnswers }
    | {
          ok: false
          reason: "disabled" | "expired" | "busy" | "invalid"
          issues?: { fieldId: string; issue: string }[]
      }

async function saveWindow(
    ctx: MutationCtx,
    input: {
        guildId: string
        userId: string
        draftId?: string
        windowId: string
        values: Record<string, string[]>
        source: "discord" | "web"
    }
): Promise<SaveResult> {
    assertBoundedValues(input.values)
    const setup = await applicationSetup(ctx, input.guildId)
    if (!setup?.settings.enabled) return { ok: false, reason: "disabled" }
    const draft = input.draftId
        ? await ownDraft(ctx, input.draftId, input.guildId, input.userId)
        : await liveDraft(ctx, input.guildId, input.userId)
    if (input.draftId && !draft) return { ok: false, reason: "expired" }
    if (
        draft?.submissionStatus === "queued" ||
        (draft?.submissionStatus === "claimed" &&
            (draft.claimedUntil ?? 0) > Date.now())
    )
        return { ok: false, reason: "busy" }
    const answers = draft ? draftAnswers(draft) : EMPTY_APPLICATION_ANSWERS
    const [verifiedSteamId, previousPlayers] = await Promise.all([
        verifiedSteam(ctx, input.userId),
        previousPlayersFor(ctx, input.guildId, answers.inGameName),
    ])
    const result = submitWindow({
        form: setup.form,
        categories: setup.categories,
        answers,
        previousPlayers,
        windowId: input.windowId,
        values: input.values,
        verifiedSteamId,
    })
    if (!result.ok)
        return {
            ok: false,
            reason: "invalid",
            issues: result.issues.map((issue) => ({ ...issue })),
        }
    const now = new Date()
    const fields = {
        ...draftPatch(result.answers),
        expiresAt: now.getTime() + APPLICATION_DRAFT_TTL_MS,
        updatedAt: now.toISOString(),
    }
    if (draft) {
        await ctx.db.patch(draft._id, {
            ...fields,
            // A failed web submission becomes editable again.
            submissionStatus: undefined,
            submissionError: undefined,
            claimedUntil: undefined,
        })
        return { ok: true, draftId: String(draft._id), answers: result.answers }
    }
    const id = await ctx.db.insert("membershipApplicationFormDrafts", {
        guildId: input.guildId,
        creatorId: input.userId,
        source: input.source,
        createdAt: now.toISOString(),
        ...fields,
    })
    return { ok: true, draftId: String(id), answers: result.answers }
}

/** Saves one Discord window after its modal is submitted (L6-08). */
export const saveApplicationWindow = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        userId: v.string(),
        draftId: v.optional(v.string()),
        windowId: v.string(),
        values: valuesValidator,
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        return await saveWindow(ctx, { ...args, source: "discord" })
    },
})

/** "Zrušit": the draft is deleted and nothing was sent. */
export const discardApplicationDraft = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        userId: v.string(),
        draftId: v.string(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const draft = await ownDraft(
            ctx,
            args.draftId,
            args.guildId,
            args.userId
        )
        if (draft) await ctx.db.delete(draft._id)
        return { ok: true }
    },
})

type ClaimFailure =
    | { ok: false; reason: "disabled" | "expired" | "busy" | "in-clan" }
    | { ok: false; reason: "incomplete"; windowId: string }
    | {
          ok: false
          reason: "open-application"
          number: number
          threadId: string
      }

/** The checks before a draft may be sent (L4-B03): complete, not in the clan, nothing open. */
async function submissionCheck(
    ctx: Ctx,
    draft: Doc<"membershipApplicationFormDrafts">
): Promise<
    | ClaimFailure
    | {
          ok: true
          setup: NonNullable<Awaited<ReturnType<typeof applicationSetup>>>
          answers: ApplicationAnswers
          verifiedSteamId: string | null
          plan: ReturnType<typeof planApplication>
          category: ApplicationCategory
      }
> {
    const setup = await applicationSetup(ctx, draft.guildId)
    if (!setup?.settings.enabled) return { ok: false, reason: "disabled" }
    const answers = draftAnswers(draft)
    const [verifiedSteamId, previousPlayers, open, assignedGames] =
        await Promise.all([
            verifiedSteam(ctx, draft.creatorId),
            previousPlayersFor(ctx, draft.guildId, answers.inGameName),
            openApplicationOf(ctx, draft.guildId, draft.creatorId),
            assignedGamesOf(ctx, draft.guildId, draft.creatorId),
        ])
    const plan = planApplication({
        form: setup.form,
        categories: setup.categories,
        answers,
        previousPlayers,
    })
    const missing = nextWindow(plan, answers, verifiedSteamId)
    if (missing || !plan.category)
        return {
            ok: false,
            reason: "incomplete",
            windowId: missing?.id ?? "about",
        }
    if (open) return { ok: false, reason: "open-application", ...open }
    const game: GameId = categoryGame(plan.category)
    if (assignedGames.some((assigned) => matchesGameScope(assigned, game)))
        return { ok: false, reason: "in-clan" }
    return {
        ok: true,
        setup,
        answers,
        verifiedSteamId,
        plan,
        category: plan.category,
    }
}

/**
 * Holds a complete draft for the bot while it creates the thread and the
 * card (L6-B04); a second click or worker finds it busy. Returns what the
 * card shows, formatted in the clan language.
 */
export const claimApplicationSubmission = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        userId: v.string(),
        draftId: v.string(),
        source: sourceValidator,
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const draft = await ownDraft(
            ctx,
            args.draftId,
            args.guildId,
            args.userId
        )
        if (!draft) return { ok: false as const, reason: "expired" as const }
        const now = Date.now()
        const staleClaim =
            draft.submissionStatus === "claimed" &&
            (draft.claimedUntil ?? 0) <= now
        const claimable =
            args.source === "web"
                ? draft.source === "web" &&
                  (draft.submissionStatus === "queued" || staleClaim)
                : draft.submissionStatus === undefined || staleClaim
        if (!claimable) return { ok: false as const, reason: "busy" as const }
        const check = await submissionCheck(ctx, draft)
        if (!check.ok) {
            if (args.source === "web")
                await ctx.db.patch(draft._id, {
                    submissionStatus: "failed",
                    submissionError: check.reason,
                })
            return check
        }
        await ctx.db.patch(draft._id, {
            submissionStatus: "claimed",
            claimedUntil: now + 2 * 60 * 1000,
        })
        const { setup, answers, verifiedSteamId, plan, category } = check
        const guild = await getGuildByDiscordId(ctx, draft.guildId)
        const accounts = submittedAccounts(answers, verifiedSteamId)
        return {
            ok: true as const,
            submission: {
                draftId: String(draft._id),
                source: draft.source,
                config: normalizeConfigDoc(setup.config),
                clanName: guild?.name ?? "",
                guildRecordId: guild ? String(guild._id) : null,
                category,
                games: plan.games,
                inGameName: answers.inGameName ?? "",
                accounts,
                answers: submittedAnswers(plan, answers, (question, values) =>
                    formatAnswer(question, values, setup.copy.fields)
                ),
                initialStatus: skipsPendingOnApply(setup.settings, category)
                    ? ("recruit" as const)
                    : ("pending" as const),
            },
        }
    },
})

/**
 * The bot could not finish a claimed submission: a Discord draft becomes
 * sendable again, a web submission shows as failed on the web page.
 */
export const releaseApplicationSubmission = mutation({
    args: {
        secret: v.string(),
        draftId: v.string(),
        error: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const id = ctx.db.normalizeId(
            "membershipApplicationFormDrafts",
            args.draftId
        )
        const draft = id ? await ctx.db.get(id) : null
        if (!draft) return { ok: true }
        await ctx.db.patch(
            draft._id,
            draft.source === "web"
                ? {
                      submissionStatus: "failed",
                      submissionError: (args.error ?? "failed").slice(0, 120),
                      claimedUntil: undefined,
                  }
                : {
                      submissionStatus: undefined,
                      claimedUntil: undefined,
                  }
        )
        return { ok: true }
    },
})

/** Web submissions waiting for the bot to create their thread. */
export const listQueuedWebApplications = query({
    args: { secret: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const [queued, claimed] = await Promise.all(
            (["queued", "claimed"] as const).map((status) =>
                ctx.db
                    .query("membershipApplicationFormDrafts")
                    .withIndex("submissionStatus", (q) =>
                        q.eq("submissionStatus", status)
                    )
                    .take(25)
            )
        )
        // A claim the bot never finished (a restart) is picked up again.
        const stale = claimed!.filter(
            (draft) =>
                draft.source === "web" &&
                (draft.claimedUntil ?? 0) <= Date.now()
        )
        return [...queued!, ...stale].map((draft) => ({
            draftId: String(draft._id),
            guildId: draft.guildId,
            creatorId: draft.creatorId,
        }))
    },
})

// --- Decisions on the thread card (L6-B08) ---------------------------------------

async function applicationByThread(ctx: Ctx, threadId: string) {
    return await ctx.db
        .query("membershipApplicationThreads")
        .withIndex("threadId", (q) => q.eq("threadId", threadId))
        .unique()
}

/**
 * One decision at a time: the buttons and `/close_application` claim the
 * application before writing the membership. A closed application reports
 * who decided what.
 */
export const claimApplicationDecision = mutation({
    args: { secret: v.string(), threadId: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const application = await applicationByThread(ctx, args.threadId)
        if (!application)
            return { ok: false as const, reason: "missing" as const }
        if (application.status === "closed")
            return {
                ok: false as const,
                reason: "closed" as const,
                outcome: application.closeOutcome ?? null,
                closedByUserId: application.closedByUserId ?? null,
            }
        const now = Date.now()
        if ((application.decisionLeaseUntil ?? 0) > now)
            return { ok: false as const, reason: "busy" as const }
        await ctx.db.patch(application._id, {
            decisionLeaseUntil: now + 60_000,
        })
        return { ok: true as const }
    },
})

export const releaseApplicationDecision = mutation({
    args: { secret: v.string(), threadId: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const application = await applicationByThread(ctx, args.threadId)
        if (application?.status === "open")
            await ctx.db.patch(application._id, {
                decisionLeaseUntil: undefined,
            })
        return { ok: true }
    },
})

/** "Ještě nerozhodnuto": records who and when; the thread stays open (L6-49). */
export const markApplicationUndecided = mutation({
    args: {
        secret: v.string(),
        threadId: v.string(),
        userId: v.string(),
        name: v.string(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const application = await applicationByThread(ctx, args.threadId)
        if (!application || application.status !== "open")
            return { ok: false as const }
        const now = new Date().toISOString()
        await ctx.db.patch(application._id, {
            undecidedByUserId: args.userId,
            undecidedByName: args.name.slice(0, 80),
            undecidedAt: now,
            updatedAt: now,
        })
        return { ok: true as const, at: now }
    },
})

// --- Variant B: the web form (N4-42, L6-16, L6-17, L6-B10) -------------------------

const actorArgs = {
    secret: v.string(),
    actor: dashboardActor,
    guildId: v.string(),
}

/** The signed-in applicant from the dashboard session; never a browser-sent ID. */
async function webApplicant(
    ctx: Ctx,
    args: {
        secret: string
        guildId: string
        actor: { sid: string; subject: string; userRecordId: string }
    }
) {
    assertSessionGateway(args.secret)
    const active = await activeDashboardSession(
        ctx,
        args.actor.sid,
        args.actor.subject,
        args.actor.userRecordId
    )
    if (!active) return null
    return { userId: active.session.subject }
}

/** The web form page: unavailable unless applications and the web switch are on. */
export const webApplicationPage = query({
    args: actorArgs,
    handler: async (ctx, args) => {
        const applicant = await webApplicant(ctx, args)
        if (!applicant) return { status: "signed-out" as const }
        const state = await applicationState(
            ctx,
            args.guildId,
            applicant.userId
        )
        if (!state?.enabled || !state.webFormEnabled)
            return { status: "unavailable" as const }
        const user = await getUserByDiscordId(ctx, applicant.userId)
        return {
            status: "ready" as const,
            applicantName: user?.name ?? "",
            state,
        }
    },
})

export const saveWebApplicationWindow = mutation({
    args: { ...actorArgs, windowId: v.string(), values: valuesValidator },
    handler: async (ctx, args) => {
        const applicant = await webApplicant(ctx, args)
        if (!applicant)
            return { ok: false as const, reason: "signed-out" as const }
        const config = await configOf(ctx, args.guildId)
        if (config?.membershipSettings?.webFormEnabled !== true)
            return { ok: false as const, reason: "disabled" as const }
        return await saveWindow(ctx, {
            guildId: args.guildId,
            userId: applicant.userId,
            windowId: args.windowId,
            values: args.values,
            source: "web",
        })
    },
})

/** "Odeslat přihlášku" on the web: the bot creates the same thread and card. */
export const submitWebApplication = mutation({
    args: actorArgs,
    handler: async (ctx, args) => {
        const applicant = await webApplicant(ctx, args)
        if (!applicant)
            return { ok: false as const, reason: "signed-out" as const }
        const config = await configOf(ctx, args.guildId)
        if (config?.membershipSettings?.webFormEnabled !== true)
            return { ok: false as const, reason: "disabled" as const }
        const draft = await liveDraft(ctx, args.guildId, applicant.userId)
        if (!draft) return { ok: false as const, reason: "expired" as const }
        if (
            draft.submissionStatus === "queued" ||
            draft.submissionStatus === "claimed"
        )
            return { ok: true as const }
        const check = await submissionCheck(ctx, draft)
        if (!check.ok) return check
        const now = Date.now()
        await ctx.db.patch(draft._id, {
            source: "web",
            submissionStatus: "queued",
            submissionError: undefined,
            // The bot needs a little time; the draft must not expire meanwhile.
            expiresAt: Math.max(draft.expiresAt, now + 60 * 60 * 1000),
            updatedAt: new Date(now).toISOString(),
        })
        return { ok: true as const }
    },
})

/** Where a web submission is: editing, waiting for the bot, failed or done. */
export const webApplicationStatus = query({
    args: actorArgs,
    handler: async (ctx, args) => {
        const applicant = await webApplicant(ctx, args)
        if (!applicant) return { state: "signed-out" as const }
        const draft = await liveDraft(ctx, args.guildId, applicant.userId)
        if (
            draft?.submissionStatus === "queued" ||
            draft?.submissionStatus === "claimed"
        )
            return { state: "queued" as const }
        if (draft?.submissionStatus === "failed")
            return {
                state: "failed" as const,
                reason: draft.submissionError ?? "failed",
            }
        const open = await openApplicationOf(
            ctx,
            args.guildId,
            applicant.userId
        )
        if (open) return { state: "done" as const, ...open }
        return { state: "editing" as const }
    },
})

// --- The panel image (N4-09) ---------------------------------------------------------

/**
 * Keeps an uploaded panel banner referenced while the application panel
 * uses it, so the unattached-upload sweep never removes it. Returns the
 * image's public URL for `panelImageUrl`.
 */
export const attachMembershipPanelImage = mutation({
    args: { ...actorArgs, assetId: v.union(v.string(), v.null()) },
    handler: async (ctx, args) => {
        await authorizeDashboardAdmin(ctx, args)
        const asset = args.assetId
            ? await attachableAsset(ctx, {
                  assetId: args.assetId,
                  guildId: args.guildId,
                  kind: "panel-banner",
              })
            : null
        if (args.assetId && !asset) return { ok: false as const }
        await syncAssetReferences(ctx, {
            guildId: args.guildId,
            owner: "panel",
            ownerId: `membership-panel:${args.guildId}`,
            assetIds: asset ? [asset._id as Id<"imageAssets">] : [],
        })
        return { ok: true as const, url: asset?.publicUrl ?? null }
    },
})

/** Deletes drafts older than 24 h (L6-08, N4-37); web submissions in flight wait. */
export const deleteExpiredDrafts = internalMutation({
    args: {},
    handler: async (ctx) => {
        const expired = await ctx.db
            .query("membershipApplicationFormDrafts")
            .withIndex("expiresAt", (q) => q.lt("expiresAt", Date.now()))
            .take(100)
        for (const draft of expired)
            if (
                draft.submissionStatus !== "queued" &&
                draft.submissionStatus !== "claimed"
            )
                await ctx.db.delete(draft._id)
    },
})
