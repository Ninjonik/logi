import {
    applicationRefs,
    type ApplicationState,
} from "./membership-application-store"
import { env } from "../environment"
import { convex } from "../convex"
import { logWarn } from "../log"

/**
 * L6-27 / L6-B05: after the applicant verifies Steam on the web, the private
 * message between windows updates itself. The bot watches the applicant's
 * state while Discord still lets it edit that message (15 minutes).
 */

const active = new Map<string, () => void>()
const EDIT_WINDOW_MS = 14 * 60 * 1000

export function watchVerifiedSteam(input: {
    guildId: string
    userId: string
    onVerified(state: ApplicationState): Promise<unknown>
    timeoutMs?: number
}) {
    const key = `${input.guildId}:${input.userId}`
    active.get(key)?.()
    const watch = convex.watchQuery(applicationRefs.state, {
        secret: env.internalSecret,
        guildId: input.guildId,
        userId: input.userId,
    })
    let stopped = false
    const stop = () => {
        if (stopped) return
        stopped = true
        unsubscribe()
        clearTimeout(timer)
        if (active.get(key) === stop) active.delete(key)
    }
    const unsubscribe = watch.onUpdate(() => {
        let state: ApplicationState | null | undefined
        try {
            state = watch.localQueryResult() as
                ApplicationState | null | undefined
        } catch {
            return
        }
        if (!state?.verifiedSteamId) return
        stop()
        void input.onVerified(state).catch((error) =>
            logWarn("interaction", "Could not update the application message", {
                guildId: input.guildId,
                error,
            })
        )
    })
    const timer = setTimeout(stop, input.timeoutMs ?? EDIT_WINDOW_MS)
    timer.unref?.()
    active.set(key, stop)
    return stop
}

export function stopVerifiedSteamWatch(guildId: string, userId: string) {
    active.get(`${guildId}:${userId}`)?.()
}
