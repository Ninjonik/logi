import { NextRequest, NextResponse } from "next/server";

import { saveServerUserAssignment } from "@/lib/server-user-management";
import { userAssignmentSchema } from "@/lib/validation/user-assignment";

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
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to save assignment.",
      },
      { status: 400 },
    );
  }
}
