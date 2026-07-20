"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Smile, X } from "lucide-react";
import { Categories, EmojiStyle, Theme } from "emoji-picker-react";
import type { EmojiClickData, PickerProps } from "emoji-picker-react";

import type { DiscordSelectOption } from "@/components/app/discord-entity-select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

type EmojiPickerInputLabels = {
  pickEmoji: string;
  search: string;
  clear: string;
  customCategory: string;
  suggestedCategory: string;
  smileysPeopleCategory: string;
  animalsNatureCategory: string;
  foodDrinkCategory: string;
  travelPlacesCategory: string;
  activitiesCategory: string;
  objectsCategory: string;
  symbolsCategory: string;
  flagsCategory: string;
};

const pickerStyle = {
  width: "100%",
  border: "none",
  boxShadow: "none",
  backgroundColor: "transparent",
  "--epr-bg-color": "hsl(var(--popover))",
  "--epr-text-color": "hsl(var(--muted-foreground))",
  "--epr-search-input-bg-color": "hsl(var(--muted) / 0.6)",
  "--epr-search-input-bg-color-active": "hsl(var(--background))",
  "--epr-search-border-color": "hsl(var(--border))",
  "--epr-search-border-color-active": "hsl(var(--ring))",
  "--epr-hover-bg-color": "hsl(var(--accent))",
  "--epr-hover-bg-color-reduced-opacity": "hsl(var(--accent) / 0.65)",
  "--epr-focus-bg-color": "hsl(var(--accent))",
  "--epr-category-label-bg-color": "hsl(var(--popover) / 0.94)",
  "--epr-picker-border-color": "hsl(var(--border))",
  "--epr-highlight-color": "hsl(var(--primary))",
  "--epr-category-icon-active-color": "hsl(var(--primary))",
  "--epr-skin-tone-picker-menu-color": "hsl(var(--popover) / 0.96)",
  "--epr-emoji-variation-picker-bg-color": "hsl(var(--popover))",
  "--epr-preview-border-color": "hsl(var(--border))",
  "--epr-preview-text-color": "hsl(var(--foreground))",
  "--epr-dark-bg-color": "hsl(var(--popover))",
  "--epr-dark-text-color": "hsl(var(--muted-foreground))",
  "--epr-dark-search-input-bg-color": "hsl(var(--muted) / 0.45)",
  "--epr-dark-search-input-bg-color-active": "hsl(var(--background))",
  "--epr-dark-picker-border-color": "hsl(var(--border))",
  "--epr-dark-hover-bg-color": "hsl(var(--accent))",
  "--epr-dark-hover-bg-color-reduced-opacity": "hsl(var(--accent) / 0.65)",
  "--epr-dark-focus-bg-color": "hsl(var(--accent))",
  "--epr-dark-highlight-color": "hsl(var(--primary))",
  "--epr-dark-category-label-bg-color": "hsl(var(--popover) / 0.94)",
  "--epr-dark-category-icon-active-color": "hsl(var(--primary))",
  "--epr-dark-skin-tone-picker-menu-color": "hsl(var(--popover) / 0.96)",
  "--epr-dark-emoji-variation-picker-bg-color": "hsl(var(--popover))",
  "--epr-dark-reactions-bg-color": "hsl(var(--popover) / 0.92)",
} as CSSProperties;

export function EmojiPickerInput({
  value,
  onChange,
  customEmojis = [],
  placeholder,
  labels,
  noneLabel,
  className,
}: {
  value?: string;
  onChange: (value?: string) => void;
  customEmojis?: DiscordSelectOption[];
  placeholder: string;
  labels: EmojiPickerInputLabels;
  noneLabel?: string;
  className?: string;
}) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);

  const customEmojiMap = useMemo(
    () => new Map(customEmojis.map((emoji) => [emoji.id.toLowerCase(), emoji.id])),
    [customEmojis],
  );
  const selectedCustomEmoji = useMemo(
    () => customEmojis.find((emoji) => emoji.id.toLowerCase() === value?.toLowerCase()),
    [customEmojis, value],
  );

  const pickerProps = useMemo<PickerProps>(() => ({
    theme: theme === "dark" ? Theme.DARK : theme === "light" ? Theme.LIGHT : Theme.AUTO,
    emojiStyle: EmojiStyle.NATIVE,
    searchPlaceholder: labels.search,
    searchClearButtonLabel: labels.clear,
    previewConfig: { showPreview: false },
    customEmojis: customEmojis
      .map((emoji) => ({
        id: emoji.id,
        names: [emoji.name],
        imgUrl: emoji.imageUrl ?? "",
      }))
      .filter((emoji) => Boolean(emoji.imgUrl)),
    categories: [
      { category: Categories.SUGGESTED, name: labels.suggestedCategory },
      { category: Categories.CUSTOM, name: labels.customCategory },
      { category: Categories.SMILEYS_PEOPLE, name: labels.smileysPeopleCategory },
      { category: Categories.ANIMALS_NATURE, name: labels.animalsNatureCategory },
      { category: Categories.FOOD_DRINK, name: labels.foodDrinkCategory },
      { category: Categories.TRAVEL_PLACES, name: labels.travelPlacesCategory },
      { category: Categories.ACTIVITIES, name: labels.activitiesCategory },
      { category: Categories.OBJECTS, name: labels.objectsCategory },
      { category: Categories.SYMBOLS, name: labels.symbolsCategory },
      { category: Categories.FLAGS, name: labels.flagsCategory },
    ],
    style: pickerStyle,
    width: "100%",
    height: 360,
    onEmojiClick: (emojiData: EmojiClickData) => {
      onChange(emojiData.isCustom ? customEmojiMap.get(emojiData.unified) ?? emojiData.unified : emojiData.emoji);
      setOpen(false);
    },
  }), [customEmojiMap, customEmojis, labels, onChange, theme]);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="w-full justify-between rounded-xl">
            <span className="flex min-w-0 items-center gap-2 truncate">
              {selectedCustomEmoji?.imageUrl ? (
                <img src={selectedCustomEmoji.imageUrl} alt="" className="size-5 rounded-sm object-contain" />
              ) : value ? (
                <span className="text-lg leading-none">{value}</span>
              ) : (
                <Smile className="size-4 text-muted-foreground" />
              )}
              <span className="truncate">
                {selectedCustomEmoji?.name ?? (value ? value : noneLabel ?? placeholder)}
              </span>
            </span>
            <span className="text-xs text-muted-foreground">{labels.pickEmoji}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[352px] rounded-xl border-border/60 p-0">
          <div className="border-b border-border/60 px-3 py-2 text-sm text-muted-foreground">
            {labels.pickEmoji}
          </div>
          <EmojiPicker {...pickerProps} />
          <div className="border-t border-border/60 p-2">
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start rounded-lg"
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}
            >
              <X className="mr-2 size-4" />
              {noneLabel ?? labels.clear}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 rounded-xl"
          onClick={() => onChange(undefined)}
          aria-label={labels.clear}
        >
          <X className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}
