import { z } from "zod";

const squadRoleSchema = z.object({
  name: z.string().trim().min(1, "Role name is required."),
  color: z.string().trim().min(1, "Role color is required."),
  icon: z.string().trim().min(1, "Role icon is required."),
  count: z.number().int().min(1, "Role count must be at least 1."),
  note: z.string().trim().optional(),
});

const squadPresetSquadSchema = z.object({
  name: z.string().trim().min(1, "Squad name is required."),
  group: z.string().trim().min(1, "Squad group is required."),
  order: z.number().int().min(0, "Squad order must be 0 or greater."),
  color: z.string().trim().min(1, "Squad color is required."),
  icon: z.string().trim().min(1, "Squad icon is required."),
  roles: z.array(squadRoleSchema).min(1, "Each squad needs at least one role."),
});

export const squadPresetSchema = z.object({
  name: z.string().trim().min(1, "Preset name is required."),
  squads: z.array(squadPresetSquadSchema).min(1, "Add at least one squad."),
});

export type SquadPresetInput = z.infer<typeof squadPresetSchema>;
