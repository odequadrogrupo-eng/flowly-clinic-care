import { corsHeaders } from "../_shared/cors.ts";
import {
  assertAdmin,
  DEMO_BATCH,
  resetDemoDataset,
  seedDemoDataset,
  createOrUpdateDemoUsers,
} from "../_shared/demo.ts";

const REQUIRED_CONFIRM_A = "RECRIAR CLUB MEDICO";
const REQUIRED_CONFIRM_B = "APAGAR SOMENTE DEMO";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");

  try {
    const body = await req.json().catch(() => ({}) as Record<string, unknown>);
    const confirmA = String(body.confirmA ?? "");
    const confirmB = String(body.confirmB ?? "");
    const recreate = Boolean(body.recreate ?? true);

    if (confirmA !== REQUIRED_CONFIRM_A || confirmB !== REQUIRED_CONFIRM_B) {
      throw new Error("Double confirmation failed.");
    }

    const admin = await assertAdmin(authHeader);

    const runStart = await admin.serviceClient
      .from("demo_seed_runs" as never)
      .insert({
        clinic_id: admin.clinicId,
        triggered_by: admin.userId,
        action: "reset",
        status: "running",
        demo_batch_id: DEMO_BATCH,
        summary: { recreate },
      } as never)
      .select("id")
      .single();

    if (runStart.error) throw runStart.error;
    const runId = (runStart.data as { id: string }).id;

    const resetResult = await resetDemoDataset(admin.serviceClient);
    let recreated = null;

    if (recreate) {
      const seeded = await seedDemoDataset(admin.serviceClient);
      const usersResult = await createOrUpdateDemoUsers(
        admin.serviceClient,
        seeded.clinicId,
        admin.userId,
      );
      seeded.usersCreated = usersResult.created;
      seeded.usersUpdated = usersResult.updated;
      recreated = seeded;
    }

    await admin.serviceClient.from("audit_logs").insert({
      clinic_id: resetResult.clinicId,
      user_id: admin.userId,
      action: "reset_demo",
      entity: "demo_seed_runs",
      entity_id: runId,
      details: { reset: resetResult, recreated: Boolean(recreate) },
      is_demo: true,
      demo_batch_id: DEMO_BATCH,
    });

    await admin.serviceClient
      .from("demo_seed_runs" as never)
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        summary: { reset: resetResult, recreated },
      } as never)
      .eq("id", runId);

    return new Response(JSON.stringify({ ok: true, runId, reset: resetResult, recreated }), {
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 400,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
