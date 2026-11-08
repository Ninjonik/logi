import { selfAssignableGroupIdsSchema } from "../assignments/self-groups"
import { defineClanSettingsSlice } from "./settings-slices"
import { z } from "zod"

const schema = z.strictObject({ groupIds: selfAssignableGroupIdsSchema })
export const selfGroupsSettingsSlice = defineClanSettingsSlice({
    key: "selfGroups",
    description:
        "Groups members may add or remove themselves with /groups. Empty disables self-service. Only secondary Logi groups change; membership status, primary groups and Discord roles are preserved.",
    schema,
    patchSchema: schema.partial(),
    read: ({ discordConfig }) => ({
        groupIds: selfAssignableGroupIdsSchema.parse(
            discordConfig?.selfAssignableGroupIds ?? []
        ),
    }),
    toPatch: (patch) =>
        patch.groupIds === undefined
            ? {}
            : { selfAssignableGroupIds: patch.groupIds },
})
