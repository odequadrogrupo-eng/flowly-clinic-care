import { supabase } from "@/integrations/supabase/client";
import { QUEUE_SELECT, type QueueItem } from "@/lib/queue";

export function sortQueue(items: QueueItem[]) {
  return [...items].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority === "priority" ? -1 : 1;
    const pa = a.position ?? new Date(a.checkin_at).getTime();
    const pb = b.position ?? new Date(b.checkin_at).getTime();
    return pa - pb;
  });
}

export async function listActiveQueueItems(clinicId: string, professionalId?: string) {
  let query = supabase
    .from("queues")
    .select(QUEUE_SELECT)
    .eq("clinic_id", clinicId)
    .in("status", [
      "waiting",
      "called",
      "waiting_reception",
      "called_reception",
      "waiting_service",
      "called_service",
      "in_service",
    ]);

  if (professionalId) query = query.eq("professional_id", professionalId);

  const { data, error } = await query.order("checkin_at", { ascending: true });
  if (error) throw error;
  return sortQueue((data ?? []) as QueueItem[]);
}

export async function reorderQueueItems(a: QueueItem, b: QueueItem) {
  if (a.priority !== b.priority) {
    throw new Error("Nao e permitido reordenar entre filas de prioridade diferentes.");
  }

  const posA = a.position ?? new Date(a.checkin_at).getTime();
  const posB = b.position ?? new Date(b.checkin_at).getTime();

  const first = await supabase.from("queues").update({ position: posB }).eq("id", a.id);
  if (first.error) throw first.error;
  const second = await supabase.from("queues").update({ position: posA }).eq("id", b.id);
  if (second.error) throw second.error;
}
