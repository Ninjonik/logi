import type { MutationCtx } from "../../../convex/_generated/server";
import { getGuildByDiscordId } from "../../../convex/identity";

import type { GuildGameRecord, GuildGameRepository } from "@/application/games/ports";

export class ConvexGuildGameRepository implements GuildGameRepository {
  constructor(private readonly ctx: MutationCtx) {}

  async guildExists(guildId: string): Promise<boolean> {
    return Boolean(await getGuildByDiscordId(this.ctx, guildId));
  }

  async getByGuildGame(guildId: string, gameId: string): Promise<GuildGameRecord | null> {
    const record = await this.ctx.db
      .query("guildGames")
      .withIndex("guildId_gameId", (query) => query.eq("guildId", guildId).eq("gameId", gameId))
      .unique();

    return record ? {
      guildId: record.guildId,
      gameId: record.gameId,
      enabled: record.enabled,
      settingsVersion: record.settingsVersion,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    } : null;
  }

  async save(input: GuildGameRecord): Promise<void> {
    const existing = await this.ctx.db
      .query("guildGames")
      .withIndex("guildId_gameId", (query) => query.eq("guildId", input.guildId).eq("gameId", input.gameId))
      .unique();

    if (existing) {
      await this.ctx.db.patch(existing._id, input);
      return;
    }

    await this.ctx.db.insert("guildGames", input);
  }
}
