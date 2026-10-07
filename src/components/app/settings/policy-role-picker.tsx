"use client"

import { useTranslations } from "next-intl"

import type { DiscordSelectOption } from "@/components/app/discord-entity-select"
import { RoleChips } from "@/components/app/settings/role-chips"

/**
 * Discord roles picked by name for an integration policy, as chips with
 * "+ role" (design G5). Saved roles that Discord no longer lists (or while
 * the list is unavailable) stay visible by ID so saving never drops them
 * silently.
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
    const t = useTranslations("membershipSettings")
    return (
        <div role="group" aria-labelledby={labelId}>
            <RoleChips
                value={value}
                onChange={onChange}
                roles={roles}
                labels={{
                    add: t("addRole"),
                    addAria: placeholder,
                    remove: (name) => t("removeRole", { role: name }),
                    search: t("roleSearch"),
                    empty: t("roleEmpty"),
                }}
            />
        </div>
    )
}
