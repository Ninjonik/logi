import type { Clock } from "@/application/ports/clock";
import type { GameRegistry } from "@/domain/games/game-registry";

import type { GuildGameRepository } from "./ports";

export class EnableGameUseCase {
  constructor(
    private readonly guildGames: GuildGameRepository,
    private readonly games: GameRegistry,
    private readonly clock: Clock,
  ) {}

  async execute(input: { guildId: string; gameId: string }): Promise<void> {
    this.games.require(input.gameId);

    if (!await this.guildGames.guildExists(input.guildId)) {
      throw new Error("Clan not found.");
    }

    const now = this.clock.now().toISOString();
    const existing = await this.guildGames.getByGuildGame(input.guildId, input.gameId);

    await this.guildGames.save({
      guildId: input.guildId,
      gameId: input.gameId,
      enabled: true,
      settingsVersion: existing?.settingsVersion ?? 1,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
  }
}
