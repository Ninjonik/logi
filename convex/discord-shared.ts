import { v } from "convex/values";

import { normalizeDoc as normalizeReadModelDoc, normalizeEventDoc, normalizeUserDoc } from "../src/infrastructure/convex/server-read-model";

export const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET ?? "dev-internal-auth-secret";

export function assertInternalSecret(secret: string) {
  if (secret !== INTERNAL_AUTH_SECRET) {
    throw new Error("Unauthorized.");
  }
}

export const normalizeDoc = normalizeReadModelDoc;
export { normalizeEventDoc, normalizeUserDoc };

export function normalizeConfigDoc<T extends { _id: unknown; defaultLanguage?: "en" | "cs" }>(doc: T) {
  return {
    ...normalizeReadModelDoc(doc),
    defaultLanguage: doc.defaultLanguage ?? "en",
  };
}

export function normalizeGuildDoc<T extends { _id: unknown; discordId?: string; id?: string }>(doc: T) {
  return {
    ...normalizeReadModelDoc(doc),
    discordId: doc.discordId ?? doc.id ?? String(doc._id),
  };
}

export const ticketModalQuestionValidator = v.object({
  id: v.string(),
  label: v.string(),
  placeholder: v.optional(v.string()),
  style: v.union(v.literal("short"), v.literal("paragraph")),
  required: v.boolean(),
});

export const ticketCategoryValidator = v.object({
  id: v.string(),
  emoji: v.optional(v.string()),
  label: v.optional(v.string()),
  description: v.optional(v.string()),
  supportRoleIds: v.array(v.string()),
  modalQuestions: v.array(ticketModalQuestionValidator),
});

export const membershipCategoryValidator = v.object({
  id: v.string(),
  emoji: v.optional(v.string()),
  label: v.optional(v.string()),
  description: v.optional(v.string()),
  supportRoleIds: v.array(v.string()),
  recruitRoleId: v.optional(v.string()),
  finalRoleId: v.optional(v.string()),
  modalQuestions: v.array(ticketModalQuestionValidator),
  assignmentType: v.union(v.literal("member"), v.literal("mercenary")),
});

export const ticketSettingsValidator = v.object({
  enabled: v.boolean(),
  submitChannelId: v.optional(v.string()),
  ticketParentChannelId: v.optional(v.string()),
  panelTitle: v.string(),
  panelDescription: v.string(),
  panelImageUrl: v.optional(v.string()),
  categories: v.array(ticketCategoryValidator),
});

export const membershipSettingsValidator = v.object({
  enabled: v.boolean(),
  submitChannelId: v.optional(v.string()),
  applicationParentChannelId: v.optional(v.string()),
  panelTitle: v.string(),
  panelDescription: v.string(),
  panelImageUrl: v.optional(v.string()),
  autoAssignRecruitOnApply: v.boolean(),
  rosterScoreSettings: v.optional(v.object({
    noCategory: v.number(),
    declined: v.number(),
    rosterPresent: v.number(),
    reservePresent: v.number(),
    rosterAbsent: v.number(),
    reserveAbsent: v.number(),
    excusedAbsence: v.number(),
  })),
  categories: v.array(membershipCategoryValidator),
});
