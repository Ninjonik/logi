import { ConvexCalendarItemRepository } from "../src/infrastructure/convex/calendar-item-repository"
import { CalendarItemCommands } from "../src/application/calendar/calendar-item-commands"
import { calendarItemCreateSchema } from "../src/lib/validation/calendar-item"
import { authorizeDashboardAdmin, dashboardActor } from "./dashboardActor"
import { systemClock } from "../src/domain/shared/clock"
import { mutation } from "./integrationMutation"
import { v } from "convex/values"

export const create = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        actor: dashboardActor,
        title: v.string(),
        startAt: v.string(),
        endAt: v.string(),
        allDay: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        await authorizeDashboardAdmin(ctx, args)
        const fields = calendarItemCreateSchema.parse({
            title: args.title,
            startAt: args.startAt,
            endAt: args.endAt,
            allDay: args.allDay,
        })
        return (
            await new CalendarItemCommands(
                new ConvexCalendarItemRepository(ctx),
                systemClock
            ).save({
                ...fields,
                guildId: args.guildId,
                color: "#7c3aed",
                allDay: Boolean(fields.allDay),
                startAt: new Date(fields.startAt).toISOString(),
                endAt: new Date(fields.endAt).toISOString(),
            })
        ).id
    },
})

export const remove = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        actor: dashboardActor,
        itemId: v.string(),
    },
    handler: async (ctx, args) => {
        await authorizeDashboardAdmin(ctx, args)
        const commands = new CalendarItemCommands(
            new ConvexCalendarItemRepository(ctx),
            systemClock
        )
        const itemId = ctx.db.normalizeId("calendarItems", args.itemId)
        const item = itemId ? await ctx.db.get(itemId) : null
        if (!item || item.guildId !== args.guildId) return false
        await commands.remove(args.guildId, args.itemId)
        return true
    },
})
