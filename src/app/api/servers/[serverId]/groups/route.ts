import { NextRequest, NextResponse } from "next/server";

import { saveServerGroup } from "@/lib/server-groups";
import { groupSchema } from "@/lib/validation/group";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ serverId: string }> },
) {
  try {
    const body = groupSchema.parse(await request.json());
    const { serverId } = await params;
    const groupId = await saveServerGroup({
      serverId,
      ...body,
    });

    return NextResponse.json({ groupId });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to save group.",
      },
      { status: 400 },
    );
  }
}
