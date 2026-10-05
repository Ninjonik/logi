"use client"

import { useMemo } from "react"

import { DiscordMultiEntitySelect } from "@/components/app/discord-multi-entity-select"
import type { DiscordSelectOption } from "@/components/app/discord-entity-select"

/**
 * Discord roles picked by name for an integration policy. Saved roles that
 * Discord no longer lists (or while the list is unavailable) stay visible by
 * ID so saving never drops them silently.
 */
export function PolicyRolePicker({
    labelId,
    value,
    onChange,
    roles,
    placeholder,
}: {
    labelId: string
    value: string[]
    onChange(value: string[]): void
    roles: DiscordSelectOption[] | null
    placeholder: string
}) {
    const options = useMemo(() => {
        const known = roles ?? []
        const unknown = value
            .filter((roleId) => !known.some((role) => role.id === roleId))
            .map((roleId) => ({ id: roleId, name: roleId }))
        return [...known, ...unknown]
    }, [roles, value])
    return (
        <div role="group" aria-labelledby={labelId}>
            <DiscordMultiEntitySelect
                value={value}
                onChange={onChange}
                options={options}
                placeholder={placeholder}
            />
        </div>
    )
}
