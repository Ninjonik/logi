import { z } from "zod";

export const userAssignmentSchema = z
  .object({
    userId: z.string().min(1, "Pick a player first."),
    type: z.enum(["member", "mercenary"]),
    status: z.enum(["pending", "recruit", "active"]),
    primaryGroupId: z.string().trim().optional(),
    secondaryGroupIds: z.array(z.string()),
    platformIds: z.string().trim().optional(),
    paused: z.boolean(),
    pausedNote: z.string().trim().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.paused && !value.pausedNote) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pausedNote"],
        message: "Add a pause note when membership is paused.",
      });
    }

    if (value.primaryGroupId && value.secondaryGroupIds.includes(value.primaryGroupId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["secondaryGroupIds"],
        message: "Primary group cannot also be selected as a secondary group.",
      });
    }

    if (value.type === "mercenary" && value.status === "recruit") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["status"],
        message: "Mercenaries cannot use the recruit status.",
      });
    }

  });

export type UserAssignmentInput = z.infer<typeof userAssignmentSchema>;
