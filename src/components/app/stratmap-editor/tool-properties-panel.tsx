"use client";

import type { Dictionary } from "@/i18n/dictionaries";
import type { HllStratmapCatalogItem, StratmapArrowStyle } from "@/lib/stratmaps";
import { cn } from "@/lib/utils";

import { EditorField, EditorInput, EditorSelect, EditorTextarea, EditorToggle } from "./editor-controls";
import type { Tool } from "./types";

export function ToolPropertiesPanel({
  dictionary,
  tool,
  strokeWidth,
  lineStyle,
  lineStartStyle,
  lineEndStyle,
  showLineDistance,
  textValue,
  textSize,
  iconId,
  catalogGroups,
  onStrokeWidthChange,
  onLineStyleChange,
  onLineStartStyleChange,
  onLineEndStyleChange,
  onShowLineDistanceChange,
  onTextValueChange,
  onTextSizeChange,
  onIconChange,
}: {
  dictionary: Dictionary;
  tool: Tool;
  strokeWidth: number;
  lineStyle: "solid" | "dashed" | "dotted";
  lineStartStyle: StratmapArrowStyle;
  lineEndStyle: StratmapArrowStyle;
  showLineDistance: boolean;
  textValue: string;
  textSize: number;
  iconId: string;
  catalogGroups: Record<string, HllStratmapCatalogItem[]>;
  onStrokeWidthChange: (value: number) => void;
  onLineStyleChange: (value: "solid" | "dashed" | "dotted") => void;
  onLineStartStyleChange: (value: StratmapArrowStyle) => void;
  onLineEndStyleChange: (value: StratmapArrowStyle) => void;
  onShowLineDistanceChange: (value: boolean) => void;
  onTextValueChange: (value: string) => void;
  onTextSizeChange: (value: number) => void;
  onIconChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5 overflow-x-hidden">
      <div className="grid grid-cols-2 gap-1">
        <EditorField label={dictionary.stratmaps.strokeWidth}>
          <EditorInput type="number" min={1} max={24} value={strokeWidth} onChange={(event) => onStrokeWidthChange(Number(event.target.value) || 1)} />
        </EditorField>
        <EditorField label={dictionary.stratmaps.lineStyle}>
          <EditorSelect value={lineStyle} onChange={(event) => onLineStyleChange(event.target.value as typeof lineStyle)}>
            <option value="solid">{dictionary.stratmaps.solid}</option>
            <option value="dashed">{dictionary.stratmaps.dashed}</option>
            <option value="dotted">{dictionary.stratmaps.dotted}</option>
          </EditorSelect>
        </EditorField>
      </div>
      {tool === "line" || tool === "measure" ? (
        <>
          <div className="grid grid-cols-2 gap-1.5">
            <EditorField label={dictionary.stratmaps.lineStart}>
              <ArrowStyleSelect value={lineStartStyle} onChange={onLineStartStyleChange} dictionary={dictionary} />
            </EditorField>
            <EditorField label={dictionary.stratmaps.lineEnd}>
              <ArrowStyleSelect value={lineEndStyle} onChange={onLineEndStyleChange} dictionary={dictionary} />
            </EditorField>
          </div>
          <EditorToggle label={dictionary.stratmaps.showDistance} checked={showLineDistance || tool === "measure"} onCheckedChange={onShowLineDistanceChange} disabled={tool === "measure"} />
        </>
      ) : null}
      {tool === "text" ? (
        <>
          <EditorField label={dictionary.stratmaps.text}><EditorTextarea value={textValue} onChange={(event) => onTextValueChange(event.target.value)} /></EditorField>
          <EditorField label={dictionary.stratmaps.fontSize}><EditorInput type="number" min={16} max={96} value={textSize} onChange={(event) => onTextSizeChange(Number(event.target.value) || 16)} /></EditorField>
        </>
      ) : null}
      {tool === "icon" ? (
        <EditorField label={dictionary.stratmaps.iconLibrary}>
          <div className="h-52 overflow-y-auto rounded-[3px] border border-border/60 p-1 [scrollbar-width:thin]">
            {Object.entries(catalogGroups).map(([category, items]) => (
              <div key={category} className="mb-2 space-y-1 last:mb-0">
                <div className="text-[8px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{category}</div>
                <div className="grid grid-cols-5 gap-0.5">
                  {items.map((item) => (
                    <button key={item.id} type="button" className={cn("flex aspect-square items-center justify-center rounded-[2px] border border-border/60 p-0.5 hover:bg-muted/50", iconId === item.id && "border-primary bg-primary/10")} onClick={() => onIconChange(item.id)} title={item.label}>
                      <div className="size-5" style={{ backgroundColor: "#39ff14", WebkitMaskImage: `url(${item.iconPath})`, maskImage: `url(${item.iconPath})`, WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "center", maskPosition: "center", WebkitMaskSize: "contain", maskSize: "contain" }} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </EditorField>
      ) : null}
    </div>
  );
}

function ArrowStyleSelect({ value, onChange, dictionary }: { value: StratmapArrowStyle; onChange: (value: StratmapArrowStyle) => void; dictionary: Dictionary }) {
  return (
    <EditorSelect value={value} onChange={(event) => onChange(event.target.value as StratmapArrowStyle)}>
      <option value="none">{dictionary.stratmaps.none}</option>
      <option value="arrow">{dictionary.stratmaps.arrow}</option>
      <option value="circle">{dictionary.stratmaps.circleMarker}</option>
      <option value="square">{dictionary.stratmaps.squareMarker}</option>
    </EditorSelect>
  );
}
