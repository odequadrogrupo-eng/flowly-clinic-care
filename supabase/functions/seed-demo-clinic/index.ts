import { corsHeaders } from "../_shared/cors.ts";
import {
  assertAdmin,
  createOrUpdateDemoUsers,
  DEMO_BATCH,
  runTenantIsolationValidation,
  seedDemoDataset,
} from "../_shared/demo.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");

  try {
    const admin = await assertAdmin(authHeader);

    const runStart = await admin.serviceClient
      .from("demo_seed_runs" as never)
      .insert({
        clinic_id: admin.clinicId,
        triggered_by: admin.userId,
        action: "seed",
        status: "running",
        demo_batch_id: DEMO_BATCH,
        summary: { started_by: admin.fullName },
      } as never)
      .select("id")
      .single();

    if (runStart.error) throw runStart.error;
    const runId = (runStart.data as { id: string }).id;

    const summary = await seedDemoDataset(admin.serviceClient);
    const usersResult = await createOrUpdateDemoUsers(
      admin.serviceClient,
      summary.clinicId,
      admin.userId,
    );
    summary.usersCreated = usersResult.created;
    summary.usersUpdated = usersResult.updated;

    const tenantValidation = await runTenantIsolationValidation(
      admin.serviceClient,
      admin.authClient,
      summary.clinicId,
    );
    summary.tenantValidation = tenantValidation;

    await admin.serviceClient.from("audit_logs").insert({
      clinic_id: summary.clinicId,
      user_id: admin.userId,
      action: "seed_demo",
      entity: "demo_seed_runs",
      entity_id: runId,
      details: {
        batch_id: DEMO_BATCH,
        users_created: usersResult.created,
        users_updated: usersResult.updated,
      },
      is_demo: true,
      demo_batch_id: DEMO_BATCH,
    });

    await admin.serviceClient
      .from("demo_seed_runs" as never)
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        summary,
      } as never)
      .eq("id", runId);

    return new Response(JSON.stringify({ ok: true, runId, summary }), {
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
