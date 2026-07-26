"use client";

import { ImagePlus, Plus, Save, Trash2 } from "lucide-react";

import { HllMapSelector } from "@/components/app/hll-map-selector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { Dictionary } from "@/i18n/dictionaries";
import type { HllStratmapMap, StratmapOverlaySettings, StratmapSlide } from "@/lib/stratmaps";

import { ToggleRow } from "./toggle-row";
import type { OverlayTeam } from "./types";

export function StratmapLeftSidebar({
  dictionary,
  canAdmin,
  isPending,
  title,
  description,
  baseMapId,
  side,
  strongpointId,
  slides,
  selectedSlideId,
  selectedMap,
  activeOverlays,
  onTitleChange,
  onDescriptionChange,
  onBaseMapChange,
  onStrongpointChange,
  onSideChange,
  onSaveMeta,
  onSelectSlide,
  onAddSlide,
  onDuplicateSlide,
  onDeleteSlide,
  onOverlayChange,
  onToggleStrongpoint,
}: {
  dictionary: Dictionary;
  canAdmin: boolean;
  isPending: boolean;
  title: string;
  description: string;
  baseMapId: string;
  side: string;
  strongpointId: string;
  slides: StratmapSlide[];
  selectedSlideId: string;
  selectedMap: HllStratmapMap | undefined;
  activeOverlays: StratmapOverlaySettings;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onBaseMapChange: (value: string) => void;
  onStrongpointChange: (value: string) => void;
  onSideChange: (value: string) => void;
  onSaveMeta: () => void;
  onSelectSlide: (slideId: string) => void;
  onAddSlide: () => void;
  onDuplicateSlide: () => void;
  onDeleteSlide: () => void;
  onOverlayChange: (next: Partial<StratmapOverlaySettings>) => void;
  onToggleStrongpoint: (pointId: string) => void;
}) {
  return (
    <div className="space-y-2 overflow-x-hidden overflow-y-auto pr-1">
      <MetaCard {...{ dictionary, canAdmin, isPending, title, description, baseMapId, side, strongpointId, onTitleChange, onDescriptionChange, onBaseMapChange, onStrongpointChange, onSideChange, onSaveMeta }} />
      <SlidesCard {...{ dictionary, canAdmin, slides, selectedSlideId, onSelectSlide, onAddSlide, onDuplicateSlide, onDeleteSlide }} />
      <OverlaysCard {...{ dictionary, canAdmin, selectedMap, activeOverlays, onOverlayChange, onToggleStrongpoint }} />
    </div>
  );
}

function MetaCard(props: { dictionary: Dictionary; canAdmin: boolean; isPending: boolean; title: string; description: string; baseMapId: string; side: string; strongpointId: string; onTitleChange: (value: string) => void; onDescriptionChange: (value: string) => void; onBaseMapChange: (value: string) => void; onStrongpointChange: (value: string) => void; onSideChange: (value: string) => void; onSaveMeta: () => void; }) {
  const { dictionary, canAdmin, isPending, title, description, baseMapId, side, strongpointId, onTitleChange, onDescriptionChange, onBaseMapChange, onStrongpointChange, onSideChange, onSaveMeta } = props;
  return (
    <Card className="rounded-xl border-border/60">
      <CardHeader className="px-3 py-3"><CardTitle className="text-base">{dictionary.stratmaps.title}</CardTitle></CardHeader>
      <CardContent className="space-y-3 px-3 pb-3">
        <div className="space-y-1.5"><Label className="text-xs">{dictionary.stratmaps.titleLabel}</Label><Input value={title} onChange={(event) => onTitleChange(event.target.value)} disabled={!canAdmin} className="h-9 rounded-lg text-sm" /></div>
        <div className="space-y-1.5"><Label className="text-xs">{dictionary.stratmaps.descriptionLabel}</Label><Input value={description} onChange={(event) => onDescriptionChange(event.target.value)} disabled={!canAdmin} className="h-16 rounded-lg text-sm" /></div>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{dictionary.stratmaps.mapAndPoint}</Label>
            <HllMapSelector mapId={baseMapId} onMapIdChange={onBaseMapChange} pointValue={strongpointId} onPointValueChange={onStrongpointChange} pointValueMode="id" pointShowGrid={false} includeVariants={false} disabled={!canAdmin} labels={{ map: dictionary.stratmaps.baseMap, mapSearch: dictionary.stratmaps.searchMap, time: "Variant", mode: "Mode", point: dictionary.stratmaps.point, pointSearch: dictionary.stratmaps.searchPoint, optional: dictionary.shared.notSet, noResults: dictionary.stratmaps.noResults }} />
          </div>
          <div className="space-y-1.5"><Label className="text-xs">{dictionary.stratmaps.side}</Label><Input value={side} onChange={(event) => onSideChange(event.target.value)} disabled={!canAdmin} className="h-9 rounded-lg text-sm" /></div>
        </div>
        {canAdmin ? <Button className="h-9 w-full rounded-lg text-sm" onClick={onSaveMeta} disabled={isPending}><Save className="size-4" />{dictionary.stratmaps.saveDetails}</Button> : <div className="text-xs text-muted-foreground">{dictionary.stratmaps.liveAccess}</div>}
      </CardContent>
    </Card>
  );
}

