import assert from "node:assert/strict";
import test from "node:test";

import { formatPanelDestination } from "../../src/lib/panel-display";

const labels = {
  roomLabel: "Sala",
  deskLabel: "Guichê",
  officeLabel: "Consultório",
  receptionLabel: "Recepção",
};

test("avoid duplicated Sala prefix", () => {
  assert.equal(formatPanelDestination("Sala 04", labels), "Sala 04");
  assert.equal(formatPanelDestination("04", labels), "Sala 04");
});

test("avoid duplicated Guiche/Consultorio prefixes", () => {
  assert.equal(formatPanelDestination("Guichê 2", labels), "Guichê 2");
  assert.equal(formatPanelDestination("Consultório 1", labels), "Consultório 1");
});
