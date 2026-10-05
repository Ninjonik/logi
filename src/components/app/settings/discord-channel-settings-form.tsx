"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    clearableId,
    saveDiscordSettings,
} from "@/components/app/settings/save-discord-settings"
import { remapLocalizedDefaults } from "@/components/app/settings/localized-panel-defaults"
import { supportedClanLanguages, type ClanLanguage } from "@/lib/clan-language"
import { DiscordChannelSelect } from "@/components/app/discord-channel-select"
import { DiscordEntitySelect } from "@/components/app/discord-entity-select"
import { useDiscordMetadata } from "@/hooks/use-discord-metadata"
import { supportedTimezones } from "@/lib/discord-timezones"
import { Card, CardContent } from "@/components/ui/card"
import type { Dictionary } from "@/i18n/dictionaries"
import type { DiscordConfig } from "@/types/domain"
import type { GameId } from "@/domain/games/game"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

/** Time zone, bot language and routing channels; with a game selected only that game's channel exceptions. */
export function DiscordChannelSettingsForm({
    serverId,
    dictionary,
    config,
    baseConfig,
    gameId,
}: {
    serverId: string
    dictionary: Dictionary
    /** Settings as they apply to the selected game, or the clan when none is selected. */
    config: DiscordConfig | null
    baseConfig: DiscordConfig | null
    gameId?: GameId
}) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const metadata = useDiscordMetadata(serverId)
    const [timezone, setTimezone] = useState(config?.timezone ?? "UTC")
    const [defaultLanguage, setDefaultLanguage] = useState<ClanLanguage>(
        config?.defaultLanguage ?? "en"
    )
    const [announcementsChannelId, setAnnouncementsChannelId] = useState(
        config?.announcementsChannelId
    )
    const [eventInfoChannelId, setEventInfoChannelId] = useState(
        config?.eventInfoChannelId
    )
    const [errorsChannelId, setErrorsChannelId] = useState(
        config?.errorsChannelId
    )
    const [calendarChannelId, setCalendarChannelId] = useState(
        config?.calendarChannelId
    )
    const [forumCategoryId, setForumCategoryId] = useState(
        config?.forumCategoryId
    )
    const [squadVoiceCategoryId, setSquadVoiceCategoryId] = useState(
        config?.squadVoiceCategoryId
    )
    const [meetingChannelId, setMeetingChannelId] = useState(
        config?.meetingChannelId
    )
    const channels = metadata?.channels ?? []
    const categories = channels.filter((channel) => channel.type === 4)
    const voiceChannels = channels.filter(
        (channel) => channel.type === 2 || channel.type === 13
    )
    const gameScoped = Boolean(gameId && baseConfig)

    async function save() {
        const routing = {
            announcementsChannelId,
            eventInfoChannelId,
            forumCategoryId,
            meetingChannelId,
            squadVoiceCategoryId,
        }
        const result =
            gameId && baseConfig
                ? await saveDiscordSettings(serverId, {
                      gameOverrides: {
                          ...baseConfig.gameOverrides,
                          [gameId]: {
                              ...baseConfig.gameOverrides?.[gameId],
                              ...routing,
                          },
                      },
                  })
                : await saveDiscordSettings(serverId, {
                      timezone,
                      defaultLanguage,
                      announcementsChannelId: clearableId(
                          announcementsChannelId
                      ),
                      eventInfoChannelId: clearableId(eventInfoChannelId),
                      errorsChannelId: clearableId(errorsChannelId),
                      calendarChannelId: clearableId(calendarChannelId),
                      forumCategoryId: clearableId(forumCategoryId),
                      meetingChannelId: clearableId(meetingChannelId),
                      squadVoiceCategoryId: clearableId(squadVoiceCategoryId),
                      ...(defaultLanguage !== (config?.defaultLanguage ?? "en")
                          ? remapLocalizedDefaults(config, defaultLanguage)
                          : {}),
                  })
        if (!result.ok) {
            toast.error(
                result.error ??
                    dictionary.serverSettings.discordSettingsSaveError
            )
            return
        }
        toast.success(dictionary.serverSettings.discordSettingsSaved)
        startTransition(() => router.refresh())
    }

    return (
        <Card className="border-border/60 rounded-2xl">
            <CardContent className="space-y-6">
                {gameScoped ? (
                    <p className="text-muted-foreground text-sm">
                        {dictionary.settingsHub.clanWideFieldsNote}
                    </p>
                ) : (
                    <div className="grid gap-6 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>{dictionary.serverSettings.timezone}</Label>
                            <Select
                                value={timezone}
                                onValueChange={setTimezone}
                            >
                                <SelectTrigger className="rounded-xl">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {supportedTimezones.map((item) => (
                                        <SelectItem key={item} value={item}>
                                            {item}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>
                                {dictionary.serverSettings.defaultLanguage}
                            </Label>
                            <Select
                                value={defaultLanguage}
                                onValueChange={(value) =>
                                    setDefaultLanguage(value as ClanLanguage)
                                }
                            >
                                <SelectTrigger className="rounded-xl">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {supportedClanLanguages.map((item) => (
                                        <SelectItem key={item} value={item}>
                                            {item === "en"
                                                ? dictionary.serverSettings
                                                      .languageEnglish
                                                : item === "cs"
                                                  ? dictionary.serverSettings
                                                        .languageCzech
                                                  : dictionary.serverSettings
                                                        .languageGerman}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )}
                <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label>
                            {dictionary.serverSettings.announcementsChannelId}
                        </Label>
                        <DiscordChannelSelect
                            value={announcementsChannelId}
                            onChange={setAnnouncementsChannelId}
                            channels={channels}
                            placeholder={
                                dictionary.serverSettings.announcementsChannelId
                            }
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>
                            {dictionary.serverSettings.eventInfoChannelId}
                        </Label>
                        <DiscordChannelSelect
                            value={eventInfoChannelId}
                            onChange={setEventInfoChannelId}
                            channels={channels}
                            placeholder={
                                dictionary.serverSettings.eventInfoChannelId
                            }
                        />
                    </div>
                    {gameScoped ? null : (
                        <>
                            <div className="space-y-2">
                                <Label>
                                    {dictionary.serverSettings.errorsChannelId}
                                </Label>
                                <DiscordChannelSelect
                                    value={errorsChannelId}
                                    onChange={setErrorsChannelId}
                                    channels={channels}
                                    placeholder={
                                        dictionary.serverSettings
                                            .errorsChannelId
                                    }
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>
                                    {
                                        dictionary.serverSettings
                                            .calendarChannelId
                                    }
                                </Label>
                                <DiscordChannelSelect
                                    value={calendarChannelId}
                                    onChange={setCalendarChannelId}
                                    channels={channels}
                                    placeholder={
                                        dictionary.serverSettings
                                            .calendarChannelId
                                    }
                                />
                            </div>
                        </>
                    )}
                    <div className="space-y-2">
                        <Label>
                            {dictionary.serverSettings.forumCategoryId}
                        </Label>
                        <DiscordEntitySelect
                            value={forumCategoryId}
                            onChange={setForumCategoryId}
                            options={categories}
                            placeholder={
                                dictionary.serverSettings.forumCategoryId
                            }
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>
                            {dictionary.serverSettings.squadVoiceCategoryId}
                        </Label>
                        <DiscordEntitySelect
                            value={squadVoiceCategoryId}
                            onChange={setSquadVoiceCategoryId}
                            options={categories}
                            placeholder={
                                dictionary.serverSettings.squadVoiceCategoryId
                            }
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>
                            {dictionary.serverSettings.meetingChannelId}
                        </Label>
                        <DiscordEntitySelect
                            value={meetingChannelId}
                            onChange={setMeetingChannelId}
                            options={voiceChannels}
                            placeholder={
                                dictionary.serverSettings.meetingChannelId
                            }
                        />
                    </div>
                </div>
                <Button
                    className="rounded-xl"
                    onClick={save}
                    disabled={isPending}
                >
                    {dictionary.serverSettings.saveDiscordSettings}
                </Button>
            </CardContent>
        </Card>
    )
}