function SlidesCard(props: { dictionary: Dictionary; canAdmin: boolean; slides: StratmapSlide[]; selectedSlideId: string; onSelectSlide: (slideId: string) => void; onAddSlide: () => void; onDuplicateSlide: () => void; onDeleteSlide: () => void; }) {
  const { dictionary, canAdmin, slides, selectedSlideId, onSelectSlide, onAddSlide, onDuplicateSlide, onDeleteSlide } = props;
  return (
    <Card className="rounded-xl border-border/60">
      <CardHeader className="flex flex-row items-center justify-between px-3 py-3">
        <CardTitle className="text-base">{dictionary.stratmaps.slides}</CardTitle>
        {canAdmin ? <div className="flex gap-2"><Button variant="outline" size="icon" className="size-8 rounded-lg" onClick={onAddSlide}><Plus className="size-4" /></Button><Button variant="outline" size="icon" className="size-8 rounded-lg" onClick={onDuplicateSlide}><ImagePlus className="size-4" /></Button><Button variant="outline" size="icon" className="size-8 rounded-lg" onClick={onDeleteSlide} disabled={slides.length <= 1}><Trash2 className="size-4" /></Button></div> : null}
      </CardHeader>
      <CardContent className="space-y-2 px-3 pb-3">
        {slides.map((slide) => <button key={slide.id} type="button" className={`w-full rounded-lg border px-2.5 py-1.5 text-left text-xs ${selectedSlideId === slide.id ? "border-primary bg-primary/10" : "border-border/60"}`} onClick={() => onSelectSlide(slide.id)}>{slide.name}</button>)}
      </CardContent>
    </Card>
  );
}

function OverlaysCard(props: { dictionary: Dictionary; canAdmin: boolean; selectedMap: HllStratmapMap | undefined; activeOverlays: StratmapOverlaySettings; onOverlayChange: (next: Partial<StratmapOverlaySettings>) => void; onToggleStrongpoint: (pointId: string) => void; }) {
  const { dictionary, canAdmin, selectedMap, activeOverlays, onOverlayChange, onToggleStrongpoint } = props;
  return (
    <Card className="rounded-xl border-border/60">
      <CardHeader className="px-3 py-3"><CardTitle className="text-base">{dictionary.stratmaps.overlays}</CardTitle></CardHeader>
      <CardContent className="space-y-3 px-3 pb-3">
        <ToggleRow label={dictionary.stratmaps.grid} checked={activeOverlays.showGrid} onCheckedChange={(checked) => onOverlayChange({ showGrid: checked })} />
        <ToggleRow label={dictionary.stratmaps.allStrongpoints} checked={activeOverlays.showAllStrongpoints} onCheckedChange={(checked) => onOverlayChange({ showAllStrongpoints: checked, visibleStrongpointIds: checked ? (selectedMap?.strongpoints.map((point) => point.id) ?? []) : activeOverlays.visibleStrongpointIds })} />
        <ToggleRow label={dictionary.stratmaps.defaultGarrisons} checked={activeOverlays.showOffensiveGarrisons} onCheckedChange={(checked) => onOverlayChange({ showOffensiveGarrisons: checked })} />
        <ToggleRow label={dictionary.stratmaps.artillery} checked={activeOverlays.showArtillery} onCheckedChange={(checked) => onOverlayChange({ showArtillery: checked })} />
        <ToggleRow label={dictionary.stratmaps.repairStations} checked={activeOverlays.showRepairStations} onCheckedChange={(checked) => onOverlayChange({ showRepairStations: checked })} />
        <ToggleRow label={dictionary.stratmaps.spawnRanges} checked={activeOverlays.showSpawnRanges} onCheckedChange={(checked) => onOverlayChange({ showSpawnRanges: checked })} />
        <div className="space-y-1.5">
          <Label className="text-xs">{dictionary.stratmaps.overlaySide}</Label>
          <Select value={activeOverlays.overlayTeam} onValueChange={(value) => onOverlayChange({ overlayTeam: value as OverlayTeam })}><SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="a">{dictionary.stratmaps.sideA}</SelectItem><SelectItem value="b">{dictionary.stratmaps.sideB}</SelectItem></SelectContent></Select>
        </div>
        <Separator />
        <div className="space-y-1.5">
          <Label className="text-xs">{dictionary.stratmaps.visibleStrongpoints}</Label>
          <ScrollArea className="h-56 rounded-lg border border-border/60 p-2">
            <div className="space-y-2">
              {selectedMap?.strongpoints.map((point) => {
                const visible = activeOverlays.showAllStrongpoints || activeOverlays.visibleStrongpointIds.includes(point.id);
                return <button key={point.id} type="button" disabled={!canAdmin} className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs ${visible ? "bg-primary/10 text-primary" : "bg-muted/20"}`} onClick={() => onToggleStrongpoint(point.id)}><div><div className="font-medium">{point.label}</div><div className="text-xs text-muted-foreground">{point.grid}</div></div><Badge variant="outline" className="rounded-lg">{point.grid}</Badge></button>;
              })}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
