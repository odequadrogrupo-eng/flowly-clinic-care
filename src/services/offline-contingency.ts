import { supabase } from "@/integrations/supabase/client";

const DB_NAME = "clinicflow-contingency";
const STORE = "operations";

export type PendingOperation = {
  id: string;
  clinicId: string;
  kind: "ticket_issue" | "queue_call" | "patient_quick_create" | "queue_status" | "print_ticket";
  payload: Record<string, unknown>;
  status: "pending" | "synced" | "conflict" | "failed";
  createdAt: string;
  syncedAt?: string;
  conflictDetails?: string;
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
  const records = (await listPendingOperations()).filter(
    (item) => item.clinicId === clinicId && item.status === "pending",
  );
  const results: PendingOperation[] = [];

  for (const record of records) {
    let status: PendingOperation["status"] = "synced";
    let conflictDetails: string | undefined;

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
    } catch (error) {
      status = "conflict";
      conflictDetails = error instanceof Error ? error.message : "Falha na sincronização";
    }

    const updated: PendingOperation = {
      ...record,
      status,
      syncedAt: new Date().toISOString(),
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
