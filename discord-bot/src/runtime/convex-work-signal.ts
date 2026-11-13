import { startReactiveWork, type WorkSignal } from "./reactive-work"
import { makeFunctionReference } from "convex/server"
import { Events, type Client } from "discord.js"
import { env } from "../environment"
import { convex } from "../convex"

export function startConvexWorkSignal(
    kind:
        | "dispatch"
        | "deletion"
        | "recap"
        | "membership-workflow"
        | "membership-effect"
        | "team",
    run: () => Promise<unknown>,
    failed: (error: unknown) => void,
    client?: Client
) {
    const reference = makeFunctionReference<"query">("discordWorkSignals:next")
    const args = { secret: env.internalSecret, kind }
    const stop = startReactiveWork({
        watch: () => {
            const watch = convex.watchQuery(reference, args)
            return {
                onUpdate: (callback) => watch.onUpdate(callback),
                localQueryResult: () =>
                    watch.localQueryResult() as WorkSignal | null | undefined,
            }
        },
        read: () => convex.query(reference, args) as Promise<WorkSignal | null>,
        run,
        failed,
    })
    const wake = () => {
        void stop.wake()
    }
    client?.on(Events.ShardReady, wake)
    client?.on(Events.ShardResume, wake)
    client?.on(Events.ClientReady, wake)
    return async () => {
        client?.off(Events.ShardReady, wake)
        client?.off(Events.ShardResume, wake)
        client?.off(Events.ClientReady, wake)
        await stop()
    }
}
