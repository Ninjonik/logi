"use client"

import { Fragment, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Info } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

import {
    changedCommands,
    resolveCommandSettings,
    storeCommandSettings,
    type CommandSettingsEntry,
    type ResolvedCommandSettings,
} from "@/domain/discord-commands/command-settings"
import {
    DEFAULT_STATS_COMMAND_SETTINGS,
    STATS_COMMAND_GAMES,
    type StatsCommandSettings,
} from "@/domain/player-stats/command-settings"
import {
    MEMBER_COMMANDS,
    NEW_COMMANDS,
    type ConfigurableCommand,
    type LogiCommand,
} from "@/domain/discord-commands/catalog"
import {
    gameExceptions,
    showsGameExceptions,
    withGameExceptions,
} from "@/domain/workspaces/game-exceptions"
import type {
    DiscordConfig,
    GameDiscordOverrides,
    PlayerStatsServer,
} from "@/types/domain"
import {
    getIntlLocaleForClanLanguage,
    type ClanLanguage,
} from "@/lib/clan-language/core"
import { DiscordMessagePreview } from "@/components/app/discord-preview/discord-message-preview"
import { SettingsSectionHeader } from "@/components/app/settings/settings-section-header"
import { saveDiscordSettings } from "@/components/app/settings/save-discord-settings"
import { UnsavedChangesBar } from "@/components/app/settings/unsaved-changes-bar"
import { DiscordChannelSelect } from "@/components/app/discord-channel-select"
import { describeCommand } from "@/domain/discord-commands/descriptions"
import { statsPreviewView } from "@/domain/player-stats/stats-preview"
import { getCommandMessages } from "@/lib/clan-language/commands"
import { useDiscordMetadata } from "@/hooks/use-discord-metadata"
import { GAME_LABELS, type GameId } from "@/domain/games/game"
import type { Dictionary } from "@/i18n/dictionaries"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

import {
    LegacyStatsConnections,
    type LegacyServerExceptions,
} from "./legacy-stats-connections"
import {
    CommandRegistrationCard,
    type CommandRegistrationView,
} from "./registration-card"
import { CloseCommandRow, CommandRow } from "./command-row"

type Draft = {
    settings: ResolvedCommandSettings
    stats: StatsCommandSettings
    servers: PlayerStatsServer[]
    exceptions: LegacyServerExceptions
}

const same = (left: unknown, right: unknown) =>
    JSON.stringify(left) === JSON.stringify(right)

/** How many things on the page differ from what is stored. */
function countChanges(draft: Draft, saved: Draft) {
    return (
        changedCommands(draft.settings, saved.settings).length +
        STATS_COMMAND_GAMES.filter(
            (game) => draft.stats.games[game] !== saved.stats.games[game]
        ).length +
        Number(
            (draft.stats.defaultShareChannelId ?? "") !==
                (saved.stats.defaultShareChannelId ?? "")
        ) +
        Number(!same(draft.servers, saved.servers)) +
        Number(!same(draft.exceptions, saved.exceptions))
    )
}

/** Text and announcement channels, the ones a command can be limited to. */
const TEXT_CHANNEL_TYPES = new Set([0, 5])

/**
 * "Příkazy v Discordu" (board N3): the bot's command registration, the old
 * stats server connections, every command with its switch, who may use it,
 * where the reply lands and where it works, `/stats`'s games, Share channel
 * and reply preview, and the descriptions Discord shows in cs, en and de.
 * Saving lets the bot register the commands again (N3-B02).
 */
