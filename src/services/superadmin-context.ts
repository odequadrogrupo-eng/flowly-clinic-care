const STORAGE_KEY = "clinicflow:superadmin:selected-clinic";

export function getSelectedClinicIdForSuperadmin(): string | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(STORAGE_KEY);
  return value && value.trim().length > 0 ? value : null;
}

export function setSelectedClinicIdForSuperadmin(clinicId: string | null) {
  if (typeof window === "undefined") return;
  if (!clinicId) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, clinicId);
}
