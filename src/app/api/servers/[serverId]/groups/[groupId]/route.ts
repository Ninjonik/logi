import { NextRequest, NextResponse } from "next/server";

import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags";
import { deleteServerGroup, saveServerGroup } from "@/lib/server-groups";
import { getUserSafeErrorMessage, logRouteError } from "@/lib/server-route-errors";
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

    revalidateCacheEntries([
      appCacheTags.serverContext(serverId),
      appCacheTags.groups(serverId),
      appCacheTags.group(updatedGroupId),
      appCacheTags.rosterImage(),
    ]);

    return NextResponse.json({ groupId: updatedGroupId });
  } catch (error) {
    logRouteError("groups.update", error);
    return NextResponse.json(
      {
        error: getUserSafeErrorMessage(error, "Unable to save the group."),
      },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ serverId: string; groupId: string }> },
) {
  try {
    const { serverId, groupId } = await params;
    await deleteServerGroup(groupId);
    revalidateCacheEntries([
      appCacheTags.serverContext(serverId),
      appCacheTags.groups(serverId),
      appCacheTags.group(groupId),
      appCacheTags.rosterImage(),
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    logRouteError("groups.delete", error);
    return NextResponse.json(
      {
        error: getUserSafeErrorMessage(error, "Unable to delete the group."),
      },
      { status: 400 },
    );
  }
}
