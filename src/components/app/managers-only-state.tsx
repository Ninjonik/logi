import { ShieldAlert } from "lucide-react"
import Link from "next/link"

import { EmptyState } from "@/components/app/empty-state"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"

/** A manager-only clan page opened by a member: say so and offer a way back. */
export function ManagersOnlyState({
    dictionary,
    overviewHref,
}: {
    dictionary: Dictionary
    overviewHref: string
}) {
    return (
        <div className="px-4 lg:px-6">
            <EmptyState
                icon={ShieldAlert}
                title={dictionary.workspacePages.managersOnlyTitle}
                description={dictionary.workspacePages.managersOnlyDescription}
                actions={
                    <Button asChild variant="outline" className="rounded-xl">
                        <Link href={overviewHref}>
                            {dictionary.workspacePages.backToOverview}
                        </Link>
                    </Button>
                }
            />
        </div>
    )
}
