import { fetchMutation } from "convex/nextjs";
import { makeFunctionReference } from "convex/server";

import { getInternalAuthSecret } from "@/lib/env";

const updateFrontendSettingsReference = makeFunctionReference<"mutation">("guilds:updateFrontendSettings");

export async function saveGuildFrontendSettings(input: {
  guildId: string;
  name: string;
  avatar: string;
  description?: string;
  eventCategories?: Array<{
    id: string;
    label: string;
    color: string;
    emoji?: string;
  }>;
  calendarItems?: Array<{
    id: string;
    title: string;
    description?: string;
    color: string;
    emoji?: string;
    label?: string;
    startAt: string;
    endAt: string;
    allDay: boolean;
    recurrence?: {
      frequency: "weekly" | "monthly_date" | "monthly_nth_weekday" | "yearly";
      interval: number;
      until?: string;
    };
  }>;
}) {
  return await fetchMutation(updateFrontendSettingsReference, {
    secret: getInternalAuthSecret(),
    guildId: input.guildId,
    name: input.name,
    avatar: input.avatar,
    description: input.description,
    eventCategories: input.eventCategories,
    calendarItems: input.calendarItems,
  });
}
