import type { AppUser } from "@/types/domain";

export function getUserScoreForGuild(user: Pick<AppUser, "guildId" | "score" | "scores">, guildId: string) {
  return user.scores?.[guildId] ?? (user.guildId === guildId ? (user.score ?? 0) : 0);
}

export function getPrimaryDisplayedScore(user: Pick<AppUser, "score" | "scores">) {
  if (typeof user.score === "number") {
    return user.score;
  }

  return Object.values(user.scores ?? {})[0] ?? 0;
}
