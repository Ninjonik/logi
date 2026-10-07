import {
    MAX_TRACKED,
    ADMIN_TRACKING_RESERVE,
    MAX_HUMAN_CANDIDATES,
} from "../src/domain/wardogs-league/discovery"
import {
    leagueCollectionWanted,
    leaguePanelsOn,
} from "../src/application/wardogs-league/tracking"
import { isPanelPaused } from "../src/domain/discord-publications/settings"
import { projectLeagueFixture } from "../src/domain/wardogs-league/fixture"
import { appendIntegrationChange } from "./integrationChangeLog"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import type { Doc } from "./_generated/dataModel"
/**
 * League-wide collection (the shared index scan and every fixture) runs while
 * a workspace keeps Wardogs League on, or has a sent, running WD League panel
 * in a workspace that did not turn the League off (L3-55).
 */
export async function leagueCollectionActive(ctx: Pick<QueryCtx, "db">) {
    const settings = await ctx.db.query("leagueTrackingSettings").take(100)
    const enabled = settings.filter((row) => row.enabled)
    if (enabled.length) return true
    const panels = (
        await ctx.db.query("discordPublicPanels").take(5000)
    ).filter(
        (panel) =>
            panel.kind === "league" &&
            !panel.draft &&
            !panel.removing &&
            !isPanelPaused(panel) &&
            leaguePanelsOn(
                settings.find((row) => row.guildId === panel.guildId) ?? null
            )
    ).length
    return leagueCollectionWanted(enabled, panels)
}
export { trackingConfig } from "./leagueTrackingReads"
export function trackedMatch(
    ctx: Pick<QueryCtx, "db">,
    guildId: string,
    matchId: string
) {
    return ctx.db
        .query("leagueTrackedMatches")
        .withIndex("identity", (q) =>
            q.eq("guildId", guildId).eq("matchId", matchId)
        )
        .unique()
}
export async function ensureTracked(
    ctx: MutationCtx,
    guildId: string,
    matchId: string
) {
    const pool = await trackingAdmission(ctx, guildId)
    const row = await pool.admit(matchId, "admin")
    if (!row) throw new Error("Tracking limit reached.")
    return row
}

/** One transaction-local inventory per batch; never read all snapshots for each URL. */
export async function trackingAdmission(ctx: MutationCtx, guildId: string) {
    const rows = await ctx.db
        .query("leagueTrackedMatches")
        .withIndex("guildId", (q) => q.eq("guildId", guildId))
        .take(MAX_TRACKED)
    const retained = new Set<string>()
    return {
        find: (id: string) => rows.find((row) => row.matchId === id),
        async admit(matchId: string, source: "admin" | "index" | "discord") {
            let old = rows.find((row) => row.matchId === matchId)
            const reserveIntake =
                source === "discord" && !old?.pinned && !old?.automatic
            if (
                reserveIntake &&
                !old?.intakeReserved &&
                rows.filter((row) => row.intakeReserved).length >=
                    MAX_HUMAN_CANDIDATES
            )
                return null
            if (old) {
                retained.add(String(old._id))
                if (reserveIntake && !old.intakeReserved) {
                    await ctx.db.patch(old._id, { intakeReserved: true })
                    const updated = { ...old, intakeReserved: true }
                    rows[rows.indexOf(old)] = updated
                    old = updated
                }
                return old
            }
            const capacity =
                source === "admin"
                    ? MAX_TRACKED
                    : MAX_TRACKED - ADMIN_TRACKING_RESERVE
            if (rows.length >= capacity && source !== "discord") {
                // Never evict retained history or control-plane intent. An unknown legacy
                // snapshot is conservative: it may have been tracked before this field existed.
                for (const candidate of [...rows].sort(
                    (a, b) => a.firstSeenAt - b.firstSeenAt
                )) {
                    if (rows.length < capacity) break
                    if (
                        retained.has(String(candidate._id)) ||
                        candidate.state !== "unmatched" ||
                        candidate.tracked ||
                        candidate.everTracked ||
                        (candidate.everTracked === undefined &&
                            candidate.snapshotJson) ||
                        candidate.pinned ||
                        candidate.automatic ||
                        candidate.ignored ||
                        candidate.paused ||
                        candidate.eventId ||
                        candidate.discordRefs.length ||
                        candidate.leaseUntil > Date.now()
                    )
                        continue
                    const publication = await ctx.db
                        .query("discordPublications")
                        .withIndex("guild_key", (q) =>
                            q
                                .eq("guildId", guildId)
                                .eq("key", `league:${candidate._id}`)
                        )
                        .unique()
                    if (publication) {
                        retained.add(String(candidate._id))
                        continue
                    }
                    await ctx.db.delete(candidate._id)
                    rows.splice(rows.indexOf(candidate), 1)
                }
            }
            if (rows.length >= capacity) return null
            const now = Date.now()
            const id = await ctx.db.insert("leagueTrackedMatches", {
                guildId,
                matchId,
                firstSeenAt: now,
                revision: now,
                pinned: false,
                intakeReserved: reserveIntake,
                everTracked: false,
                automatic: false,
                tracked: false,
                announce: false,
                ignored: false,
                paused: false,
                discordRefs: [],
                state: "pending",
                nextRefreshAt: now,
                leaseUntil: 0,
                fence: 0,
            })
            const inserted = (await ctx.db.get(id))!
            rows.push(inserted)
            return inserted
        },
    }
}
export async function updateTracked(
    ctx: MutationCtx,
    row: Doc<"leagueTrackedMatches">,
    patch: Partial<Omit<Doc<"leagueTrackedMatches">, "_id" | "_creationTime">>
) {
    const now = Date.now(),
        revision = Math.max(now, row.revision + 1)
    const everTracked = Boolean(
        row.everTracked ||
        row.tracked ||
        patch.tracked ||
        (row.everTracked === undefined && row.snapshotJson)
    )
    const merged = { ...row, ...patch }
    const intakeReserved =
        merged.pinned || merged.automatic || merged.ignored
            ? false
            : merged.intakeReserved
    await ctx.db.patch(row._id, {
        ...patch,
        everTracked,
        intakeReserved,
        revision,
    })
    const after = { ...merged, everTracked, intakeReserved, revision }
    if (row.tracked || after.tracked)
        await appendIntegrationChange(ctx, {
            guildId: row.guildId,
            gameId: "wardogs",
            resource: "league-fixtures",
            id: row.matchId,
            operation: projectLeagueFixture(after, now) ? "upsert" : "remove",
        })
    return after
}
