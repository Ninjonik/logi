import type { Metadata } from "next"

import { getCurrentPlayer, getVisibleGuildsForLoggedInUser } from "@/lib/auth"
import { UserSettingsForm } from "@/components/app/user-settings-form"
import { PageHeader } from "@/components/app/page-header"
import { getDictionary } from "@/i18n/dictionaries"
import { isLocale } from "@/i18n/config"

export const metadata: Metadata = {
    title: "User settings | Logi",
    description: "Manage your Logi account settings.",
}

export default async function UserSettingsPage({
    params,
}: {
    params: Promise<{ locale: string }>
}) {
    const { locale } = await params
    const dictionary = getDictionary(isLocale(locale) ? locale : "en")
    const [user, workspaces] = await Promise.all([
        getCurrentPlayer(),
        getVisibleGuildsForLoggedInUser(),
    ])

    if (!user) {
        return null
    }

    return (
        <>
            <PageHeader
                title={dictionary.userSettings.title}
                description={dictionary.userSettings.description}
            />
            <div className="px-4 lg:px-6">
                <UserSettingsForm
                    user={user}
                    dictionary={dictionary}
                    workspaces={workspaces}
                />
            </div>
        </>
    )
}
