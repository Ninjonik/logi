import { NextRequest, NextResponse } from "next/server";

import { deleteServerUserAssignment, saveServerUserAssignment } from "@/lib/server-user-management";
import { userAssignmentSchema } from "@/lib/validation/user-assignment";

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

    return NextResponse.json({ assignmentId: updatedAssignmentId });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to update assignment.",
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
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to delete assignment.",
      },
      { status: 400 },
    );
  }
}
