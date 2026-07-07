"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type DiscordSelectOption = {
  id: string;
  name: string;
  imageUrl?: string;
};

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
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => options.find((option) => option.id === value), [options, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between rounded-xl">
          <span className="flex min-w-0 items-center gap-2 truncate">
            {selected?.imageUrl ? <img src={selected.imageUrl} alt="" className="size-5 rounded-sm object-contain" /> : null}
            <span className="truncate">{selected?.name ?? placeholder}</span>
          </span>
          <ChevronsUpDown className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              {allowNone ? (
                <CommandItem
                  value={noneLabel}
                  onSelect={() => {
                    onChange(undefined);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 size-4", !value ? "opacity-100" : "opacity-0")} />
                  {noneLabel}
                </CommandItem>
              ) : null}
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={`${option.name} ${option.id}`}
                  onSelect={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 size-4", value === option.id ? "opacity-100" : "opacity-0")} />
                  {option.imageUrl ? <img src={option.imageUrl} alt="" className="mr-2 size-5 rounded-sm object-contain" /> : null}
                  <span className="truncate">{option.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
