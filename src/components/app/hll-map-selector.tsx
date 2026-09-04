"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getHllModeOptions, getHllTimeOptions } from "@/lib/hll-map-presets";
import { getHllStratmapMapById, getHllStratmapMaps } from "@/lib/stratmaps";
import { cn } from "@/lib/utils";

function getDisplayMapName(mapId: string) {
  const map = getHllStratmapMapById(mapId);
  if (!map) {
    return mapId;
  }

  const upstreamName = map.upstreamName?.trim();
  if (upstreamName && /^[A-Za-z.\s]+$/.test(upstreamName) && upstreamName.length < map.name.length) {
    return upstreamName;
  }

  return map.name;
}

function resolvePointValue(mapId: string, value: string | undefined, valueMode: "id" | "label") {
  if (!value) {
    return undefined;
  }

  const points = getHllStratmapMapById(mapId)?.strongpoints ?? [];
  return points.find((point) =>
    valueMode === "id"
      ? point.id === value
      : point.label.toLowerCase() === value.toLowerCase() || point.grid.toLowerCase() === value.toLowerCase(),
  );
}

function SearchableSelect({
                            value,
                            onChange,
                            options,
                            placeholder,
                            searchPlaceholder,
                            noneLabel,
                            noResults,
                            disabled,
                            open,
                            onOpenChange,
                            onClosed,
                          }: {
  value?: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string; searchText?: string; detail?: string }>;
  placeholder: string;
  searchPlaceholder: string;
  noneLabel?: string;
  noResults: string;
  disabled?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fires once Radix has fully finished closing this popover (animation included). */
  onClosed?: () => void;
}) {
  const selected = options.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="h-auto min-h-9 w-full min-w-0 justify-between overflow-hidden rounded-lg px-3 py-2 text-sm"
          disabled={disabled}
        >
          <span className="flex min-w-0 flex-col items-start text-left">
            <span className={cn("truncate font-medium", !selected && "text-muted-foreground")}>
              {selected?.label ?? noneLabel ?? placeholder}
            </span>
            {selected?.detail ? <span className="truncate text-xs text-muted-foreground">{selected.detail}</span> : null}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[360px] p-0"
        align="start"
        onCloseAutoFocus={(event) => {
          // The trigger is either about to be permanently disabled (locked
          // field) or the user just dismissed without picking anything —
          // either way, returning focus to it isn't useful, and doing so is
          // what caused the race with the next popover opening. This event
          // is also our reliable "I am fully done closing" signal, so we
          // use it to drive the next-field-opens logic instead of guessing
          // with timers.
          event.preventDefault();
          onClosed?.();
        }}
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{noResults}</CommandEmpty>
            <CommandGroup>
              {noneLabel ? (
                <CommandItem
                  value={noneLabel}
                  onSelect={() => {
                    onChange("");
                  }}
                >
                  <Check className={cn("mr-2 size-4", !value ? "opacity-100" : "opacity-0")} />
                  {noneLabel}
                </CommandItem>
              ) : null}
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.searchText ?? `${option.label} ${option.detail ?? ""}`}
                  onSelect={() => {
                    onChange(option.value);
                  }}
                >
                  <Check className={cn("mr-2 size-4", value === option.value ? "opacity-100" : "opacity-0")} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{option.label}</span>
                    {option.detail ? <span className="truncate text-xs text-muted-foreground">{option.detail}</span> : null}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

type SelectorField = "map" | "time" | "mode" | "point" | "side";

