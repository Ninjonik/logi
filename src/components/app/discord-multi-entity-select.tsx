"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { DiscordSelectOption } from "@/components/app/discord-entity-select";

export function DiscordMultiEntitySelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  options: DiscordSelectOption[];
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedOptions = useMemo(
    () => options.filter((option) => value.includes(option.id)),
    [options, value],
  );

  function toggleOption(optionId: string) {
    onChange(value.includes(optionId) ? value.filter((id) => id !== optionId) : [...value, optionId]);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="h-auto min-h-11 w-full justify-between rounded-xl px-3 py-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-left">
            {selectedOptions.length ? selectedOptions.map((option) => (
              <Badge
                key={option.id}
                variant="secondary"
                className="max-w-full gap-1 rounded-md"
                onClick={(event) => {
                  event.stopPropagation();
                  toggleOption(option.id);
                }}
              >
                <span className="truncate">{option.name}</span>
                <X className="size-3" />
              </Badge>
            )) : (
              <span className="truncate text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={`${option.name} ${option.id}`}
                  onSelect={() => toggleOption(option.id)}
                >
                  <Check className={cn("mr-2 size-4", value.includes(option.id) ? "opacity-100" : "opacity-0")} />
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
