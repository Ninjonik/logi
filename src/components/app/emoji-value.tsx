"use client";

import { parseDiscordCustomEmoji } from "@/lib/discord-emoji";
import { cn } from "@/lib/utils";

export function EmojiValue({
  value,
  className,
}: {
  value?: string | null;
  className?: string;
}) {
  if (!value) return null;

  const customEmoji = parseDiscordCustomEmoji(value);
  if (customEmoji) {
    return (
      <img
        src={customEmoji.imageUrl}
        alt={customEmoji.name}
        className={cn("inline-block size-4 rounded-sm object-contain align-text-bottom", className)}
      />
    );
  }

  return <span className={className}>{value}</span>;
}
