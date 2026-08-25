"use client";

import { ChevronDown, ChevronUp, Copy, Layers3, Map, Plus, Save, Trash2 } from "lucide-react";

import type { Dictionary } from "@/i18n/dictionaries";
import type { HllStratmapMap, StratmapOverlaySettings, StratmapSlide } from "@/lib/stratmaps";
import { cn } from "@/lib/utils";

import { EditorButton, EditorField, EditorIconButton, EditorInput, EditorPanel, EditorSelect, EditorTextarea } from "./editor-controls";

type LeftSidebarProps = {
  dictionary: Dictionary;
  canAdmin: boolean;
  isPending: boolean;
  title: string;
  description: string;
  baseMapId: string;
  side: string;
  strongpointId: string;
  maps: HllStratmapMap[];
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
  onDeleteSlide: () => void;
  onToggleStrongpoint: (pointId: string) => void;
};

export function StratmapLeftSidebar(props: LeftSidebarProps) {
  return (
    <aside className="min-w-0 space-y-1 overflow-x-hidden overflow-y-auto pr-0.5 [scrollbar-width:thin]">
      <MetaPanel {...props} />
      <SlidesPanel {...props} />
      <StrongpointsPanel {...props} />
    </aside>
  );
}

function MetaPanel({ dictionary, canAdmin, isPending, title, description, baseMapId, side, strongpointId, maps, selectedMap, onTitleChange, onDescriptionChange, onBaseMapChange, onStrongpointChange, onSideChange, onSaveMeta }: LeftSidebarProps) {
  return (
    <EditorPanel title={dictionary.stratmaps.title} icon={Map}>
      <EditorField label={dictionary.stratmaps.titleLabel}>
        <EditorInput value={title} onChange={(event) => onTitleChange(event.target.value)} disabled={!canAdmin} />
      </EditorField>
      <EditorField label={dictionary.stratmaps.descriptionLabel}>
        <EditorTextarea value={description} onChange={(event) => onDescriptionChange(event.target.value)} disabled={!canAdmin} className="min-h-10" />
      </EditorField>
      <div className="grid grid-cols-[minmax(0,1fr)_4.25rem] gap-1">
        <EditorField label={dictionary.stratmaps.baseMap}>
          <EditorSelect value={baseMapId} onChange={(event) => onBaseMapChange(event.target.value)} disabled={!canAdmin}>
            {maps.map((map) => <option key={map.id} value={map.id}>{map.name}</option>)}
          </EditorSelect>
        </EditorField>
        <EditorField label={dictionary.stratmaps.side}>
          <EditorInput value={side} onChange={(event) => onSideChange(event.target.value)} disabled={!canAdmin} />
        </EditorField>
      </div>
      <EditorField label={dictionary.stratmaps.point}>
        <EditorSelect value={strongpointId} onChange={(event) => onStrongpointChange(event.target.value)} disabled={!canAdmin}>
          <option value="">{dictionary.shared.notSet}</option>
          {selectedMap?.strongpoints.map((point) => <option key={point.id} value={point.id}>{point.label} · {point.grid}</option>)}
        </EditorSelect>
      </EditorField>
      {canAdmin ? (
        <EditorButton className="w-full" onClick={onSaveMeta} disabled={isPending}>
          <Save className="size-3" />
          {dictionary.stratmaps.saveDetails}
        </EditorButton>
      ) : <p className="text-[10px] text-muted-foreground">{dictionary.stratmaps.liveAccess}</p>}
    </EditorPanel>
  );
}

function SlidesPanel({ dictionary, canAdmin, slides, selectedSlideId, onSelectSlide, onAddSlide, onDuplicateSlide, onRenameSlide, onMoveSlide, onDeleteSlide }: LeftSidebarProps) {
  const actions = canAdmin ? (
    <div className="flex gap-0.5">
      <EditorIconButton icon={Plus} label={dictionary.stratmaps.createSlideAction ?? "Add slide"} onClick={onAddSlide} />
      <EditorIconButton icon={Copy} label="Duplicate slide" onClick={onDuplicateSlide} />
      <EditorIconButton icon={Trash2} label="Delete slide" onClick={onDeleteSlide} disabled={slides.length <= 1} />
    </div>
  ) : null;

  return (
    <EditorPanel title={dictionary.stratmaps.slides} icon={Layers3} action={actions}>
      <div className="space-y-0.5">
        {slides.map((slide, index) => (
          <div key={slide.id} className={cn("group flex h-7 items-center rounded-[3px] border border-transparent px-1", selectedSlideId === slide.id ? "border-primary/60 bg-primary/12" : "hover:bg-muted/40")}>
            {canAdmin ? (
              <EditorInput value={slide.name} onChange={(event) => onRenameSlide(slide.id, event.target.value)} onFocus={() => onSelectSlide(slide.id)} className="h-5 min-w-0 flex-1 border-0 bg-transparent px-1 shadow-none focus:ring-0" />
            ) : (
              <button type="button" className="min-w-0 flex-1 truncate px-1 text-left text-[10px]" onClick={() => onSelectSlide(slide.id)}>{slide.name}</button>
            )}
            {canAdmin ? (
              <div className="ml-0.5 flex gap-0.5 opacity-50 group-hover:opacity-100 group-focus-within:opacity-100">
                <EditorIconButton icon={ChevronUp} label="Move slide up" className="size-5 border-0 bg-transparent" disabled={index === 0} onClick={() => onMoveSlide(slide.id, -1)} />
                <EditorIconButton icon={ChevronDown} label="Move slide down" className="size-5 border-0 bg-transparent" disabled={index === slides.length - 1} onClick={() => onMoveSlide(slide.id, 1)} />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </EditorPanel>
  );
}

function StrongpointsPanel({ dictionary, selectedMap, activeOverlays, onToggleStrongpoint }: LeftSidebarProps) {
  return (
    <EditorPanel title={dictionary.stratmaps.visibleStrongpoints}>
      <div className="max-h-48 space-y-px overflow-y-auto pr-0.5 [scrollbar-width:thin]">
        {selectedMap?.strongpoints.map((point) => {
          const visible = activeOverlays.showAllStrongpoints || activeOverlays.visibleStrongpointIds.includes(point.id);
          return (
            <button key={point.id} type="button" aria-pressed={visible} className={cn("flex h-6 w-full items-center gap-1.5 rounded-[3px] px-1.5 text-left text-[10px] hover:bg-muted/50", visible && "bg-primary/10 text-primary")} onClick={() => onToggleStrongpoint(point.id)}>
              <span className={cn("size-1.5 shrink-0 rounded-full border border-current", visible && "bg-current")} />
              <span className="min-w-0 flex-1 truncate">{point.label}</span>
              <span className="font-mono text-[9px] text-muted-foreground">{point.grid}</span>
            </button>
          );
        })}
      </div>
    </EditorPanel>
  );
}
