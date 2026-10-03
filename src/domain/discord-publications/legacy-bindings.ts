/** Legacy game overrides own their message IDs even before their first publish. */
export function membershipPanelConfig<
    T extends {
        membershipPanelMessageId?: string
        membershipPanelLastConfigUpdatedAt?: string
    },
>(base: T, override?: Partial<T>): T {
    return override
        ? {
              ...base,
              ...override,
              membershipPanelMessageId: override.membershipPanelMessageId,
              membershipPanelLastConfigUpdatedAt:
                  override.membershipPanelLastConfigUpdatedAt,
          }
        : base
}

export function eventMessageIdentity(input: {
    eventId: string
    kind: "announcement" | "info"
    destination: string
    messageId?: string
    storedAnnouncementChannelId?: string
}) {
    return {
        key: `event:${input.eventId}:${input.kind}`,
        legacyMessageId: input.messageId,
        legacyChannelId:
            input.kind === "announcement"
                ? (input.storedAnnouncementChannelId ?? input.destination)
                : input.destination,
    }
}
