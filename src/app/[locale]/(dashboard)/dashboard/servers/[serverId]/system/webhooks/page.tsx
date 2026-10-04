import { redirect } from "next/navigation"

/** Webhooks moved to clan settings. */
export default async function SystemWebhooksPage({
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
        `/${locale}/dashboard/servers/${serverId}/settings/webhooks${search}`
    )
}
