"use client"

import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import type { ServerUserAssignment } from "@/lib/server-user-management"
import { parseDiscordCustomEmoji } from "@/lib/discord-emoji"
import type { Group } from "@/types/domain"

function findGroupByName(groupsById: Map<string, Group>, name?: string | null) {
    if (!name) {
        return undefined
    }

    return [...groupsById.values()].find((group) => group.name === name)
}

function GroupIcon({
    group,
    fallbackLabel,
}: {
    group?: Group
    fallbackLabel?: string | null
}) {
    if (!group && !fallbackLabel) {
        return null
    }

    const customEmoji = group?.discordEmoji
        ? parseDiscordCustomEmoji(group.discordEmoji)
        : null

    if (customEmoji) {
        return (
            <img
                src={customEmoji.imageUrl}
                alt={customEmoji.name}
                title={group?.name ?? fallbackLabel ?? customEmoji.name}
                className="inline-block size-4 rounded-sm object-contain align-middle"
            />
        )
    }

    if (group?.discordEmoji?.trim()) {
        return (
            <span
                title={group.name}
                className="inline-flex size-4 items-center justify-center text-[11px] leading-none"
            >
                {group.discordEmoji}
            </span>
        )
    }

    return (
        <span
            title={group?.name ?? fallbackLabel ?? ""}
            className="border-border/60 inline-flex size-3 rounded-full border"
            style={{ backgroundColor: group?.color ?? "#64748b" }}
        />
    )
}

export function GroupInlineIcons({
    assignment,
    groupsById,
    signupGroupName,
    signupPreferences,
}: {
    assignment?: ServerUserAssignment
    groupsById: Map<string, Group>
    signupGroupName?: string | null
    signupPreferences?: string[]
}) {
    const primaryGroup = assignment?.primaryGroupId
        ? groupsById.get(assignment.primaryGroupId)
        : undefined
    const secondaryGroups = (assignment?.secondaryGroupIds ?? [])
        .map((groupId) => groupsById.get(groupId))
        .filter((group): group is Group => Boolean(group))
    signupGroupName = signupPreferences?.[0] ?? signupGroupName
    const signupGroup = findGroupByName(groupsById, signupGroupName)
    const hasDistinctSignupGroup =
        Boolean(primaryGroup) &&
        Boolean(signupGroupName) &&
        signupGroup?.id !== primaryGroup?.id &&
        signupGroupName !== primaryGroup?.name

    if (!primaryGroup && !signupGroupName) {
        return null
    }

    const signupIcon = signupGroupName ? (
        <Tooltip>
            <TooltipTrigger asChild>
                <span
                    role="img"
                    tabIndex={0}
                    className="inline-flex cursor-help items-center"
                    aria-label={(signupPreferences ?? [signupGroupName])
                        .map((name, index) => `${index + 1}. ${name}`)
                        .join(", ")}
                >
                    <GroupIcon
                        group={signupGroup}
                        fallbackLabel={signupGroupName}
                    />
                </span>
            </TooltipTrigger>
            <TooltipContent>
                <ol className="list-inside list-decimal space-y-1">
                    {(signupPreferences?.length
                        ? signupPreferences
                        : [signupGroupName]
                    ).map((name) => (
                        <li key={name}>{name}</li>
                    ))}
                </ol>
            </TooltipContent>
        </Tooltip>
    ) : null
    return (
        <div className="inline-flex shrink-0 items-center gap-1">
            {hasDistinctSignupGroup ||
            (primaryGroup && (signupPreferences?.length ?? 0) > 1)
                ? signupIcon
                : null}
            {primaryGroup ? (
                secondaryGroups.length ? (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="inline-flex cursor-help items-center">
                                <GroupIcon group={primaryGroup} />
                            </span>
                        </TooltipTrigger>
                        <TooltipContent>
                            <span className="flex items-center gap-1">
                                {secondaryGroups.map((group) => (
                                    <GroupIcon key={group.id} group={group} />
                                ))}
                            </span>
                        </TooltipContent>
                    </Tooltip>
                ) : (
                    <GroupIcon group={primaryGroup} />
                )
            ) : null}
            {!primaryGroup && signupGroupName ? signupIcon : null}
        </div>
    )
}
