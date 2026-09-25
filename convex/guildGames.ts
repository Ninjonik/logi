import { mutation } from "./_generated/server";
import { v } from "convex/values";

import { EnableGameUseCase } from "../src/application/games/enable-game.use-case";
import { gameRegistry } from "../src/domain/games/registry";
import { systemClock } from "../src/domain/shared/clock";
import { handleEnableGame } from "../src/infrastructure/convex/guild-game-handlers";
import { ConvexGuildGameRepository } from "../src/infrastructure/convex/guild-game-repository";
import { getGuildById, getGuildDiscordId } from "./identity";

const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET ?? "dev-internal-auth-secret";

export const enable = mutation({
  args: {
    secret: v.string(),
    serverId: v.id("guilds"),
    gameId: v.string(),
  },
  handler: async (ctx, args) => await handleEnableGame({
    secret: args.secret,
    expectedSecret: INTERNAL_AUTH_SECRET,
    args: {
      secret: args.secret,
      serverId: String(args.serverId),
      gameId: args.gameId,
    },
    getGuildById: async (serverId) => await getGuildById(ctx, serverId),
    getGuildDiscordId,
    createUseCase: () => new EnableGameUseCase(
      new ConvexGuildGameRepository(ctx),
      gameRegistry,
      systemClock,
    ),
  }),
});
