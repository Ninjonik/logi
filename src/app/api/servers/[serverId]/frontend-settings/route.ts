import { NextResponse } from "next/server";

import { handleIfNotLoggedIn } from "@/lib/auth";
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags";
import { getServerContext } from "@/lib/server-context";
import { saveGuildFrontendSettings } from "@/lib/server-guild-settings";
import { logNextError, logNextInfo } from "@/lib/system-logs";

export async function POST(request: Request, context: { params: Promise<{ serverId: string }> }) {
  const { serverId } = await context.params;
  await handleIfNotLoggedIn(`/dashboard/servers/${serverId}/settings`);

  const serverContext = await getServerContext(serverId);
  if (!serverContext?.canAdmin) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      name?: string;
      avatar?: string;
      description?: string;
      eventCategories?: Array<{
        id?: string;
        label?: string;
        color?: string;
        emoji?: string;
      }>;
      calendarItems?: Array<{
        id?: string;
        title?: string;
        description?: string;
        color?: string;
        emoji?: string;
        label?: string;
        startAt?: string;
        endAt?: string;
        allDay?: boolean;
        recurrence?: {
          frequency?: "weekly" | "monthly_date" | "monthly_nth_weekday" | "yearly";
          interval?: number;
          until?: string;
        };
      }>;
    };

    if (!body.name?.trim() || !body.avatar?.trim()) {
      return NextResponse.json({ error: "Name and avatar are required." }, { status: 400 });
    }

    await saveGuildFrontendSettings({
      guildId: serverId,
      name: body.name,
      avatar: body.avatar,
      description: body.description,
      eventCategories: (body.eventCategories ?? [])
        .map((category) => ({
          id: category.id?.trim() ?? "",
          label: category.label?.trim() ?? "",
          color: category.color?.trim() ?? "",
          emoji: category.emoji?.trim() || undefined,
        }))
        .filter((category) => category.id && category.label && category.color),
      calendarItems: (body.calendarItems ?? [])
        .map((item) => ({
          id: item.id?.trim() ?? "",
          title: item.title?.trim() ?? "",
          description: item.description?.trim() || undefined,
          color: item.color?.trim() ?? "",
          emoji: item.emoji?.trim() || undefined,
          label: item.label?.trim() || undefined,
          startAt: item.startAt ?? "",
          endAt: item.endAt ?? "",
          allDay: Boolean(item.allDay),
          recurrence: item.recurrence?.frequency ? {
            frequency: item.recurrence.frequency,
            interval: Math.max(1, Math.floor(item.recurrence.interval ?? 1)),
            until: item.recurrence.until || undefined,
          } : undefined,
        }))
        .filter((item) => item.id && item.title && item.color && item.startAt && item.endAt),
    });

    revalidateCacheEntries([
      appCacheTags.server(serverId),
      appCacheTags.serverContext(serverId),
      appCacheTags.rosters(serverId),
    ]);

    logNextInfo("frontend-settings", "Saved clan frontend settings", {
      serverId,
      userId: serverContext.user.discordId,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logNextError("frontend-settings", "Failed to save clan frontend settings", { serverId, error });
    return NextResponse.json({ error: "Unable to save clan frontend settings." }, { status: 500 });
  }
}
