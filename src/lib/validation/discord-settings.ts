import { z } from "zod";

import { supportedTimezones } from "@/lib/discord-timezones";

const discordIdField = z
  .string()
  .trim()
  .regex(/^\d*$/, "Discord IDs must contain only digits.")
  .optional()
  .transform((value) => value || undefined);

export const discordSettingsSchema = z.object({
  timezone: z.enum(supportedTimezones),
  announcementsChannelId: discordIdField,
  forumChannelId: discordIdField,
  clanRoleId: discordIdField,
  dashboardAdminRoleId: discordIdField,
  groupLinks: z.array(
    z.object({
      groupId: z.string().min(1),
      roleId: discordIdField,
      emoji: z.string().trim().optional().transform((value) => value || undefined),
    }),
  ),
});

export type DiscordSettingsInput = z.infer<typeof discordSettingsSchema>;
