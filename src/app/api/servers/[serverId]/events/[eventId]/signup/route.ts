import { NextResponse } from "next/server";

import { handleIfNotLoggedIn } from "@/lib/auth";
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags";
import { getClanDiscordMessages } from "@/lib/clan-language";
import { resolveEventSignupSelection } from "@/lib/event-signup";
import { getServerContext } from "@/lib/server-context";
import { toggleServerEventSignup } from "@/lib/server-events";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ serverId: string; eventId: string }> },
) {
  const { serverId, eventId } = await params;
  const user = await handleIfNotLoggedIn(`/dashboard/servers/${serverId}/calendar`);
  const context = await getServerContext(serverId);
  if (!context) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const event = context.events.find((item) => item.id === eventId);
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  const body = (await request.json()) as { actionId?: unknown };
  const messages = getClanDiscordMessages(context.discordConfig?.defaultLanguage ?? "en");
  const resolved = resolveEventSignupSelection({
    event,
    groups: context.groups,
    memberRoleIds: context.memberRoleIds,
    actionId: String(body.actionId ?? ""),
    labels: {
      registrationClosed: messages.interaction.registrationClosed,
      invalidSignupButton: messages.interaction.invalidSignupButton,
      unableToResolveMembership: messages.interaction.unableToResolveMembership,
      missingRequiredRole: messages.interaction.missingRequiredRole,
      signupUpdated: messages.interaction.signupUpdated,
      markedNotAttending: messages.interaction.markedNotAttending,
    },
  });

  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }

  await toggleServerEventSignup({
    eventId,
    userId: user.discordId,
    group: resolved.group,
  });

  revalidateCacheEntries([
    appCacheTags.serverContext(serverId),
    appCacheTags.events(serverId),
    appCacheTags.event(eventId),
    appCacheTags.rosters(serverId),
    appCacheTags.rosterImageEvent(eventId),
  ]);

  return NextResponse.json({ ok: true, message: resolved.successMessage });
}
