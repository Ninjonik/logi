import { resolveMatchMessageSettings } from "@/domain/discord-messages/notification-settings"
import { resolveRosterUpdateChannelIds } from "@/domain/rosters/roster-update-channel"
import type { RosterPublishContext } from "@/components/app/roster-publish-dialog"
import { getDiscordChannelNames } from "@/lib/read-models/discord-channel-names"
import type { DiscordConfig, EventRecord, Guild } from "@/types/domain"
import { resolveClanLanguage } from "@/lib/clan-language/core"
import { getSiteUrl } from "@/lib/env"

/**
 * What the roster publish dialog shows from the clan's settings (board D5):
 * the clan language and colour for the preview, the roster channel's name
 * (read-only, from "Kanály a jazyk"), the meeting channel, the category and
 * the defaults from "Zprávy a panely" (N1-11, N1-12, N1-24). For clan admins.
 */
export async function getRosterPublishContext(input: {
    serverId: string
    locale: string
    server: Pick<Guild, "discordId" | "eventCategories">
    event: EventRecord
    discordConfig: DiscordConfig | null | undefined
    /** Channel names already loaded by the page, if any. */
    channelNames?: Map<string, string>
}): Promise<RosterPublishContext> {
    const { event, discordConfig } = input
    const language = resolveClanLanguage(discordConfig?.defaultLanguage)
    const settings = resolveMatchMessageSettings(discordConfig)
    const channels = resolveRosterUpdateChannelIds({
        eventAnnouncementChannelId: event.announcementChannelId,
        eventInfoChannelId: event.eventInfoChannelId,
        configuredAnnouncementChannelId: discordConfig?.announcementsChannelId,
        configuredEventInfoChannelId: discordConfig?.eventInfoChannelId,
    })
    const meetingChannelId =
        event.meetingChannelId ?? discordConfig?.meetingChannelId
    const names =
        input.channelNames ??
        (await getDiscordChannelNames(input.serverId, input.server.discordId))
    const matchType = event.matchType?.trim().toLowerCase()
    const category =
        event.kind === "training" || !matchType
            ? undefined
            : (input.server.eventCategories?.find(
                  (item) => item.id.trim().toLowerCase() === matchType
              )?.label ?? event.matchType)
    const base = `/${input.locale}/dashboard/servers/${input.serverId}/settings`
    return {
        language,
        messageStyle: discordConfig?.messageStyle ?? null,
        timeZone: discordConfig?.timezone || "UTC",
        rosterChannelName: channels.rosterUpdateChannelId
            ? names.get(channels.rosterUpdateChannelId)
            : undefined,
        meetingChannelId,
        meetingChannelName: meetingChannelId
            ? names.get(meetingChannelId)
            : undefined,
        categoryLabel: category?.trim() || undefined,
        defaultVariant: settings.rosterMessageVariant,
        changesPostDefault: settings.rosterChangesPost,
        changesDmDefault: settings.rosterChangesDm,
        messagesSettingsHref: `${base}/messages`,
        channelsSettingsHref: `${base}/channels`,
        rosterUrl: new URL(
            `/${language}/rosters/${encodeURIComponent(event.id)}`,
            getSiteUrl()
        ).toString(),
    }
}
