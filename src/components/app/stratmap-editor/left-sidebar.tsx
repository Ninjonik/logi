"use client";

import { ImagePlus, Plus, Save, Trash2 } from "lucide-react";

import { HllMapSelector } from "@/components/app/hll-map-selector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Dictionary } from "@/i18n/dictionaries";
import type { HllStratmapMap, StratmapOverlaySettings, StratmapSlide } from "@/lib/stratmaps";

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
  onRenameSlide,
  onMoveSlide,
  onModeChange,
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
  onRenameSlide: (slideId: string, name: string) => void;
  onMoveSlide: (slideId: string, direction: -1 | 1) => void;
  onModeChange: (mode: "view" | "edit") => void;
  onDeleteSlide: () => void;
  onOverlayChange: (next: Partial<StratmapOverlaySettings>) => void;
  onToggleStrongpoint: (pointId: string) => void;
}) {
  return (
    <div className="min-w-0 space-y-2 overflow-x-hidden overflow-y-auto pr-1">
      <MetaCard
        {...{
          dictionary,
          canAdmin,
          isPending,
          title,
          description,
          baseMapId,
          side,
          strongpointId,
          onTitleChange,
          onDescriptionChange,
          onBaseMapChange,
          onStrongpointChange,
          onSideChange,
          onSaveMeta,
        }}
      />
      <SlidesCard {...{ dictionary, canAdmin, slides, selectedSlideId, onSelectSlide, onAddSlide, onDuplicateSlide, onRenameSlide, onMoveSlide, onDeleteSlide }} />
      <OverlaysCard {...{ dictionary, selectedMap, activeOverlays, onOverlayChange, onToggleStrongpoint }} />
    </div>
  );
}

