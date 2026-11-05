import {
    autoImportSettingsSchema,
    teamFixtureSchema,
    importedFieldsSchema,
    matchFixtureTeams,
    ownTeamFirst,
} from "../src/domain/wardogs-league/team-api"
import {
    ConvexEventCommandRepository,
    DelegatingEventScorePort,
} from "../src/infrastructure/convex/event-command-repositories"
import { ImportTeamFixtureUseCase } from "../src/application/wardogs-league/import-team-fixture"
import { syncEventAssetReferences } from "../src/infrastructure/convex/event-asset-references"
import { credentialEnvelopeSchema } from "../src/domain/game-data/credentials.schema"
import { UpsertEventUseCase } from "../src/application/events/upsert-event.use-case"
import { refreshEventSchedule } from "../src/infrastructure/convex/event-scheduling"
import { matchTemplateSchema } from "../src/lib/validation/match-templates"
import { matchTeamAssignmentSchema } from "../src/domain/teams/match-teams"
import { authorizeDashboardAdmin, dashboardActor } from "./dashboardActor"
import { loadEventDiscussionDefaults } from "./eventDiscussionSettings"
import { templatesFor } from "../src/domain/events/match-templates"
import { trackedMatch, ensureTracked } from "./leagueTrackingStore"
import { currentEventStatus } from "../src/domain/events/status"
import { withGameOverrides } from "../src/domain/games/game"
import { query, internalQuery } from "./_generated/server"
import { systemClock } from "../src/domain/shared/clock"
import { internalMutation } from "./integrationMutation"
import type { QueryCtx } from "./_generated/server"
import { assetPublicUrl } from "./imageAssetStore"
import { getGuildByDiscordId } from "./identity"
import { mutation } from "./_generated/server"
import { v } from "convex/values"
import { z } from "zod"

const access = {
    secret: v.string(),
    guildId: v.string(),
    actor: dashboardActor,
}
const configFor = (ctx: Pick<QueryCtx, "db">, guildId: string) =>
    ctx.db
        .query("leagueAutoImportSettings")
        .withIndex("guildId", (q) => q.eq("guildId", guildId))
        .unique()
