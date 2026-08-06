import assert from "node:assert/strict";
import test from "node:test";

const publicRoutes = ["/apresentacao", "/manual"];

test("smoke routes list should include public commercial pages", () => {
  assert.ok(publicRoutes.includes("/apresentacao"));
  assert.ok(publicRoutes.includes("/manual"));
});
