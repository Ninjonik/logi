import { SignupActivityFeed } from "@/components/app/signup-activity-feed"
import { getUsersByIds } from "@/lib/server-user-management"
import { PageHeader } from "@/components/app/page-header"
import { getSignupActivity } from "@/lib/signup-activity"
import { getServerContext } from "@/lib/server-context"
import { getDictionary } from "@/i18n/dictionaries"
import { isLocale } from "@/i18n/config"

export default async function SignupActivityPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string; serverId: string }>
    searchParams: Promise<{ eventId?: string }>
}) {
    const { locale, serverId } = await params
    const { eventId } = await searchParams
    const dictionary = getDictionary(isLocale(locale) ? locale : "en")
    const context = await getServerContext(serverId)
    if (!context) return null

    const activity = await getSignupActivity(serverId, eventId)
    const users = await getUsersByIds(
        [...new Set(activity.map((entry) => entry.userId))],
        context.server.discordId
    )
    const userNameById = new Map(
        users.map((user) => [user.discordId, user.name])
    )

    return (
        <>
            <PageHeader
                title={dictionary.signupActivity.title}
                description={dictionary.signupActivity.description}
            />
            <div className="mt-6 px-4 lg:px-6">
                <SignupActivityFeed
                    activity={activity}
                    userNameById={userNameById}
                    dictionary={dictionary}
                />
            </div>
        </>
    )
}
