import { z } from "zod";

export const eventSchema = z
  .object({
    kind: z.enum(["match", "training"]),
    name: z.string().trim().min(1, "Event name is required."),
    description: z.string().trim().optional(),
    thumbnailUrl: z.string().trim().url("Thumbnail must be a valid URL.").optional().or(z.literal("")),
    meetingChannelId: z.string().trim().optional(),
    requiredRoleIds: z.array(z.string().trim()).default([]),
    rewardRoleIds: z.array(z.string().trim()).default([]),
    server: z.string().trim().optional(),
    serverPassword: z.string().trim().optional(),
    side: z.string().trim().optional(),
    map: z.string().trim().optional(),
    cap: z.string().trim().optional(),
    notes: z.string().trim().optional(),
    registrationEnd: z.string().min(1, "Registration end is required."),
    meetingStart: z.string().min(1, "Meeting start is required."),
    gameStart: z.string().optional(),
    gameEnd: z.string().optional(),
    pingClan: z.boolean(),
    topicPresetId: z.string().trim().optional(),
  })
  .superRefine((value, ctx) => {
    const registrationEnd = new Date(value.registrationEnd);
    const meetingStart = new Date(value.meetingStart);
    const gameStart = value.gameStart ? new Date(value.gameStart) : null;
    const gameEnd = value.gameEnd ? new Date(value.gameEnd) : null;

    if (Number.isNaN(registrationEnd.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["registrationEnd"], message: "Registration end must be a valid date and time." });
    }
    if (Number.isNaN(meetingStart.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["meetingStart"], message: "Meeting start must be a valid date and time." });
    }
    if (value.kind === "match" && (!gameStart || Number.isNaN(gameStart.getTime()))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["gameStart"], message: "Game start must be a valid date and time." });
    }
    if (value.kind === "match" && (!gameEnd || Number.isNaN(gameEnd.getTime()))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["gameEnd"], message: "Game end must be a valid date and time." });
    }

    if (!Number.isNaN(registrationEnd.getTime()) && !Number.isNaN(meetingStart.getTime()) && registrationEnd > meetingStart) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["registrationEnd"], message: "Registration end should be before meeting start." });
    }
    if (value.kind === "match" && gameStart && !Number.isNaN(meetingStart.getTime()) && !Number.isNaN(gameStart.getTime()) && meetingStart > gameStart) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["meetingStart"], message: "Meeting start should be before game start." });
    }
    if (value.kind === "match" && gameStart && gameEnd && !Number.isNaN(gameStart.getTime()) && !Number.isNaN(gameEnd.getTime()) && gameStart > gameEnd) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["gameEnd"], message: "Game end should be after game start." });
    }
  });

export type EventInput = z.input<typeof eventSchema>;
export type EventParsedInput = z.infer<typeof eventSchema>;
