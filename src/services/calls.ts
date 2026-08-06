import { supabase } from "@/integrations/supabase/client";

export type PanelCallRow = {
  id: string;
  display_name: string;
  professional_name: string | null;
  room_name: string | null;
  called_at: string;
  queue_id: string | null;
  ticket_code: string | null;
  ticket_priority: boolean | null;
};

export async function listRecentCalls(clinicId: string, limit = 6) {
  const { data, error } = await supabase
    .from("calls")
    .select("id, display_name, professional_name, room_name, called_at, queue_id")
    .eq("clinic_id", clinicId)
    .order("called_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  const calls = (data ?? []) as Array<PanelCallRow>;
  const queueIds = calls.map((call) => call.queue_id).filter(Boolean) as string[];

  if (queueIds.length === 0) {
    return calls.map((call) => ({ ...call, ticket_code: null, ticket_priority: null }));
  }

  const { data: tickets, error: ticketsError } = await supabase
    .from("tickets" as never)
    .select("queue_id, code, priority" as never)
    .eq("clinic_id", clinicId)
    .in("queue_id", queueIds);

  if (ticketsError) throw ticketsError;

  const ticketByQueueId = new Map(
    (
      (tickets ?? []) as Array<{
        queue_id: string | null;
        code: string | null;
        priority: boolean | null;
      }>
    ).map((ticket) => [ticket.queue_id, ticket]),
  );

  return calls.map((call) => ({
    ...call,
    ticket_code: call.queue_id ? (ticketByQueueId.get(call.queue_id)?.code ?? null) : null,
    ticket_priority: call.queue_id ? (ticketByQueueId.get(call.queue_id)?.priority ?? null) : null,
  }));
}

export async function listCallHistory(
  clinicId: string,
  fromIso: string,
  toIso: string,
  limit = 200,
) {
  const { data, error } = await supabase
    .from("calls")
    .select("id, display_name, professional_name, room_name, called_at, queue_id")
    .eq("clinic_id", clinicId)
    .gte("called_at", fromIso)
    .lte("called_at", toIso)
    .order("called_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  const calls = (data ?? []) as Array<PanelCallRow>;
  const queueIds = calls.map((call) => call.queue_id).filter(Boolean) as string[];
  if (queueIds.length === 0) {
    return calls.map((call) => ({ ...call, ticket_code: null, ticket_priority: null }));
  }

  const { data: tickets, error: ticketsError } = await supabase
    .from("tickets" as never)
    .select("queue_id, code, priority" as never)
    .eq("clinic_id", clinicId)
    .in("queue_id", queueIds);

  if (ticketsError) throw ticketsError;

  const ticketByQueueId = new Map(
    (
      (tickets ?? []) as Array<{
        queue_id: string | null;
        code: string | null;
        priority: boolean | null;
      }>
    ).map((ticket) => [ticket.queue_id, ticket]),
  );

  return calls.map((call) => ({
    ...call,
    ticket_code: call.queue_id ? (ticketByQueueId.get(call.queue_id)?.code ?? null) : null,
    ticket_priority: call.queue_id ? (ticketByQueueId.get(call.queue_id)?.priority ?? null) : null,
  }));
}

export function formatPanelDisplayName(
  call: Pick<PanelCallRow, "display_name" | "ticket_code">,
  showMode: "ticket_only" | "first_name" | "name_abbreviated",
) {
  if (showMode === "ticket_only") {
    return call.ticket_code ?? call.display_name;
  }

  if (showMode === "first_name") {
    return call.display_name.split(" ")[0] ?? call.display_name;
  }

  return call.display_name;
}
