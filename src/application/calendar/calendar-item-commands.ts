import type { Clock } from "../ports/clock"

export type CalendarItemFields = {
    title: string
    description?: string
    color: string
    emoji?: string
    label?: string
    startAt: string
    endAt: string
    allDay: boolean
    recurrence?: {
        frequency: "weekly" | "monthly_date" | "monthly_nth_weekday" | "yearly"
        interval: number
        until?: string
    }
}
export type CalendarItemRecord = CalendarItemFields & {
    id: string
    guildId: string
    createdAt: string
    updatedAt: string
}
export interface CalendarItemRepository {
    get(id: string): Promise<CalendarItemRecord | null>
    list(guildId: string): Promise<CalendarItemRecord[]>
    create(record: Omit<CalendarItemRecord, "id">): Promise<string>
    update(
        id: string,
        fields: CalendarItemFields & { updatedAt: string }
    ): Promise<void>
    delete(id: string): Promise<void>
}
export class CalendarItemCommands {
    constructor(
        private readonly repository: CalendarItemRepository,
        private readonly clock: Clock
    ) {}
    async save(
        input: CalendarItemFields & { guildId: string; calendarItemId?: string }
    ) {
        const title = input.title.trim()
        if (
            !title ||
            !/^#[0-9A-Fa-f]{6}$/.test(input.color) ||
            !input.startAt ||
            !input.endAt ||
            Number.isNaN(Date.parse(input.startAt)) ||
            Number.isNaN(Date.parse(input.endAt)) ||
            Date.parse(input.endAt) < Date.parse(input.startAt) ||
            (input.recurrence &&
                (!Number.isInteger(input.recurrence.interval) ||
                    input.recurrence.interval < 1 ||
                    (input.recurrence.until &&
                        Number.isNaN(Date.parse(input.recurrence.until)))))
        )
            throw new Error(
                "title, color, valid start/end times, and allDay are required."
            )
        const existing = input.calendarItemId
            ? await this.repository.get(input.calendarItemId)
            : null
        if (
            input.calendarItemId &&
            (!existing || existing.guildId !== input.guildId)
        )
            throw new Error("Calendar item not found.")
        const now = this.clock.now().toISOString()
        const fields = {
            title,
            color: input.color,
            description: input.description?.trim() || undefined,
            emoji: input.emoji?.trim() || undefined,
            label: input.label?.trim() || undefined,
            startAt: input.startAt,
            endAt: input.endAt,
            allDay: input.allDay,
            recurrence: input.recurrence,
            updatedAt: now,
        }
        if (existing) {
            await this.repository.update(existing.id, fields)
            return { ...existing, ...fields }
        }
        const record = { ...fields, guildId: input.guildId, createdAt: now }
        return { ...record, id: await this.repository.create(record) }
    }
    async remove(guildId: string, id: string) {
        const existing = await this.repository.get(id)
        if (!existing || existing.guildId !== guildId)
            throw new Error("Calendar item not found.")
        await this.repository.delete(id)
    }
    /** Explicit whole-list editing in frontend settings retains its replacement contract. */
    async replace(
        guildId: string,
        items: Array<CalendarItemFields & { id: string }>
    ) {
        const existing = await this.repository.list(guildId)
        const normalized = items
            .map((item) => ({
                ...item,
                id: item.id.trim(),
                title: item.title.trim(),
                color: item.color.trim(),
                recurrence: item.recurrence
                    ? {
                          ...item.recurrence,
                          interval: Math.max(
                              1,
                              Math.floor(item.recurrence.interval)
                          ),
                      }
                    : undefined,
            }))
            .filter((item) => item.id && item.title && item.color)
        const nextIds = new Set(normalized.map((item) => item.id))
        for (const item of existing)
            if (!nextIds.has(item.id)) await this.remove(guildId, item.id)
        const existingIds = new Set(existing.map((item) => item.id))
        for (const item of normalized)
            await this.save({
                ...item,
                guildId,
                calendarItemId: existingIds.has(item.id) ? item.id : undefined,
            })
    }
}
