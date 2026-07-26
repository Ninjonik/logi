import rawCatalog from "@/data/hll-stratmap-catalog.json";
import rawMaps from "@/data/hll-stratmap-maps.json";

export type HllStratmapCatalogItem = {
  id: string;
  label: string;
  category: string;
  iconPath: string;
};

export type HllStratmapStrongpoint = {
  id: string;
  label: string;
  grid: string;
  center: { x: number; y: number };
  bounds: { x: number; y: number; width: number; height: number };
  rects: Array<{ x: number; y: number; width: number; height: number }>;
  spritePath: string;
};

export type HllStratmapMap = {
  id: string;
  name: string;
  upstreamName: string;
  imagePath: string;
  mapSize: number;
  strongpoints: HllStratmapStrongpoint[];
  defaultElements: {
    offensiveGarrisons: {
      a: StratmapDefaultElement[];
      b: StratmapDefaultElement[];
    };
    artillery: {
      a: StratmapDefaultElement[];
      b: StratmapDefaultElement[];
    };
    tanks: {
      a: StratmapDefaultElement[];
      b: StratmapDefaultElement[];
    };
    trucks: {
      a: StratmapDefaultElement[];
      b: StratmapDefaultElement[];
    };
    commandSpawns: {
      a: StratmapDefaultElement[];
      b: StratmapDefaultElement[];
    };
    repairStations: {
      a: StratmapDefaultElement[];
      b: StratmapDefaultElement[];
    };
  };
};

export type StratmapDefaultElement = {
  type: string;
  modifier: string | null;
  x: number;
  y: number;
  angle: number;
};

export type StratmapOverlaySettings = {
  showGrid: boolean;
  showAllStrongpoints: boolean;
  visibleStrongpointIds: string[];
  showOffensiveGarrisons: boolean;
  overlayTeam: "a" | "b";
  showArtillery: boolean;
  showRepairStations: boolean;
};

export type StratmapStrokeStyle = "solid" | "dashed" | "dotted";
export type StratmapArrowStyle = "none" | "arrow" | "circle" | "square";

type StratmapElementBase = {
  id: string;
  x: number;
  y: number;
  rotation?: number;
  color?: string;
  strokeColor?: string;
  strokeWidth?: number;
  fillColor?: string;
  fillOpacity?: number;
  strokeStyle?: StratmapStrokeStyle;
  locked?: boolean;
};

export type StratmapElementAttachment = {
  url: string;
  filename?: string;
  contentType?: string;
  description?: string;
};

export type StratmapIconElement = StratmapElementBase & {
  kind: "icon";
  iconId: string;
  size: number;
  note?: string;
  attachments?: StratmapElementAttachment[];
};

export type StratmapTextElement = StratmapElementBase & {
  kind: "text";
  text: string;
  fontSize: number;
  width: number;
  align?: "left" | "center" | "right";
};

export type StratmapLineElement = StratmapElementBase & {
  kind: "line";
  points: Array<{ x: number; y: number }>;
  startStyle?: StratmapArrowStyle;
  endStyle?: StratmapArrowStyle;
};

export type StratmapShapeElement = StratmapElementBase & {
  kind: "rectangle" | "ellipse";
  width: number;
  height: number;
};

export type StratmapPolygonElement = StratmapElementBase & {
  kind: "polygon";
  points: Array<{ x: number; y: number }>;
};

export type StratmapFreehandElement = StratmapElementBase & {
  kind: "freehand";
  points: Array<{ x: number; y: number }>;
};

export type StratmapPing = {
  id: string;
  x: number;
  y: number;
  color: string;
  createdAt: string;
};

export type StratmapElement =
  | StratmapIconElement
  | StratmapTextElement
  | StratmapLineElement
  | StratmapShapeElement
  | StratmapPolygonElement
  | StratmapFreehandElement;

export type StratmapSlide = {
  id: string;
  name: string;
  overlays: StratmapOverlaySettings;
  elements: StratmapElement[];
  pings: StratmapPing[];
};

export type StratmapState = {
  version: 1;
  baseMapId: string;
  slides: StratmapSlide[];
};

export const HLL_STRATMAP_MAPS = rawMaps as HllStratmapMap[];
export const HLL_STRATMAP_CATALOG = rawCatalog as HllStratmapCatalogItem[];

export function getHllStratmapMaps() {
  return HLL_STRATMAP_MAPS;
}

export function getHllStratmapMapById(mapId: string) {
  return HLL_STRATMAP_MAPS.find((map) => map.id === mapId);
}

export function getHllStratmapCatalog() {
  return HLL_STRATMAP_CATALOG;
}

export function getHllStratmapCatalogGroups() {
  return HLL_STRATMAP_CATALOG.reduce<Record<string, HllStratmapCatalogItem[]>>((groups, item) => {
    groups[item.category] ??= [];
    groups[item.category].push(item);
    return groups;
  }, {});
}

export function buildDefaultStratmapState(baseMapId: string): StratmapState {
  const map = getHllStratmapMapById(baseMapId) ?? HLL_STRATMAP_MAPS[0];
  const visibleStrongpointIds = map?.strongpoints.slice(0, 3).map((point) => point.id) ?? [];

  return {
    version: 1,
    baseMapId: map?.id ?? baseMapId,
    slides: [
      {
        id: crypto.randomUUID(),
        name: "Slide 1",
        overlays: {
          showGrid: true,
          showAllStrongpoints: true,
          visibleStrongpointIds,
          showOffensiveGarrisons: false,
          overlayTeam: "a",
          showArtillery: false,
          showRepairStations: false,
        },
        elements: [],
        pings: [],
      },
    ],
  };
}

export function parseStratmapState(stateJson?: string | null, fallbackMapId?: string) {
  if (!stateJson) {
    return buildDefaultStratmapState(fallbackMapId ?? HLL_STRATMAP_MAPS[0]?.id ?? "carentan");
  }

  try {
    const parsed = JSON.parse(stateJson) as Omit<StratmapState, "slides"> & {
      slides?: Array<Omit<StratmapSlide, "overlays"> & {
        overlays?: Partial<StratmapOverlaySettings> & { offensiveGarrisonSide?: "a" | "b" };
      }>;
    };
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.slides) || !parsed.baseMapId) {
      throw new Error("Invalid stratmap state.");
    }

    return {
      ...parsed,
      slides: parsed.slides.map((slide) => ({
        ...slide,
        overlays: {
          showGrid: slide.overlays?.showGrid ?? true,
          showAllStrongpoints: slide.overlays?.showAllStrongpoints ?? true,
          visibleStrongpointIds: slide.overlays?.visibleStrongpointIds ?? [],
          showOffensiveGarrisons: slide.overlays?.showOffensiveGarrisons ?? false,
          overlayTeam: slide.overlays?.overlayTeam ?? slide.overlays?.offensiveGarrisonSide ?? "a",
          showArtillery: slide.overlays?.showArtillery ?? false,
          showRepairStations: slide.overlays?.showRepairStations ?? false,
        },
        elements: slide.elements.map((element) => (
          element.kind === "icon"
            ? {
                ...element,
                note: element.note ?? "",
                attachments: Array.isArray(element.attachments)
                  ? element.attachments.map((attachment) => ({
                      ...attachment,
                      description: attachment.description ?? "",
                    }))
                  : [],
              }
            : element
        )),
      })),
    };
  } catch {
    return buildDefaultStratmapState(fallbackMapId ?? HLL_STRATMAP_MAPS[0]?.id ?? "carentan");
  }
}

export function stringifyStratmapState(state: StratmapState) {
  return JSON.stringify(state);
}
