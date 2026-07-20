import { convex, references } from "../convex";
import { env } from "../environment";
import type {
  DiscordConfig,
  Group,
  GuildCacheSnapshot,
  GuildRecord,
  SquadPreset,
  TopicPreset,
} from "../types";

export type GuildRuntimeData = {
  guild: GuildRecord;
  config?: DiscordConfig;
  groups: Group[];
  squadPresets: SquadPreset[];
  topicPresets: TopicPreset[];
};

type GuildChangeHandler = (guildIds: string[]) => void;

export class GuildCache {
  private runtimeByGuildId = new Map<string, GuildRuntimeData>();
  private signaturesByGuildId = new Map<string, string>();
  private unsubscribe?: () => void;

  async start(onGuildsChanged: GuildChangeHandler) {
    const initialSnapshot = (await convex.query(references.listGuildCacheSnapshot, {
      secret: env.internalSecret,
    })) as GuildCacheSnapshot;
    this.applySnapshot(initialSnapshot);

    const watch = convex.watchQuery(references.listGuildCacheSnapshot, {
      secret: env.internalSecret,
    });
    this.unsubscribe = watch.onUpdate(() => {
      const snapshot = watch.localQueryResult() as GuildCacheSnapshot | undefined;
      if (!snapshot) {
        return;
      }

      const changedGuildIds = this.applySnapshot(snapshot);
      if (changedGuildIds.length > 0) {
        onGuildsChanged(changedGuildIds);
      }
    });
  }

  stop() {
    this.unsubscribe?.();
  }

  get(guildId: string) {
    return this.runtimeByGuildId.get(guildId);
  }

  getAllGuildIds() {
    return [...this.runtimeByGuildId.keys()];
  }

  private applySnapshot(snapshot: GuildCacheSnapshot) {
    const nextRuntimeByGuildId = new Map<string, GuildRuntimeData>();

    for (const guild of snapshot.guilds) {
      nextRuntimeByGuildId.set(guild.discordId, {
        guild,
        config: snapshot.configs.find((config) => config.guildId === guild.discordId),
        groups: snapshot.groups.filter((group) => group.guildId === guild.discordId),
        squadPresets: snapshot.squadPresets.filter((preset) => preset.guildId === guild.discordId),
        topicPresets: snapshot.topicPresets.filter((preset) => preset.guildId === guild.discordId),
      });
    }

    const nextSignaturesByGuildId = new Map<string, string>();
    for (const [guildId, runtime] of nextRuntimeByGuildId) {
      nextSignaturesByGuildId.set(guildId, buildGuildSignature(runtime));
    }

    const changedGuildIds = new Set<string>();
    for (const [guildId, signature] of nextSignaturesByGuildId) {
      if (this.signaturesByGuildId.get(guildId) !== signature) {
        changedGuildIds.add(guildId);
      }
    }

    for (const guildId of this.signaturesByGuildId.keys()) {
      if (!nextSignaturesByGuildId.has(guildId)) {
        changedGuildIds.add(guildId);
      }
    }

    this.runtimeByGuildId = nextRuntimeByGuildId;
    this.signaturesByGuildId = nextSignaturesByGuildId;

    return [...changedGuildIds];
  }
}

function buildGuildSignature(runtime: GuildRuntimeData) {
  const configSignature = runtime.config
    ? `${runtime.config.id}:${runtime.config.updatedAt}`
    : "no-config";

  return [
    `${runtime.guild.id}:${runtime.guild.updatedAt}`,
    configSignature,
    runtime.groups.map((group) => `${group.id}:${group.updatedAt}`).sort().join(","),
    runtime.squadPresets.map((preset) => `${preset.id}:${preset.updatedAt}`).sort().join(","),
    runtime.topicPresets.map((preset) => `${preset.id}:${preset.updatedAt}`).sort().join(","),
  ].join("|");
}
