import Link from "next/link";
import { ArrowRight, ShieldCheck, Sword, Users } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import type { Guild } from "@/types/domain";
import type { Locale } from "@/i18n/config";

export function ServerCard({
  locale,
  guild,
  label,
}: {
  locale: Locale;
  guild: Guild;
  label: string;
}) {
  return (
    <Card className="overflow-hidden rounded-2xl border-border/60 bg-card/80 shadow-sm">
      <CardHeader className="relative overflow-hidden border-b border-border/60 bg-[linear-gradient(135deg,rgba(90,110,55,.2),rgba(201,168,78,.08))]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(201,168,78,.22),transparent_40%)]" />
        <div className="relative flex items-start gap-4">
          <Avatar className="size-16 rounded-2xl border border-border/60">
            <AvatarImage src={guild.avatar} alt={guild.name} />
            <AvatarFallback>{guild.name.slice(0, 2)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <Badge variant="secondary" className="mb-3 rounded-full">
              {label}
            </Badge>
            <h2 className="truncate text-xl font-semibold">{guild.name}</h2>
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{guild.description}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 py-5 sm:grid-cols-3">
        <div className="rounded-xl border border-border/60 p-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <ShieldCheck className="size-3.5" />
            Admins
          </div>
          <div className="mt-2 text-lg font-semibold">{guild.adminIds.length}</div>
        </div>
        <div className="rounded-xl border border-border/60 p-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <Users className="size-3.5" />
            Members
          </div>
          <div className="mt-2 text-lg font-semibold">{guild.memberIds.length}</div>
        </div>
        <div className="rounded-xl border border-border/60 p-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <Sword className="size-3.5" />
            Mercs
          </div>
          <div className="mt-2 text-lg font-semibold">{guild.mercenaryIds.length}</div>
        </div>
      </CardContent>
      <CardFooter>
        <Button asChild className="w-full rounded-xl">
          <Link href={`/${locale}/dashboard/servers/${guild.id}`}>
            Open server
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
