"use client";

import { useState, useTransition } from "react";
import { makeFunctionReference } from "convex/server";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { HllMapSelector } from "@/components/app/hll-map-selector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Dictionary } from "@/i18n/dictionaries";
import { getHllStratmapMaps } from "@/lib/stratmaps";

const createStratmapReference = makeFunctionReference<"mutation">("stratmaps:create");

export function StratmapCreateForm({
  locale,
  serverId,
  userId,
  dictionary,
  defaultTitle = "",
}: {
  locale: string;
  serverId: string;
  userId: string;
  dictionary: Dictionary;
  defaultTitle?: string;
}) {
  const router = useRouter();
  const createStratmap = useMutation(createStratmapReference);
  const [isPending, startTransition] = useTransition();
  const maps = getHllStratmapMaps();
  const [title, setTitle] = useState(defaultTitle);
  const [baseMapId, setBaseMapId] = useState(maps[0]?.id ?? "carentan");
  const [side, setSide] = useState("");
  const [strongpointId, setStrongpointId] = useState("");

  async function handleSubmit() {
    if (!title.trim()) {
      toast.error(dictionary.stratmaps.titleRequired);
      return;
    }

    startTransition(async () => {
      try {
        const stratmapId = await createStratmap({
          userId,
          serverId: serverId as never,
          title: title.trim(),
          baseMapId,
          side: side.trim() || undefined,
          strongpointId: strongpointId || undefined,
        });

        router.push(`/${locale}/dashboard/servers/${serverId}/stratmaps/${stratmapId}`);
      } catch (error) {
        console.error(error);
        toast.error(dictionary.stratmaps.createError);
      }
    });
  }

  return (
    <Card className="rounded-2xl border-border/60">
      <CardHeader>
        <CardTitle>{dictionary.stratmaps.createTitle}</CardTitle>
        <CardDescription>{dictionary.stratmaps.createDescription}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 overflow-x-hidden">
        <div className="space-y-2">
          <Label>{dictionary.stratmaps.titleLabel}</Label>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} className="min-w-0 overflow-hidden rounded-xl" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="min-w-0 space-y-2 md:col-span-2">
            <Label>{dictionary.stratmaps.mapAndPoint}</Label>
            <HllMapSelector
              mapId={baseMapId}
              onMapIdChange={(value) => {
                setBaseMapId(value);
                setStrongpointId("");
              }}
              pointValue={strongpointId}
              onPointValueChange={setStrongpointId}
              pointValueMode="id"
              includeVariants={false}
              labels={{
                map: dictionary.stratmaps.baseMap,
                mapSearch: dictionary.stratmaps.searchMap,
                time: "Variant",
                mode: "Mode",
                point: dictionary.stratmaps.point,
                pointSearch: dictionary.stratmaps.searchPoint,
                optional: dictionary.event.optionalLabel,
                noResults: dictionary.stratmaps.noResults,
              }}
            />
          </div>
          <div className="min-w-0 space-y-2">
            <Label>{dictionary.stratmaps.side}</Label>
            <div className="text-xs font-medium uppercase tracking-[0.2em] text-transparent select-none">
              {dictionary.event.optionalLabel}
            </div>
            <Input
              value={side}
              onChange={(event) => setSide(event.target.value)}
              className="min-w-0 overflow-hidden rounded-xl"
              placeholder={dictionary.event.optionalLabel}
            />
          </div>
        </div>
        <Button className="rounded-xl" onClick={handleSubmit} disabled={isPending}>
          {dictionary.stratmaps.createTitle}
        </Button>
      </CardContent>
    </Card>
  );
}
