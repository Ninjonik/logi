import {
    assertMembershipSecret,
    authorizeMembership,
    ensureMembershipGuild,
    memberObservation,
    membershipGuild,
    membershipPolicy,
} from "./membershipAccess"
import {
    observationChange,
    type ProviderObservation,
} from "../src/domain/membership/observation"
import {
    appendIntegrationChange,
    integrationRecord,
} from "./integrationChangeLog"
import { projectMembership } from "../src/domain/membership/observation.schema"
import { nextRevision, revisionOrder } from "../src/domain/integrations/change"
import { GAME_IDS, type GameId } from "../src/domain/games/game"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { readMembershipAssignment } from "./membershipSubject"
import type { Doc } from "./_generated/dataModel"

// The secret check, guild/observation lookups and the key policy live in
// `membershipAccess.ts` (free of Zod); they stay exported from here for
// existing importers. The projections below validate and keep the schema.
export {
    assertMembershipSecret,
    authorizeMembership,
    ensureMembershipGuild,
    memberObservation,
    membershipGuild,
    membershipPolicy,
}

export async function readMembershipRecord(
    ctx: Pick<QueryCtx, "db">,
    args: { guildId: string; gameId: string; discordUserId: string },
    grant: NonNullable<Awaited<ReturnType<typeof authorizeMembership>>>,
    maxAgeMs: number,
    forceUnavailable = false
) {
    const guild = await membershipGuild(ctx, args.guildId),
        raw = await memberObservation(ctx, args.guildId, args.discordUserId)
    const assignment = await readMembershipAssignment(ctx, args)
    const stamp = await integrationRecord(ctx, {
        guildId: args.guildId,
        gameId: args.gameId,
        resource: "membership-summaries",
        id: args.discordUserId,
    })
    const revision = [
        stamp?.revision ?? "0",
        grant.policy.version,
        guild?.epochRevision ?? "0",
    ]
        .sort((a, b) => revisionOrder(a).localeCompare(revisionOrder(b)))
        .at(-1)!
    return projectMembership(
        {
            guildId: args.guildId,
            discordUserId: args.discordUserId,
            gameId: args.gameId as GameId,
        },
        raw && forceUnavailable ? { ...raw, unavailable: true } : raw,
        {
            epoch: guild?.epoch ?? "0",
            revision,
            allowedRoleIds: grant.roleIds,
            assignment: assignment
                ? { type: assignment.type, status: assignment.status }
                : null,
            maxAgeMs,
            now: Date.now(),
        }
    )
}

export async function storeMemberObservation(
    ctx: MutationCtx,
    guildId: string,
    discordUserId: string,
    value: ProviderObservation,
    seenRunId?: Doc<"membershipSyncRuns">["_id"]
) {
    const guild = await ensureMembershipGuild(ctx, guildId),
        previous = await memberObservation(ctx, guildId, discordUserId)
    const roleIds =
            value.state === "present" ? [...new Set(value.roleIds)].sort() : [],
        unavailable = value.state === "unknown"
    const evidence = {
        observedAt: value.observedAt,
        receivedAt: new Date().toISOString(),
        refreshUntil: 0,
        nextRefreshAt: 0,
        // Only a reconciliation marks a member seen. A gateway event or a
        // lookup in the middle of a run keeps the mark, or the run's sweep
        // would take the member for departed.
        ...(seenRunId ? { seenRunId } : {}),
    }
    const change = observationChange(previous, {
        state: value.state,
        roleIds,
        epoch: guild.epoch,
        unavailable,
    })
    if (previous && change !== "member") {
        // Same state and roles: newer evidence only. The guild revision, the
        // subject's revision and the change feed stay as they are; a
        // reconciliation of an unchanged clan writes nothing else. A newer
        // epoch is stored with the evidence (freshness compares it with the
        // guild's) but is no change to the member: consumers reset on the
        // epoch itself. A member who is still absent or still unknown under
        // the same epoch gains no evidence from being seen so again, so
        // nothing is written at all.
        if (change === "epoch")
            await ctx.db.patch(previous._id, {
                ...evidence,
                epoch: guild.epoch,
            })
        else if (value.state === "present")
            await ctx.db.patch(previous._id, evidence)
        return
    }
    const revision = nextRevision(guild.revision)
    const patch = {
        state: value.state,
        roleIds,
        ...evidence,
        epoch: guild.epoch,
        revision,
        unavailable,
        refreshFence: previous?.refreshFence ?? 0,
        departureRevision:
            value.state === "left" ? revision : previous?.departureRevision,
    }
    if (previous) await ctx.db.patch(previous._id, patch)
    else
        await ctx.db.insert("memberObservations", {
            guildId,
            discordUserId,
            ...patch,
        })
    if (value.state === "left") {
        const access = await ctx.db
            .query("discordMemberAccess")
            .withIndex("guildId_userId", (q) =>
                q.eq("guildId", guildId).eq("userId", discordUserId)
            )
            .unique()
        if (access) await ctx.db.delete(access._id)
    }
    await ctx.db.patch(guild._id, { revision })
    // Every supported game's projection can observe presence independently of its assignment.
    for (const gameId of GAME_IDS)
        await appendIntegrationChange(ctx, {
            guildId,
            gameId,
            resource: "membership-summaries",
            id: discordUserId,
            operation: "upsert",
        })
}
