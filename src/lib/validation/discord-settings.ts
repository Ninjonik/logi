import { z } from "zod";

import { supportedClanLanguages } from "@/lib/clan-language";
import { supportedTimezones } from "@/lib/discord-timezones";

const discordIdField = z
  .string()
  .trim()
  .regex(/^\d*$/, "Discord IDs must contain only digits.")
  .optional()
  .transform((value) => value || undefined);

export const discordSettingsSchema = z.object({
  timezone: z.enum(supportedTimezones),
  defaultLanguage: z.enum(supportedClanLanguages),
  announcementsChannelId: discordIdField,
  forumCategoryId: discordIdField,
  clanRoleId: discordIdField,
  dashboardAdminRoleId: discordIdField,
});

export type DiscordSettingsInput = z.infer<typeof discordSettingsSchema>;
