import assert from "node:assert/strict";
import test from "node:test";

import { readFileSync } from "node:fs";

const migrations = readFileSync(
  "supabase/migrations/20260807070000_superadmin_global_and_onboarding_tx.sql",
  "utf8",
);

test("superadmin global migration enforces clinic nullability rule", () => {
  assert.match(migrations, /profiles_clinic_role_check/);
  assert.match(migrations, /role = 'superadmin' AND clinic_id IS NULL/);
  assert.match(migrations, /role <> 'superadmin' AND clinic_id IS NOT NULL/);
});

test("superadmin context function exists", () => {
  assert.match(migrations, /set_superadmin_support_context/);
  assert.match(migrations, /superadmin_support_context/);
});
