import { redirect } from "next/navigation"

export default async function SystemWebhooksPage({
    params,
}: {
    params: Promise<{ locale: string; serverId: string }>
}) {
    const { locale, serverId } = await params
    redirect(`/${locale}/dashboard/servers/${serverId}/system#webhooks`)
}
