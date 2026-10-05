import { redirect } from "next/navigation"

/** System tools now live in clan settings. */
export default async function SystemPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string; serverId: string }>
    searchParams: Promise<{ game?: string }>
}) {
    const { locale, serverId } = await params
    const { game } = await searchParams
    const search = game ? `?game=${encodeURIComponent(game)}` : ""
    redirect(`/${locale}/dashboard/servers/${serverId}/settings${search}`)
}
