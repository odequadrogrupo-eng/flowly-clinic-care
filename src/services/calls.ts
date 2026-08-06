import { supabase } from "@/integrations/supabase/client";

export type PanelCallRow = {
  id: string;
  display_name: string;
  professional_name: string | null;
  room_name: string | null;
  called_at: string;
};

export async function listRecentCalls(clinicId: string, limit = 6) {
  const { data, error } = await supabase
    .from("calls")
    .select("id, display_name, professional_name, room_name, called_at")
    .eq("clinic_id", clinicId)
    .order("called_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as PanelCallRow[];
}

export async function listCallHistory(clinicId: string, fromIso: string, toIso: string, limit = 200) {
  const { data, error } = await supabase
    .from("calls")
    .select("id, display_name, professional_name, room_name, called_at")
    .eq("clinic_id", clinicId)
    .gte("called_at", fromIso)
    .lte("called_at", toIso)
    .order("called_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as PanelCallRow[];
}
