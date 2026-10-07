import type { Metadata } from "next"

import { getCurrentPlayer, getVisibleGuildsForLoggedInUser } from "@/lib/auth"
import { UserSettingsForm } from "@/components/app/user-settings-form"
import { getDictionary } from "@/i18n/dictionaries"
import { isLocale } from "@/i18n/config"

export async function generateMetadata(props: {
    params?: Promise<{ locale: string }>
}): Promise<Metadata> {
    // The build also evaluates this while collecting page data, without params.
    const locale = (await props?.params)?.locale
    const dictionary = getDictionary(locale && isLocale(locale) ? locale : "en")
    return {
        title: dictionary.userSettings.accountTitle,
        description: dictionary.userSettings.accountDescription,
    }
}

export default async function UserSettingsPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string }>
    searchParams: Promise<{ steam?: string }>
}) {
    const { locale } = await params
    const dictionary = getDictionary(isLocale(locale) ? locale : "en")
    const [user, workspaces] = await Promise.all([
        getCurrentPlayer(),
        getVisibleGuildsForLoggedInUser(),
    ])

    // The dashboard layout already sends signed-out visitors to the login.
    if (!user) {
        return null
    }

    return (
        <div className="px-4 pb-12 lg:px-6">
            <UserSettingsForm
                user={user}
                dictionary={dictionary}
                workspaces={workspaces}
                locale={isLocale(locale) ? locale : "en"}
                steamCallbackFailed={(await searchParams).steam === "failed"}
            />
        </div>
    )
}
