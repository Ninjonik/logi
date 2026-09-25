import assert from "node:assert/strict";
import test from "node:test";

import { handleEnableGame } from "./guild-game-handlers";

test("handleEnableGame authenticates and maps a guild record to its Discord ID", async () => {
  const calls: Array<{ guildId: string; gameId: string }> = [];

  const result = await handleEnableGame({
    secret: "secret",
    expectedSecret: "secret",
    args: { secret: "secret", serverId: "guild-record", gameId: "hell-let-loose" },
    getGuildById: async () => ({ discordId: "guild-discord" }),
    getGuildDiscordId: (guild) => guild.discordId ?? "",
    createUseCase: () => ({
      execute: async (input) => {
        calls.push(input);
      },
    }),
  });

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(calls, [{ guildId: "guild-discord", gameId: "hell-let-loose" }]);
});

test("handleEnableGame rejects invalid authentication and missing guilds", async () => {
  await assert.rejects(() => handleEnableGame({
    secret: "wrong",
    expectedSecret: "secret",
    args: { secret: "wrong", serverId: "guild-record", gameId: "hell-let-loose" },
    getGuildById: async () => ({ discordId: "guild-discord" }),
    getGuildDiscordId: (guild) => guild.discordId ?? "",
    createUseCase: () => ({ execute: async () => undefined }),
  }), /Unauthorized/);

  await assert.rejects(() => handleEnableGame({
    secret: "secret",
    expectedSecret: "secret",
    args: { secret: "secret", serverId: "missing", gameId: "hell-let-loose" },
    getGuildById: async () => null,
    getGuildDiscordId: () => "",
    createUseCase: () => ({ execute: async () => undefined }),
  }), /Server not found/);
});
