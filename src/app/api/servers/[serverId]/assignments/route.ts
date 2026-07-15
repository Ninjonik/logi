import { NextRequest, NextResponse } from "next/server";

import { syncDiscordRolesForAssignment } from "@/lib/discord";
import { getUserSafeErrorMessage, logRouteError } from "@/lib/server-route-errors";
import { savePlayerPlatformId, savePlayerScore, saveServerUserAssignment } from "@/lib/server-user-management";
import { userAssignmentSchema } from "@/lib/validation/user-assignment";

function getAssignmentErrorCode(error: unknown) {
  if (!(error instanceof Error)) return "UNKNOWN";
  if (error.message.includes("Pick a primary group")) return "PRIMARY_GROUP_REQUIRED";
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
    const { serverId } = await params;
    console.log("[assignments.create] Incoming request", {
      serverId,
      userId: body.userId,
      type: body.type,
      primaryGroupId: body.primaryGroupId || null,
      secondaryGroupIds: body.secondaryGroupIds,
    });
    const assignmentId = await saveServerUserAssignment({
      serverId,
      ...body,
    });
    await savePlayerScore({
      userId: body.userId,
      score: body.score,
    });
    await savePlayerPlatformId({
      userId: body.userId,
      platformIds: body.platformIds,
    });
    await syncRolesSafely({
      guildId: serverId,
      userId: body.userId,
      afterPrimaryGroupId: body.primaryGroupId || undefined,
      afterSecondaryGroupIds: body.secondaryGroupIds,
    });

    return NextResponse.json({ assignmentId });
  } catch (error) {
    console.error("[assignments.create] Request failed", error);
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
