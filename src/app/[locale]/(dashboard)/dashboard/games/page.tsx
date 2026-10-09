import { GameCatalogueAdmin } from "@/components/app/game-catalogue-admin"
import { competitionAdminAccess } from "@/lib/gateways/competition-admin"
import { AdminPageHeader } from "@/components/app/admin-page-header"
import { makeFunctionReference } from "convex/server"
import { getDictionary } from "@/i18n/dictionaries"
import { notFound } from "next/navigation"
import { fetchQuery } from "convex/nextjs"
import { isLocale } from "@/i18n/config"

export default async function GamesAdminPage({
    params,
}: {
    params: Promise<{ locale: string }>
}) {
    const { locale } = await params
    const dictionary = getDictionary(isLocale(locale) ? locale : "en")
    const access = await competitionAdminAccess()
    if (!access) notFound()
    const games = await fetchQuery(
        makeFunctionReference<"query">("gameCatalog:list"),
        {}
    )
    return (
        <main className="space-y-6 p-6">
            <AdminPageHeader
                eyebrow={dictionary.sidebar.adminNav.title}
                title={dictionary.gameCatalogue.title}
                description={dictionary.gameCatalogue.description}
            />
            <GameCatalogueAdmin
                initialGames={games as never}
                dictionary={dictionary.gameCatalogue}
            />
        </main>
    )
}