export function HllMapSelector({
                                 mapId,
                                 onMapIdChange,
                                 time,
                                 onTimeChange,
                                 mode,
                                 onModeChange,
                                 pointValue,
                                 onPointValueChange,
                                 sideValue,
                                 onSideValueChange,
                                 pointValueMode = "label",
                                 pointShowGrid = true,
                                 includeVariants = false,
                                 includePoint = true,
                                 includeSide = false,
                                 disabled,
                                 labels,
                               }: {
  mapId: string;
  onMapIdChange: (value: string) => void;
  time?: string;
  onTimeChange?: (value: string) => void;
  mode?: string;
  onModeChange?: (value: string) => void;
  pointValue?: string;
  onPointValueChange?: (value: string) => void;
  sideValue?: string;
  onSideValueChange?: (value: string) => void;
  pointValueMode?: "id" | "label";
  pointShowGrid?: boolean;
  includeVariants?: boolean;
  includePoint?: boolean;
  includeSide?: boolean;
  disabled?: boolean;
  labels: {
    map: string;
    mapSearch: string;
    time: string;
    mode: string;
    point: string;
    pointSearch: string;
    optional?: string;
    noResults: string;
    side?: string;
    reset?: string;
  };
}) {
  const maps = getHllStratmapMaps();
  const selectedMap = getHllStratmapMapById(mapId);
  const selectedPoint = mapId ? resolvePointValue(mapId, pointValue, pointValueMode) : undefined;
  const timeOptions = mapId ? getHllTimeOptions(mapId) : [];
  const modeOptions = mapId && time ? getHllModeOptions(mapId, time) : [];

  // Only the fields that are actually rendered, in the order they get
  // filled in and locked.
  const fieldOrder: SelectorField[] = [
    "map",
    ...(includeVariants ? (["time", "mode"] as const) : []),
    ...(includePoint ? (["point"] as const) : []),
    ...(includeSide ? (["side"] as const) : []),
  ];

  // Explicit, not inferred from "does it have a value" — picking "None" on
  // an optional field is still a choice and should lock it too.
  const [lockedFields, setLockedFields] = useState<Record<SelectorField, boolean>>({
    map: false,
    time: false,
    mode: false,
    point: false,
    side: false,
  });
  const [openField, setOpenField] = useState<SelectorField | null>(null);

  const isLocked = (field: SelectorField) => lockedFields[field];

  const dependencyDisabled = (field: SelectorField) => {
    switch (field) {
      case "time":
        return !mapId;
      case "mode":
        return !mapId || !time;
      case "point":
        return !mapId;
      default:
        return false;
    }
  };

  const isOpenFor = (field: SelectorField) =>
    openField === field && !isLocked(field) && !dependencyDisabled(field) && !disabled;

  const openChangeHandler = (field: SelectorField) => (isOpen: boolean) => {
    setOpenField((current) => {
      if (isOpen) return field;
      return current === field ? null : current;
    });
  };

  const lockField = (field: SelectorField) => {
    setLockedFields((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  };

  const advanceFrom = (field: SelectorField) => {
    const idx = fieldOrder.indexOf(field);
    setOpenField(idx === -1 ? null : fieldOrder[idx + 1] ?? null);
  };

  // Only chain to the next field if THIS popover closed because the user
  // just locked it in — not if they dismissed it (Escape / click outside)
  // while it was still editable.
  const handleClosed = (field: SelectorField) => () => {
    if (lockedFields[field]) {
      advanceFrom(field);
    }
  };

  const hasAnyValue = fieldOrder.some((field) => lockedFields[field]);

  const handleReset = () => {
    onMapIdChange("");
    onTimeChange?.("");
    onModeChange?.("");
    onPointValueChange?.("");
    onSideValueChange?.("");
    setLockedFields({ map: false, time: false, mode: false, point: false, side: false });
    setOpenField(null);
  };

  return (
    <div className="flex flex-row flex-wrap items-end gap-2 w-full min-w-0 overflow-x-hidden">
      <div className="flex-1 min-w-48 space-y-1.5">
        <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{labels.map}</div>
        <SearchableSelect
          value={mapId}
          open={isOpenFor("map")}
          onOpenChange={openChangeHandler("map")}
          onClosed={handleClosed("map")}
          onChange={(value) => {
            onMapIdChange(value);
            lockField("map");
          }}
          disabled={disabled || isLocked("map")}
          placeholder={labels.map}
          searchPlaceholder={labels.mapSearch}
          noResults={labels.noResults}
          options={maps.map((map) => ({
            value: map.id,
            label: getDisplayMapName(map.id),
            searchText: [map.name, map.upstreamName, map.id].filter(Boolean).join(" "),
          }))}
        />
      </div>
      {includeVariants ? (
        <div className="flex-1 min-w-48 space-y-1.5">
          <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{labels.time}</div>
          <SearchableSelect
            value={time}
            open={isOpenFor("time")}
            onOpenChange={openChangeHandler("time")}
            onClosed={handleClosed("time")}
            onChange={(value) => {
              onTimeChange?.(value);
              lockField("time");
            }}
            disabled={disabled || dependencyDisabled("time") || isLocked("time")}
            placeholder={labels.time}
            searchPlaceholder={labels.time}
            noResults={labels.noResults}
            options={timeOptions}
          />
        </div>
      ) : null}
      {includeVariants ? (
        <div className="flex-1 min-w-48 space-y-1.5">
          <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{labels.mode}</div>
          <SearchableSelect
            value={mode}
            open={isOpenFor("mode")}
            onOpenChange={openChangeHandler("mode")}
            onClosed={handleClosed("mode")}
            onChange={(value) => {
              onModeChange?.(value);
              lockField("mode");
            }}
            disabled={disabled || dependencyDisabled("mode") || isLocked("mode")}
            placeholder={labels.mode}
            searchPlaceholder={labels.mode}
            noResults={labels.noResults}
            options={modeOptions}
          />
        </div>
      ) : null}
      {includePoint ? (
        <div className="flex-1 min-w-48 space-y-1.5">
          <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{labels.point}</div>
          <SearchableSelect
            value={selectedPoint?.id ?? ""}
            open={isOpenFor("point")}
            onOpenChange={openChangeHandler("point")}
            onClosed={handleClosed("point")}
            onChange={(value) => {
              if (!value) {
                onPointValueChange?.("");
              } else {
                const point = resolvePointValue(mapId, value, "id");
                onPointValueChange?.(point ? (pointValueMode === "id" ? point.id : point.label) : value);
              }
              lockField("point");
            }}
            disabled={disabled || dependencyDisabled("point") || isLocked("point")}
            placeholder={labels.point}
            searchPlaceholder={labels.pointSearch}
            noneLabel={labels.optional}
            noResults={labels.noResults}
            options={(selectedMap?.strongpoints ?? []).map((point) => ({
              value: point.id,
              label: point.label,
              searchText: `${point.label} ${point.id}`,
            }))}
          />
        </div>
      ) : null}
      {includeSide ? (
        <div className="flex-1 min-w-48 space-y-1.5">
          <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{labels.side ?? "Side"}</div>
          <SearchableSelect
            value={sideValue ?? ""}
            open={isOpenFor("side")}
            onOpenChange={openChangeHandler("side")}
            onClosed={handleClosed("side")}
            onChange={(value) => {
              onSideValueChange?.(value);
              lockField("side");
            }}
            disabled={disabled || isLocked("side")}
            placeholder={labels.side ?? "Side"}
            searchPlaceholder={labels.side ?? "Side"}
            noneLabel={labels.optional}
            noResults={labels.noResults}
            options={[
              { value: "Allies", label: "Allies" },
              { value: "Axis", label: "Axis" },
            ]}
          />
        </div>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 shrink-0 gap-1.5 rounded-lg"
        disabled={disabled || !hasAnyValue}
        onClick={handleReset}
      >
        <RotateCcw className="size-4" />
        {labels.reset ?? "Reset"}
      </Button>
    </div>
  );
}