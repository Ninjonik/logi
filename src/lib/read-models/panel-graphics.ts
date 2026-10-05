import { makeFunctionReference } from "convex/server"
import { fetchQuery } from "convex/nextjs"

import {
    toPanelGraphicsPageData,
    type PanelGraphicsPageData,
} from "@/lib/panel-graphics-view"
import { currentDashboardActor } from "@/lib/gateways/dashboard-actor"
import { getInternalAuthSecret } from "@/lib/env"
import { logNextError } from "@/lib/system-logs"

const getReference = makeFunctionReference<"query">("discordPanelGraphics:get")

/**
 * The "Grafika panelů" page data for a clan. Convex checks the dashboard
 * session and the clan admin right itself; null when that fails or the read
 * breaks, so the page shows its error state instead of crashing.
 */
export async function getPanelGraphicsPageData(
    guildId: string
): Promise<PanelGraphicsPageData | null> {
    const actor = await currentDashboardActor()
    if (!actor) return null
    try {
        return toPanelGraphicsPageData(
            await fetchQuery(getReference, {
                secret: getInternalAuthSecret(),
                guildId,
                actor,
            })
        )
    } catch (error) {
        logNextError("panel-graphics", "Failed to read the panel graphics", {
            guildId,
            error,
        })
        return null
    }
}
