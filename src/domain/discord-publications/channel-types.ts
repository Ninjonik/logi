export type ChannelPurpose = "publication" | "private-thread"
export function canUseChannelType(purpose: ChannelPurpose, type: number) {
    return (purpose === "private-thread" ? [0] : [0, 5]).includes(type)
}
