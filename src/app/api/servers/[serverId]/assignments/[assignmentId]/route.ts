import { NextRequest, NextResponse } from "next/server";

import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags";
import { syncDiscordRolesForAssignment } from "@/lib/discord";
import { getMembershipApplicationByAssignment } from "@/lib/server-discord-settings";
import { getServerContext } from "@/lib/server-context";
import { deleteServerUserAssignment, savePlayerPlatformId, saveServerUserAssignment } from "@/lib/server-user-management";
import { getUserSafeErrorMessage, logRouteError } from "@/lib/server-route-errors";
import { getServerUserAssignment } from "@/lib/server-user-management";
import { userAssignmentSchema } from "@/lib/validation/user-assignment";

function getAssignmentErrorCode(error: unknown) {
  if (!(error instanceof Error)) return "UNKNOWN";
  if (error.message.includes("already assigned to this server")) return "ALREADY_ASSIGNED";
  if (error.message.includes("already linked to another player")) return "PLATFORM_ALREADY_LINKED";
  return "UNKNOWN";
}

async function syncRolesSafely(input: Parameters<typeof syncDiscordRolesForAssignment>[0]) {
  try {
    await syncDiscordRolesForAssignment(input);
  } catch (error) {
    logRouteError("assignments.discordRoleSync", error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ serverId: string; assignmentId: string }> },
) {
  try {
    const body = userAssignmentSchema.parse(await request.json());
    const { serverId, assignmentId } = await params;
    const serverContext = await getServerContext(serverId);
    if (!serverContext?.canAdmin) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    const existingAssignment = await getServerUserAssignment(assignmentId);
    const linkedApplication = existingAssignment?.membershipCategoryId
      ? null
      : await getMembershipApplicationByAssignment(assignmentId);
    const effectiveMembershipCategoryId = existingAssignment?.membershipCategoryId ?? linkedApplication?.categoryId;
    const updatedAssignmentId = await saveServerUserAssignment({
      assignmentId,
      serverId,
      ...body,
      membershipCategoryId: effectiveMembershipCategoryId,
    });
    await savePlayerPlatformId({
      userId: body.userId,
      platformIds: body.platformIds,
    });
    await syncRolesSafely({
      serverId,
      discordGuildId: serverContext.server.discordId,
      userId: body.userId,
      beforePrimaryGroupId: existingAssignment?.primaryGroupId,
      beforeSecondaryGroupIds: existingAssignment?.secondaryGroupIds ?? [],
      beforeAssignmentType: existingAssignment?.type,
      beforeMembershipStatus: existingAssignment?.status,
      beforeMembershipCategoryId: effectiveMembershipCategoryId,
      afterPrimaryGroupId: body.primaryGroupId || undefined,
      afterSecondaryGroupIds: body.secondaryGroupIds,
      afterAssignmentType: body.type,
      afterMembershipStatus: body.status,
      afterMembershipCategoryId: effectiveMembershipCategoryId,
    });

    revalidateCacheEntries([
      appCacheTags.serverContext(serverId),
      appCacheTags.assignments(serverId),
      appCacheTags.assignment(updatedAssignmentId),
      appCacheTags.player(body.userId),
      appCacheTags.users(),
      appCacheTags.rosterImage(),
    ]);

    return NextResponse.json({ assignmentId: updatedAssignmentId });
  } catch (error) {
    logRouteError("assignments.update", error);
    return NextResponse.json(
      {
        errorCode: getAssignmentErrorCode(error),
        error: getUserSafeErrorMessage(error, "Unable to save the player assignment."),
      },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ serverId: string; assignmentId: string }> },
) {
  try {
    const { assignmentId, serverId } = await params;
    const serverContext = await getServerContext(serverId);
    if (!serverContext?.canAdmin) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    const existingAssignment = await getServerUserAssignment(assignmentId);
    const linkedApplication = existingAssignment?.membershipCategoryId
      ? null
      : existingAssignment
        ? await getMembershipApplicationByAssignment(assignmentId)
        : null;
    const effectiveMembershipCategoryId = existingAssignment?.membershipCategoryId ?? linkedApplication?.categoryId;
    await deleteServerUserAssignment(assignmentId);
    if (existingAssignment) {
      await syncRolesSafely({
        serverId,
        discordGuildId: serverContext.server.discordId,
        userId: existingAssignment.userId,
        beforePrimaryGroupId: existingAssignment.primaryGroupId,
        beforeSecondaryGroupIds: existingAssignment.secondaryGroupIds ?? [],
        beforeAssignmentType: existingAssignment.type,
        beforeMembershipStatus: existingAssignment.status,
        beforeMembershipCategoryId: effectiveMembershipCategoryId,
      });
    }
    revalidateCacheEntries([
      appCacheTags.serverContext(serverId),
      appCacheTags.assignments(serverId),
      appCacheTags.assignment(assignmentId),
      existingAssignment?.userId ? appCacheTags.player(existingAssignment.userId) : undefined,
      appCacheTags.users(),
      appCacheTags.rosterImage(),
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    logRouteError("assignments.delete", error);
    return NextResponse.json(
      {
        errorCode: "UNKNOWN",
        error: getUserSafeErrorMessage(error, "Unable to delete the player assignment."),
      },
      { status: 400 },
    );
  }
}
