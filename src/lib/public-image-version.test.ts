import assert from "node:assert/strict";
import test from "node:test";

import { getPublicImageDimensions, getPublicImageVersion, publicImageRenderRevision } from "./public-image-version";

test("public image URLs include the renderer revision", () => {
  assert.equal(getPublicImageVersion("content-v1"), `content-v1:${publicImageRenderRevision}`);
});

test("public image dimensions are stable and reduced by one to five pixels", () => {
  const version = "content-v1";
  const dimensions = getPublicImageDimensions(version);

  assert.deepEqual(getPublicImageDimensions(version), dimensions);
  assert.ok(dimensions.width >= 1195 && dimensions.width <= 1199);
  assert.ok(dimensions.height >= 625 && dimensions.height <= 629);
  assert.equal(1200 - dimensions.width, 630 - dimensions.height);
});
