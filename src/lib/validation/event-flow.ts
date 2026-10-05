import { z } from "zod"

import { eventSchema } from "./event"

const id = z.string().trim().min(1).max(64)
const timestamp = z
    .string()
    .trim()
    .refine((value) => Number.isFinite(Date.parse(value)), "Invalid date.")

/**
 * The new-match flow's body (design D2): the event fields of the older form,
 * strictly (unknown keys are refused), plus the settings a match template
 * gives. A draft may still be untitled; its dates must be valid timestamps.
 */
export const eventDraftSchema = z.strictObject({
    ...eventSchema.shape,
    name: z.string().trim().max(200),
    registrationStart: timestamp.optional().or(z.literal("")),
    registrationEnd: timestamp,
    meetingStart: timestamp,
    gameStart: timestamp.optional(),
    gameEnd: timestamp.optional(),
    // A draft names a preset or none; it never clears a saved one.
    squadPresetId: id.optional(),
})

/** Publishing needs everything the older create form needs: a name and a coherent timeline. */
export const eventPublishSchema = eventDraftSchema.superRefine((value, ctx) => {
    const {
        signupGroupLimits: _limits,
        attendanceReminderHours: _reminders,
        createParticipantRoles: _roles,
        squadPresetId: _preset,
        ...event
    } = value
    const checked = eventSchema.safeParse(event)
    if (checked.success) return
    for (const issue of checked.error.issues)
        ctx.addIssue({
            code: "custom",
            path: issue.path,
            message: issue.message,
        })
})

export type EventDraftInput = z.input<typeof eventDraftSchema>
export type EventDraftParsed = z.infer<typeof eventDraftSchema>