function MetaCard(props: {
  dictionary: Dictionary;
  canAdmin: boolean;
  isPending: boolean;
  title: string;
  description: string;
  baseMapId: string;
  side: string;
  strongpointId: string;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onBaseMapChange: (value: string) => void;
  onStrongpointChange: (value: string) => void;
  onSideChange: (value: string) => void;
  onSaveMeta: () => void;
}) {
  const { dictionary, canAdmin, isPending, title, description, baseMapId, side, strongpointId, onTitleChange, onDescriptionChange, onBaseMapChange, onStrongpointChange, onSideChange, onSaveMeta } = props;
  return (
    <Card className="min-w-0 overflow-hidden rounded-xl border-border/60">
      <CardHeader className="px-3 py-3">
        <CardTitle className="text-base">{dictionary.stratmaps.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 overflow-x-hidden px-3 pb-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{dictionary.stratmaps.titleLabel}</Label>
          <Input value={title} onChange={(event) => onTitleChange(event.target.value)} disabled={!canAdmin} className="h-9 min-w-0 overflow-hidden rounded-lg text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{dictionary.stratmaps.descriptionLabel}</Label>
          <Input value={description} onChange={(event) => onDescriptionChange(event.target.value)} disabled={!canAdmin} className="h-16 min-w-0 overflow-hidden rounded-lg text-sm" />
        </div>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{dictionary.stratmaps.mapAndPoint}</Label>
            <HllMapSelector
              mapId={baseMapId}
              onMapIdChange={onBaseMapChange}
              pointValue={strongpointId}
              onPointValueChange={onStrongpointChange}
              pointValueMode="id"
              pointShowGrid={false}
              includeVariants={false}
              disabled={!canAdmin}
              labels={{
                map: dictionary.stratmaps.baseMap,
                mapSearch: dictionary.stratmaps.searchMap,
                time: "Variant",
                mode: "Mode",
                point: dictionary.stratmaps.point,
                pointSearch: dictionary.stratmaps.searchPoint,
                optional: dictionary.shared.notSet,
                noResults: dictionary.stratmaps.noResults,
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{dictionary.stratmaps.side}</Label>
            <Input value={side} onChange={(event) => onSideChange(event.target.value)} disabled={!canAdmin} className="h-9 min-w-0 overflow-hidden rounded-lg text-sm" />
          </div>
        </div>
        {canAdmin ? (
          <Button className="h-9 w-full rounded-lg text-sm" onClick={onSaveMeta} disabled={isPending}>
            <Save className="size-4" />
            {dictionary.stratmaps.saveDetails}
          </Button>
        ) : (
          <div className="text-xs text-muted-foreground">{dictionary.stratmaps.liveAccess}</div>
        )}
      </CardContent>
    </Card>
  );
}

function SlidesCard(props: {
  dictionary: Dictionary;
  canAdmin: boolean;
  slides: StratmapSlide[];
  selectedSlideId: string;
  onSelectSlide: (slideId: string) => void;
  onAddSlide: () => void;
  onDuplicateSlide: () => void;
  onRenameSlide: (slideId: string, name: string) => void;
  onMoveSlide: (slideId: string, direction: -1 | 1) => void;
  onDeleteSlide: () => void;
}) {
  const { dictionary, canAdmin, slides, selectedSlideId, onSelectSlide, onAddSlide, onDuplicateSlide, onRenameSlide, onMoveSlide, onDeleteSlide } = props;
  return (
    <Card className="min-w-0 overflow-hidden rounded-xl border-border/60">
      <CardHeader className="flex flex-row items-center justify-between px-3 py-3">
        <CardTitle className="text-base">{dictionary.stratmaps.slides}</CardTitle>
        {canAdmin ? (
          <div className="flex gap-2">
            <Button variant="outline" size="icon" className="size-8 rounded-lg" onClick={onAddSlide}>
              <Plus className="size-4" />
            </Button>
            <Button variant="outline" size="icon" className="size-8 rounded-lg" onClick={onDuplicateSlide}>
              <ImagePlus className="size-4" />
            </Button>
            <Button variant="outline" size="icon" className="size-8 rounded-lg" onClick={onDeleteSlide} disabled={slides.length <= 1}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2 overflow-x-hidden px-3 pb-3">
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            role="button"
            tabIndex={0}
            className={`w-full rounded-lg border px-2.5 py-1.5 text-left text-xs ${selectedSlideId === slide.id ? "border-primary bg-primary/10" : "border-border/60"}`}
            onClick={() => onSelectSlide(slide.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelectSlide(slide.id);
              }
            }}
          >
            {canAdmin ? (
              <div className="flex items-center gap-2">
              <Input
                value={slide.name}
                onChange={(event) => onRenameSlide(slide.id, event.target.value)}
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => event.stopPropagation()}
                className="h-7 border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
              />
                <div className="ml-auto flex gap-1">
                  <Button type="button" variant="ghost" size="icon" className="size-6 rounded-md" disabled={index === 0} onClick={(event) => { event.stopPropagation(); onMoveSlide(slide.id, -1); }}>
                    ↑
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="size-6 rounded-md" disabled={index === slides.length - 1} onClick={(event) => { event.stopPropagation(); onMoveSlide(slide.id, 1); }}>
                    ↓
                  </Button>
                </div>
              </div>
            ) : (
              slide.name
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function OverlaysCard(props: {
  dictionary: Dictionary;
  selectedMap: HllStratmapMap | undefined;
  activeOverlays: StratmapOverlaySettings;
  onOverlayChange: (next: Partial<StratmapOverlaySettings>) => void;
  onToggleStrongpoint: (pointId: string) => void;
}) {
  const { dictionary, selectedMap, activeOverlays, onToggleStrongpoint } = props;
  return (
    <Card className="min-w-0 overflow-hidden rounded-xl border-border/60">
      <CardHeader className="px-3 py-3">
        <CardTitle className="text-base">{dictionary.stratmaps.visibleStrongpoints}</CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <ScrollArea className="h-56 rounded-lg border border-border/60 p-2">
          <div className="space-y-2">
            {selectedMap?.strongpoints.map((point) => {
              const visible = activeOverlays.showAllStrongpoints || activeOverlays.visibleStrongpointIds.includes(point.id);
              return (
                <button
                  key={point.id}
                  type="button"
                  disabled={false}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs ${visible ? "bg-primary/10 text-primary" : "bg-muted/20"}`}
                  onClick={() => onToggleStrongpoint(point.id)}
                >
                  <div>
                    <div className="font-medium">{point.label}</div>
                    <div className="text-xs text-muted-foreground">{point.grid}</div>
                  </div>
                  <Badge variant="outline" className="rounded-lg">
                    {point.grid}
                  </Badge>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
