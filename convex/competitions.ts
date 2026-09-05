import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET ?? "dev-internal-auth-secret";
const NOW = () => new Date().toISOString();
const ECL_DIVISIONS = [
  ["Division 1", ["Greyhounds", "Omen", "The Circle", "Wolves of War", "Bober Kurwa"]],
  ["Division 2", ["82AD", "HaiiTeD", "Kebaguettes & Bayonets", "Yoko"]],
  ["Division 3", ["404", "Finns Let Loose", "Valkyria", "ËJiG"]],
  ["Division 4", ["Black Bees", "Overlord", "PZJR", "We Are Ready"]],
  ["Division 5", ["Betrunkenedonnerbalkenbesitzer", "Hell´s Trident", "Luftwaffen-Jäger-Regiment 46", "Oktogon", "Special Beer Delivery"]],
  ["Division 6", ["February Division", "MIB33", "No Tomorrow", "Panzerbrigade", "United Teams Coalition"]],
] as const;

function normalizedName(value: string) { return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/[^a-z0-9]+/g, ""); }
function assertSecret(secret: string) { if (secret !== INTERNAL_AUTH_SECRET) throw new Error("Unauthorized."); }

async function findGuildByName(ctx: any, name: string) {
  return (await ctx.db.query("guilds").collect()).find((guild: any) => normalizedName(guild.name) === normalizedName(name));
}

async function resolveGuild(ctx: any, name: string) {
  const existing = await findGuildByName(ctx, name);
  if (existing) return existing._id as Id<"guilds">;
  const now = NOW();
  return await ctx.db.insert("guilds", { name, avatar: "/logo.png", botInside: false, adminIds: [], memberIds: [], members: [], mercenaryIds: [], createdAt: now, updatedAt: now });
}

export const seedEcl2026 = mutation({ args: { secret: v.string() }, handler: async (ctx, args) => {
  assertSecret(args.secret);
  let competition = await ctx.db.query("competitions").withIndex("slug", q => q.eq("slug", "ecl-2026")).unique();
  const now = NOW();
  if (!competition) {
    const id = await ctx.db.insert("competitions", { slug: "ecl-2026", name: "European Community League", season: "2026", description: "European Community League 2026 season", format: { kind: "league_with_playoffs", standings: "ecl_cap_score" }, createdAt: now, updatedAt: now });
    competition = await ctx.db.get(id);
  }
  if (!competition) throw new Error("Could not create ECL.");
  for (let order = 0; order < ECL_DIVISIONS.length; order++) {
    const [name, teams] = ECL_DIVISIONS[order];
    let division = (await ctx.db.query("competitionDivisions").withIndex("competitionId", q => q.eq("competitionId", competition!._id)).collect()).find(item => item.name === name);
    if (!division) { const id = await ctx.db.insert("competitionDivisions", { competitionId: competition._id, name, order, createdAt: now }); division = (await ctx.db.get(id)) ?? undefined; }
    if (!division) continue;
    for (const teamName of teams) {
      const guildId = await resolveGuild(ctx, teamName);
      const joined = await ctx.db.query("competitionTeams").withIndex("competitionId_guildId", q => q.eq("competitionId", competition!._id).eq("guildId", guildId)).unique();
      if (!joined) await ctx.db.insert("competitionTeams", { competitionId: competition._id, guildId, divisionId: division._id, withdrawn: teamName === "Bober Kurwa", createdAt: now, updatedAt: now });
    }
  }
  return { competitionId: competition._id };
} });

export const getPublic = query({ args: { slug: v.string() }, handler: async (ctx, args) => {
  const competition = await ctx.db.query("competitions").withIndex("slug", q => q.eq("slug", args.slug)).unique(); if (!competition) return null;
  const [divisions, joins, fixtures] = await Promise.all([ctx.db.query("competitionDivisions").withIndex("competitionId", q => q.eq("competitionId", competition._id)).collect(), ctx.db.query("competitionTeams").withIndex("competitionId", q => q.eq("competitionId", competition._id)).collect(), ctx.db.query("competitionFixtures").withIndex("competitionId", q => q.eq("competitionId", competition._id)).collect()]);
  const guildIds = [...new Set([...joins.map(x => x.guildId), ...fixtures.flatMap(x => [x.teamAId, x.teamBId])])]; const guilds = new Map((await Promise.all(guildIds.map(id => ctx.db.get(id)))).filter(Boolean).map(g => [g!._id, g!]));
  return { id: String(competition._id), slug: competition.slug, name: competition.name, season: competition.season, divisions: divisions.sort((a,b) => a.order-b.order).map(division => ({ id: String(division._id), name: division.name, teams: joins.filter(x => x.divisionId === division._id).map(x => ({ id: String(x.guildId), name: guilds.get(x.guildId)?.name ?? "Unknown team", withdrawn: x.withdrawn })), fixtures: fixtures.filter(x => x.divisionId === division._id).map(x => ({ id: String(x._id), phase: x.phase, teamAId: String(x.teamAId), teamBId: String(x.teamBId), scoreA: x.scoreA, scoreB: x.scoreB, status: x.status, scheduledAt: x.scheduledAt, eventId: x.eventId ? String(x.eventId) : undefined })) })) };
} });