export const read = query({
    args: access,
    handler: async (ctx, args) => {
        const { server } = await authorizeDashboardAdmin(ctx, args)
        const config = await configFor(ctx, args.guildId)
        const discord = await ctx.db
            .query("discordConfigs")
            .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
            .unique()
        const scoped = discord
            ? withGameOverrides(discord, discord.gameOverrides, "wardogs")
            : null
        const linked = await ctx.db
            .query("teamDirectory")
            .withIndex("linkedGuildId", (q) =>
                q.eq("linkedGuildId", args.guildId)
            )
            .take(20)
        const ownTeams = linked.filter(
            (t) => t.gameId === "wardogs" && !t.archivedAt
        )
        const records = await ctx.db
            .query("leagueAutoImportFixtures")
            .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
            .order("desc")
            .take(100)
        return {
            settings: config
                ? {
                      ...autoImportSettingsSchema.parse(
                          JSON.parse(config.settingsJson)
                      ),
                      enabled: config.enabled,
                  }
                : null,
            defaults: {
                teamCode:
                    ownTeams.length === 1 ? (ownTeams[0].shortCode ?? "") : "",
                announcementChannelId: scoped?.announcementsChannelId ?? "",
                eventInfoChannelId: scoped?.eventInfoChannelId ?? "",
                eventResultsChannelId: discord?.eventResultsChannelId ?? "",
            },
            hasKey: Boolean(config),
            lastSuccessAt: config?.lastSuccessAt ?? null,
            error: config?.error ?? null,
            templates: templatesFor(server.matchTemplates, "match", "wardogs"),
            available: server.enabledGames?.includes("wardogs") ?? false,
            records: records.map((r) => ({
                fixtureId: r.fixtureId,
                eventId: r.eventId ?? null,
                issue: r.issue ?? null,
            })),
        }
    },
})
export const save = mutation({
    args: {
        ...access,
        settingsJson: v.string(),
        credentialJson: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const { server } = await authorizeDashboardAdmin(ctx, args)
        if (!server.enabledGames?.includes("wardogs"))
            throw new Error("Wardogs is not enabled.")
        const settings = autoImportSettingsSchema.parse(
            JSON.parse(args.settingsJson)
        )
        const template = templatesFor(
            server.matchTemplates,
            "match",
            "wardogs"
        ).find((t) => t.id === settings.templateId)
        if (settings.enabled && !template)
            throw new Error("Select a Wardogs match template.")
        if (
            template &&
            settings.registrationHoursBeforeStart * 60 <=
                template.meetingMinutesBeforeStart +
                    template.registrationHoursBeforeMeeting * 60
        )
            throw new Error("Registration must open before it closes.")
        const old = await configFor(ctx, args.guildId)
        const credentialJson = args.credentialJson ?? old?.credentialJson
        if (!credentialJson) throw new Error("Provide a Wardogs API key.")
        credentialEnvelopeSchema.parse(JSON.parse(credentialJson))
        const value = {
            guildId: args.guildId,
            settingsJson: JSON.stringify(settings),
            credentialJson,
            enabled: settings.enabled,
            revision: (old?.revision ?? 0) + 1,
            nextPollAt: Date.now(),
            leaseUntil: 0,
            fence: (old?.fence ?? 0) + 1,
            error: undefined,
        }
        if (old) await ctx.db.patch(old._id, value)
        else await ctx.db.insert("leagueAutoImportSettings", value)
        return { ok: true }
    },
})
export const claim = internalMutation({
    args: {},
    handler: async (ctx) => {
        const now = Date.now()
        const rows = await ctx.db
            .query("leagueAutoImportSettings")
            .withIndex("due", (q) =>
                q.eq("enabled", true).lte("nextPollAt", now)
            )
            .take(20)
        const row = rows.find((r) => r.leaseUntil <= now)
        if (!row) return null
        const guild = await getGuildByDiscordId(ctx, row.guildId)
        if (!guild?.enabledGames?.includes("wardogs")) {
            await ctx.db.patch(row._id, { enabled: false })
            return null
        }
        const fence = row.fence + 1
        await ctx.db.patch(row._id, {
            fence,
            leaseUntil: now + 5 * 60_000,
            nextPollAt: now + 15 * 60_000,
        })
        return { ...row, fence }
    },
})
export const finish = internalMutation({
    args: {
        id: v.id("leagueAutoImportSettings"),
        fence: v.number(),
        revision: v.number(),
        error: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const row = await ctx.db.get(args.id)
        if (!row || row.fence !== args.fence || row.revision !== args.revision)
            return
        await ctx.db.patch(row._id, {
            leaseUntil: 0,
            error: args.error,
            ...(!args.error ? { lastSuccessAt: Date.now() } : {}),
        })
    },
})
export const importFixture = internalMutation({
    args: {
        id: v.id("leagueAutoImportSettings"),
        fence: v.number(),
        revision: v.number(),
        fixtureJson: v.string(),
    },
    handler: async (ctx, args) => {
        const config = await ctx.db.get(args.id)
        if (
            !config?.enabled ||
            config.fence !== args.fence ||
            config.revision !== args.revision ||
            config.leaseUntil < Date.now()
        )
            return
        const defaults = autoImportSettingsSchema.parse(
            JSON.parse(config.settingsJson)
        )
        const guild = await getGuildByDiscordId(ctx, config.guildId)
        if (!guild?.enabledGames?.includes("wardogs")) return
        let fixture = teamFixtureSchema.parse(JSON.parse(args.fixtureJson))
        const old = await ctx.db
            .query("leagueAutoImportFixtures")
            .withIndex("identity", (q) =>
                q.eq("guildId", config.guildId).eq("fixtureId", fixture.id)
            )
            .unique()
        const settings = old?.settingsJson
            ? autoImportSettingsSchema.parse(JSON.parse(old.settingsJson))
            : defaults
        fixture = ownTeamFirst(fixture, settings.teamCode) ?? fixture
        const tracked = await trackedMatch(ctx, config.guildId, fixture.id)
        const current = old?.eventId ? await ctx.db.get(old.eventId) : null
        if (
            current &&
            (current.guildId !== config.guildId ||
                current.gameId !== "wardogs" ||
                current.kind !== "match")
        )
            throw new Error("Imported match scope mismatch.")
        const template = old?.templateJson
            ? matchTemplateSchema.parse(JSON.parse(old.templateJson))
            : templatesFor(guild.matchTemplates, "match", "wardogs").find(
                  (t) => t.id === settings.templateId
              )
        if (!template) throw new Error("Default match template is missing.")
        const catalogue = await ctx.db
            .query("teamDirectory")
            .withIndex("gameId_archivedAt_normalizedName", (q) =>
                q.eq("gameId", "wardogs").eq("archivedAt", null)
            )
            .take(2000)
        const teams = matchFixtureTeams(
            fixture,
            await Promise.all(
                catalogue
                    .filter((t) =>
                        fixture.participants.some(
                            (p) =>
                                p.team.code.toLowerCase() ===
                                    t.shortCode?.toLowerCase() ||
                                p.team.name.toLowerCase() ===
                                    t.name.toLowerCase()
                        )
                    )
                    .map(async (t) => ({
                        id: String(t._id),
                        ...t,
                        logoAssetId: t.logoAssetId
                            ? String(t.logoAssetId)
                            : null,
                        logoUrl: await assetPublicUrl(ctx, t.logoAssetId),
                    }))
            ),
            current?.matchTeams,
            new Date().toISOString()
        )
        const groups = await ctx.db
            .query("groups")
            .withIndex("guildId_gameId", (q) =>
                q.eq("guildId", config.guildId).eq("gameId", "wardogs")
            )
            .collect()
        const repository = new ConvexEventCommandRepository(ctx)
        await new ImportTeamFixtureUseCase({
            create: async (command) => {
                for (const [table, id] of [
                    ["squadPresets", template.squadPresetId],
                    ["topicPresets", template.topicPresetId],
                ] as const) {
                    if (!id) continue
                    const presetId = ctx.db.normalizeId(table, id)
                    const preset = presetId ? await ctx.db.get(presetId) : null
                    if (
                        !preset ||
                        preset.guildId !== config.guildId ||
                        ("gameId" in preset &&
                            preset.gameId &&
                            preset.gameId !== "wardogs")
                    )
                        throw new Error("Invalid template preset.")
                }
                return new UpsertEventUseCase(
                    repository,
                    new DelegatingEventScorePort(async () => {
                        throw new Error("Creation cannot score signups.")
                    }),
                    systemClock
                ).execute(command)
            },
            update: (id, patch) => repository.update(id, patch),
            link: async (id) => {
                const link =
                    tracked ??
                    (await ensureTracked(ctx, config.guildId, fixture.id))
                await ctx.db.patch(link._id, { eventId: id })
            },
            refreshSchedule: async (id) => {
                const normalized = ctx.db.normalizeId("events", id)
                if (!normalized) throw new Error("Invalid imported event ID.")
                const saved = await ctx.db.get(normalized)
                if (saved) await syncEventAssetReferences(ctx, saved)
                await refreshEventSchedule(ctx, normalized)
            },
            save: async (value) => {
                const eventId = value.eventId
                    ? ctx.db.normalizeId("events", value.eventId)
                    : null
                if (value.eventId && !eventId)
                    throw new Error("Invalid imported event ID.")
                const patch = {
                    issue: value.issue,
                    ...(eventId ? { eventId } : {}),
                    ...(value.baseline
                        ? { baselineJson: JSON.stringify(value.baseline) }
                        : {}),
                    ...(value.teamsBaseline
                        ? {
                              teamBaselineJson: JSON.stringify(
                                  value.teamsBaseline
                              ),
                          }
                        : {}),
                    ...(value.template
                        ? {
                              templateJson:
                                  old?.templateJson ??
                                  JSON.stringify(value.template),
                          }
                        : {}),
                    ...(value.settings
                        ? {
                              settingsJson:
                                  old?.settingsJson ??
                                  JSON.stringify(value.settings),
                          }
                        : {}),
                    ...(value.overrides ? { overrides: value.overrides } : {}),
                    ...(value.changed ? { cachePending: true } : {}),
                    updatedAt: Date.now(),
                }
                if (old) await ctx.db.patch(old._id, patch)
                else
                    await ctx.db.insert("leagueAutoImportFixtures", {
                        guildId: config.guildId,
                        fixtureId: fixture.id,
                        overrides: [],
                        ...patch,
                    })
            },
        }).execute({
            guildId: config.guildId,
            fixture,
            template,
            settings,
            now: Date.now(),
            current: current
                ? { ...current, status: currentEventStatus(current) }
                : null,
            previous: old
                ? {
                      eventId: old.eventId ? String(old.eventId) : undefined,
                      baseline: old.baselineJson
                          ? importedFieldsSchema.parse(
                                JSON.parse(old.baselineJson)
                            )
                          : undefined,
                      teamsBaseline: old.teamBaselineJson
                          ? z
                                .array(matchTeamAssignmentSchema)
                                .parse(JSON.parse(old.teamBaselineJson))
                          : undefined,
                      overrides: old.overrides,
                  }
                : undefined,
            manuallyManaged: Boolean(
                tracked?.ignored ||
                tracked?.paused ||
                (tracked?.eventId && tracked.eventId !== old?.eventId)
            ),
            assignments: teams.assignments,
            unmatched: teams.unmatched.length > 0,
            offeredGroupIds: groups.map((g) => String(g._id)),
            discussion: await loadEventDiscussionDefaults(
                ctx,
                config.guildId,
                "wardogs"
            ),
        })
    },
})

export const pendingCache = internalQuery({
    args: {},
    handler: (ctx) =>
        ctx.db
            .query("leagueAutoImportFixtures")
            .withIndex("cachePending", (q) => q.eq("cachePending", true))
            .take(30),
})
export const acknowledgeCache = internalMutation({
    args: { id: v.id("leagueAutoImportFixtures"), updatedAt: v.number() },
    handler: async (ctx, args) => {
        const row = await ctx.db.get(args.id)
        if (row?.updatedAt === args.updatedAt)
            await ctx.db.patch(row._id, { cachePending: false })
    },
})
