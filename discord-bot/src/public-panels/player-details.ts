type PlayerPanel = {
    _id: string
    guildId: string
    channelId: string
    revision: number
    enabled: boolean
    showPlayers: boolean
    kind: string
}

export function playerControl(
    id: string,
    revision: number,
    page: number,
    action: "open" | "previous" | "next"
) {
    return `logi:players:${id}:${revision}:${page}:${action}`
}

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
        /^logi:players:([a-zA-Z0-9_-]{1,64}):(\d{1,16}):(\d{1,3}):(open|previous|next)$/.exec(
            input.customId
        )
    if (!match || !Number.isSafeInteger(Number(match[2]))) return null
    const current = (panel: P | null): panel is P =>
        Boolean(
            panel?.enabled &&
            panel.showPlayers &&
            panel.kind !== "results" &&
            panel._id === match[1] &&
            panel.revision === Number(match[2]) &&
            panel.guildId === input.guildId &&
            panel.channelId === input.channelId
        )
    const panel = await ports.readPanel(match[1])
    if (!current(panel) || !(await ports.canView(panel))) return null
    const data = await ports.readLive(panel)
    const latest = await ports.readPanel(match[1])
    if (!data || !current(latest) || !(await ports.canView(latest))) return null
    return { panel: latest, data, page: Number(match[3]) }
}
