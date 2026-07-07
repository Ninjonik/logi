"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Guild } from "@/types/domain";
import type { Locale } from "@/i18n/config";

export function ServerSwitcher({
  locale,
  servers,
  activeServerId,
}: {
  locale: Locale;
  servers: Guild[];
  activeServerId?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedServerId = activeServerId ?? searchParams.get("workspace") ?? undefined;
  const activeServer = selectedServerId
    ? servers.find((server) => server.id === selectedServerId)
    : undefined;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-12 w-full justify-between rounded-xl">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-8 rounded-lg">
              <AvatarImage src={activeServer?.avatar} alt={activeServer?.name} />
              <AvatarFallback>{activeServer?.name?.slice(0, 2) ?? "WS"}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 text-left">
              <div className="truncate text-sm font-semibold">{activeServer?.name ?? "Select workspace"}</div>
              <div className="truncate text-xs text-muted-foreground">
                {activeServer ? "Active workspace" : "No workspace selected"}
              </div>
            </div>
          </div>
          <ChevronsUpDown className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72 rounded-xl">
        {servers.map((server) => {
          const target =
            pathname?.includes("/servers/") && selectedServerId && pathname.includes(`/${selectedServerId}/`)
              ? pathname.replace(`/servers/${selectedServerId}`, `/servers/${server.id}`)
              : `/${locale}/dashboard/servers/${server.id}`;

          return (
            <DropdownMenuItem key={server.id} asChild>
              <Link href={target} className="flex items-center gap-3">
                <Avatar className="size-8 rounded-lg">
                  <AvatarImage src={server.avatar} alt={server.name} />
                  <AvatarFallback>{server.name.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="truncate font-medium">{server.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{server.description}</div>
                </div>
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
