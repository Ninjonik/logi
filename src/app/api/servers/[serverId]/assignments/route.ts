import { NextRequest, NextResponse } from "next/server";

import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags";
import { syncDiscordRolesForAssignment } from "@/lib/discord";
import { getServerContext } from "@/lib/server-context";
import { getUserSafeErrorMessage, logRouteError } from "@/lib/server-route-errors";
import { savePlayerNote, savePlayerPlatformId, saveServerUserAssignment } from "@/lib/server-user-management";
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ serverId: string }> },
) {
  try {
    const body = userAssignmentSchema.parse(await request.json());
    const normalizedBody = {
      ...body,
      secondaryGroupIds: body.secondaryGroupIds.filter((groupId) => groupId !== body.primaryGroupId),
    };
    const { serverId } = await params;
    const serverContext = await getServerContext(serverId);
    if (!serverContext?.canAdmin) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    const assignmentId = await saveServerUserAssignment({
      serverId,
      ...normalizedBody,
      membershipCategoryId: undefined,
    });
    await savePlayerPlatformId({
      userId: normalizedBody.userId,
      platformIds: normalizedBody.platformIds,
    });
    await savePlayerNote({
      userId: normalizedBody.userId,
      note: normalizedBody.note,
    });
    await syncRolesSafely({
      serverId,
      discordGuildId: serverContext.server.discordId,
      userId: normalizedBody.userId,
      afterPrimaryGroupId: normalizedBody.primaryGroupId || undefined,
      afterSecondaryGroupIds: normalizedBody.secondaryGroupIds,
      afterAssignmentType: normalizedBody.type,
      afterMembershipStatus: normalizedBody.status,
      afterMembershipCategoryId: undefined,
    });

    revalidateCacheEntries([
      appCacheTags.serverContext(serverId),
      appCacheTags.assignments(serverId),
      appCacheTags.assignment(assignmentId),
      appCacheTags.player(body.userId),
      appCacheTags.users(),
      appCacheTags.rosterImage(),
    ]);

    return NextResponse.json({ assignmentId });
  } catch (error) {
    logRouteError("assignments.create", error);
    return NextResponse.json(
      {
        errorCode: getAssignmentErrorCode(error),
        error: getUserSafeErrorMessage(error, "Unable to save the player assignment."),
      },
      { status: 400 },
    );
  }
}
