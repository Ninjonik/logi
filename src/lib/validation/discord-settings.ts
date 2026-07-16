import { z } from "zod";

import { supportedClanLanguages } from "@/lib/clan-language";
import { supportedTimezones } from "@/lib/discord-timezones";

const discordIdField = z
  .string()
  .trim()
  .regex(/^\d*$/, "Discord IDs must contain only digits.")
  .optional()
  .transform((value) => value || undefined);

const imageUrlField = z
  .string()
  .trim()
  .max(512, "Image URLs must be 512 characters or fewer.")
  .optional()
  .transform((value) => value || undefined)
  .refine((value) => !value || /^https?:\/\//i.test(value), "Image URLs must start with http:// or https://.");

const ticketModalQuestionSchema = z.object({
  id: z.string().trim().min(1).max(40),
  label: z.string().trim().min(1, "Question label is required.").max(45, "Question labels can be up to 45 characters."),
  placeholder: z.string().trim().max(100, "Question placeholders can be up to 100 characters.").optional().transform((value) => value || undefined),
  style: z.enum(["short", "paragraph"]),
  required: z.boolean(),
});

const ticketCategorySchema = z.object({
  id: z.string().trim().min(1).max(40),
  emoji: z.string().trim().max(100, "Category emoji must be 100 characters or fewer.").optional().transform((value) => value || undefined),
  label: z.string().trim().max(80, "Category label can be up to 80 characters.").optional().transform((value) => value || undefined),
  description: z.string().trim().max(240, "Category description can be up to 240 characters.").optional().transform((value) => value || undefined),
  supportRoleIds: z.array(z.string().trim().regex(/^\d+$/, "Role IDs must contain only digits.")).max(25),
  modalQuestions: z.array(ticketModalQuestionSchema).max(5, "Discord modals can have up to 5 questions."),
});

const membershipCategorySchema = ticketCategorySchema.extend({
  recruitRoleId: discordIdField,
  finalRoleId: discordIdField,
  assignmentType: z.enum(["member", "mercenary"]),
});

const ticketSettingsSchema = z.object({
  enabled: z.boolean(),
  submitChannelId: discordIdField,
  ticketParentChannelId: discordIdField,
  panelTitle: z.string().trim().max(256, "Discord embed titles can be up to 256 characters."),
  panelDescription: z.string().trim().max(4096, "Discord embed descriptions can be up to 4096 characters."),
  panelImageUrl: imageUrlField,
  categories: z.array(ticketCategorySchema).max(20, "Keep ticket categories to 20 or fewer buttons."),
}).superRefine((value, ctx) => {
  if (!value.enabled) {
    return;
  }

  if (!value.submitChannelId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["submitChannelId"],
      message: "Pick a submit channel for tickets.",
    });
  }

  if (!value.ticketParentChannelId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["ticketParentChannelId"],
      message: "Pick a parent text channel for ticket threads.",
    });
  }

  if (!value.panelTitle.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["panelTitle"],
      message: "Ticket panel title is required.",
    });
  }

  if (!value.panelDescription.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["panelDescription"],
      message: "Ticket panel description is required.",
    });
  }

  if (!value.categories.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["categories"],
      message: "Add at least one ticket category.",
    });
  }

  const usedIds = new Set<string>();
  for (const [index, category] of value.categories.entries()) {
    const label = category.label?.trim();
    const emoji = category.emoji?.trim();
    if (!label && !emoji) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["categories", index, "label"],
        message: "Each ticket category needs at least a label or an emoji.",
      });
    }

    if (usedIds.has(category.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["categories", index, "id"],
        message: "Ticket category IDs must be unique.",
      });
    }
    usedIds.add(category.id);
  }
});

const membershipSettingsSchema = z.object({
  enabled: z.boolean(),
  submitChannelId: discordIdField,
  applicationParentChannelId: discordIdField,
  panelTitle: z.string().trim().max(256, "Discord embed titles can be up to 256 characters."),
  panelDescription: z.string().trim().max(4096, "Discord embed descriptions can be up to 4096 characters."),
  panelImageUrl: imageUrlField,
  autoAssignRecruitOnApply: z.boolean(),
  categories: z.array(membershipCategorySchema).max(20, "Keep membership categories to 20 or fewer buttons."),
}).superRefine((value, ctx) => {
  if (!value.enabled) {
    return;
  }

  if (!value.submitChannelId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["submitChannelId"],
      message: "Pick a submit channel for clan applications.",
    });
  }

  if (!value.applicationParentChannelId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["applicationParentChannelId"],
      message: "Pick a parent text channel for application threads.",
    });
  }

  if (!value.panelTitle.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["panelTitle"],
      message: "Application panel title is required.",
    });
  }

  if (!value.panelDescription.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["panelDescription"],
      message: "Application panel description is required.",
    });
  }

  if (!value.categories.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["categories"],
      message: "Add at least one application category.",
    });
  }

  const usedIds = new Set<string>();
  for (const [index, category] of value.categories.entries()) {
    if (!category.label?.trim() && !category.emoji?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["categories", index, "label"],
        message: "Each application category needs at least a label or an emoji.",
      });
    }

    if (usedIds.has(category.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["categories", index, "id"],
        message: "Application category IDs must be unique.",
      });
    }

    usedIds.add(category.id);
  }
});

export const discordSettingsSchema = z.object({
  timezone: z.enum(supportedTimezones),
  defaultLanguage: z.enum(supportedClanLanguages),
  announcementsChannelId: discordIdField,
  forumCategoryId: discordIdField,
  meetingChannelId: discordIdField,
  clanRoleId: discordIdField,
  dashboardAdminRoleId: discordIdField,
  ticketSettings: ticketSettingsSchema.optional(),
  membershipSettings: membershipSettingsSchema.optional(),
});

export type DiscordSettingsInput = z.infer<typeof discordSettingsSchema>;
