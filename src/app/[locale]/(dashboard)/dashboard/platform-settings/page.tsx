import {
    getCurrentPlayer,
    getVisibleGuildsForLoggedInUser,
    isCurrentUserSuperadmin,
} from "@/lib/auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PlatformSettingsForm } from "@/components/app/platform-settings-form"
import { getPlatformSettings } from "@/lib/platform-settings"
import { PageHeader } from "@/components/app/page-header"
import { getDictionary } from "@/i18n/dictionaries"
import { redirect } from "next/navigation"
import { isLocale } from "@/i18n/config"
import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Platform settings",
    description: "Platform-wide service status settings.",
}

export default async function PlatformSettingsPage({
    params,
}: {
    params: Promise<{ locale: string }>
}) {
    const { locale } = await params
    const safeLocale = isLocale(locale) ? locale : "en"
    if (!(await getCurrentPlayer()) || !(await isCurrentUserSuperadmin()))
        redirect(`/${safeLocale}/dashboard`)
    const [settings, workspaces] = await Promise.all([
        getPlatformSettings(),
        getVisibleGuildsForLoggedInUser(),
    ])
    const dictionary = getDictionary(safeLocale)
    const t = dictionary.dashboard
    return (
        <>
            <PageHeader
                title={dictionary.dashboard.platformSettingsTitle}
                description={dictionary.dashboard.platformSettingsDescription}
            />
            <div className="px-4 lg:px-6">
                <Card className="max-w-2xl">
                    <CardHeader>
                        <CardTitle>
                            {dictionary.dashboard.platformSettingsTitle}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <PlatformSettingsForm
                            workspaces={workspaces.map((workspace) => ({
                                id: workspace.discordId,
                                name: workspace.name,
                                botInside: Boolean(workspace.botInside),
                            }))}
                            initialWorkspaceGuildId={settings?.workspaceGuildId}
                            initialStatusChannelId={settings?.statusChannelId}
                            labels={{
                                workspace: t.platformWorkspace,
                                workspacePlaceholder:
                                    t.platformWorkspacePlaceholder,
                                workspaceHint: t.platformWorkspaceHint,
                                workspaceBotMissing:
                                    t.platformWorkspaceBotMissing,
                                savedWorkspace: t.platformSavedWorkspace,
                                channel: t.platformStatusChannel,
                                channelPlaceholder:
                                    t.platformChannelPlaceholder,
                                channelNone: t.platformChannelNone,
                                channelsLoading: t.platformChannelsLoading,
                                channelsError: t.platformChannelsError,
                                channelsRetry: t.platformChannelsRetry,
                                chooseWorkspaceFirst:
                                    t.platformChooseWorkspaceFirst,
                                hint: t.platformStatusChannelHint,
                                save: t.platformSave,
                                saved: t.platformSaved,
                                saveError: t.platformSaveError,
                            }}
                        />
                    </CardContent>
                </Card>
            </div>
        </>
    )
}
