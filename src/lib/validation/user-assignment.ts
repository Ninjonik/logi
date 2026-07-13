import { z } from "zod";

export const userAssignmentSchema = z
  .object({
    userId: z.string().min(1, "Pick a player first."),
    type: z.enum(["member", "mercenary"]),
    primaryGroupId: z.string().trim().optional(),
    secondaryGroupIds: z.array(z.string()),
    score: z.int(),
    paused: z.boolean(),
    pausedNote: z.string().trim().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.primaryGroupId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["primaryGroupId"],
        message: "Pick a primary group.",
      });
    }

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
  });

export type UserAssignmentInput = z.infer<typeof userAssignmentSchema>;
