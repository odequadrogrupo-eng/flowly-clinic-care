import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type QueueStatus = Database["public"]["Enums"]["queue_status"];
export type QueuePriority = Database["public"]["Enums"]["queue_priority"];
export type QueueRow = Database["public"]["Tables"]["queues"]["Row"];
export type Patient = Database["public"]["Tables"]["patients"]["Row"];
export type Professional = Database["public"]["Tables"]["professionals"]["Row"];
export type Room = Database["public"]["Tables"]["rooms"]["Row"];
export type CallRow = Database["public"]["Tables"]["calls"]["Row"];

export type QueueItem = QueueRow & {
  patients: Pick<Patient, "id" | "full_name"> | null;
  professionals: Pick<Professional, "id" | "full_name" | "specialty"> | null;
  rooms: Pick<Room, "id" | "name" | "number"> | null;
};

export const QUEUE_SELECT =
  "*, patients(id, full_name), professionals(id, full_name, specialty), rooms(id, name, number)";

export const statusLabels: Record<QueueStatus, string> = {
  waiting: "Aguardando",
  called: "Chamado",
  in_service: "Em atendimento",
  finished: "Finalizado",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
};

export const statusTone: Record<QueueStatus, string> = {
  waiting: "bg-secondary text-secondary-foreground",
  called: "bg-warning/20 text-warning-foreground",
  in_service: "bg-primary/12 text-primary",
  finished: "bg-success/15 text-success",
  cancelled: "bg-destructive/12 text-destructive",
  no_show: "bg-muted text-muted-foreground",
};

export async function logAudit(input: {
  clinicId: string;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
}) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from("audit_logs").insert({
    clinic_id: input.clinicId,
    user_id: data.user.id,
    action: input.action,
    entity: input.entity,
    entity_id: input.entityId ?? null,
    details: (input.details ?? null) as never,
  });
}

/** Public display name — only first name + last initial, never full personal data. */
export function displayName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  return `${parts[0]} ${last.charAt(0).toUpperCase()}.`;
}

export async function callQueueItem(item: QueueItem, clinicId: string) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("queues")
    .update({ status: "called", called_at: now })
    .eq("id", item.id);
  if (error) throw error;

  const { error: callError } = await supabase.from("calls").insert({
    clinic_id: clinicId,
    queue_id: item.id,
    patient_id: item.patient_id,
    professional_id: item.professional_id,
    room_id: item.room_id,
    display_name: displayName(item.patients?.full_name ?? "Paciente"),
    professional_name: item.professionals?.full_name ?? null,
    room_name: item.rooms
      ? [item.rooms.name, item.rooms.number].filter(Boolean).join(" ")
      : null,
    called_at: now,
  });
  if (callError) throw callError;
  await logAudit({ clinicId, action: "call", entity: "queues", entityId: item.id });
}

export async function updateQueueStatus(
  item: QueueItem,
  status: QueueStatus,
  clinicId: string,
  extra: Partial<QueueRow> = {},
) {
  const now = new Date().toISOString();
  const patch: Partial<QueueRow> = { status, ...extra };
  if (status === "in_service") patch.started_at = now;
  if (status === "finished") patch.finished_at = now;
  if (status === "cancelled") patch.cancelled_at = now;
  const { error } = await supabase.from("queues").update(patch).eq("id", item.id);
  if (error) throw error;
  await logAudit({ clinicId, action: `queue_${status}`, entity: "queues", entityId: item.id });
}

export function minutesBetween(from: string | null, to: string | null) {
  if (!from) return 0;
  const end = to ? new Date(to).getTime() : Date.now();
  return Math.max(0, Math.round((end - new Date(from).getTime()) / 60000));
}

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m.toString().padStart(2, "0")}`;
}

export function formatTime(iso: string | null) {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "pt-BR";
  utterance.rate = 0.95;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
