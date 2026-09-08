"use client"

import { FaPlaystation, FaSteam, FaXbox } from "react-icons/fa"
import { ExternalLink, Globe2 } from "lucide-react"
import { SiEpicgames } from "react-icons/si"
import type { IconType } from "react-icons"

import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { describePlatformIds, type PlatformKey } from "@/lib/platform-ids"
import type { Dictionary } from "@/i18n/dictionaries"
import { Badge } from "@/components/ui/badge"

function PlatformIcon({
    platform,
    className = "size-4",
}: {
    platform: PlatformKey
    className?: string
}) {
    const icons: Partial<Record<PlatformKey, IconType>> = {
        steam: FaSteam,
        epic: SiEpicgames,
        xbox: FaXbox,
        playstation: FaPlaystation,
    }
    const Icon = icons[platform]

    if (Icon) {
        return <Icon className={className} aria-hidden="true" />
    }

    switch (platform) {
        default:
            return <Globe2 className={className} />
    }
}

function getPlatformLabels(
    dictionary: Dictionary
): Record<PlatformKey, string> {
    return {
        steam: dictionary.shared.platformSteam,
        epic: dictionary.shared.platformEpic,
        xbox: dictionary.shared.platformXbox,
        playstation: dictionary.shared.platformPlayStation,
        other: dictionary.shared.platformOther,
    }
}

export function getDetectedPlatformHint(input: string, dictionary: Dictionary) {
    const items = describePlatformIds(
        input
            .split(",")
            .map((entry) => entry.trim())
            .filter(Boolean),
        getPlatformLabels(dictionary)
    )

    if (!items.length) {
        return null
    }

    const labels = [...new Set(items.map((item) => `${item.label} ID`))].join(
        ", "
    )
    return dictionary.shared.detectedPlatformId.replace("{platform}", labels)
}

export function PlatformIdList({
    platformIds,
    dictionary,
    compact = false,
    showProfileLinks = false,
    emptyLabel,
}: {
    platformIds: string[] | undefined | null
    dictionary: Dictionary
    compact?: boolean
    showProfileLinks?: boolean
    emptyLabel?: string
}) {
    const items = describePlatformIds(
        platformIds,
        getPlatformLabels(dictionary)
    )

    if (!items.length) {
        return emptyLabel ? (
            <span className="text-muted-foreground text-sm">{emptyLabel}</span>
        ) : null
    }

    if (compact) {
        return (
            <div className="flex flex-wrap items-center gap-1.5">
                {items.map((item) => (
                    <Tooltip key={`${item.platform}-${item.rawId}`}>
                        <TooltipTrigger asChild>
                            <span className="border-border/60 bg-background text-muted-foreground inline-flex size-7 items-center justify-center rounded-full border">
                                <PlatformIcon
                                    platform={item.platform}
                                    className="size-3.5"
                                />
                            </span>
                        </TooltipTrigger>
                        <TooltipContent>
                            {item.label}: {item.rawId}
                        </TooltipContent>
                    </Tooltip>
                ))}
            </div>
        )
    }

    return (
        <div className="flex flex-wrap gap-2">
            {items.map((item) => (
                <Badge
                    key={`${item.platform}-${item.rawId}`}
                    variant="secondary"
                    className="border-border/60 bg-background flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium"
                >
                    <PlatformIcon
                        platform={item.platform}
                        className="size-3.5"
                    />
                    <span>{item.label}</span>
                    <span className="max-w-[18rem] truncate">{item.rawId}</span>
                    {showProfileLinks && item.profileUrl ? (
                        <a
                            href={item.profileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <ExternalLink className="size-3.5" />
                        </a>
                    ) : null}
                </Badge>
            ))}
        </div>
    )
}
