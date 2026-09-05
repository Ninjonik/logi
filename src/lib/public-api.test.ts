import assert from "node:assert/strict";
import test from "node:test";

import { hashApiKey, readBearerToken } from "./public-api";

test("hashApiKey is deterministic and does not return the secret", () => {
  const key = "logi_very-secret-key";
  assert.equal(hashApiKey(key), hashApiKey(key));
  assert.notEqual(hashApiKey(key), key);
});

test("readBearerToken accepts only a bearer authorization header", () => {
  assert.equal(readBearerToken(new Request("https://example.test", { headers: { authorization: "Bearer logi_key" } })), "logi_key");
  assert.equal(readBearerToken(new Request("https://example.test", { headers: { authorization: "Basic abc" } })), null);
});
