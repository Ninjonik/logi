"use client"

import {
    EntitySelect,
    type EntitySelectOption,
} from "@/components/app/entity-select"

export type DiscordSelectOption = EntitySelectOption

export function DiscordEntitySelect({
    id,
    value,
    onChange,
    options,
    placeholder,
    allowNone = true,
    noneLabel = "None",
    emptyLabel,
}: {
    id?: string
    value?: string
    onChange: (value?: string) => void
    options: DiscordSelectOption[]
    placeholder: string
    allowNone?: boolean
    noneLabel?: string
    emptyLabel?: string
}) {
    return (
        <EntitySelect
            id={id}
            value={value}
            onChange={onChange}
            options={options}
            placeholder={placeholder}
            allowNone={allowNone}
            noneLabel={noneLabel}
            emptyLabel={emptyLabel}
        />
    )
}
