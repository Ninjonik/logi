import {
    isPanelPaused,
    normalizePanelKind,
} from "../../../src/domain/discord-publications/settings"

type PlayerPanel = {
    _id: string
    guildId: string
    channelId: string
    revision: number
    enabled: boolean
    paused?: boolean
    draft?: boolean
    removing?: boolean
    showPlayers: boolean
    kind: string
}

/** Custom ID of the player list buttons; `page` is the disabled "1 / 10" button. */
export function playerControl(
    id: string,
    revision: number,
    page: number,
    action: "open" | "previous" | "next" | "page"
) {
    return `logi:players:${id}:${revision}:${page}:${action}`
}

/**
 * The private player list of a live server panel (P4-40..43): only from the
 * panel's current message in its channel, for someone who can see that
 * channel now, and only while the panel runs (not paused, not withdrawn).
 */
export async function loadPlayerDetails<P extends PlayerPanel, D>(
    input: {
        customId: string
        guildId: string | null
        channelId: string | null
    },
    ports: {
        readPanel: (id: string) => Promise<P | null>
        canView: (panel: P) => Promise<boolean>
        readLive: (panel: P) => Promise<D | null>
    }
) {
    const match =
        /^logi:players:([a-zA-Z0-9_-]{1,64}):(\d{1,16}):(\d{1,3}):(open|previous|next|page)$/.exec(
            input.customId
        )
    if (!match || !Number.isSafeInteger(Number(match[2]))) return null
    const current = (panel: P | null): panel is P =>
        Boolean(
            panel &&
            !isPanelPaused(panel) &&
            !panel.draft &&
            !panel.removing &&
            panel.showPlayers &&
            normalizePanelKind(panel.kind) === "server" &&
            panel._id === match[1] &&
            panel.revision === Number(match[2]) &&
            panel.guildId === input.guildId &&
            panel.channelId === input.channelId
        )
    const panel = await ports.readPanel(match[1]!)
    if (!current(panel) || !(await ports.canView(panel))) return null
    const data = await ports.readLive(panel)
    const latest = await ports.readPanel(match[1]!)
    if (!data || !current(latest) || !(await ports.canView(latest))) return null
    return { panel: latest, data, page: Number(match[3]) }
}
