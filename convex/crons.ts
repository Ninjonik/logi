import { cronJobs } from "convex/server"

import { internal } from "./_generated/api"

const crons = cronJobs()

crons.daily(
    "remove expired public previews",
    { hourUTC: 3, minuteUTC: 15 },
    internal.publicPreviews.removeExpired,
    {}
)

crons.interval(
    "deliver pending webhooks",
    { minutes: 1 },
    internal.webhookDispatcher.deliverDue,
    {}
)

export default crons
