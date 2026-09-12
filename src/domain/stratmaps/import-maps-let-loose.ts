import {
    getHllStratmapCatalog,
    getHllStratmapMapById,
    getHllStratmapMaps,
    type StratmapElement,
    type StratmapSlide,
    type StratmapState,
} from "@/lib/stratmaps"
import {
    MAPS_LET_LOOSE_GREEN_COLOR,
    mapsLetLooseIconColor,
} from "./maps-let-loose-colors"

type UnknownRecord = Record<string, unknown>

export type MapsLetLooseImport = {
    baseMapId: string | null
    state: StratmapState
    skippedElements: number
}

/** Converts the mll_config.json payload from Matt's Maps Let Loose exports. */
export function importMapsLetLooseJson(input: unknown): MapsLetLooseImport {
    const sourceSlides = Array.isArray(input) ? input : [input]
    const catalogIds = new Set(getHllStratmapCatalog().map((item) => item.id))
    let skippedElements = 0
    const firstControls = getRecord(getRecord(sourceSlides[0])?.state)?.controls
    const baseMapId = resolveMapId(getRecord(firstControls)?.map)

    const slides = sourceSlides.flatMap((sourceSlide, index) => {
        const slide = getRecord(sourceSlide)
        const state = getRecord(slide?.state)
        const controls = getRecord(state?.controls)
        const elements = Array.isArray(state?.elements) ? state.elements : []
        const drawings = Array.isArray(state?.drawings) ? state.drawings : []
        const converted = [...elements, ...drawings].flatMap((element) => {
            const result = convertElement(getRecord(element), catalogIds)
            if (!result) skippedElements += 1
            return result ? [result] : []
        })

        return {
            id: crypto.randomUUID(),
            name: stringValue(slide?.name) || `Slide ${index + 1}`,
            background: { kind: "map" as const },
            overlays: {
                showGrid: booleanValue(controls?.grid, true),
                showAllStrongpoints: booleanValue(controls?.sp, true),
                visibleStrongpointIds: [],
                showOffensiveGarrisons: booleanValue(
                    controls?.defaultOffensiveGarries,
                    false
                ),
                overlayTeam: booleanValue(controls?.defaultSideB, false)
                    ? "b"
                    : "a",
                showArtillery: booleanValue(controls?.defaultArty, false),
                showRepairStations: booleanValue(
                    controls?.defaultRepairStations,
                    false
                ),
                showSpawnRanges: !booleanValue(controls?.spawnRadius, false),
            },
            elements: converted,
            pings: [],
        } satisfies StratmapSlide
    })

    if (!slides.length)
        throw new Error("The Maps Let Loose export has no slides.")

    return {
        baseMapId,
        state: { version: 1, baseMapId: baseMapId ?? "carentan", slides },
        skippedElements,
    }
}

function convertElement(
    element: UnknownRecord | undefined,
    catalogIds: Set<string>
): StratmapElement | null {
    if (!element) return null
    const meta = getRecord(element.type)
    const type = stringValue(meta?.type)
    const id = crypto.randomUUID()
    const x = numberValue(element.left, 0)
    const y = numberValue(element.top, 0)
    const rotation = numberValue(element.angle, 0)
    const scaleX = numberValue(element.scaleX, 1)
    const scaleY = numberValue(element.scaleY, 1)
    const color = normalizeMapsLetLooseColor(
        stringValue(element.stroke) || stringValue(element.fill)
    )
    const strokeWidth = numberValue(element.strokeWidth, 6)
    const strokeStyle = dashStyle(element.strokeDashArray)

    if (type === "textbox") {
        return {
            id,
            kind: "text",
            x,
            y,
            rotation,
            text: stringValue(element.text) || "Text",
            fontSize: numberValue(element.fontSize, 24),
            width: numberValue(element.width, 380) * scaleX,
            color: normalizeMapsLetLooseColor(
                stringValue(element.fill),
                "#ffffff"
            ),
            backgroundColor:
                stringValue(element.backgroundColor) || "transparent",
        }
    }
    if (type === "rectangle" || type === "circle") {
        return {
            id,
            kind: type === "circle" ? "ellipse" : "rectangle",
            x,
            y,
            rotation,
            width:
                numberValue(
                    element.width,
                    numberValue(element.radius, 190) * 2
                ) * scaleX,
            height:
                numberValue(
                    element.height,
                    numberValue(element.radius, 190) * 2
                ) * scaleY,
            fillColor: normalizeMapsLetLooseColor(
                stringValue(element.fill),
                "transparent"
            ),
            fillOpacity: numberValue(element.opacity, 1),
            strokeColor: color,
            strokeWidth,
            strokeStyle,
        }
    }
    if (type === "polygon") {
        const points = pointsValue(element.points, x, y)
        return points.length >= 3
            ? {
                  id,
                  kind: "polygon",
                  x,
                  y,
                  rotation,
                  points,
                  fillColor: normalizeMapsLetLooseColor(
                      stringValue(element.fill),
                      "transparent"
                  ),
                  fillOpacity: numberValue(element.opacity, 1),
                  strokeColor: color,
                  strokeWidth,
                  strokeStyle,
              }
            : null
    }
    if (type === "measure-line") {
        return {
            id,
            kind: "line",
            x: 0,
            y: 0,
            points: [
                {
                    x: numberValue(element.x1, 0),
                    y: numberValue(element.y1, 0),
                },
                {
                    x: numberValue(element.x2, 0),
                    y: numberValue(element.y2, 0),
                },
            ],
            strokeColor: color,
            strokeWidth,
            strokeStyle,
            showDistance: true,
        }
    }
    if (type === "drawing" || element.type === "path") {
        const points = fabricPathPoints(element.path, x, y)
        return points.length >= 2
            ? {
                  id,
                  kind: "freehand",
                  x: 0,
                  y: 0,
                  points,
                  strokeColor: normalizeMapsLetLooseColor(
                      stringValue(element.stroke)
                  ),
                  strokeWidth,
                  strokeStyle,
              }
            : null
    }

    const iconId = iconIdFor(type, stringValue(meta?.modifier), catalogIds)
    return iconId
        ? {
              id,
              kind: "icon",
              x,
              y,
              rotation,
              iconId,
              size: Math.max(24, 50 * Math.max(scaleX, scaleY)),
              // Maps Let Loose stores an icon's allegiance in `type.side` and
              // applies its blue/red filter at render time; `fill` and `stroke`
              // are unrelated Fabric properties for these image assets.
              color: mapsLetLooseIconColor(meta?.side),
          }
        : null
}

