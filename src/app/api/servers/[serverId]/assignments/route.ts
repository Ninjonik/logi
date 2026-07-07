import { NextRequest, NextResponse } from "next/server";

import { getUserSafeErrorMessage, logRouteError } from "@/lib/server-route-errors";
import { saveServerUserAssignment } from "@/lib/server-user-management";
import { userAssignmentSchema } from "@/lib/validation/user-assignment";

function getAssignmentErrorCode(error: unknown) {
  if (!(error instanceof Error)) return "UNKNOWN";
  if (error.message.includes("Pick a primary group")) return "PRIMARY_GROUP_REQUIRED";
  if (error.message.includes("already assigned to this server")) return "ALREADY_ASSIGNED";
  return "UNKNOWN";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ serverId: string }> },
) {
  try {
    const body = userAssignmentSchema.parse(await request.json());
    const { serverId } = await params;
    const assignmentId = await saveServerUserAssignment({
      serverId,
      ...body,
    });

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
