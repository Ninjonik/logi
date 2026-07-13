import { NextRequest, NextResponse } from "next/server";

import { deleteServerUserAssignment, savePlayerScore, saveServerUserAssignment } from "@/lib/server-user-management";
import { getUserSafeErrorMessage, logRouteError } from "@/lib/server-route-errors";
import { userAssignmentSchema } from "@/lib/validation/user-assignment";

function getAssignmentErrorCode(error: unknown) {
  if (!(error instanceof Error)) return "UNKNOWN";
  if (error.message.includes("Pick a primary group")) return "PRIMARY_GROUP_REQUIRED";
  if (error.message.includes("already assigned to this server")) return "ALREADY_ASSIGNED";
  return "UNKNOWN";
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ serverId: string; assignmentId: string }> },
) {
  try {
    const body = userAssignmentSchema.parse(await request.json());
    const { serverId, assignmentId } = await params;
    const updatedAssignmentId = await saveServerUserAssignment({
      assignmentId,
      serverId,
      ...body,
    });
    await savePlayerScore({
      userId: body.userId,
      score: body.score,
    });

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
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  try {
    const { assignmentId } = await params;
    await deleteServerUserAssignment(assignmentId);
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
