import { ListChecks, Users } from "lucide-react"
import Link from "next/link"

import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"

/** Settings › Squad and topic presets: what each preset type does and where to edit it. */
export function PresetsOverview({
    locale,
    serverId,
    squadPresetCount,
    topicPresetCount,
    dictionary,
}: {
    locale: string
    serverId: string
    squadPresetCount: number
    topicPresetCount: number
    dictionary: Dictionary
}) {
    const text = dictionary.matchTemplates.presets
    const base = `/${locale}/dashboard/servers/${serverId}`
    const cards = [
        {
            key: "squad",
            icon: Users,
            title: dictionary.settingsHub.presetLinks.squadPresets,
            description: text.squadDescription,
            count: squadPresetCount,
            href: `${base}/squad-presets`,
        },
        {
            key: "topic",
            icon: ListChecks,
            title: dictionary.settingsHub.presetLinks.topicPresets,
            description: text.topicDescription,
            count: topicPresetCount,
            href: `${base}/topic-presets`,
        },
    ]
    return (
        <ul className="grid gap-4 md:grid-cols-2">
            {cards.map((card) => (
                <li
                    key={card.key}
                    className="border-border/60 flex flex-col gap-3 rounded-2xl border p-5"
                >
                    <div className="flex items-start gap-3">
                        <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-xl">
                            <card.icon className="size-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 space-y-1">
                            <h2 className="font-semibold">{card.title}</h2>
                            <p className="text-muted-foreground text-sm">
                                {card.description}
                            </p>
                        </div>
                    </div>
                    <p className="text-sm">
                        {text.count.replace("{count}", String(card.count))}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            asChild
                            variant="outline"
                            className="rounded-xl"
                        >
                            <Link href={card.href}>{text.manage}</Link>
                        </Button>
                        <Button asChild className="rounded-xl">
                            <Link href={`${card.href}/create`}>
                                {dictionary.common.createPreset}
                            </Link>
                        </Button>
                    </div>
                </li>
            ))}
        </ul>
    )
}