export const listGuilds = query({ args: {}, handler: async (ctx) => (await ctx.db.query("guilds").collect()).map(guild => ({ id: String(guild._id), name: guild.name, isGhost: !guild.discordId && !guild.id })).sort((left, right) => left.name.localeCompare(right.name)) });

export const mergeGuilds = mutation({ args: { secret: v.string(), primaryGuildId: v.id("guilds"), secondaryGuildId: v.id("guilds") }, handler: async (ctx, args) => {
  assertSecret(args.secret); if (args.primaryGuildId === args.secondaryGuildId) throw new Error("Pick two different clans.");
  const [primary, secondary] = await Promise.all([ctx.db.get(args.primaryGuildId), ctx.db.get(args.secondaryGuildId)]); if (!primary || !secondary) throw new Error("Clan not found.");
  const secondaryTeams = await ctx.db.query("competitionTeams").withIndex("guildId", q => q.eq("guildId", args.secondaryGuildId)).collect();
  for (const membership of secondaryTeams) { const existing = await ctx.db.query("competitionTeams").withIndex("competitionId_guildId", q => q.eq("competitionId", membership.competitionId).eq("guildId", args.primaryGuildId)).unique(); if (existing) await ctx.db.delete(membership._id); else await ctx.db.patch(membership._id, { guildId: args.primaryGuildId, updatedAt: NOW() }); }
  const fixtures = await ctx.db.query("competitionFixtures").collect(); for (const fixture of fixtures) { const patch: { teamAId?: Id<"guilds">; teamBId?: Id<"guilds">; updatedAt?: string } = {}; if (fixture.teamAId === args.secondaryGuildId) patch.teamAId = args.primaryGuildId; if (fixture.teamBId === args.secondaryGuildId) patch.teamBId = args.primaryGuildId; if (patch.teamAId || patch.teamBId) { patch.updatedAt = NOW(); await ctx.db.patch(fixture._id, patch); } }
  if (!secondary.discordId && !secondary.id) await ctx.db.delete(args.secondaryGuildId);
  return { primaryGuildId: String(args.primaryGuildId), secondaryDeleted: !secondary.discordId && !secondary.id };
} });

export const linkEvent = mutation({ args: { secret: v.string(), competitionId: v.id("competitions"), eventId: v.id("events"), teamAId: v.id("guilds"), teamBId: v.id("guilds"), divisionId: v.optional(v.id("competitionDivisions")) }, handler: async (ctx, args) => {
  assertSecret(args.secret); const event = await ctx.db.get(args.eventId); if (!event || event.kind === "training") throw new Error("Only matches can be added to a competition.");
  const existing = await ctx.db.query("competitionFixtures").withIndex("eventId", q => q.eq("eventId", args.eventId)).unique(); if (existing) return existing._id;
  const now = NOW(); const score = event.eventResult?.score;
  const fixtureId = await ctx.db.insert("competitionFixtures", { competitionId: args.competitionId, divisionId: args.divisionId, phase: "league", teamAId: args.teamAId, teamBId: args.teamBId, scoreA: score?.sideA, scoreB: score?.sideB, status: score ? "final" : "scheduled", eventId: args.eventId, createdAt: now, updatedAt: now }); await ctx.db.patch(args.eventId, { competitionFixtureId: fixtureId }); return fixtureId;
} });

export const saveFixture = mutation({ args: { secret: v.string(), competitionId: v.id("competitions"), divisionId: v.optional(v.id("competitionDivisions")), phase: v.union(v.literal("league"),v.literal("playoff"),v.literal("relegation")), teamAId: v.id("guilds"), teamBId: v.id("guilds"), scheduledAt: v.optional(v.string()), scoreA: v.optional(v.number()), scoreB: v.optional(v.number()), status: v.union(v.literal("scheduled"),v.literal("final"),v.literal("forfeit")) }, handler: async (ctx,args) => { assertSecret(args.secret); if (args.teamAId === args.teamBId) throw new Error("A team cannot play itself."); const now=NOW(); return await ctx.db.insert("competitionFixtures", {...args, createdAt:now,updatedAt:now}); } });
