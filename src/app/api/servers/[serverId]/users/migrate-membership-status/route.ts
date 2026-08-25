import { NextRequest, NextResponse } from "next/server";

import { handleIfNotLoggedIn } from "@/lib/auth";
import { fetchDiscordGuildMembers } from "@/lib/discord";
import { getServerContext } from "@/lib/server-context";
import { getServerUserAssignments, saveServerUserAssignment } from "@/lib/server-user-management";
import { syncDiscordRolesForAssignment } from "@/lib/discord";
import { getUserSafeErrorMessage, logRouteError } from "@/lib/server-route-errors";
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags";

type MigrationTarget = "recruit" | "member" | "reserve_member" | "mercenary";

function resolveAssignmentPayload(target: MigrationTarget): {
  type: "member" | "reserve_member" | "mercenary";
  status: "recruit" | "active";
} {
  switch (target) {
    case "recruit":
      return { type: "member", status: "recruit" };
    case "reserve_member":
      return { type: "reserve_member", status: "active" };
    case "mercenary":
      return { type: "mercenary", status: "active" };
    default:
      return { type: "member", status: "active" };
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ serverId: string }> },
) {
  try {
    const { serverId } = await params;
    await handleIfNotLoggedIn(`/dashboard/servers/${serverId}/settings`);

    const context = await getServerContext(serverId);
    if (!context?.canAdmin) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const body = await request.json() as {
      roleId?: string;
      target?: MigrationTarget;
    };
    const roleId = body.roleId?.trim();
    const target = body.target;
    if (!roleId || !target) {
      return NextResponse.json({ error: "Role and target status are required." }, { status: 400 });
    }

    const guildMembers = await fetchDiscordGuildMembers(context.server.discordId);
    const matchingDiscordUserIds = new Set(
      guildMembers
        .filter((member) => member.user?.id && member.roles.includes(roleId))
        .map((member) => member.user!.id),
    );

    const assignments = await getServerUserAssignments(serverId);
    const assignmentsByUserId = new Map(assignments.map((assignment) => [assignment.userId, assignment]));
    const nextAssignment = resolveAssignmentPayload(target);

    let updatedCount = 0;
    let skippedUnassigned = 0;
    let skippedUnchanged = 0;

    for (const userId of matchingDiscordUserIds) {
      const assignment = assignmentsByUserId.get(userId);
      if (!assignment) {
        skippedUnassigned += 1;
        continue;
      }

      if (assignment.type === nextAssignment.type && assignment.status === nextAssignment.status) {
        skippedUnchanged += 1;
        continue;
      }

      await saveServerUserAssignment({
        assignmentId: assignment.id,
        userId: assignment.userId,
        serverId,
        type: nextAssignment.type,
        status: nextAssignment.status,
        membershipCategoryId: assignment.membershipCategoryId,
        primaryGroupId: assignment.primaryGroupId,
        secondaryGroupIds: assignment.secondaryGroupIds,
        paused: assignment.paused,
        pausedNote: assignment.pausedNote,
      });

      try {
        await syncDiscordRolesForAssignment({
          serverId,
          discordGuildId: context.server.discordId,
          userId: assignment.userId,
          beforePrimaryGroupId: assignment.primaryGroupId,
          beforeSecondaryGroupIds: assignment.secondaryGroupIds ?? [],
          beforeAssignmentType: assignment.type,
          beforeMembershipStatus: assignment.status,
          beforeMembershipCategoryId: assignment.membershipCategoryId,
          afterPrimaryGroupId: assignment.primaryGroupId,
          afterSecondaryGroupIds: assignment.secondaryGroupIds ?? [],
          afterAssignmentType: nextAssignment.type,
          afterMembershipStatus: nextAssignment.status,
          afterMembershipCategoryId: assignment.membershipCategoryId,
        });
      } catch (error) {
        logRouteError("users.migrateMembershipStatus.discordRoleSync", error);
      }

      updatedCount += 1;
    }

    revalidateCacheEntries([
      appCacheTags.serverContext(serverId),
      appCacheTags.assignments(serverId),
      appCacheTags.users(),
      appCacheTags.rosterImage(),
    ]);

    return NextResponse.json({
      updatedCount,
      skippedUnassigned,
      skippedUnchanged,
      matchedMembers: matchingDiscordUserIds.size,
    });
  } catch (error) {
    logRouteError("users.migrateMembershipStatus", error);
    return NextResponse.json(
      {
        error: getUserSafeErrorMessage(error, "Unable to migrate membership statuses."),
      },
      { status: 400 },
    );
  }
}
