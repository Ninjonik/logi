export type RosterPlayer = {
    allocatedGuildId?: string
    locked?: boolean
    id?: string
    customName?: string
    ack: boolean
    confirmed?: boolean
    note?: string
    roleName?: string
    roleIcon?: string
}

export type ReserveAttendanceRecord = {
    userId: string
    ack: boolean
    confirmed?: boolean
}

export type RosterSquad = {
    name: string
    group: string
    order: number
    color: string
    icon?: string
    players: RosterPlayer[]
}

export type RosterLike = {
    localPlayerIds?: string[]
    squads: RosterSquad[]
    reservePlayerIds: string[]
    reserveAttendances?: ReserveAttendanceRecord[]
    notAttendingPlayerIds: string[]
    streamerId?: string
    published: boolean
    squadPresetId?: unknown
}

export type AttendanceStatus = "pending" | "acknowledged" | "confirmed"
