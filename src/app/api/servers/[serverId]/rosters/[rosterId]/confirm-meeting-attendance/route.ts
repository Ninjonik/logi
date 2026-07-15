import { NextResponse } from "next/server";

import { handleIfNotLoggedIn } from "@/lib/auth";
import { confirmRosterAttendanceFromMeetingChannel } from "@/lib/server-discord-settings";
import { getServerContext } from "@/lib/server-context";

export async function POST(
  _request: Request,
  context: { params: Promise<{ serverId: string; rosterId: string }> },
) {
  const { serverId, rosterId } = await context.params;
  await handleIfNotLoggedIn(`/dashboard/servers/${serverId}/rosters/${rosterId}`);

  const serverContext = await getServerContext(serverId);
  if (!serverContext?.canAdmin) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const result = await confirmRosterAttendanceFromMeetingChannel({
      guildId: serverContext.server.discordId,
      rosterId,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to confirm meeting attendance", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to confirm attendance." },
      { status: 500 },
    );
  }
}
