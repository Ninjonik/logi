"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Dictionary } from "@/i18n/dictionaries";
import type { HllStratmapCatalogItem, StratmapArrowStyle } from "@/lib/stratmaps";
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
    <Card className="min-w-0 overflow-hidden rounded-xl border-border/60">
      <CardHeader className="px-3 py-3"><CardTitle className="text-base">{dictionary.stratmaps.toolProperties}</CardTitle></CardHeader>
      <CardContent className="space-y-3 overflow-x-hidden px-3 pb-3">
        <div className="space-y-1.5"><Label className="text-xs">{dictionary.stratmaps.strokeWidth}</Label><Input type="number" min={1} max={24} value={strokeWidth} onChange={(event) => onStrokeWidthChange(Number(event.target.value) || 1)} className="h-9 min-w-0 overflow-hidden rounded-lg text-sm" /></div>
        <div className="space-y-1.5"><Label className="text-xs">{dictionary.stratmaps.lineStyle}</Label><Select value={lineStyle} onValueChange={(value) => onLineStyleChange(value as typeof lineStyle)}><SelectTrigger className="h-9 min-w-0 overflow-hidden rounded-lg text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="solid">{dictionary.stratmaps.solid}</SelectItem><SelectItem value="dashed">{dictionary.stratmaps.dashed}</SelectItem><SelectItem value="dotted">{dictionary.stratmaps.dotted}</SelectItem></SelectContent></Select></div>
        {tool === "line" || tool === "measure" ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="min-w-0 space-y-1.5"><Label className="text-xs">{dictionary.stratmaps.lineStart}</Label><ArrowStyleSelect value={lineStartStyle} onChange={onLineStartStyleChange} dictionary={dictionary} /></div>
              <div className="min-w-0 space-y-1.5"><Label className="text-xs">{dictionary.stratmaps.lineEnd}</Label><ArrowStyleSelect value={lineEndStyle} onChange={onLineEndStyleChange} dictionary={dictionary} /></div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2">
              <Label className="text-xs">{dictionary.stratmaps.showDistance}</Label>
              <Switch checked={showLineDistance || tool === "measure"} onCheckedChange={onShowLineDistanceChange} disabled={tool === "measure"} />
            </div>
          </>
        ) : null}
        {tool === "text" ? <><div className="space-y-1.5"><Label className="text-xs">{dictionary.stratmaps.text}</Label><Textarea value={textValue} onChange={(event) => onTextValueChange(event.target.value)} className="min-h-16 rounded-lg px-3 py-2 text-sm" /></div><div className="space-y-1.5"><Label className="text-xs">{dictionary.stratmaps.fontSize}</Label><Input type="number" min={16} max={96} value={textSize} onChange={(event) => onTextSizeChange(Number(event.target.value) || 16)} className="h-9 min-w-0 overflow-hidden rounded-lg text-sm" /></div></> : null}
        {tool === "icon" ? <div className="space-y-1.5"><Label className="text-xs">{dictionary.stratmaps.iconLibrary}</Label><ScrollArea className="h-[22rem] rounded-lg border border-border/60 p-2">{Object.entries(catalogGroups).map(([category, items]) => <div key={category} className="mb-4 space-y-2"><div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{category}</div><div className="grid grid-cols-4 gap-1.5">{items.map((item) => <button key={item.id} type="button" className={`flex aspect-square flex-col items-center justify-center rounded-lg border p-1.5 ${iconId === item.id ? "border-primary bg-primary/10" : "border-border/60"}`} onClick={() => onIconChange(item.id)} title={item.label}><div className="flex h-8 w-8 items-center justify-center" style={{ backgroundColor: "#39ff14", WebkitMaskImage: `url(${item.iconPath})`, maskImage: `url(${item.iconPath})`, WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "center", maskPosition: "center", WebkitMaskSize: "contain", maskSize: "contain" }} /></button>)}</div></div>)}</ScrollArea></div> : null}
      </CardContent>
    </Card>
  );
}

function ArrowStyleSelect({ value, onChange, dictionary }: { value: StratmapArrowStyle; onChange: (value: StratmapArrowStyle) => void; dictionary: Dictionary }) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as StratmapArrowStyle)}>
      <SelectTrigger className="h-9 min-w-0 overflow-hidden rounded-lg text-sm"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="none">{dictionary.stratmaps.none}</SelectItem>
        <SelectItem value="arrow">{dictionary.stratmaps.arrow}</SelectItem>
        <SelectItem value="circle">{dictionary.stratmaps.circleMarker}</SelectItem>
        <SelectItem value="square">{dictionary.stratmaps.squareMarker}</SelectItem>
      </SelectContent>
    </Select>
  );
}
