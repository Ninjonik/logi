import { redirect } from "next/navigation"

/** Imports moved to clan settings. */
export default async function SystemImportsPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string; serverId: string }>
    searchParams: Promise<{ game?: string }>
}) {
    const { locale, serverId } = await params
    const { game } = await searchParams
    const search = game ? `?game=${encodeURIComponent(game)}` : ""
    redirect(
        `/${locale}/dashboard/servers/${serverId}/settings/imports${search}`
    )
}
