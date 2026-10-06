import {
    discordSeedWebAccess,
    readDiscordSeed,
} from "@/lib/gateways/discord-seed"
import { settingsHref } from "@/components/app/settings/settings-section-meta"
import { isSettingsSectionId } from "@/domain/workspaces/settings-sections"
import { resolveClanLanguage } from "@/lib/clan-language/core"
import type { ServerContext } from "@/lib/server-context"
import type { Dictionary } from "@/i18n/dictionaries"
import { getSiteUrl } from "@/lib/env"

import { SeedSettings } from "./seed-settings"

const CONNECTION_ID = /^[A-Za-z0-9:_-]{1,100}$/

/**
 * "Panely v Discordu", the page this one sits under. Until that page exists
 * on this branch the way back leads to the settings overview.
 */
function backHref(locale: string, serverId: string) {
    const parent: string = "discord-panels"
    return isSettingsSectionId(parent)
        ? settingsHref(locale, serverId, parent)
        : settingsHref(locale, serverId)
}

/**
 * Loads the "Seed serverů" page (board P3) for a clan admin: the tabs, the
 * selected server's plan, status and history, and the clan's message
 * language, colour and time zone for the previews.
 */
export async function SeedSettingsPage({
    serverId,
    locale,
    server,
    context,
    dictionary,
}: {
    serverId: string
    locale: string
    /** `?server=` from the URL: the selected tab. */
    server: string | undefined
    context: Pick<ServerContext, "discordConfig" | "user">
    dictionary: Dictionary
}) {
    const access = await discordSeedWebAccess(serverId)
    const selected = server && CONNECTION_ID.test(server) ? server : null
    let data = access
        ? await readDiscordSeed(access, selected).catch(() => null)
        : null
    // An old link to a removed server opens the first tab instead.
    if (access && data && !data.selected && selected && data.servers.length)
        data = await readDiscordSeed(access, null).catch(() => null)
    if (!data)
        return (
            <p role="alert" className="text-muted-foreground text-sm">
                {dictionary.seedPage.unavailable}
            </p>
        )
    const config = context.discordConfig
    const language = resolveClanLanguage(config?.defaultLanguage)
    return (
        <SeedSettings
            serverId={serverId}
            locale={locale}
            language={language}
            timeZone={config?.timezone || "UTC"}
            messageStyle={config?.messageStyle ?? null}
            data={data}
            now={new Date().getTime()}
            actorName={context.user.name}
            joinUrl={`${getSiteUrl()}/${language}/join`}
            hrefs={{
                page: settingsHref(locale, serverId, "discord-seed"),
                back: backHref(locale, serverId),
                gameServers: settingsHref(locale, serverId, "game-servers"),
            }}
            text={dictionary.seedPage}
            previewLabels={dictionary.discordPreview}
        />
    )
}
