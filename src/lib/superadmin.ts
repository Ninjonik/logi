import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";

const SUPERADMIN_CONFIG_PATH = path.join(process.cwd(), "config", "superadmins.json");

type SuperadminConfig = {
  discordUserIds?: string[];
};

const readSuperadminConfig = cache(async function readSuperadminConfig(): Promise<SuperadminConfig> {
  try {
    const raw = await readFile(SUPERADMIN_CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw) as SuperadminConfig;
    return {
      discordUserIds: Array.isArray(parsed.discordUserIds)
        ? parsed.discordUserIds.map((value) => String(value).trim()).filter(Boolean)
        : [],
    };
  } catch {
    return {
      discordUserIds: [],
    };
  }
});

export async function getSuperadminDiscordIds() {
  return (await readSuperadminConfig()).discordUserIds ?? [];
}

export async function isSuperadminDiscordId(discordUserId: string | undefined | null) {
  if (!discordUserId) {
    return false;
  }

  return (await getSuperadminDiscordIds()).includes(discordUserId);
}
