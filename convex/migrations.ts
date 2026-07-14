import { mutation } from "./_generated/server";
import { v } from "convex/values";

const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET ?? "dev-internal-auth-secret";

function assertInternalSecret(secret: string) {
  if (secret !== INTERNAL_AUTH_SECRET) {
    throw new Error("Unauthorized.");
  }
}

function normalizePlatformIds(...values: Array<string | string[] | undefined>) {
  return [...new Set(
    values
      .flatMap((value) => Array.isArray(value) ? value : value ? [value] : [])
      .flatMap((entry) => entry.split(","))
      .map((entry) => entry.replace(/\s+/g, "").trim())
      .filter(Boolean),
  )];
}

export const migratePlatformIds = mutation({
  args: {
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const users = await ctx.db.query("users").collect();
    let updated = 0;

    for (const user of users) {
      const legacyUser = user as typeof user & { platformId?: string; steamId?: string };
      const platformIds = normalizePlatformIds(user.platformIds, legacyUser.platformId, legacyUser.steamId);

      const currentPlatformIds = normalizePlatformIds(user.platformIds);
      const needsUpdate =
        currentPlatformIds.length !== platformIds.length ||
        currentPlatformIds.some((value, index) => value !== platformIds[index]);

      if (!needsUpdate) {
        continue;
      }

      await ctx.db.patch(user._id, {
        platformIds,
        updatedAt: new Date().toISOString(),
      });
      updated += 1;
    }

    return {
      scanned: users.length,
      updated,
    };
  },
});

export const migrateEventResults = mutation({
  args: {
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    assertInternalSecret(args.secret);

    const events = await ctx.db.query("events").collect();
    let updated = 0;

    for (const event of events) {
      const currentResult = event.eventResult as
        | {
            sourceUrl: string;
            mapId: string;
            mapName?: string;
            endedAt?: string;
            importedAt: string;
            sideA?: string;
            sideB?: string;
            outcome: "victory" | "defeat" | "draw";
            score?: {
              sideA?: number;
              sideB?: number;
              axis?: number;
              allied?: number;
              local?: number;
              enemy?: number;
            };
            localTeam?: string;
            enemyTeam?: string;
          }
        | undefined;

      if (!currentResult) {
        continue;
      }

      if (currentResult.sideA && currentResult.sideB && currentResult.score?.sideA !== undefined && currentResult.score?.sideB !== undefined) {
        continue;
      }

      await ctx.db.patch(event._id, {
        eventResult: {
          sourceUrl: currentResult.sourceUrl,
          mapId: currentResult.mapId,
          mapName: currentResult.mapName,
          endedAt: currentResult.endedAt,
          importedAt: currentResult.importedAt,
          sideA: currentResult.sideA ?? "axis",
          sideB: currentResult.sideB ?? "allies",
          outcome: currentResult.outcome,
          score: {
            sideA: currentResult.score?.sideA ?? currentResult.score?.axis ?? 0,
            sideB: currentResult.score?.sideB ?? currentResult.score?.allied ?? 0,
          },
        },
        updatedAt: new Date().toISOString(),
      });
      updated += 1;
    }

    return {
      scanned: events.length,
      updated,
    };
  },
});
