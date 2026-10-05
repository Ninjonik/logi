import assert from "node:assert/strict"
import test from "node:test"

import {
    API_KEY_RESOURCE_GROUPS,
    groupsOfResources,
    resourcesForGroups,
} from "./key-access-groups"
import { API_KEY_READ_RESOURCES, isApiKeyReadAccess } from "./key-access"

test("every read resource belongs to exactly one area", () => {
    const grouped = Object.values(API_KEY_RESOURCE_GROUPS).flat()
    assert.equal(new Set(grouped).size, grouped.length)
    assert.deepEqual([...grouped].sort(), [...API_KEY_READ_RESOURCES].sort())
})

test("areas expand to a valid read policy in a stable order", () => {
    const resources = resourcesForGroups(["members", "matches"])
    assert.deepEqual(
        resources,
        API_KEY_READ_RESOURCES.filter((resource) =>
            [
                ...API_KEY_RESOURCE_GROUPS.matches,
                ...API_KEY_RESOURCE_GROUPS.members,
            ].includes(resource as never)
        )
    )
    assert.ok(isApiKeyReadAccess({ resources, gameIds: ["wardogs"] }))
    assert.deepEqual(resourcesForGroups([]), [])
})

test("a key shows the areas it covers fully or in part", () => {
    assert.deepEqual(
        groupsOfResources([
            ...API_KEY_RESOURCE_GROUPS.rosters,
            "event-summaries",
            "unknown",
        ]),
        { full: ["rosters"], partial: ["matches"] }
    )
    assert.deepEqual(groupsOfResources([]), { full: [], partial: [] })
})
