import { buildServerMembershipState, buildUserMembershipState } from "@/domain/assignments/membership-state";

import type { AssignmentCommandRepository } from "./ports";

export async function rebuildMembershipState(
  repository: AssignmentCommandRepository,
  serverDiscordId: string,
  userIds: string[],
  now: Date,
) {
  const assignments = await repository.listByServer(serverDiscordId);
  const groupNameById = await repository.listGroupNamesByServer(serverDiscordId);
  const serverState = buildServerMembershipState({
    assignments,
    groupNameById,
  });

  await repository.updateServerMembership(serverDiscordId, {
    ...serverState,
    updatedAt: now.toISOString(),
  });

  for (const userId of userIds) {
    const userAssignments = await repository.listByUser(userId);
    const userState = buildUserMembershipState({
      assignments: userAssignments,
    });

    await repository.updateUserMembership(userId, {
      guildId: userState.guildId,
      mercenaryGuildIds: userState.mercenaryGuildIds,
      updatedAt: now.toISOString(),
    });
  }
}
