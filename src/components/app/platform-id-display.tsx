"use client";

import { ExternalLink, Globe2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Dictionary } from "@/i18n/dictionaries";
import { describePlatformIds, type PlatformKey } from "@/lib/platform-ids";

function SteamIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M11.98 2a10 10 0 0 0-8.64 15.04l3.96 1.64a3.2 3.2 0 0 1 1.82-.57h.1l1.77-2.55v-.04a4.1 4.1 0 1 1 4.1 4.1h-.09l-2.52 1.8a3.24 3.24 0 1 1-6.47.24l-2.84-1.18A10 10 0 1 0 11.98 2Zm3.01 7.43a2.11 2.11 0 1 0 0 4.22 2.11 2.11 0 0 0 0-4.22ZM8.2 19.05a1.75 1.75 0 1 0 1.23 3.28 1.75 1.75 0 0 0-1.23-3.28Z" />
    </svg>
  );
}

function EpicIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M6 2h12l1 4.87V16l-7 6-7-6V6.87L6 2Zm3 5.25V9h6V7.25H9Zm0 3V12h5v-1.75H9Zm0 3V15h6v-1.75H9Z" />
    </svg>
  );
}

function XboxIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm4.72 4.2c-1.24-.12-2.79.72-4.72 2.38-1.93-1.66-3.48-2.5-4.72-2.38A8 8 0 0 1 12 4a8 8 0 0 1 4.72 2.2Zm1.7 1.62c-.8 1.15-2.11 2.6-3.88 4.31 1.56 1.79 2.74 3.46 3.47 4.95A7.97 7.97 0 0 1 12 20a7.97 7.97 0 0 1-6.01-2.92c.73-1.49 1.91-3.16 3.47-4.95-1.77-1.71-3.08-3.16-3.88-4.31a1.95 1.95 0 0 1 1.51-.12c1.12.4 2.62 1.51 4.45 3.37 1.83-1.86 3.33-2.97 4.45-3.37.53-.18 1.04-.16 1.51.12Z" />
    </svg>
  );
}

function PlayStationIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M10.3 3.1v10.8c0 .58-.18.97-.55 1.17-.35.2-.77.21-1.24.04l-1.6-.55V5.54c0-1.08.37-1.82 1.12-2.2.75-.39 1.5-.46 2.27-.24Zm2.12 1.47 4.63 1.57c1.18.4 1.77 1.03 1.77 1.89 0 .67-.41 1.15-1.24 1.45l-5.16 1.88V4.57Zm-1.9 8.63v2.2l-5.01 1.8c-.83.3-1.25.77-1.25 1.42 0 .46.22.77.67.93.45.15 1 .12 1.64-.11l3.95-1.43v1.84l-2.6.94c-1.6.58-3 .7-4.18.35-1.18-.35-1.77-1.12-1.77-2.32 0-.86.59-1.5 1.77-1.9l6.78-2.44Zm2.2.1 6.33 2.13c1.3.44 1.95 1.12 1.95 2.06 0 .7-.37 1.18-1.12 1.46-.75.28-1.7.23-2.84-.16l-4.32-1.47v-2.06l2.82.95c.66.22 1.16.26 1.5.12.35-.14.53-.39.53-.74 0-.47-.36-.82-1.09-1.06l-3.76-1.27v-1.96Z" />
    </svg>
  );
}

function PlatformIcon({ platform, className = "size-4" }: { platform: PlatformKey; className?: string }) {
  switch (platform) {
    case "steam":
      return <SteamIcon className={className} />;
    case "epic":
      return <EpicIcon className={className} />;
    case "xbox":
      return <XboxIcon className={className} />;
    case "playstation":
      return <PlayStationIcon className={className} />;
    default:
      return <Globe2 className={className} />;
  }
}

function getPlatformLabels(dictionary: Dictionary): Record<PlatformKey, string> {
  return {
    steam: dictionary.shared.platformSteam,
    epic: dictionary.shared.platformEpic,
    xbox: dictionary.shared.platformXbox,
    playstation: dictionary.shared.platformPlayStation,
    other: dictionary.shared.platformOther,
  };
}

export function getDetectedPlatformHint(input: string, dictionary: Dictionary) {
  const items = describePlatformIds(
    input
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
    getPlatformLabels(dictionary),
  );

  if (!items.length) {
    return null;
  }

  const labels = [...new Set(items.map((item) => `${item.label} ID`))].join(", ");
  return dictionary.shared.detectedPlatformId.replace("{platform}", labels);
}

export function PlatformIdList({
  platformIds,
  dictionary,
  compact = false,
  showProfileLinks = false,
  emptyLabel,
}: {
  platformIds: string[] | undefined | null;
  dictionary: Dictionary;
  compact?: boolean;
  showProfileLinks?: boolean;
  emptyLabel?: string;
}) {
  const items = describePlatformIds(platformIds, getPlatformLabels(dictionary));

  if (!items.length) {
    return emptyLabel ? <span className="text-sm text-muted-foreground">{emptyLabel}</span> : null;
  }

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {items.map((item) => (
          <Tooltip key={`${item.platform}-${item.rawId}`}>
            <TooltipTrigger asChild>
              <span className="inline-flex size-7 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground">
                <PlatformIcon platform={item.platform} className="size-3.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {item.label}: {item.rawId}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Badge
          key={`${item.platform}-${item.rawId}`}
          variant="secondary"
          className="flex items-center gap-2 rounded-full border border-border/60 bg-background px-3 py-1 text-xs font-medium"
        >
          <PlatformIcon platform={item.platform} className="size-3.5" />
          <span>{item.label}</span>
          <span className="max-w-[18rem] truncate">{item.rawId}</span>
          {showProfileLinks && item.profileUrl ? (
            <a href={item.profileUrl} target="_blank" rel="noreferrer" className="text-muted-foreground transition-colors hover:text-foreground">
              <ExternalLink className="size-3.5" />
            </a>
          ) : null}
        </Badge>
      ))}
    </div>
  );
}
