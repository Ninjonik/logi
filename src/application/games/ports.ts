export type GuildGameRecord = {
  guildId: string;
  gameId: string;
  enabled: boolean;
  settingsVersion: number;
  createdAt: string;
  updatedAt: string;
};

export interface GuildGameRepository {
  guildExists(guildId: string): Promise<boolean>;
  getByGuildGame(guildId: string, gameId: string): Promise<GuildGameRecord | null>;
  save(input: GuildGameRecord): Promise<void>;
}
