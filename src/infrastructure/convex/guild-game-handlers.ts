import { assertInternalSecret } from "./event-handlers";

type EnableGameUseCase = {
  execute(input: { guildId: string; gameId: string }): Promise<void>;
};

export async function handleEnableGame(input: {
  secret: string;
  expectedSecret: string;
  args: { secret: string; serverId: string; gameId: string };
  getGuildById: (serverId: string) => Promise<{ discordId?: string; id?: string } | null>;
  getGuildDiscordId: (guild: { discordId?: string; id?: string }) => string;
  createUseCase: () => EnableGameUseCase;
}) {
  assertInternalSecret(input.secret, input.expectedSecret);

  const guild = await input.getGuildById(input.args.serverId);
  if (!guild) {
    throw new Error("Server not found.");
  }

  await input.createUseCase().execute({
    guildId: input.getGuildDiscordId(guild),
    gameId: input.args.gameId,
  });

  return { ok: true as const };
}
