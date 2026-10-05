import type { CalendarItem, EventCategory, Guild } from "@/types/domain"

/**
 * Body for `POST /api/servers/{serverId}/frontend-settings`. The route saves
 * the whole clan profile at once, so the event categories and calendar items
 * travel with the name, logo and description.
 */
export type FrontendSettingsSubmission = {
    name: string
    avatar: string
    description: string
    eventCategories: Array<
        Pick<EventCategory, "id" | "label" | "color" | "emoji">
    >
    calendarItems: Array<
        Pick<
            CalendarItem,
            | "id"
            | "title"
            | "description"
            | "color"
            | "emoji"
            | "label"
            | "startAt"
            | "endAt"
            | "allDay"
            | "recurrence"
        >
    >
    regenerateCalendarFeedToken?: boolean
}

/** The stored categories and calendar items, sent unchanged when only the profile changes. */
export function storedProfileCollections(
    server: Pick<Guild, "eventCategories" | "calendarItems">
): Pick<FrontendSettingsSubmission, "eventCategories" | "calendarItems"> {
    return {
        eventCategories: (server.eventCategories ?? []).map((category) => ({
            id: category.id,
            label: category.label,
            color: category.color,
            emoji: category.emoji || undefined,
        })),
        calendarItems: (server.calendarItems ?? []).map((item) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            color: item.color,
            emoji: item.emoji,
            label: item.label,
            startAt: item.startAt,
            endAt: item.endAt,
            allDay: item.allDay,
            recurrence: item.recurrence,
        })),
    }
}

export async function saveFrontendSettings(
    serverId: string,
    submission: FrontendSettingsSubmission
): Promise<{ ok: true } | { ok: false; error?: string }> {
    const response = await fetch(`/api/servers/${serverId}/frontend-settings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(submission),
    }).catch(() => null)
    if (response?.ok) return { ok: true }
    const body = (await response?.json().catch(() => null)) as {
        error?: unknown
    } | null
    return {
        ok: false,
        error: typeof body?.error === "string" ? body.error : undefined,
    }
}
