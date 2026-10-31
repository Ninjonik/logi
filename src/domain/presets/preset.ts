export type TopicPresetFields = {
    name: string
    side?: string
    map?: string
    cap?: string
    notes?: string
    topics: Array<{
        id?: string
        title: string
        body?: string
        attachments: string[]
        messages?: Array<{ id: string; body?: string; attachments: string[] }>
    }>
}

export type SquadPresetFields = {
    gameId?: string
    name: string
    squads: Array<{
        name: string
        group: string
        order: number
        color: string
        icon: string
        roles: Array<{
            name: string
            color: string
            icon: string
            count: number
            note?: string
        }>
    }>
}
