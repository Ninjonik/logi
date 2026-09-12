/** The preset palette used by Matt Wright's Maps Let Loose editor. */
export const MAPS_LET_LOOSE_COLORS = [
    "#0080ff",
    "#ff8080",
    "#ff8000",
    "#ffff80",
    "#00ff00",
    "#8000ff",
    "#ffffff",
    "#c0c0c0",
] as const

export const MAPS_LET_LOOSE_GREEN_COLOR = MAPS_LET_LOOSE_COLORS[4]
export const MAPS_LET_LOOSE_FRIENDLY_COLOR = MAPS_LET_LOOSE_COLORS[0]
export const MAPS_LET_LOOSE_ENEMY_COLOR = MAPS_LET_LOOSE_COLORS[1]

export function mapsLetLooseIconColor(side: unknown) {
    return side === "enemy"
        ? MAPS_LET_LOOSE_ENEMY_COLOR
        : MAPS_LET_LOOSE_FRIENDLY_COLOR
}
