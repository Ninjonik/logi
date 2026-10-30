import { DemoPlayerProfile } from "@/components/app/onboarding/native-examples"
import { getServerContext } from "@/lib/server-context"
import { getDictionary } from "@/i18n/dictionaries"
import { notFound } from "next/navigation"
import { isLocale } from "@/i18n/config"
/** A reserved, authenticated example profile; never a real assignment identifier. */
export default async function OnboardingPlayerPage({
    params,
}: {
    params: Promise<{ serverId: string; locale: string }>
}) {
    const { serverId, locale } = await params
    const context = await getServerContext(serverId, "all")
    if (!context?.canAdmin) notFound()
    const safeLocale = isLocale(locale) ? locale : "en"
    return (
        <DemoPlayerProfile
            dictionary={getDictionary(safeLocale)}
            locale={safeLocale}
        />
    )
}
