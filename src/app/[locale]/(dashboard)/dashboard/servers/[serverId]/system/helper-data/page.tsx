import { redirect } from "next/navigation"

export default async function SystemHelperDataPage({
    params,
}: {
    params: Promise<{ locale: string; serverId: string }>
}) {
    const { locale, serverId } = await params
    redirect(`/${locale}/dashboard/servers/${serverId}/system#helper-data`)
}
