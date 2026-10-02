import assert from "node:assert/strict"
import test from "node:test"

import { getRoleIconOptions } from "./squad-preset-templates"

test("squad preset icon options are scoped to their game", () => {
    const hllIcons = getRoleIconOptions("hell_let_loose")
    const vietnamIcons = getRoleIconOptions("hell_let_loose_vietnam")
    const wardogsIcons = getRoleIconOptions("wardogs")

    assert.deepEqual(vietnamIcons, hllIcons)
    assert.ok(hllIcons.includes("/img/roles/icn_officer.png"))
    assert.ok(!hllIcons.includes("/img/roles/icn_builder.png"))
    assert.ok(wardogsIcons.includes("/img/roles/icn_builder.png"))
    assert.ok(!wardogsIcons.includes("/img/roles/icn_officer.png"))
})
