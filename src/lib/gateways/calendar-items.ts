import type { CalendarItemCreateInput } from "../validation/calendar-item"
import { currentDashboardActor } from "./dashboard-actor"
import { makeFunctionReference } from "convex/server"
import { getInternalAuthSecret } from "../env"
import { fetchMutation } from "convex/nextjs"

export async function createCalendarItem(
    guildId: string,
    fields: CalendarItemCreateInput
) {
    const actor = await currentDashboardActor()
    if (!actor) throw new Error("Forbidden.")
    return fetchMutation(
        makeFunctionReference<"mutation">("calendarItems:create"),
        { ...fields, guildId, actor, secret: getInternalAuthSecret() }
    )
}
export async function removeCalendarItem(
    guildId: string,
    itemId: string
): Promise<boolean> {
    const actor = await currentDashboardActor()
    if (!actor) throw new Error("Forbidden.")
    return fetchMutation(
        makeFunctionReference<"mutation">("calendarItems:remove"),
        { guildId, itemId, actor, secret: getInternalAuthSecret() }
    )
}
