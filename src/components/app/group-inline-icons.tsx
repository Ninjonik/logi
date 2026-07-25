"use client";

import type { Group } from "@/types/domain";
import type { ServerUserAssignment } from "@/lib/server-user-management";

function findGroupByName(groupsById: Map<string, Group>, name?: string | null) {
  if (!name) {
    return undefined;
  }

  return [...groupsById.values()].find((group) => group.name === name);
}

function GroupIcon({
  group,
  fallbackLabel,
}: {
  group?: Group;
  fallbackLabel?: string | null;
}) {
  if (!group && !fallbackLabel) {
    return null;
  }

  if (group?.discordEmoji?.trim()) {
    return (
      <span
        title={group.name}
        className="inline-flex size-4 items-center justify-center text-[11px] leading-none"
      >
        {group.discordEmoji}
      </span>
    );
  }

  return (
    <span
      title={group?.name ?? fallbackLabel ?? ""}
      className="inline-flex size-3 rounded-full border border-border/60"
      style={{ backgroundColor: group?.color ?? "#64748b" }}
    />
  );
}

export function GroupInlineIcons({
  assignment,
  groupsById,
  signupGroupName,
}: {
  assignment?: ServerUserAssignment;
  groupsById: Map<string, Group>;
  signupGroupName?: string | null;
}) {
  const primaryGroup = assignment?.primaryGroupId ? groupsById.get(assignment.primaryGroupId) : undefined;
  const secondaryGroups = (assignment?.secondaryGroupIds ?? [])
    .map((groupId) => groupsById.get(groupId))
    .filter((group): group is Group => Boolean(group));
  const signupGroup = findGroupByName(groupsById, signupGroupName);

  if (!primaryGroup && secondaryGroups.length === 0 && !signupGroupName) {
    return null;
  }

  return (
    <div className="inline-flex items-center gap-1">
      <GroupIcon group={primaryGroup} />
      {secondaryGroups.map((group) => (
        <GroupIcon key={group.id} group={group} />
      ))}
      {signupGroupName ? (
        <span className="ml-0.5 inline-flex items-center">
          <GroupIcon group={signupGroup} fallbackLabel={signupGroupName} />
        </span>
      ) : null}
    </div>
  );
}
