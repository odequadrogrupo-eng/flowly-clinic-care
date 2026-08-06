import { supabase } from "@/integrations/supabase/client";

const DB_NAME = "clinicflow-contingency";
const STORE = "operations";

export type PendingOperation = {
  id: string;
  clinicId: string;
  kind:
    | "ticket_issue"
    | "patient_quick_create"
    | "queue_call"
    | "queue_repeat_call"
    | "queue_status"
    | "queue_start"
    | "queue_finish"
    | "queue_transfer"
    | "queue_no_show"
    | "print_ticket";
  payload: Record<string, unknown>;
  status: "pending" | "synced" | "conflict" | "failed";
  createdAt: string;
  syncedAt?: string;
  conflictDetails?: string;
  attempts?: number;
  nextRetryAt?: string;
  lastError?: string;
};

async function getDb(): Promise<IDBDatabase> {
  return await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function enqueueOperation(
  input: Omit<PendingOperation, "id" | "createdAt" | "status">,
) {
  const db = await getDb();
  const record: PendingOperation = {
    id: crypto.randomUUID(),
    clinicId: input.clinicId,
    kind: input.kind,
    payload: input.payload,
    createdAt: new Date().toISOString(),
    status: "pending",
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  return record;
}

export async function listPendingOperations() {
  const db = await getDb();
  return await new Promise<PendingOperation[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () =>
      resolve(
        (req.result as PendingOperation[]).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      );
    req.onerror = () => reject(req.error);
  });
}

export async function syncPendingOperations(clinicId: string) {
  const nowIso = new Date().toISOString();
  const records = (await listPendingOperations()).filter(
    (item) =>
      item.clinicId === clinicId &&
      item.status === "pending" &&
      (!item.nextRetryAt || item.nextRetryAt <= nowIso),
  );
  const results: PendingOperation[] = [];

  for (const record of records) {
    let status: PendingOperation["status"] = "synced";
    let conflictDetails: string | undefined;
    let lastError: string | undefined;
    const attempts = (record.attempts ?? 0) + 1;

    try {
      if (record.kind === "queue_status") {
        const queueId = String(record.payload["queueId"] ?? "");
        const nextStatus = String(record.payload["status"] ?? "");
        const { error } = await supabase
          .from("queues" as never)
          .update({ status: nextStatus } as never)
          .eq("id", queueId)
          .eq("clinic_id", clinicId);
        if (error) throw error;
      }

      if (record.kind === "queue_start") {
        const queueId = String(record.payload["queueId"] ?? "");
        const { error } = await supabase
          .from("queues" as never)
          .update({ status: "in_service", started_at: new Date().toISOString() } as never)
          .eq("id", queueId)
          .eq("clinic_id", clinicId);
        if (error) throw error;
      }

      if (record.kind === "queue_finish") {
        const queueId = String(record.payload["queueId"] ?? "");
        const { error } = await supabase
          .from("queues" as never)
          .update({ status: "finished", finished_at: new Date().toISOString() } as never)
          .eq("id", queueId)
          .eq("clinic_id", clinicId);
        if (error) throw error;
      }

      if (record.kind === "queue_transfer") {
        const queueId = String(record.payload["queueId"] ?? "");
        const nextRoomId = String(record.payload["roomId"] ?? "");
        const { error } = await supabase
          .from("queues" as never)
          .update({ room_id: nextRoomId, status: "waiting_service" } as never)
          .eq("id", queueId)
          .eq("clinic_id", clinicId);
        if (error) throw error;
      }

      if (record.kind === "queue_no_show") {
        const queueId = String(record.payload["queueId"] ?? "");
        const { error } = await supabase
          .from("queues" as never)
          .update({ status: "no_show" } as never)
          .eq("id", queueId)
          .eq("clinic_id", clinicId);
        if (error) throw error;
      }

      if (record.kind === "queue_call" || record.kind === "queue_repeat_call") {
        const queueId = String(record.payload["queueId"] ?? "");
        const displayName = String(record.payload["displayName"] ?? "Paciente");
        const roomName = String(record.payload["roomName"] ?? "Recepção");

        const { error: queueError } = await supabase
          .from("queues" as never)
          .update({ status: "called_service", called_at: new Date().toISOString() } as never)
          .eq("id", queueId)
          .eq("clinic_id", clinicId);
        if (queueError) throw queueError;

        const { error: callError } = await supabase.from("calls" as never).insert({
          clinic_id: clinicId,
          queue_id: queueId,
          display_name: displayName,
          room_name: roomName,
          called_at: new Date().toISOString(),
        } as never);
        if (callError) throw callError;
      }

      if (record.kind === "patient_quick_create") {
        const fullName = String(record.payload["fullName"] ?? "Paciente Offline");
        const phone = String(record.payload["phone"] ?? "");
        const localRef = String(record.payload["localRef"] ?? "");
        const { error } = await supabase.from("patients" as never).insert({
          clinic_id: clinicId,
          full_name: fullName,
          phone: phone || null,
          notes: localRef ? `offline-ref:${localRef}` : null,
          active: true,
        } as never);
        if (error) throw error;
      }

      if (record.kind === "ticket_issue") {
        const token = String(record.payload["kioskToken"] ?? "");
        const priority = Boolean(record.payload["priority"] ?? false);
        const reason = String(record.payload["priorityReason"] ?? "");
        const { data, error } = await supabase.rpc(
          "issue_ticket_by_token" as never,
          {
            _token: token,
            _priority: priority,
            _priority_reason: reason || null,
          } as never,
        );
        if (error) throw error;

        const ok = (data as { ok?: boolean } | null)?.ok;
        if (!ok) throw new Error("Falha ao emitir senha no replay offline.");
      }

      if (record.kind === "print_ticket") {
        // Print replay currently marks as synced; the UI should request a new print after reconnection.
      }
    } catch (error) {
      status = attempts >= 3 ? "conflict" : "pending";
      conflictDetails = error instanceof Error ? error.message : "Falha na sincronização";
      lastError = conflictDetails;
    }

    const updated: PendingOperation = {
      ...record,
      status,
      syncedAt: new Date().toISOString(),
      attempts,
      ...(status === "pending"
        ? {
            nextRetryAt: new Date(Date.now() + Math.min(60_000, 5_000 * attempts)).toISOString(),
          }
        : {}),
      ...(lastError ? { lastError } : {}),
      ...(conflictDetails ? { conflictDetails } : {}),
    };

    await persistOperation(updated);
    await recordSyncLog(updated);
    results.push(updated);
  }

  return results;
}

async function persistOperation(record: PendingOperation) {
  const db = await getDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function recordSyncLog(record: PendingOperation) {
  await supabase.from("contingency_sync_logs" as never).insert({
    clinic_id: record.clinicId,
    operation_type: record.kind,
    local_operation_id: record.id,
    status: record.status,
    conflict_details: record.conflictDetails ? { message: record.conflictDetails } : null,
  } as never);
}