export function CommandsSettingsForm({
    serverId,
    serverName,
    dictionary,
    config,
    enabledGames,
    registration,
    now,
    hrefs,
}: {
    serverId: string
    serverName: string
    dictionary: Dictionary
    config: DiscordConfig | null
    enabledGames: readonly GameId[]
    registration: CommandRegistrationView | null
    now: number
    hrefs: {
        gameServers: string
        channels: string
        tickets: string
        membership: string
    }
}) {
    const page = dictionary.settingsHub.commandsPage
    const text = page.commands
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [saving, setSaving] = useState(false)
    const metadata = useDiscordMetadata(serverId)
    const clanLanguage: ClanLanguage = config?.defaultLanguage ?? "en"
    const [saved, setSaved] = useState<Draft>(() => {
        const stats = config?.statsSettings ?? DEFAULT_STATS_COMMAND_SETTINGS
        return {
            settings: resolveCommandSettings(
                config?.commandSettings,
                stats.enabled
            ),
            stats,
            servers: config?.playerStatsServers ?? [],
            exceptions: gameExceptions<
                GameDiscordOverrides,
                "playerStatsServers"
            >(config?.gameOverrides, "playerStatsServers", enabledGames),
        }
    })
    const [draft, setDraft] = useState<Draft>(saved)
    const roles = metadata?.roles ?? null
    const channels = useMemo(
        () =>
            metadata
                ? metadata.channels.filter((channel) =>
                      TEXT_CHANNEL_TYPES.has(channel.type)
                  )
                : null,
        [metadata]
    )
    const changes = countChanges(draft, saved)

    function updateCommand(
        command: ConfigurableCommand,
        entry: CommandSettingsEntry
    ) {
        setDraft((current) => ({
            ...current,
            settings: { ...current.settings, [command]: entry },
        }))
    }
    function updateStats(patch: Partial<StatsCommandSettings>) {
        setDraft((current) => ({
            ...current,
            stats: { ...current.stats, ...patch },
        }))
    }

    async function save() {
        setSaving(true)
        try {
            const commandsChanged =
                changedCommands(draft.settings, saved.settings).length > 0 ||
                !same(draft.stats, saved.stats)
            if (commandsChanged) {
                const response = await fetch(
                    `/api/servers/${serverId}/discord-commands`,
                    {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({
                            action: "save",
                            commandSettings: storeCommandSettings(
                                draft.settings
                            ),
                            statsSettings: {
                                ...draft.stats,
                                enabled: draft.settings.stats.enabled,
                            },
                        }),
                    }
                )
                if (!response.ok) {
                    toast.error(page.saveError)
                    return
                }
            }
            if (
                !same(draft.servers, saved.servers) ||
                !same(draft.exceptions, saved.exceptions)
            ) {
                const result = await saveDiscordSettings(serverId, {
                    playerStatsServers: draft.servers,
                    gameOverrides: withGameExceptions<
                        GameDiscordOverrides,
                        "playerStatsServers"
                    >(
                        config?.gameOverrides,
                        "playerStatsServers",
                        draft.exceptions,
                        enabledGames
                    ),
                })
                if (!result.ok) {
                    toast.error(result.error ?? page.saveError)
                    return
                }
            }
            setSaved(draft)
            toast.success(page.saved)
            startTransition(() => router.refresh())
        } finally {
            setSaving(false)
        }
    }

    const describe = (command: LogiCommand, language = clanLanguage) =>
        describeCommand(
            getCommandMessages(language).registry,
            command,
            draft.settings
        )

    const statsPreview = statsPreviewView({
        language: clanLanguage,
        locale: getIntlLocaleForClanLanguage(clanLanguage),
        settings: { ...draft.stats, enabled: draft.settings.stats.enabled },
        reply: draft.settings.stats.reply,
        accessCopy: getCommandMessages(clanLanguage).access,
        playerName: page.stats.previewPlayer,
    })

    const memberRow = (command: (typeof MEMBER_COMMANDS)[number]) => (
        <CommandRow
            key={command}
            command={command}
            entry={draft.settings[command]}
            description={describe(command)}
            onChange={(entry) => updateCommand(command, entry)}
            roles={roles}
            channels={channels}
            dictionary={dictionary}
            replyHint={command === "player" ? text.playerShareHint : undefined}
        >
            {command === "stats" ? (
                <div className="bg-muted/30 grid gap-6 rounded-2xl border p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <div className="min-w-0 space-y-5">
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold">
                                {page.stats.gamesTitle}
                            </h3>
                            <ul className="space-y-3">
                                {STATS_COMMAND_GAMES.map((game) => (
                                    <li
                                        key={game}
                                        className="flex items-start gap-3"
                                    >
                                        <Switch
                                            id={`stats-command-${game}`}
                                            className="mt-0.5"
                                            aria-label={page.stats.gameSwitch.replace(
                                                "{game}",
                                                GAME_LABELS[game]
                                            )}
                                            checked={draft.stats.games[game]}
                                            disabled={
                                                !draft.settings.stats.enabled
                                            }
                                            onCheckedChange={(checked) =>
                                                updateStats({
                                                    games: {
                                                        ...draft.stats.games,
                                                        [game]: checked,
                                                    },
                                                })
                                            }
                                        />
                                        <div className="min-w-0 space-y-0.5">
                                            <Label
                                                htmlFor={`stats-command-${game}`}
                                                className="font-medium"
                                            >
                                                {GAME_LABELS[game]}
                                            </Label>
                                            <p className="text-muted-foreground text-[13px]">
                                                {game === "wardogs" ? (
                                                    <>
                                                        {
                                                            page.stats
                                                                .wardogsSource
                                                        }{" "}
                                                        <Link
                                                            href={
                                                                hrefs.gameServers
                                                            }
                                                            className="text-foreground underline underline-offset-3"
                                                        >
                                                            {
                                                                page.stats
                                                                    .gameServersLink
                                                            }
                                                        </Link>
                                                        .
                                                    </>
                                                ) : (
                                                    page.stats.hllSource
                                                )}
                                            </p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="space-y-2 border-t pt-4">
                            <div className="text-sm font-medium">
                                {page.stats.shareChannel}
                            </div>
                            <DiscordChannelSelect
                                value={draft.stats.defaultShareChannelId}
                                onChange={(value) =>
                                    updateStats({
                                        defaultShareChannelId:
                                            value || undefined,
                                    })
                                }
                                channels={metadata?.channels ?? []}
                                placeholder={page.stats.shareChannel}
                                noneLabel={page.stats.noShareChannel}
                            />
                            <p className="text-muted-foreground text-[13px]">
                                {page.stats.shareChannelHelp}
                            </p>
                        </div>
                    </div>
                    <div className="min-w-0 space-y-2">
                        <h3 className="text-sm font-semibold">
                            {page.stats.previewTitle}
                        </h3>
                        <DiscordMessagePreview
                            view={statsPreview}
                            language={clanLanguage}
                            style={config?.messageStyle}
                            labels={dictionary.discordPreview}
                            author={{}}
                            invokedBy={{
                                user: page.stats.previewPlayer,
                                command: "/stats",
                            }}
                        />
                    </div>
                </div>
            ) : null}
        </CommandRow>
    )

    const descriptionsIntro = page.descriptions.intro
        .replace("{language}", page.descriptions.languages[clanLanguage])
        .split("{channels}")

    return (
        <div className="space-y-6">
            <SettingsSectionHeader
                title={page.title}
                description={page.description}
            />
            <CommandRegistrationCard
                serverId={serverId}
                serverName={serverName}
                registration={registration}
                now={now}
                dictionary={dictionary}
            />
            <LegacyStatsConnections
                serverId={serverId}
                servers={draft.servers}
                exceptions={draft.exceptions}
                enabledGames={enabledGames}
                exceptionsShown={showsGameExceptions(enabledGames, [
                    draft.exceptions,
                ])}
                onServersChange={(servers) =>
                    setDraft((current) => ({ ...current, servers }))
                }
                onExceptionsChange={(exceptions) =>
                    setDraft((current) => ({ ...current, exceptions }))
                }
                dictionary={dictionary}
            />
            <section
                aria-labelledby="commands-list"
                className="bg-card overflow-hidden rounded-2xl border"
            >
                <div className="space-y-1.5 px-4 pt-5 pb-4 sm:px-5">
                    <h2 id="commands-list" className="text-base font-semibold">
                        {text.title}
                    </h2>
                    <p className="text-muted-foreground flex gap-2 text-sm">
                        <Info
                            className="mt-0.5 size-4 shrink-0"
                            aria-hidden="true"
                        />
                        {text.intro}
                    </p>
                </div>
                <h3 className="bg-muted/50 border-y px-4 py-2 text-sm font-semibold sm:px-5">
                    {text.members}
                </h3>
                <ul className="divide-y">{MEMBER_COMMANDS.map(memberRow)}</ul>
                <h3 className="bg-muted/50 border-y px-4 py-2 text-sm font-semibold sm:px-5">
                    {text.staff}
                </h3>
                <ul className="divide-y">
                    <CommandRow
                        command="server-status"
                        entry={draft.settings["server-status"]}
                        description={describe("server-status")}
                        onChange={(entry) =>
                            updateCommand("server-status", entry)
                        }
                        roles={roles}
                        channels={channels}
                        dictionary={dictionary}
                    />
                    <CloseCommandRow
                        command="close_ticket"
                        enabled={Boolean(config?.ticketSettings?.enabled)}
                        description={describe("close_ticket")}
                        href={hrefs.tickets}
                        dictionary={dictionary}
                    />
                    <CloseCommandRow
                        command="close_application"
                        enabled={Boolean(config?.membershipSettings?.enabled)}
                        description={describe("close_application")}
                        href={hrefs.membership}
                        dictionary={dictionary}
                    />
                </ul>
            </section>
            <section
                aria-labelledby="commands-descriptions"
                className="bg-card space-y-4 rounded-2xl border py-5"
            >
                <div className="space-y-1 px-4 sm:px-5">
                    <h2
                        id="commands-descriptions"
                        className="text-base font-semibold"
                    >
                        {page.descriptions.title}
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        {descriptionsIntro.map((part, index) => (
                            <Fragment key={index}>
                                {index > 0 ? (
                                    <Link
                                        href={hrefs.channels}
                                        className="text-foreground underline underline-offset-3"
                                    >
                                        {page.descriptions.channelsLink}
                                    </Link>
                                ) : null}
                                {part}
                            </Fragment>
                        ))}
                    </p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-sm">
                        <thead className="bg-muted/50 text-left">
                            <tr>
                                <th
                                    scope="col"
                                    className="px-4 py-2 font-semibold sm:px-5"
                                >
                                    {page.descriptions.command}
                                </th>
                                {languageColumns(clanLanguage).map(
                                    (language) => (
                                        <th
                                            key={language}
                                            scope="col"
                                            className="px-3 py-2 font-semibold"
                                        >
                                            {
                                                page.descriptions.columns[
                                                    language
                                                ]
                                            }
                                            {language === clanLanguage
                                                ? ` · ${page.descriptions.clanLanguage}`
                                                : ""}
                                        </th>
                                    )
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {DESCRIPTION_ORDER.map((command) => (
                                <tr key={command} className="align-top">
                                    <th
                                        scope="row"
                                        className="px-4 py-3 text-left font-mono font-semibold sm:px-5"
                                    >
                                        /{command}
                                        {NEW_COMMANDS.has(command) ? (
                                            <Badge
                                                variant="outline"
                                                className="mt-1 block w-fit border-blue-300 bg-blue-50 font-sans text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200"
                                            >
                                                {text.new}
                                            </Badge>
                                        ) : null}
                                    </th>
                                    {languageColumns(clanLanguage).map(
                                        (language) => (
                                            <td
                                                key={language}
                                                lang={language}
                                                className="px-3 py-3"
                                            >
                                                {describe(command, language)}
                                            </td>
                                        )
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
            <UnsavedChangesBar
                changes={changes}
                saving={saving || isPending}
                onDiscard={() => setDraft(saved)}
                onSave={() => void save()}
                dictionary={dictionary}
                note={page.saveNote}
            />
        </div>
    )
}

/** The table's rows in the board's order (N3-23). */
const DESCRIPTION_ORDER: readonly LogiCommand[] = [
    "help",
    "stats",
    "player",
    "link",
    "notice",
    "server-status",
    "close_ticket",
    "close_application",
]
const COLUMN_ORDER: readonly ClanLanguage[] = ["cs", "en", "de"]

/** The clan language's column first, then Czech, English and German. */
function languageColumns(clanLanguage: ClanLanguage) {
    return [
        clanLanguage,
        ...COLUMN_ORDER.filter((language) => language !== clanLanguage),
    ]
}
