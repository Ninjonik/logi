import type { Metadata } from "next"

import { EditMatchPage } from "@/components/app/new-match/edit-match-page"

export const metadata: Metadata = {
    title: "Edit event",
    description: "Change a published match or training in the five-step flow.",
}

/** Edit a published event (design D2 in edit mode); `?step=` opens a step. */
export default async function EditEventRoute({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string; serverId: string; eventId: string }>
    searchParams: Promise<{ step?: string }>
}) {
    const { locale, serverId, eventId } = await params
    const { step } = await searchParams
    return (
        <EditMatchPage
            locale={locale}
            serverId={serverId}
            eventId={eventId}
            section="events"
            step={step}
        />
    )
}
