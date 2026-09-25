export function isGameScopedRecordVisible(record: { gameId?: string }, selectedGameId: string) {
  return !record.gameId || record.gameId === selectedGameId;
}

export function assertGroupsAreAvailableToGameMembership(input: {
  gameId: string;
  groupIds: string[];
  groupsById: Map<string, { scope: "global" | "game"; gameId?: string }>;
}) {
  for (const groupId of input.groupIds) {
    const group = input.groupsById.get(groupId);
    if (!group) {
      throw new Error(`Group not found: ${groupId}`);
    }

    if (group.scope === "game" && group.gameId !== input.gameId) {
      throw new Error(`Group ${groupId} does not belong to game ${input.gameId}.`);
    }
  }
}
