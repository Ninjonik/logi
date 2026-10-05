"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
    GAME_EXCEPTION_CHANNEL_FIELDS,
    gameExceptions,
    showsGameExceptions,
    withGameExceptions,
    type GameExceptionChannelField,
} from "@/domain/workspaces/game-exceptions"
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
import { GameExceptionList } from "@/components/app/settings/game-exception-list"
import { supportedClanLanguages, type ClanLanguage } from "@/lib/clan-language"
import { DiscordChannelSelect } from "@/components/app/discord-channel-select"
import { DiscordEntitySelect } from "@/components/app/discord-entity-select"
import type { DiscordConfig, GameDiscordOverrides } from "@/types/domain"
import { useDiscordMetadata } from "@/hooks/use-discord-metadata"
import { GAME_LABELS, type GameId } from "@/domain/games/game"
import { supportedTimezones } from "@/lib/discord-timezones"
import { Card, CardContent } from "@/components/ui/card"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

type ChannelExceptions = Record<
    GameExceptionChannelField,
    Partial<Record<GameId, string>>
>

/**
 * Time zone, bot language and routing channels for the whole clan. The routing
 * channels can differ per game: each shows its game exceptions underneath.
 */
export function DiscordChannelSettingsForm({
    serverId,
    dictionary,
    config,
    enabledGames,
}: {
    serverId: string
    dictionary: Dictionary
    /** The clan-wide settings with the stored game overrides. */
    config: DiscordConfig | null
    enabledGames: readonly GameId[]
}) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const metadata = useDiscordMetadata(serverId)
    const [timezone, setTimezone] = useState(config?.timezone ?? "UTC")
    const [defaultLanguage, setDefaultLanguage] = useState<ClanLanguage>(
        config?.defaultLanguage ?? "en"
    )
    const [values, setValues] = useState<
        Record<GameExceptionChannelField, string | undefined>
    >({
        announcementsChannelId: config?.announcementsChannelId,
        eventInfoChannelId: config?.eventInfoChannelId,
        forumCategoryId: config?.forumCategoryId,
        meetingChannelId: config?.meetingChannelId,
        squadVoiceCategoryId: config?.squadVoiceCategoryId,
    })
    const [exceptions, setExceptions] = useState<ChannelExceptions>(() => {
        const read = (field: GameExceptionChannelField) =>
            gameExceptions<GameDiscordOverrides, GameExceptionChannelField>(
                config?.gameOverrides,
                field,
                enabledGames
            )
        return {
            announcementsChannelId: read("announcementsChannelId"),
            eventInfoChannelId: read("eventInfoChannelId"),
            forumCategoryId: read("forumCategoryId"),
            meetingChannelId: read("meetingChannelId"),
            squadVoiceCategoryId: read("squadVoiceCategoryId"),
        }
    })
    const [errorsChannelId, setErrorsChannelId] = useState(
        config?.errorsChannelId
    )
    const [calendarChannelId, setCalendarChannelId] = useState(
        config?.calendarChannelId
    )
    const channels = metadata?.channels ?? []
    const categories = channels.filter((channel) => channel.type === 4)
    const voiceChannels = channels.filter(
        (channel) => channel.type === 2 || channel.type === 13
    )
    const exceptionsShown = showsGameExceptions(
        enabledGames,
        Object.values(exceptions)
    )

    function picker(
        field: GameExceptionChannelField,
        value: string | undefined,
        onChange: (value?: string) => void,
        placeholder: string
    ) {
        if (
            field === "announcementsChannelId" ||
            field === "eventInfoChannelId"
        )
            return (
                <DiscordChannelSelect
                    value={value}
                    onChange={onChange}
                    channels={channels}
                    placeholder={placeholder}
                />
            )
        return (
            <DiscordEntitySelect
                value={value}
                onChange={onChange}
                options={
                    field === "meetingChannelId" ? voiceChannels : categories
                }
                placeholder={placeholder}
            />
        )
    }

    function routingField(field: GameExceptionChannelField) {
        const label = dictionary.serverSettings[field]
        return (
            <div key={field} className="space-y-2">
                <Label>{label}</Label>
                {picker(
                    field,
                    values[field],
                    (value) =>
                        setValues((current) => ({
                            ...current,
                            [field]: value,
                        })),
                    label
                )}
                {exceptionsShown ? (
                    <GameExceptionList<string>
                        enabledGames={enabledGames}
                        exceptions={exceptions[field]}
                        onChange={(next) =>
                            setExceptions((current) => ({
                                ...current,
                                [field]: next,
                            }))
                        }
                        emptyValue=""
                        canAdd={enabledGames.length > 1}
                        dictionary={dictionary}
                        renderValue={(game, value, setValue) =>
                            picker(
                                field,
                                value,
                                (next) => setValue(next ?? ""),
                                dictionary.settingsHub.gameExceptionPlaceholder.replace(
                                    "{game}",
                                    GAME_LABELS[game]
                                )
                            )
                        }
                    />
                ) : null}
            </div>
        )
    }

    async function save() {
        const gameOverrides = GAME_EXCEPTION_CHANNEL_FIELDS.reduce(
            (overrides, field) =>
                withGameExceptions<
                    GameDiscordOverrides,
                    GameExceptionChannelField
                >(overrides, field, exceptions[field], enabledGames),
            config?.gameOverrides ?? {}
        )
        const result = await saveDiscordSettings(serverId, {
            timezone,
            defaultLanguage,
            announcementsChannelId: clearableId(values.announcementsChannelId),
            eventInfoChannelId: clearableId(values.eventInfoChannelId),
            errorsChannelId: clearableId(errorsChannelId),
            calendarChannelId: clearableId(calendarChannelId),
            forumCategoryId: clearableId(values.forumCategoryId),
            meetingChannelId: clearableId(values.meetingChannelId),
            squadVoiceCategoryId: clearableId(values.squadVoiceCategoryId),
            gameOverrides,
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
                <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label>{dictionary.serverSettings.timezone}</Label>
                        <Select value={timezone} onValueChange={setTimezone}>
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
                {exceptionsShown ? (
                    <p className="text-muted-foreground text-sm">
                        {dictionary.settingsHub.gameExceptionsNote}
                    </p>
                ) : null}
                <div className="grid gap-6 md:grid-cols-2">
                    {routingField("announcementsChannelId")}
                    {routingField("eventInfoChannelId")}
                    <div className="space-y-2">
                        <Label>
                            {dictionary.serverSettings.errorsChannelId}
                        </Label>
                        <DiscordChannelSelect
                            value={errorsChannelId}
                            onChange={setErrorsChannelId}
                            channels={channels}
                            placeholder={
                                dictionary.serverSettings.errorsChannelId
                            }
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>
                            {dictionary.serverSettings.calendarChannelId}
                        </Label>
                        <DiscordChannelSelect
                            value={calendarChannelId}
                            onChange={setCalendarChannelId}
                            channels={channels}
                            placeholder={
                                dictionary.serverSettings.calendarChannelId
                            }
                        />
                    </div>
                    {routingField("forumCategoryId")}
                    {routingField("squadVoiceCategoryId")}
                    {routingField("meetingChannelId")}
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
