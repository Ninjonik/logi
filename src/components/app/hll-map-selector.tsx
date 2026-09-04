"use client";

import { useEffect, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

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
                            onSelectComplete,
                          }: {
  value?: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string; searchText?: string; detail?: string }>;
  placeholder: string;
  searchPlaceholder: string;
  noneLabel?: string;
  noResults: string;
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSelectComplete?: () => void;
}) {
  const selected = options.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="h-auto min-h-9 w-full min-w-0 justify-between overflow-hidden rounded-lg px-3 py-2 text-sm" disabled={disabled}>
          <span className="flex min-w-0 flex-col items-start text-left">
            <span className={cn("truncate font-medium", !selected && "text-muted-foreground")}>
              {selected?.label ?? noneLabel ?? placeholder}
            </span>
            {selected?.detail ? <span className="truncate text-xs text-muted-foreground">{selected.detail}</span> : null}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="start">
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
                    onOpenChange?.(false);
                    onSelectComplete?.();
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
                    onOpenChange?.(false);
                    onSelectComplete?.();
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
  };
}) {
  const maps = getHllStratmapMaps();
  const selectedMap = getHllStratmapMapById(mapId);
  const selectedPoint = mapId ? resolvePointValue(mapId, pointValue, pointValueMode) : undefined;
  const timeOptions = mapId ? getHllTimeOptions(mapId) : [];
  const modeOptions = mapId && time ? getHllModeOptions(mapId, time) : [];
  const [mapOpen, setMapOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
  const [pointOpen, setPointOpen] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);

  useEffect(() => {
    if (!includeVariants) {
      setTimeOpen(false);
      setModeOpen(false);
    }
  }, [includeVariants]);

  useEffect(() => {
    if (!includePoint) {
      setPointOpen(false);
    }
  }, [includePoint]);

  useEffect(() => {
    if (!includeSide) {
      setSideOpen(false);
    }
  }, [includeSide]);

  return (
    <div className="flex flex-row flex-wrap gap-2 w-full min-w-0 overflow-x-hidden">
      <div className="flex-1 min-w-48 space-y-1.5">
        <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{labels.map}</div>
        <SearchableSelect
          value={mapId}
          onChange={onMapIdChange}
          disabled={disabled}
          placeholder={labels.map}
          searchPlaceholder={labels.mapSearch}
          noResults={labels.noResults}
          open={mapOpen}
          onOpenChange={setMapOpen}
          onSelectComplete={() => {
            if (includeVariants) {
              setTimeOpen(true);
              return;
            }

            if (includePoint) {
              setPointOpen(true);
            }
          }}
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
            onChange={(value) => onTimeChange?.(value)}
            disabled={disabled || !mapId}
            placeholder={labels.time}
            searchPlaceholder={labels.time}
            noResults={labels.noResults}
            open={timeOpen}
            onOpenChange={setTimeOpen}
            onSelectComplete={() => setModeOpen(true)}
            options={timeOptions}
          />
        </div>
      ) : null}
      {includeVariants ? (
        <div className="flex-1 min-w-48 space-y-1.5">
          <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{labels.mode}</div>
          <SearchableSelect
            value={mode}
            onChange={(value) => onModeChange?.(value)}
            disabled={disabled || !mapId || !time}
            placeholder={labels.mode}
            searchPlaceholder={labels.mode}
            noResults={labels.noResults}
            open={modeOpen}
            onOpenChange={setModeOpen}
            onSelectComplete={() => {
              if (includePoint) {
                setPointOpen(true);
              }
            }}
            options={modeOptions}
          />
        </div>
      ) : null}
      {includePoint ? (
        <div className="flex-1 min-w-48 space-y-1.5">
          <div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{labels.point}</div>
          <SearchableSelect
            value={selectedPoint?.id ?? ""}
            onChange={(value) => {
              if (!value) {
                onPointValueChange?.("");
                return;
              }

              const point = resolvePointValue(mapId, value, "id");
              onPointValueChange?.(point ? (pointValueMode === "id" ? point.id : point.label) : value);
            }}
            disabled={disabled || !mapId}
            placeholder={labels.point}
            searchPlaceholder={labels.pointSearch}
            noneLabel={labels.optional}
            noResults={labels.noResults}
            open={pointOpen}
            onOpenChange={setPointOpen}
            onSelectComplete={() => {
              if (includeSide) {
                setSideOpen(true);
              }
            }}
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
            onChange={(value) => onSideValueChange?.(value)}
            disabled={disabled}
            placeholder={labels.side ?? "Side"}
            searchPlaceholder={labels.side ?? "Side"}
            noneLabel={labels.optional}
            noResults={labels.noResults}
            open={sideOpen}
            onOpenChange={setSideOpen}
            options={[
              { value: "Allies", label: "Allies" },
              { value: "Axis", label: "Axis" },
            ]}
          />
        </div>
      ) : null}
    </div>
  );
}