function normalizeMapsLetLooseColor(
    value: string | undefined,
    fallback: string = MAPS_LET_LOOSE_GREEN_COLOR
) {
    const color = value?.trim()
    if (!color) return fallback

    const normalized = color.toLowerCase().replace(/\s+/g, "")
    return [
        "green",
        "#008000",
        "#0f0",
        "#00ff00",
        "rgb(0,128,0)",
        "rgb(0,255,0)",
    ].includes(normalized)
        ? MAPS_LET_LOOSE_GREEN_COLOR
        : color
}

function iconIdFor(type: string, modifier: string, catalogIds: Set<string>) {
    const candidates = [
        modifier ? `${type}-${modifier}` : "",
        type === "outpost" ? `outpost-${modifier}` : "",
        type,
    ]
    return (
        candidates.find(
            (candidate) => candidate && catalogIds.has(candidate)
        ) ?? null
    )
}

function resolveMapId(value: unknown) {
    const name = stringValue(value).toLowerCase()
    if (!name) return null
    const exact = getHllStratmapMapById(name)
    if (exact) return exact.id
    // Upstream map names are retained in our catalog specifically for this mapping.
    return (
        getHllStratmapMaps().find(
            (map) =>
                map.upstreamName.toLowerCase() === name ||
                map.name.toLowerCase() === name
        )?.id ?? null
    )
}

function getRecord(value: unknown): UnknownRecord | undefined {
    return value && typeof value === "object" && !Array.isArray(value)
        ? (value as UnknownRecord)
        : undefined
}
function stringValue(value: unknown) {
    return typeof value === "string" ? value : ""
}
function numberValue(value: unknown, fallback: number) {
    return typeof value === "number" && Number.isFinite(value)
        ? value
        : fallback
}
function booleanValue(value: unknown, fallback: boolean) {
    return typeof value === "boolean" ? value : fallback
}
function dashStyle(value: unknown): "solid" | "dashed" | "dotted" {
    if (!Array.isArray(value)) return "solid"
    return numberValue(value[0], 0) <= 1 ? "dotted" : "dashed"
}
function pointsValue(value: unknown, offsetX: number, offsetY: number) {
    return Array.isArray(value)
        ? value.flatMap((point) => {
              const item = getRecord(point)
              return item
                  ? [
                        {
                            x: numberValue(item.x, 0) + offsetX,
                            y: numberValue(item.y, 0) + offsetY,
                        },
                    ]
                  : []
          })
        : []
}
function fabricPathPoints(value: unknown, offsetX: number, offsetY: number) {
    return Array.isArray(value)
        ? value.flatMap((command) =>
              Array.isArray(command) &&
              command.length >= 3 &&
              typeof command[1] === "number" &&
              typeof command[2] === "number"
                  ? [{ x: command[1] + offsetX, y: command[2] + offsetY }]
                  : []
          )
        : []
}
