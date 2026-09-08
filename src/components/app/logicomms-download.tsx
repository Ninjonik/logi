import { Download } from "lucide-react"

import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export function LogicommsDownload({
    dictionary,
    downloadUrl,
}: {
    dictionary: Dictionary
    downloadUrl: string | null
}) {
    return (
        <section id="logicomms" className="border-t py-10">
            <div className="bg-card grid gap-6 rounded-2xl border p-6 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="space-y-3">
                    <Badge variant="outline" className="rounded-full">
                        {dictionary.home.commsBadge}
                    </Badge>
                    <h2 className="text-2xl font-semibold tracking-tight">
                        {dictionary.home.commsTitle}
                    </h2>
                    <p className="text-muted-foreground max-w-3xl text-sm leading-7 sm:text-base">
                        {dictionary.home.commsDescription}
                    </p>
                </div>
                {downloadUrl ? (
                    <Button asChild size="lg">
                        <a href={downloadUrl}>
                            <Download />
                            {dictionary.home.commsDownload}
                        </a>
                    </Button>
                ) : (
                    <p className="text-muted-foreground text-sm">
                        {dictionary.home.commsUnavailable}
                    </p>
                )}
            </div>
        </section>
    )
}
