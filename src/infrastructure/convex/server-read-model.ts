import { normalizeEventRecord } from "@/domain/events/normalization";
import { getGuildDiscordId, getUserDiscordId } from "../../../convex/identity";

type UnknownDoc = { _id: unknown };

export function normalizeDoc<T extends UnknownDoc>(doc: T) {
  return {
    ...doc,
    id: String(doc._id),
  };
}

export function normalizeUserDoc<
  T extends {
    _id: unknown;
    discordId?: string;
    id?: string;
    platformIds?: string[];
    score?: number;
    scores?: Record<string, number>;
  },
>(user: T) {
  const legacyUser = user as T & { steamId?: string; platformId?: string };

  return {
    ...user,
    id: String(user._id),
    discordId: getUserDiscordId(user),
    platformIds: [...new Set(
      (user.platformIds ?? [legacyUser.platformId ?? legacyUser.steamId].filter(Boolean))
        .flatMap((entry) => String(entry).split(","))
        .map((entry) => entry.replace(/\s+/g, "").trim())
        .filter(Boolean),
    )],
    scores: user.scores ?? {},
  };
}

export function normalizeGuildDoc<T extends UnknownDoc>(guild: T & { discordId?: string; id?: string }) {
  return {
    ...normalizeDoc(guild),
    discordId: getGuildDiscordId(guild),
  };
}

export function normalizeEventDoc<T extends {
  _id: unknown;
  registrationEnd: string;
  meetingStart: string;
  gameEnd: string;
  kind?: "match" | "training";
  thumbnailUrl?: string;
  meetingChannelId?: string;
  requiredRoleIds?: string[];
  rewardRoleIds?: string[];
  createForumChannel?: boolean;
  status?: "registration" | "closed" | "starting" | "concluded";
  statusUpdatedAt?: string;
  concludedAt?: string;
  eventResult?: {
    sourceUrl: string;
    mapId: string;
    mapName?: string;
    endedAt?: string;
    importedAt: string;
    sideA: string;
    sideB: string;
    outcome: "victory" | "defeat" | "draw";
    score: {
      sideA: number;
      sideB: number;
    };
  };
  matchStatsId?: unknown;
  attendanceReminderLog?: Array<{ userId: string; offsetHours: number; sentAt: string }>;
  participants?: Array<{ userId: string; status: "attending" | "not_attending"; group?: string | null; completed?: "passed" | "failed"; updatedAt: string }>;
  signUps?: Array<{ userId: string; group?: string | null }>;
  scoreAppliedAt?: string;
  scoreResolution?: "applied" | "skipped";
  absenceNotices?: Array<{ userId: string; reason: string; createdAt: string }>;
  updatedAt?: string;
  createdAt?: string;
}>(event: T) {
  const normalized = normalizeEventRecord(event);

  return {
    ...normalizeDoc(event),
    ...normalized,
    matchStatsId: normalized.matchStatsId ? String(normalized.matchStatsId) : undefined,
    matchId: normalized.matchStatsId ? String(normalized.matchStatsId) : undefined,
  };
}

export function normalizeAssignmentDoc<
  T extends {
    _id: unknown;
    serverId: string;
    primaryGroupId?: unknown;
    secondaryGroupIds?: unknown[];
  },
>(assignment: T, groupNameById: Map<string, string>) {
  const primaryGroupId = assignment.primaryGroupId ? String(assignment.primaryGroupId) : undefined;
  const secondaryGroupIds = Array.isArray(assignment.secondaryGroupIds)
    ? assignment.secondaryGroupIds.map((groupId) => String(groupId))
    : [];

  return {
    ...assignment,
    id: String(assignment._id),
    primaryGroupId,
    secondaryGroupIds,
    primaryGroup: primaryGroupId ? groupNameById.get(primaryGroupId) : undefined,
    secondaryGroups: secondaryGroupIds
      .map((groupId) => groupNameById.get(groupId))
      .filter((groupName): groupName is string => Boolean(groupName)),
  };
}

export function canAccessServerContext(input: {
  user: {
    guildId?: string;
    managedGuildIds: string[];
    mercenaryGuildIds: string[];
  };
  serverDiscordId: string;
  discordAccess?: {
    hasDashboardAccess?: boolean;
    isAdmin?: boolean;
  } | null;
}) {
  const { user, serverDiscordId, discordAccess } = input;

  return (
    user.guildId === serverDiscordId ||
    user.managedGuildIds.includes(serverDiscordId) ||
    user.mercenaryGuildIds.includes(serverDiscordId) ||
    Boolean(discordAccess?.hasDashboardAccess)
  );
}

export function canAdminServerContext(input: {
  serverAdminIds: string[];
  userId: string;
  discordAccess?: {
    isAdmin?: boolean;
  } | null;
}) {
  return input.serverAdminIds.includes(input.userId) || Boolean(input.discordAccess?.isAdmin);
}
