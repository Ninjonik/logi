import { NextRequest, NextResponse } from "next/server";

import { deleteServerGroup, saveServerGroup } from "@/lib/server-groups";
import { groupSchema } from "@/lib/validation/group";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ serverId: string; groupId: string }> },
) {
  try {
    const body = groupSchema.parse(await request.json());
    const { serverId, groupId } = await params;
    const updatedGroupId = await saveServerGroup({
      serverId,
      groupId,
      ...body,
    });

    return NextResponse.json({ groupId: updatedGroupId });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to update group.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> },
) {
  try {
    const { groupId } = await params;
    await deleteServerGroup(groupId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to delete group.",
      },
      { status: 400 },
    );
  }
}
