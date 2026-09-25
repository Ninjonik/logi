import assert from "node:assert/strict";
import test from "node:test";

import { gameRegistry } from "@/domain/games/registry";
import { FakeClock } from "@/infrastructure/testing/fake-clock";

import { EnableGameUseCase } from "./enable-game.use-case";
import type { GuildGameRecord, GuildGameRepository } from "./ports";

class InMemoryGuildGameRepository implements GuildGameRepository {
  public readonly records = new Map<string, GuildGameRecord>();

  constructor(private readonly guildIds: Set<string>) {}

  async guildExists(guildId: string): Promise<boolean> {
    return this.guildIds.has(guildId);
  }

  async getByGuildGame(guildId: string, gameId: string): Promise<GuildGameRecord | null> {
    return this.records.get(`${guildId}:${gameId}`) ?? null;
  }

  async save(input: GuildGameRecord): Promise<void> {
    this.records.set(`${input.guildId}:${input.gameId}`, input);
  }
}

test("enabling a supported game creates an enabled clan-game record", async () => {
  const repository = new InMemoryGuildGameRepository(new Set(["guild-1"]));
  const useCase = new EnableGameUseCase(repository, gameRegistry, new FakeClock(new Date("2026-09-05T10:00:00.000Z")));

  await useCase.execute({ guildId: "guild-1", gameId: "hell-let-loose" });

  assert.deepEqual(repository.records.get("guild-1:hell-let-loose"), {
    guildId: "guild-1",
    gameId: "hell-let-loose",
    enabled: true,
    settingsVersion: 1,
    createdAt: "2026-09-05T10:00:00.000Z",
    updatedAt: "2026-09-05T10:00:00.000Z",
  });
});

test("enabling a disabled game preserves its creation time and re-enables it", async () => {
  const repository = new InMemoryGuildGameRepository(new Set(["guild-1"]));
  repository.records.set("guild-1:hell-let-loose", {
    guildId: "guild-1",
    gameId: "hell-let-loose",
    enabled: false,
    settingsVersion: 2,
    createdAt: "2026-09-01T10:00:00.000Z",
    updatedAt: "2026-09-01T10:00:00.000Z",
  });
  const useCase = new EnableGameUseCase(repository, gameRegistry, new FakeClock(new Date("2026-09-05T10:00:00.000Z")));

  await useCase.execute({ guildId: "guild-1", gameId: "hell-let-loose" });

  assert.deepEqual(repository.records.get("guild-1:hell-let-loose"), {
    guildId: "guild-1",
    gameId: "hell-let-loose",
    enabled: true,
    settingsVersion: 2,
    createdAt: "2026-09-01T10:00:00.000Z",
    updatedAt: "2026-09-05T10:00:00.000Z",
  });
});

test("enabling an unsupported game or missing clan fails before writing", async () => {
  const repository = new InMemoryGuildGameRepository(new Set(["guild-1"]));
  const useCase = new EnableGameUseCase(repository, gameRegistry, new FakeClock(new Date("2026-09-05T10:00:00.000Z")));

  await assert.rejects(() => useCase.execute({ guildId: "guild-1", gameId: "wardogs" }), /Unsupported game: wardogs/);
  await assert.rejects(() => useCase.execute({ guildId: "missing", gameId: "hell-let-loose" }), /Clan not found/);
  assert.equal(repository.records.size, 0);
});
