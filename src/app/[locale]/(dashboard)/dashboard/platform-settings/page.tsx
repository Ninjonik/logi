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
                            workspaces={workspaces
                                .filter((workspace) => workspace.botInside)
                                .map((workspace) => ({
                                    id: workspace.discordId,
                                    name: workspace.name,
                                }))}
                            initialWorkspaceGuildId={settings?.workspaceGuildId}
                            initialStatusChannelId={settings?.statusChannelId}
                            labels={{
                                workspace:
                                    dictionary.dashboard.platformWorkspace,
                                channel:
                                    dictionary.dashboard.platformStatusChannel,
                                hint: dictionary.dashboard
                                    .platformStatusChannelHint,
                                save: dictionary.dashboard.platformSave,
                                saved: dictionary.dashboard.platformSaved,
                            }}
                        />
                    </CardContent>
                </Card>
            </div>
        </>
    )
}
