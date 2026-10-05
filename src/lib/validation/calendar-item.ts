import { z } from "zod"

/** A manual calendar item created from the dashboard calendar. */
export const calendarItemCreateSchema = z
    .strictObject({
        title: z.string().trim().min(1).max(120),
        startAt: z.iso.datetime({ offset: true }),
        endAt: z.iso.datetime({ offset: true }),
        allDay: z.boolean().optional(),
    })
    .refine((value) => Date.parse(value.endAt) >= Date.parse(value.startAt), {
        path: ["endAt"],
        message: "The end must be after the start.",
    })

export type CalendarItemCreateInput = z.infer<typeof calendarItemCreateSchema>
