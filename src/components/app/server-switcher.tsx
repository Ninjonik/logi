"use client";

import Link from "next/link";
import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Check, ChevronsUpDown } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Locale } from "@/i18n/config";
import type { Guild } from "@/types/domain";
import { cn } from "@/lib/utils";

const MAX_VISIBLE_RESULTS = 5;

function getServerScore(server: Guild, query: string) {
  if (!query) {
    return 0;
  }

  const normalizedQuery = query.trim().toLowerCase();
  const name = server.name.toLowerCase();
  const description = server.description?.toLowerCase() ?? "";

  if (name === normalizedQuery) return 100;
  if (name.startsWith(normalizedQuery)) return 80;
  if (name.includes(normalizedQuery)) return 60;
  if (description.startsWith(normalizedQuery)) return 40;
  if (description.includes(normalizedQuery)) return 20;
  return -1;
}

export function ServerSwitcher({
  locale,
  servers,
  activeServerId,
  labels,
}: {
  locale: Locale;
  servers: Guild[];
  activeServerId?: string;
  labels: {
    selectWorkspace: string;
    activeWorkspace: string;
    noWorkspaceSelected: string;
    searchWorkspace: string;
    noMatchingResults: string;
  };
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedServerId = activeServerId ?? searchParams.get("workspace") ?? undefined;
  const activeServer = selectedServerId
    ? servers.find((server) => server.id === selectedServerId)
    : undefined;

  const rankedServers = React.useMemo(() => {
    if (!query.trim()) {
      return [...servers]
        .sort((left, right) => left.name.localeCompare(right.name))
        .slice(0, MAX_VISIBLE_RESULTS);
    }

    return [...servers]
      .map((server) => ({
        server,
        score: getServerScore(server, query),
      }))
      .filter((entry) => entry.score >= 0)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        return left.server.name.localeCompare(right.server.name);
      })
      .slice(0, MAX_VISIBLE_RESULTS)
      .map((entry) => entry.server);
  }, [query, servers]);

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setQuery("");
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-12 w-full justify-between rounded-xl">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-8 rounded-lg">
              <AvatarImage src={activeServer?.avatar} alt={activeServer?.name} />
              <AvatarFallback>{activeServer?.name?.slice(0, 2) ?? "WS"}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 text-left">
              <div className="truncate text-sm font-semibold">{activeServer?.name ?? labels.selectWorkspace}</div>
              <div className="truncate text-xs text-muted-foreground">
                {activeServer ? labels.activeWorkspace : labels.noWorkspaceSelected}
              </div>
            </div>
          </div>
          <ChevronsUpDown className="size-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[22rem] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={labels.searchWorkspace}
          />
          <CommandList>
            <CommandEmpty>{labels.noMatchingResults}</CommandEmpty>
            {rankedServers.map((server) => {
              const target =
                pathname?.includes("/servers/") && selectedServerId && pathname.includes(`/${selectedServerId}/`)
                  ? pathname.replace(`/servers/${selectedServerId}`, `/servers/${server.id}`)
                  : `/${locale}/dashboard/servers/${server.id}`;

              return (
                <CommandItem
                  key={server.id}
                  value={`${server.name} ${server.description ?? ""}`}
                  onSelect={() => {
                    setOpen(false);
                    setQuery("");
                  }}
                  asChild
                >
                  <Link href={target} prefetch={false} className="flex items-center gap-3">
                    <Avatar className="size-8 rounded-lg">
                      <AvatarImage src={server.avatar} alt={server.name} />
                      <AvatarFallback>{server.name.slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{server.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{server.description}</div>
                    </div>
                    <Check
                      className={cn(
                        "size-4 text-muted-foreground",
                        selectedServerId === server.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </Link>
                </CommandItem>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
