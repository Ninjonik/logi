import {
    panelActionPatch,
    type PanelAction,
    type PanelActionPatch,
} from "@/domain/discord-publications/panel-delivery"

/**
 * The live panel actions requested from the dashboard (P1-B04, P2-B12) or
 * from the "Ovládání serveru" message in Discord (W4): Odeslat do kanálu,
 * Obnovit teď, Pozastavit / Spustit, Zkusit znovu, Odstranit zprávu and
 * removing a panel. Nothing here talks to Discord: the action is a flag on
 * the panel that the bot's worker answers on its next pass.
 */
export type PanelActionPanel = {
    id: string
    guildId: string
    draft: boolean
    paused: boolean
    removing: boolean
}

export type PanelActionStore = {
    panel(guildId: string, panelId: string): Promise<PanelActionPanel | null>
    patch(panelId: string, patch: PanelActionPatch): Promise<void>
    /**
     * Clears the retry wait of the panel's messages; with `abandonPending`
     * also forgets a create Discord never confirmed, so it is sent again.
     */
    resetDelivery(
        guildId: string,
        panelId: string,
        options: { abandonPending: boolean }
    ): Promise<void>
}

export type PanelActionResult =
    | { status: "accepted"; action: PanelAction; requestedAt: number }
    | { status: "not_found" }
    | { status: "rejected"; reason: "not_sent" | "removing" }

export async function requestPanelAction(
    store: PanelActionStore,
    input: {
        guildId: string
        panelId: string
        action: PanelAction
        /** Discord user ID of the admin, kept as "Pozastavil …". */
        actorId: string
        now: number
    }
): Promise<PanelActionResult> {
    const panel = await store.panel(input.guildId, input.panelId)
    if (!panel || panel.guildId !== input.guildId)
        return { status: "not_found" }
    const decision = panelActionPatch(panel, input.action, {
        now: input.now,
        actorId: input.actorId,
    })
    if (!decision.ok) return { status: "rejected", reason: decision.reason }
    await store.patch(panel.id, decision.patch)
    if (decision.resetRetry || decision.abandonPending)
        await store.resetDelivery(input.guildId, panel.id, {
            abandonPending: decision.abandonPending,
        })
    return {
        status: "accepted",
        action: input.action,
        requestedAt: decision.patch.requestedAt,
    }
}
