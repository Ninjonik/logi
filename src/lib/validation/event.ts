import { z } from "zod";

export const eventSchema = z
  .object({
    name: z.string().trim().min(1, "Event name is required."),
    description: z.string().trim().optional(),
    server: z.string().trim().optional(),
    serverPassword: z.string().trim().optional(),
    side: z.string().trim().optional(),
    map: z.string().trim().optional(),
    cap: z.string().trim().optional(),
    notes: z.string().trim().optional(),
    registrationEnd: z.string().min(1, "Registration end is required."),
    meetingStart: z.string().min(1, "Meeting start is required."),
    gameStart: z.string().min(1, "Game start is required."),
    gameEnd: z.string().min(1, "Game end is required."),
    pingClan: z.boolean(),
    topicPresetId: z.string().trim().optional(),
  })
  .superRefine((value, ctx) => {
    const registrationEnd = new Date(value.registrationEnd);
    const meetingStart = new Date(value.meetingStart);
    const gameStart = new Date(value.gameStart);
    const gameEnd = new Date(value.gameEnd);

    if (Number.isNaN(registrationEnd.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["registrationEnd"], message: "Registration end must be a valid date and time." });
    }
    if (Number.isNaN(meetingStart.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["meetingStart"], message: "Meeting start must be a valid date and time." });
    }
    if (Number.isNaN(gameStart.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["gameStart"], message: "Game start must be a valid date and time." });
    }
    if (Number.isNaN(gameEnd.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["gameEnd"], message: "Game end must be a valid date and time." });
    }

    if (!Number.isNaN(registrationEnd.getTime()) && !Number.isNaN(meetingStart.getTime()) && registrationEnd > meetingStart) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["registrationEnd"], message: "Registration end should be before meeting start." });
    }
    if (!Number.isNaN(meetingStart.getTime()) && !Number.isNaN(gameStart.getTime()) && meetingStart > gameStart) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["meetingStart"], message: "Meeting start should be before game start." });
    }
    if (!Number.isNaN(gameStart.getTime()) && !Number.isNaN(gameEnd.getTime()) && gameStart > gameEnd) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["gameEnd"], message: "Game end should be after game start." });
    }
  });

export type EventInput = z.infer<typeof eventSchema>;
