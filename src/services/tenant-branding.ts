import { supabase } from "@/integrations/supabase/client";

export type TenantBranding = {
  clinicId: string | null;
  tenantSlug: string | null;
  displayName: string;
  logoUrl: string | null;
  colors: Record<string, string>;
  rawBranding: Record<string, unknown>;
};

const DEFAULT_BRANDING: TenantBranding = {
  clinicId: null,
  tenantSlug: null,
  displayName: "ClinicFlow",
  logoUrl: null,
  colors: {},
  rawBranding: {},
};

const STORAGE_KEY = "clinicflow:tenant-branding";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asColorMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  return Object.entries(value).reduce<Record<string, string>>((acc, [key, raw]) => {
    if (typeof raw === "string" && raw.trim().length > 0) {
      acc[key] = raw.trim();
    }
    return acc;
  }, {});
}

function parseStoredBranding(value: string | null): TenantBranding | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<TenantBranding>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      clinicId: typeof parsed.clinicId === "string" ? parsed.clinicId : null,
      tenantSlug: typeof parsed.tenantSlug === "string" ? parsed.tenantSlug : null,
      displayName:
        typeof parsed.displayName === "string" && parsed.displayName.trim().length > 0
          ? parsed.displayName.trim()
          : "ClinicFlow",
      logoUrl:
        typeof parsed.logoUrl === "string" && parsed.logoUrl.trim().length > 0
          ? parsed.logoUrl.trim()
          : null,
      colors: asColorMap(parsed.colors),
      rawBranding: isRecord(parsed.rawBranding) ? parsed.rawBranding : {},
    };
  } catch {
    return null;
  }
}

function extractTenantIdentifier(): { slug: string | null; host: string | null } {
  if (typeof window === "undefined") return { slug: null, host: null };

  const params = new URLSearchParams(window.location.search);
  const fromParam = params.get("clinic") ?? params.get("tenant") ?? params.get("slug") ?? null;
  const slug = fromParam?.trim().toLowerCase() || null;
  const host = window.location.hostname?.trim().toLowerCase() || null;

  return { slug, host };
}

function readStoredBranding(): TenantBranding | null {
  if (typeof window === "undefined") return null;
  return parseStoredBranding(window.localStorage.getItem(STORAGE_KEY));
}

export function applyBrandingTheme(branding: TenantBranding) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const colors = branding.colors;

  if (colors["primary"]) root.style.setProperty("--primary", colors["primary"]);
  if (colors["primaryForeground"])
    root.style.setProperty("--primary-foreground", colors["primaryForeground"]);
  if (colors["accent"]) root.style.setProperty("--accent", colors["accent"]);
  if (colors["accentForeground"])
    root.style.setProperty("--accent-foreground", colors["accentForeground"]);
}

export async function resolveTenantBranding(): Promise<TenantBranding> {
  const { slug, host } = extractTenantIdentifier();

  if (!slug && !host) {
    const stored = readStoredBranding();
    if (stored) {
      applyBrandingTheme(stored);
      return stored;
    }
    return DEFAULT_BRANDING;
  }

  const { data, error } = await supabase.rpc("resolve_clinic_branding" as never, {
    _identifier: slug,
    _host: host,
  } as never);

  if (error) {
    const stored = readStoredBranding();
    return stored ?? DEFAULT_BRANDING;
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (!row || typeof row !== "object") {
    const stored = readStoredBranding();
    return stored ?? DEFAULT_BRANDING;
  }

  const record = row as Record<string, unknown>;
  const rawBranding = isRecord(record["branding"]) ? (record["branding"] as Record<string, unknown>) : {};
  const colors = asColorMap(rawBranding["colors"]);
  const displayName =
    (typeof rawBranding["display_name"] === "string" && rawBranding["display_name"].trim()) ||
    (typeof record["display_name"] === "string" && record["display_name"].trim()) ||
    "ClinicFlow";

  const resolved: TenantBranding = {
    clinicId: typeof record["clinic_id"] === "string" ? (record["clinic_id"] as string) : null,
    tenantSlug:
      typeof record["tenant_slug"] === "string"
        ? (record["tenant_slug"] as string)
        : slug,
    displayName,
    logoUrl:
      typeof record["logo_url"] === "string" && record["logo_url"].trim().length > 0
        ? (record["logo_url"] as string).trim()
        : null,
    colors,
    rawBranding,
  };

  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(resolved));
  }

  applyBrandingTheme(resolved);
  return resolved;
}

export function getDefaultBranding(): TenantBranding {
  return DEFAULT_BRANDING;
}
