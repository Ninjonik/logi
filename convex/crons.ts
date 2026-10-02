import { cronJobs } from "convex/server"

import { makeFunctionReference } from "convex/server"
import { internal } from "./_generated/api"

const crons = cronJobs()
crons.interval(
    "reconcile people result relationships",
    { minutes: 5 },
    makeFunctionReference<"mutation">("peopleSummaries:reconcileResultLinks"),
    {}
)
crons.interval(
    "prune expired identity sessions",
    { hours: 1 },
    makeFunctionReference<"mutation">("dashboardSessions:prune"),
    {}
)
crons.interval(
    "prune membership reconciliation metadata",
    { minutes: 1 },
    makeFunctionReference<"mutation">(
        "memberObservations:pruneReconciliations"
    ),
    {}
)
crons.interval(
    "prune integration change retention",
    { hours: 1 },
    makeFunctionReference<"mutation">("integrationChanges:prune"),
    {}
)
crons.interval(
    "collect game server data",
    { minutes: 1 },
    internal.gameDataCollector.collectDue,
    {}
)
crons.interval(
    "collect HLL history",
    { minutes: 1 },
    internal.gameDataCollector.collectHistoryDue,
    {}
)

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
