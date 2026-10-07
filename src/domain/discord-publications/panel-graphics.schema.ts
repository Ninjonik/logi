import { PANEL_MAP_GAMES, PANEL_MAPS, PANEL_STYLES } from "./panel-graphics"
import { z } from "zod"

export const panelStyleSchema = z.enum(PANEL_STYLES)
export const panelMapGameSchema = z.enum(PANEL_MAP_GAMES)
export const panelMapKeySchema = z
    .string()
    .regex(/^[a-z0-9-]{2,40}$/)
    .refine((key) => PANEL_MAPS.some((map) => map.key === key))
