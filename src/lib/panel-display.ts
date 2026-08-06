export type PanelDestinationLabels = {
  roomLabel: string;
  deskLabel: string;
  officeLabel: string;
  receptionLabel: string;
};

export type DestinationKind = "room" | "desk" | "office" | "reception" | "custom";

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

function startsWithAny(value: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(value));
}

export function parseDestinationKind(raw: string): { kind: DestinationKind; body: string } {
  const value = normalizeText(raw);
  if (!value) return { kind: "reception", body: "" };

  const room = /^(sala)\b\s*[:-]?\s*(.*)$/i.exec(value);
  if (room) return { kind: "room", body: normalizeText(room[2]) };

  const desk = /^(guiche|guichê)\b\s*[:-]?\s*(.*)$/i.exec(value);
  if (desk) return { kind: "desk", body: normalizeText(desk[2]) };

  const office = /^(consultorio|consultório)\b\s*[:-]?\s*(.*)$/i.exec(value);
  if (office) return { kind: "office", body: normalizeText(office[2]) };

  if (startsWithAny(value, [/^recepcao$/i, /^recepção$/i])) {
    return { kind: "reception", body: "" };
  }

  if (/^\d+[a-zA-Z-]*$/.test(value)) {
    return { kind: "room", body: value };
  }

  return { kind: "custom", body: value };
}

export function formatPanelDestination(
  raw: string | null | undefined,
  labels: PanelDestinationLabels,
) {
  const value = normalizeText(raw);
  if (!value) return labels.receptionLabel;

  const parsed = parseDestinationKind(value);
  if (parsed.kind === "custom") return value;
  if (parsed.kind === "reception") return labels.receptionLabel;

  const label =
    parsed.kind === "room"
      ? labels.roomLabel
      : parsed.kind === "desk"
        ? labels.deskLabel
        : labels.officeLabel;

  if (!parsed.body) return label;
  if (parsed.body.toLowerCase().startsWith(label.toLowerCase())) return parsed.body;
  return `${label} ${parsed.body}`;
}
