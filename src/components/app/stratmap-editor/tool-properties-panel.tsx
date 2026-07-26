"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Dictionary } from "@/i18n/dictionaries";
import type { HllStratmapCatalogItem } from "@/lib/stratmaps";

import { STROKE_COLOR_OPTIONS, type Tool } from "./types";

export function ToolPropertiesPanel({
  dictionary,
  tool,
  strokeColor,
  fillColor,
  strokeWidth,
  lineStyle,
  textValue,
  textSize,
  iconId,
  catalogGroups,
  onStrokeColorChange,
  onFillColorChange,
  onStrokeWidthChange,
  onLineStyleChange,
  onTextValueChange,
  onTextSizeChange,
  onIconChange,
}: {
  dictionary: Dictionary;
  tool: Tool;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  lineStyle: "solid" | "dashed" | "dotted";
  textValue: string;
  textSize: number;
  iconId: string;
  catalogGroups: Record<string, HllStratmapCatalogItem[]>;
  onStrokeColorChange: (value: string) => void;
  onFillColorChange: (value: string) => void;
  onStrokeWidthChange: (value: number) => void;
  onLineStyleChange: (value: "solid" | "dashed" | "dotted") => void;
  onTextValueChange: (value: string) => void;
  onTextSizeChange: (value: number) => void;
  onIconChange: (value: string) => void;
}) {
  return (
    <Card className="rounded-xl border-border/60">
      <CardHeader className="px-3 py-3"><CardTitle className="text-base">{dictionary.stratmaps.toolProperties}</CardTitle></CardHeader>
      <CardContent className="space-y-3 px-3 pb-3">
        <div className="space-y-1.5"><Label className="text-xs">{dictionary.stratmaps.quickColors}</Label><div className="flex flex-wrap gap-2">{STROKE_COLOR_OPTIONS.map((color) => <button key={color} type="button" className={`h-7 w-7 rounded-full border-2 ${strokeColor === color ? "border-primary" : "border-border/60"}`} style={{ backgroundColor: color }} onClick={() => onStrokeColorChange(color)} />)}</div></div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5"><Label className="text-xs">{dictionary.stratmaps.stroke}</Label><Input type="color" value={strokeColor} onChange={(event) => onStrokeColorChange(event.target.value)} className="h-9 rounded-lg p-1" /></div>
          <div className="space-y-1.5"><Label className="text-xs">{dictionary.stratmaps.fill}</Label><Input type="color" value={fillColor.slice(0, 7)} onChange={(event) => onFillColorChange(`${event.target.value}33`)} className="h-9 rounded-lg p-1" /></div>
        </div>
        <div className="space-y-1.5"><Label className="text-xs">{dictionary.stratmaps.strokeWidth}</Label><Input type="number" min={1} max={24} value={strokeWidth} onChange={(event) => onStrokeWidthChange(Number(event.target.value) || 1)} className="h-9 rounded-lg text-sm" /></div>
        <div className="space-y-1.5"><Label className="text-xs">{dictionary.stratmaps.lineStyle}</Label><Select value={lineStyle} onValueChange={(value) => onLineStyleChange(value as typeof lineStyle)}><SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="solid">{dictionary.stratmaps.solid}</SelectItem><SelectItem value="dashed">{dictionary.stratmaps.dashed}</SelectItem><SelectItem value="dotted">{dictionary.stratmaps.dotted}</SelectItem></SelectContent></Select></div>
        {tool === "text" ? <><div className="space-y-1.5"><Label className="text-xs">{dictionary.stratmaps.text}</Label><Textarea value={textValue} onChange={(event) => onTextValueChange(event.target.value)} className="min-h-16 rounded-lg px-3 py-2 text-sm" /></div><div className="space-y-1.5"><Label className="text-xs">{dictionary.stratmaps.fontSize}</Label><Input type="number" min={16} max={96} value={textSize} onChange={(event) => onTextSizeChange(Number(event.target.value) || 16)} className="h-9 rounded-lg text-sm" /></div></> : null}
        {tool === "icon" ? <div className="space-y-1.5"><Label className="text-xs">{dictionary.stratmaps.iconLibrary}</Label><ScrollArea className="h-[22rem] rounded-lg border border-border/60 p-2">{Object.entries(catalogGroups).map(([category, items]) => <div key={category} className="mb-4 space-y-2"><div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{category}</div><div className="grid grid-cols-4 gap-1.5">{items.map((item) => <button key={item.id} type="button" className={`flex aspect-square flex-col items-center justify-center rounded-lg border p-1.5 ${iconId === item.id ? "border-primary bg-primary/10" : "border-border/60"}`} onClick={() => onIconChange(item.id)} title={item.label}><div className="flex h-8 w-8 items-center justify-center" style={{ backgroundColor: strokeColor, WebkitMaskImage: `url(${item.iconPath})`, maskImage: `url(${item.iconPath})`, WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "center", maskPosition: "center", WebkitMaskSize: "contain", maskSize: "contain" }} /></button>)}</div></div>)}</ScrollArea></div> : null}
      </CardContent>
    </Card>
  );
}
