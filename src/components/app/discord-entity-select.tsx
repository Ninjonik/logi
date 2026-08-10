"use client";

import { EntitySelect, type EntitySelectOption } from "@/components/app/entity-select";

export type DiscordSelectOption = EntitySelectOption;

export function DiscordEntitySelect({
  value,
  onChange,
  options,
  placeholder,
  allowNone = true,
  noneLabel = "None",
}: {
  value?: string;
  onChange: (value?: string) => void;
  options: DiscordSelectOption[];
  placeholder: string;
  allowNone?: boolean;
  noneLabel?: string;
}) {
  return (
    <EntitySelect
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      allowNone={allowNone}
      noneLabel={noneLabel}
    />
  );
}
