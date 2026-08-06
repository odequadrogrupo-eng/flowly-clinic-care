import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

export const DEMO_BATCH = "club-medico-demo-v2";
export const CLUB_LOGO_PATH = "/brands/club-medico/logo.png";

export type SeedSummary = {
  clinic: "created" | "updated";
  usersCreated: number;
  usersUpdated: number;
  doctorsCreated: number;
  patientsCreated: number;
  ticketsCreated: number;
  queuesCreated: number;
  callsCreated: number;
  appointmentsCreated: number;
  tenantValidation: {
    secondClinicCreated: boolean;
    checks: Array<{ table: string; passed: boolean; details: string }>;
  };
  errors: string[];
  clinicId: string;
  batchId: string;
  totemToken?: string;
  panelToken?: string;
};

export function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export function createClients(authHeader?: string) {
  const url = requireEnv("SUPABASE_URL");
  const anon = requireEnv("SUPABASE_ANON_KEY");
  const service = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const authClient = createClient(url, anon, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const serviceClient = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return { authClient, serviceClient, url, anon };
}

export async function assertAdmin(authHeader: string | null) {
  if (!authHeader) {
    throw new Error("Missing Authorization header");
  }

  const { authClient, serviceClient } = createClients(authHeader);
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: userData, error: userError } = await authClient.auth.getUser(token);

  if (userError || !userData.user) {
    throw new Error("Invalid or expired session token");
  }

  const { data: profile, error: profileError } = await serviceClient
    .from("profiles" as never)
    .select("id, clinic_id, role, active, full_name" as never)
    .eq("id", userData.user.id)
    .single();

  if (profileError || !profile) {
    throw new Error("Admin profile not found");
  }

  const typed = profile as {
    id: string;
    clinic_id: string | null;
    role: string;
    active: boolean;
    full_name: string | null;
  };

  if (!typed.active || (typed.role !== "admin" && typed.role !== "superadmin")) {
    throw new Error("Access denied. Admin or superadmin role required.");
  }

  return {
    userId: typed.id,
    clinicId: typed.clinic_id,
    fullName: typed.full_name ?? "Administrador",
    serviceClient,
    authClient,
  };
}

function randomPhone(index: number) {
  const n = String(1000 + index).slice(-4);
  return `(34) 991${n.slice(0, 2)}-${n.slice(2)}`;
}

function fakeCpf(index: number) {
  return `9000000${String(index).padStart(4, "0")}`;
}

async function ensureClinic(serviceClient: ReturnType<typeof createClient>) {
  const payload = {
    name: "Club Médico",
    legal_name: "Club Médico Unidade Sacramento Ltda.",
    document: "12.345.678/0001-90",
    phone: "(34) 3333-2026",
    whatsapp: "(34) 99999-2026",
    email: "contato@clubmedico.teste",
    address: "Avenida Sacramento, 1000",
    district: "Centro",
    city: "Sacramento",
    state: "Minas Gerais",
    zip_code: "38190-000",
    opening_hours: "segunda a sexta, das 08:00 às 18:00",
    timezone: "America/Sao_Paulo",
    status: "active",
    plan: "demo",
    voice_enabled: true,
    logo_url: CLUB_LOGO_PATH,
    is_demo: true,
    demo_batch_id: DEMO_BATCH,
  };

  const { data: existing } = await serviceClient
    .from("clinics")
    .select("id")
    .eq("email", "contato@clubmedico.teste")
    .maybeSingle();

  if (existing) {
    const { error } = await serviceClient
      .from("clinics")
      .update(payload)
      .eq("id", (existing as { id: string }).id);
    if (error) throw error;
    return { clinicId: (existing as { id: string }).id, status: "updated" as const };
  }

  const { data: created, error } = await serviceClient
    .from("clinics")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw error;
  return { clinicId: (created as { id: string }).id, status: "created" as const };
}

async function upsertByName(
  serviceClient: ReturnType<typeof createClient>,
  table: string,
  clinicId: string,
  rows: Array<Record<string, unknown>>,
) {
  for (const row of rows) {
    const name = String(row.name ?? "");
    const { data: existing } = await serviceClient
      .from(table as never)
      .select("id" as never)
      .eq("clinic_id", clinicId)
      .eq("name", name)
      .maybeSingle();

    if (existing) {
      await serviceClient
        .from(table as never)
        .update(row as never)
        .eq("id", (existing as { id: string }).id);
    } else {
      await serviceClient.from(table as never).insert({ ...row, clinic_id: clinicId } as never);
    }
  }
}

export async function seedDemoDataset(serviceClient: ReturnType<typeof createClient>) {
  const summary: SeedSummary = {
    clinic: "updated",
    usersCreated: 0,
    usersUpdated: 0,
    doctorsCreated: 0,
    patientsCreated: 0,
    ticketsCreated: 0,
    queuesCreated: 0,
    callsCreated: 0,
    appointmentsCreated: 0,
    tenantValidation: { secondClinicCreated: false, checks: [] },
    errors: [],
    clinicId: "",
    batchId: DEMO_BATCH,
  };

  const clinic = await ensureClinic(serviceClient);
  summary.clinic = clinic.status;
  summary.clinicId = clinic.clinicId;

  const roomRows = Array.from({ length: 7 }, (_, idx) => ({
    name: `Sala ${idx + 1}`,
    number: String(idx + 1),
    sector: "Atendimento",
    active: true,
    is_demo: true,
    demo_batch_id: DEMO_BATCH,
  }));

  const receptionRows = Array.from({ length: 3 }, (_, idx) => ({
    name: `Guichê ${idx + 1}`,
    location: "Recepção",
    active: true,
    is_demo: true,
    demo_batch_id: DEMO_BATCH,
  }));

  const specialties = [
    "Cardiologia",
    "Clínica Geral",
    "Pediatria",
    "Ortopedia",
    "Dermatologia",
    "Neurologia",
    "Ginecologia",
    "Endocrinologia",
    "Otorrino",
    "Urologia",
    "Oftalmologia",
  ];

  await upsertByName(serviceClient, "rooms", clinic.clinicId, roomRows);
  await upsertByName(serviceClient, "receptions", clinic.clinicId, receptionRows);
  await upsertByName(
    serviceClient,
    "specialties",
    clinic.clinicId,
    specialties.map((name) => ({ name, active: true, is_demo: true, demo_batch_id: DEMO_BATCH })),
  );

  const doctors = [
    ["Dra. Ana Martins", "Cardiologia", "CRM/MG 123456", "ana.martins@clubmedico.teste"],
    ["Dr. Bruno Lima", "Clínica Geral", "CRM/MG 234567", "bruno.lima@clubmedico.teste"],
    ["Dra. Carla Souza", "Pediatria", "CRM/MG 345678", "carla.souza@clubmedico.teste"],
    ["Dr. Diego Alves", "Ortopedia", "CRM/MG 456789", "diego.alves@clubmedico.teste"],
    ["Dra. Elisa Rocha", "Dermatologia", "CRM/MG 567890", "elisa.rocha@clubmedico.teste"],
    ["Dr. Fabio Nunes", "Neurologia", "CRM/MG 678901", "fabio.nunes@clubmedico.teste"],
    ["Dra. Gabriela Prado", "Ginecologia", "CRM/MG 789012", "gabriela.prado@clubmedico.teste"],
    ["Dr. Henrique Melo", "Endocrinologia", "CRM/MG 890123", "henrique.melo@clubmedico.teste"],
    ["Dra. Isabela Fonseca", "Otorrino", "CRM/MG 901234", "isabela.fonseca@clubmedico.teste"],
    ["Dr. João Castro", "Urologia", "CRM/MG 012345", "joao.castro@clubmedico.teste"],
    ["Dra. Karina Bastos", "Oftalmologia", "CRM/MG 112233", "karina.bastos@clubmedico.teste"],
  ];

  const roomList = await serviceClient
    .from("rooms")
    .select("id, name")
    .eq("clinic_id", clinic.clinicId)
    .order("name", { ascending: true });

  const rooms = (roomList.data ?? []) as Array<{ id: string; name: string }>;

  for (let i = 0; i < doctors.length; i += 1) {
    const [full_name, specialty, professional_registration, email] = doctors[i] as [
      string,
      string,
      string,
      string,
    ];
    const { data: existing } = await serviceClient
      .from("professionals")
      .select("id")
      .eq("clinic_id", clinic.clinicId)
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      await serviceClient
        .from("professionals")
        .update({
          full_name,
          specialty,
          professional_registration,
          room_id: null,
          status: i % 3 === 0 ? "busy" : i % 5 === 0 ? "away" : "available",
          active: true,
          is_demo: true,
          demo_batch_id: DEMO_BATCH,
        })
        .eq("id", (existing as { id: string }).id);
    } else {
      await serviceClient.from("professionals").insert({
        clinic_id: clinic.clinicId,
        full_name,
        specialty,
        professional_registration,
        email,
        room_id: null,
        status: i % 3 === 0 ? "busy" : i % 5 === 0 ? "away" : "available",
        active: true,
        is_demo: true,
        demo_batch_id: DEMO_BATCH,
      });
      summary.doctorsCreated += 1;
    }
  }

  const professionals = ((
    await serviceClient
      .from("professionals")
      .select("id, full_name")
      .eq("clinic_id", clinic.clinicId)
      .order("full_name")
  ).data ?? []) as Array<{ id: string; full_name: string }>;

  // Shift scale for today
  const today = new Date();
  const dayStr = today.toISOString().slice(0, 10);
  for (let i = 0; i < professionals.length; i += 1) {
    const p = professionals[i];
    const room = rooms[i % rooms.length];
    const start = i % 2 === 0 ? "08:00" : "13:00";
    const end = i % 2 === 0 ? "12:00" : "18:00";

    const { data: existing } = await serviceClient
      .from("doctor_room_shifts" as never)
      .select("id" as never)
      .eq("clinic_id", clinic.clinicId)
      .eq("professional_id", p.id)
      .eq("room_id", room.id)
      .eq("shift_date", dayStr)
      .eq("start_time", `${start}:00`)
      .eq("end_time", `${end}:00`)
      .maybeSingle();

    if (!existing) {
      await serviceClient.from("doctor_room_shifts" as never).insert({
        clinic_id: clinic.clinicId,
        professional_id: p.id,
        room_id: room.id,
        shift_date: dayStr,
        start_time: `${start}:00`,
        end_time: `${end}:00`,
        is_demo: true,
        demo_batch_id: DEMO_BATCH,
      } as never);
    }
  }

  // Patients
  const patientCount = 75;
  for (let i = 1; i <= patientCount; i += 1) {
    const cpf = fakeCpf(i);
    const full_name = `Paciente Demo ${String(i).padStart(2, "0")}`;
    const { data: existing } = await serviceClient
      .from("patients")
      .select("id")
      .eq("clinic_id", clinic.clinicId)
      .eq("cpf", cpf)
      .maybeSingle();

    const birthYear = 1948 + (i % 70);
    const birthMonth = 1 + (i % 12);
    const birthDay = 1 + (i % 27);

    const basePayload = {
      clinic_id: clinic.clinicId,
      full_name,
      cpf,
      birth_date: `${birthYear}-${String(birthMonth).padStart(2, "0")}-${String(birthDay).padStart(2, "0")}`,
      phone: randomPhone(i),
      email: `paciente${i}@clubmedico.demo`,
      address: `Rua Demo ${i}, Sacramento/MG`,
      notes:
        i % 11 === 0
          ? "PCD ficticio para teste de prioridade e privacidade"
          : i % 7 === 0
            ? "Gestante ficticia"
            : i % 5 === 0
              ? "Idoso preferencial"
              : "Paciente demo",
      active: true,
      is_demo: true,
      demo_batch_id: DEMO_BATCH,
    };

    if (existing) {
      await serviceClient
        .from("patients")
        .update(basePayload)
        .eq("id", (existing as { id: string }).id);
    } else {
      await serviceClient.from("patients").insert(basePayload);
      summary.patientsCreated += 1;
    }
  }

  const patients = ((
    await serviceClient
      .from("patients")
      .select("id, full_name")
      .eq("clinic_id", clinic.clinicId)
      .order("created_at")
  ).data ?? []) as Array<{ id: string; full_name: string }>;
  const receptions = ((
    await serviceClient
      .from("receptions" as never)
      .select("id, name" as never)
      .eq("clinic_id", clinic.clinicId)
      .order("name", { ascending: true })
  ).data ?? []) as Array<{ id: string; name: string }>;

  // Appointments around current date
  for (let offset = -30; offset <= 15; offset += 1) {
    const date = new Date(today);
    date.setDate(date.getDate() + offset);
    const isoDay = date.toISOString().slice(0, 10);

    for (let i = 0; i < 11; i += 1) {
      const doctor = professionals[i % professionals.length];
      const patient = patients[(offset * 11 + i + patients.length * 2) % patients.length];
      const room = rooms[(i + (offset % rooms.length) + rooms.length) % rooms.length];
      const hour = 8 + (i % 10);
      const scheduledFor = `${isoDay}T${String(hour).padStart(2, "0")}:00:00.000Z`;
      const noteKey = `DEMO_CM_APT_${isoDay}_${i}`;

      const { data: existing } = await serviceClient
        .from("appointments" as never)
        .select("id" as never)
        .eq("clinic_id", clinic.clinicId)
        .eq("notes", noteKey)
        .maybeSingle();

      const statuses = [
        "scheduled",
        "confirmed",
        "commitment",
        "blocked",
        "birthday",
        "holiday",
        "cancelled",
      ];

      const payload = {
        clinic_id: clinic.clinicId,
        patient_id: patient.id,
        professional_id: doctor.id,
        room_id: room.id,
        scheduled_for: scheduledFor,
        duration_minutes: 30,
        status: statuses[Math.abs(offset + i) % statuses.length],
        notes: noteKey,
        internal_notes: "Seed demo Club Medico",
        is_demo: true,
        demo_batch_id: DEMO_BATCH,
      };

      if (existing) {
        await serviceClient
          .from("appointments" as never)
          .update(payload as never)
          .eq("id", (existing as { id: string }).id);
      } else {
        await serviceClient.from("appointments" as never).insert(payload as never);
        summary.appointmentsCreated += 1;
      }
    }
  }

  // Settings
  await serviceClient.from("kiosk_settings" as never).upsert(
    {
      clinic_id: clinic.clinicId,
      name: "Totem Principal Club Médico",
      enabled: true,
      allow_normal: true,
      allow_priority: true,
      normal_prefix: "N",
      priority_prefix: "P",
      custom_text: "Bem-vindo ao Club Médico",
      footer_text: "Aguarde ser chamado no painel",
      logo_url: CLUB_LOGO_PATH,
      paper_size: "80mm",
      print_auto: true,
      qr_enabled: true,
      priority_help_text: "Idoso, gestante, pessoa com deficiência ou mobilidade reduzida",
      kiosk_mode: true,
      is_demo: true,
      demo_batch_id: DEMO_BATCH,
    } as never,
    { onConflict: "clinic_id" },
  );

  await serviceClient.from("panel_settings" as never).upsert(
    {
      clinic_id: clinic.clinicId,
      name: "Painel Principal Club Médico",
      enabled: true,
      show_mode: "ticket_only",
      show_destination: true,
      full_screen: true,
      show_clock: true,
      show_latest_calls: true,
      latest_calls_limit: 5,
      voice_enabled: true,
      voice_volume: 0.8,
      voice_rate: 1.0,
      voice_pitch: 1.0,
      voice_repeat_count: 2,
      voice_repeat_interval_seconds: 2,
      sound_enabled: true,
      phrase_template: "Senha {{ticket}}, dirigir-se à {{destination}}.",
      is_demo: true,
      demo_batch_id: DEMO_BATCH,
    } as never,
    { onConflict: "clinic_id" },
  );

  await serviceClient.from("print_settings" as never).upsert(
    {
      clinic_id: clinic.clinicId,
      paper_size: "80mm",
      welcome_message: "Seja bem-vindo(a)",
      footer_message: "Aguarde ser chamado",
      qr_enabled: true,
      browser_fallback_enabled: true,
      webusb_enabled: true,
      webserial_enabled: true,
      local_agent_endpoint: "http://127.0.0.1:3311/print",
      is_demo: true,
      demo_batch_id: DEMO_BATCH,
    } as never,
    { onConflict: "clinic_id" },
  );

  // Ensure demo queue/tickets for today
  const requested = [
    ["N", 1, "waiting_reception"],
    ["N", 2, "waiting_reception"],
    ["P", 1, "waiting_reception"],
    ["N", 3, "called_reception"],
    ["P", 2, "waiting_service"],
    ["N", 4, "called_service"],
    ["P", 3, "in_service"],
    ["N", 5, "finished"],
    ["N", 6, "cancelled"],
    ["P", 4, "no_show"],
  ] as Array<[string, number, string]>;

  for (let i = 0; i < requested.length; i += 1) {
    const [prefix, sequence, status] = requested[i];
    const code = `${prefix}-${String(sequence).padStart(3, "0")}`;
    const patient = patients[i % patients.length];
    const doctor = professionals[i % professionals.length];
    const room = rooms[i % rooms.length];

    const queueNote = `DEMO_CM_QUEUE_${code}`;
    const { data: existingQueue } = await serviceClient
      .from("queues")
      .select("id")
      .eq("clinic_id", clinic.clinicId)
      .eq("notes", queueNote)
      .maybeSingle();

    const checkinAt = new Date();
    checkinAt.setMinutes(checkinAt.getMinutes() - (110 - i * 8));

    let queueId: string;
    const queuePayload = {
      clinic_id: clinic.clinicId,
      patient_id: patient.id,
      professional_id: doctor.id,
      room_id: room.id,
      service_type: "Consulta",
      priority: prefix === "P" ? "priority" : "normal",
      status,
      position: Date.now() + i,
      checkin_at: checkinAt.toISOString(),
      called_at: ["called_reception", "called_service", "in_service", "finished"].includes(status)
        ? new Date(checkinAt.getTime() + 8 * 60000).toISOString()
        : null,
      started_at: ["in_service", "finished"].includes(status)
        ? new Date(checkinAt.getTime() + 20 * 60000).toISOString()
        : null,
      finished_at:
        status === "finished" ? new Date(checkinAt.getTime() + 45 * 60000).toISOString() : null,
      cancelled_at:
        status === "cancelled" ? new Date(checkinAt.getTime() + 25 * 60000).toISOString() : null,
      notes: queueNote,
      internal_notes: `Guichê ${(i % 3) + 1}`,
      is_demo: true,
      demo_batch_id: DEMO_BATCH,
    };

    if (existingQueue) {
      queueId = (existingQueue as { id: string }).id;
      await serviceClient.from("queues").update(queuePayload).eq("id", queueId);
    } else {
      const inserted = await serviceClient
        .from("queues")
        .insert(queuePayload)
        .select("id")
        .single();
      queueId = (inserted.data as { id: string }).id;
      summary.queuesCreated += 1;
    }

    const ticketPayload = {
      clinic_id: clinic.clinicId,
      queue_id: queueId,
      patient_id: i === 1 ? null : patient.id,
      code,
      sequence,
      prefix,
      priority: prefix === "P",
      status,
      issued_at: checkinAt.toISOString(),
      called_at: queuePayload.called_at,
      finished_at: queuePayload.finished_at,
      cancelled_at: queuePayload.cancelled_at,
      is_demo: true,
      demo_batch_id: DEMO_BATCH,
    };

    const ticketRes = await serviceClient
      .from("tickets" as never)
      .upsert(ticketPayload as never, { onConflict: "clinic_id,code" })
      .select("id" as never)
      .single();

    if (ticketRes.error) throw ticketRes.error;
    summary.ticketsCreated += 1;
  }

  // Add traffic for a realistic day
  for (let i = 7; i <= 45; i += 1) {
    const prefix = i % 6 === 0 ? "P" : "N";
    const code = `${prefix}-${String(i).padStart(3, "0")}`;
    const patient = patients[i % patients.length];
    const doctor = professionals[i % professionals.length];
    const room = rooms[i % rooms.length];
    const statusCycle = [
      "waiting_reception",
      "called_reception",
      "waiting_service",
      "called_service",
      "in_service",
      "finished",
      "cancelled",
      "no_show",
    ];
    const status = statusCycle[i % statusCycle.length];

    const note = `DEMO_CM_QUEUE_${code}`;
    const checkinAt = new Date();
    checkinAt.setMinutes(checkinAt.getMinutes() - (250 - i * 3));

    const existingQueue = await serviceClient
      .from("queues")
      .select("id")
      .eq("clinic_id", clinic.clinicId)
      .eq("notes", note)
      .maybeSingle();

    let queueId = (existingQueue.data as { id: string } | null)?.id;
    if (!queueId) {
      const inserted = await serviceClient
        .from("queues")
        .insert({
          clinic_id: clinic.clinicId,
          patient_id: patient.id,
          professional_id: doctor.id,
          room_id: room.id,
          service_type: "Consulta",
          priority: prefix === "P" ? "priority" : "normal",
          status,
          position: Date.now() + i,
          checkin_at: checkinAt.toISOString(),
          notes: note,
          internal_notes: `Guichê ${(i % 3) + 1}`,
          is_demo: true,
          demo_batch_id: DEMO_BATCH,
        })
        .select("id")
        .single();

      queueId = (inserted.data as { id: string }).id;
      summary.queuesCreated += 1;
    }

    await serviceClient.from("tickets" as never).upsert(
      {
        clinic_id: clinic.clinicId,
        queue_id: queueId,
        patient_id: patient.id,
        code,
        sequence: i,
        prefix,
        priority: prefix === "P",
        status,
        issued_at: checkinAt.toISOString(),
        is_demo: true,
        demo_batch_id: DEMO_BATCH,
      } as never,
      { onConflict: "clinic_id,code" },
    );
  }

  // Calls (including required two-step panel message for N-015)
  const n015 = await serviceClient
    .from("tickets" as never)
    .select("queue_id, patient_id")
    .eq("clinic_id", clinic.clinicId)
    .eq("code", "N-015")
    .maybeSingle();
  if (n015.data) {
    const queueId = (n015.data as { queue_id: string | null }).queue_id;
    if (queueId) {
      const patientId = (n015.data as { patient_id: string | null }).patient_id;
      const patient = patients.find((p) => p.id === patientId) ?? patients[0];
      const firstDisplay = `${patient.full_name.split(" ")[0]} ${patient.full_name.split(" ").slice(-1)[0]?.charAt(0) ?? ""}.`;

      const calls = [
        {
          clinic_id: clinic.clinicId,
          queue_id: queueId,
          patient_id: patient.id,
          professional_id: null,
          room_id: null,
          display_name: firstDisplay,
          professional_name: null,
          room_name: "Guichê 2",
          called_at: new Date(Date.now() - 10 * 60000).toISOString(),
          is_demo: true,
          demo_batch_id: DEMO_BATCH,
        },
        {
          clinic_id: clinic.clinicId,
          queue_id: queueId,
          patient_id: patient.id,
          professional_id: professionals[3]?.id ?? null,
          room_id: rooms[3]?.id ?? null,
          display_name: firstDisplay,
          professional_name: professionals[3]?.full_name ?? null,
          room_name: "Sala 4",
          called_at: new Date(Date.now() - 3 * 60000).toISOString(),
          is_demo: true,
          demo_batch_id: DEMO_BATCH,
        },
      ];

      for (const call of calls) {
        const exists = await serviceClient
          .from("calls")
          .select("id")
          .eq("clinic_id", clinic.clinicId)
          .eq("queue_id", queueId)
          .eq("room_name", call.room_name)
          .gte("called_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
          .limit(1);

        if ((exists.data ?? []).length === 0) {
          await serviceClient.from("calls").insert(call);
          summary.callsCreated += 1;
        }
      }
    }
  }

  // Additional call history
  const recentTickets = ((
    await serviceClient
      .from("tickets" as never)
      .select("queue_id, patient_id, code")
      .eq("clinic_id", clinic.clinicId)
      .order("issued_at", { ascending: false })
      .limit(20)
  ).data ?? []) as Array<{ queue_id: string | null; patient_id: string | null; code: string }>;
  for (let i = 0; i < Math.min(5, recentTickets.length); i += 1) {
    const t = recentTickets[i];
    if (!t.queue_id || !t.patient_id) continue;
    const p = patients.find((x) => x.id === t.patient_id) ?? patients[0];
    const roomName = i < rooms.length ? rooms[i].name : "Recepção";

    const exists = await serviceClient
      .from("calls")
      .select("id")
      .eq("clinic_id", clinic.clinicId)
      .eq("queue_id", t.queue_id)
      .eq("room_name", roomName)
      .gte("called_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
      .limit(1);

    if ((exists.data ?? []).length > 0) continue;

    await serviceClient.from("calls").insert({
      clinic_id: clinic.clinicId,
      queue_id: t.queue_id,
      patient_id: t.patient_id,
      professional_id: professionals[i % professionals.length]?.id ?? null,
      room_id: rooms[i % rooms.length]?.id ?? null,
      display_name: `${p.full_name.split(" ")[0]} ${p.full_name.split(" ").slice(-1)[0]?.charAt(0) ?? ""}.`,
      professional_name: professionals[i % professionals.length]?.full_name ?? null,
      room_name: roomName,
      called_at: new Date(Date.now() - (i + 1) * 6 * 60000).toISOString(),
      is_demo: true,
      demo_batch_id: DEMO_BATCH,
    });
    summary.callsCreated += 1;
  }

  const settingsToken = await serviceClient
    .from("kiosk_settings" as never)
    .select("public_token" as never)
    .eq("clinic_id", clinic.clinicId)
    .single();
  summary.totemToken = (settingsToken.data as { public_token: string } | null)?.public_token;
  const panelToken = await serviceClient
    .from("panel_settings" as never)
    .select("public_token" as never)
    .eq("clinic_id", clinic.clinicId)
    .single();
  summary.panelToken = (panelToken.data as { public_token: string } | null)?.public_token;

  return summary;
}

export async function createOrUpdateDemoUsers(
  serviceClient: ReturnType<typeof createClient>,
  clinicId: string,
  _triggeredBy: string,
) {
  const users = [
    ["Administrador Club Médico", "admin@clubmedico.teste", "ClubMedico@2026", "admin"],
    ["Juliana Ferreira", "recepcao@clubmedico.teste", "Recepcao@2026", "receptionist"],
    ["Marcos Oliveira", "atendimento@clubmedico.teste", "Atendimento@2026", "attendant"],
    ["Painel Club Médico", "painel@clubmedico.teste", "Painel@2026", "public_display"],
    ["Dra. Ana Martins", "ana.martins@clubmedico.teste", "AnaMedica@2026", "professional"],
    ["Dr. Bruno Lima", "bruno.lima@clubmedico.teste", "BrunoMedico@2026", "professional"],
    ["Dra. Carla Souza", "carla.souza@clubmedico.teste", "CarlaMedica@2026", "professional"],
    ["Dr. Diego Alves", "diego.alves@clubmedico.teste", "DiegoMedico@2026", "professional"],
    ["Dra. Elisa Rocha", "elisa.rocha@clubmedico.teste", "ElisaMedica@2026", "professional"],
    ["Dr. Fabio Nunes", "fabio.nunes@clubmedico.teste", "FabioMedico@2026", "professional"],
    [
      "Dra. Gabriela Prado",
      "gabriela.prado@clubmedico.teste",
      "GabrielaMedica@2026",
      "professional",
    ],
    ["Dr. Henrique Melo", "henrique.melo@clubmedico.teste", "HenriqueMedico@2026", "professional"],
    [
      "Dra. Isabela Fonseca",
      "isabela.fonseca@clubmedico.teste",
      "IsabelaMedica@2026",
      "professional",
    ],
    ["Dr. João Castro", "joao.castro@clubmedico.teste", "JoaoMedico@2026", "professional"],
    ["Dra. Karina Bastos", "karina.bastos@clubmedico.teste", "KarinaMedica@2026", "professional"],
  ] as Array<[string, string, string, string]>;

  const listed = await serviceClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listed.error) throw listed.error;
  const byEmail = new Map((listed.data.users ?? []).map((u) => [u.email?.toLowerCase(), u]));

  let created = 0;
  let updated = 0;
  const doctorProfileByEmail = new Map<string, string>();

  for (const [name, email, password, role] of users) {
    const found = byEmail.get(email.toLowerCase());
    let userId: string;

    if (!found) {
      const createdUser = await serviceClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name, demo_seed: DEMO_BATCH },
      });
      if (createdUser.error) throw createdUser.error;
      userId = createdUser.data.user.id;
      created += 1;
    } else {
      userId = found.id;
      const updateUser = await serviceClient.auth.admin.updateUserById(userId, {
        password,
        email,
        user_metadata: { full_name: name, demo_seed: DEMO_BATCH },
      });
      if (updateUser.error) throw updateUser.error;
      updated += 1;
    }

    await serviceClient.from("profiles" as never).upsert(
      {
        id: userId,
        clinic_id: clinicId,
        full_name: name,
        email,
        role,
        active: true,
        force_password_change: true,
        temp_password_issued_at: new Date().toISOString(),
        is_demo: true,
        demo_batch_id: DEMO_BATCH,
      } as never,
      { onConflict: "id" },
    );

    if (role === "professional") {
      doctorProfileByEmail.set(email.toLowerCase(), userId);
    }
  }

  const professionals = await serviceClient
    .from("professionals")
    .select("id, email")
    .eq("clinic_id", clinicId)
    .not("email", "is", null);

  for (const professional of (professionals.data ?? []) as Array<{
    id: string;
    email: string | null;
  }>) {
    if (!professional.email) continue;
    const profileId = doctorProfileByEmail.get(professional.email.toLowerCase());
    if (!profileId) continue;
    await serviceClient
      .from("professionals")
      .update({ profile_id: profileId, is_demo: true, demo_batch_id: DEMO_BATCH })
      .eq("id", professional.id);
  }

  const attendants = await serviceClient
    .from("profiles" as never)
    .select("id" as never)
    .eq("clinic_id", clinicId)
    .eq("email", "atendimento@clubmedico.teste")
    .maybeSingle();
  const firstReception = await serviceClient
    .from("receptions" as never)
    .select("id" as never)
    .eq("clinic_id", clinicId)
    .order("name", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (attendants.data?.id) {
    await serviceClient.from("attendants" as never).upsert(
      {
        clinic_id: clinicId,
        profile_id: attendants.data.id,
        reception_id: firstReception.data?.id ?? null,
        display_name: "Marcos Oliveira",
        active: true,
        is_demo: true,
        demo_batch_id: DEMO_BATCH,
      } as never,
      { onConflict: "clinic_id,profile_id" },
    );
  }

  return { created, updated };
}

export async function runTenantIsolationValidation(
  serviceClient: ReturnType<typeof createClient>,
  authClient: ReturnType<typeof createClient>,
  clubClinicId: string,
) {
  const checks: Array<{ table: string; passed: boolean; details: string }> = [];
  let secondClinicCreated = false;

  let secondClinicId: string;
  const secondClinicPayload = {
    name: "Demo Isolamento",
    legal_name: "Demo Isolamento Ltda.",
    email: "contato@isolamento.teste",
    phone: "(34) 3000-2026",
    address: "Rua Isolada, 10",
    opening_hours: "08:00-18:00",
    voice_enabled: false,
    is_demo: true,
    demo_batch_id: DEMO_BATCH,
  };

  const secondExisting = await serviceClient
    .from("clinics")
    .select("id")
    .eq("email", "contato@isolamento.teste")
    .maybeSingle();
  if (secondExisting.data?.id) {
    secondClinicId = secondExisting.data.id;
    await serviceClient.from("clinics").update(secondClinicPayload).eq("id", secondClinicId);
  } else {
    const created = await serviceClient
      .from("clinics")
      .insert(secondClinicPayload)
      .select("id")
      .single();
    if (created.error) throw created.error;
    secondClinicId = (created.data as { id: string }).id;
    secondClinicCreated = true;
  }

  const secondEmail = "isolamento.admin@demo.teste";
  const secondPass = "Isolamento@2026";

  const users = await serviceClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) throw users.error;
  const found = (users.data.users ?? []).find((u) => u.email?.toLowerCase() === secondEmail);

  let secondUserId: string;
  if (!found) {
    const created = await serviceClient.auth.admin.createUser({
      email: secondEmail,
      password: secondPass,
      email_confirm: true,
      user_metadata: { full_name: "Admin Isolamento", demo_seed: DEMO_BATCH },
    });
    if (created.error) throw created.error;
    secondUserId = created.data.user.id;
  } else {
    secondUserId = found.id;
    await serviceClient.auth.admin.updateUserById(secondUserId, {
      password: secondPass,
      user_metadata: { full_name: "Admin Isolamento", demo_seed: DEMO_BATCH },
    });
  }

  await serviceClient.from("profiles" as never).upsert(
    {
      id: secondUserId,
      clinic_id: secondClinicId,
      full_name: "Admin Isolamento",
      email: secondEmail,
      role: "admin",
      active: true,
      is_demo: true,
      demo_batch_id: DEMO_BATCH,
    } as never,
    { onConflict: "id" },
  );

  const signIn = await authClient.auth.signInWithPassword({
    email: secondEmail,
    password: secondPass,
  });
  if (signIn.error || !signIn.data.session) {
    checks.push({
      table: "auth",
      passed: false,
      details: signIn.error?.message ?? "Unable to sign in",
    });
    return { secondClinicCreated, checks };
  }

  const userToken = signIn.data.session.access_token;
  const url = requireEnv("SUPABASE_URL");
  const anon = requireEnv("SUPABASE_ANON_KEY");

  const scoped = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${userToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const tableChecks = ["patients", "professionals", "rooms", "queues", "calls"];
  for (const table of tableChecks) {
    const result = await scoped.from(table).select("id").eq("clinic_id", clubClinicId).limit(1);
    const blocked = (result.data ?? []).length === 0;
    checks.push({
      table,
      passed: blocked,
      details: blocked ? "RLS blocked cross-clinic access" : "Cross-clinic row visible",
    });
  }

  const reportCheck = await scoped
    .from("queues")
    .select("id")
    .eq("clinic_id", clubClinicId)
    .gte("checkin_at", new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString())
    .limit(1);

  checks.push({
    table: "reports",
    passed: (reportCheck.data ?? []).length === 0,
    details:
      (reportCheck.data ?? []).length === 0
        ? "No cross-clinic rows for report query"
        : "Report query leaked rows",
  });

  await authClient.auth.signOut();

  return { secondClinicCreated, checks };
}

export async function resetDemoDataset(serviceClient: ReturnType<typeof createClient>) {
  const clinicRes = await serviceClient
    .from("clinics")
    .select("id")
    .or("email.eq.contato@clubmedico.teste,name.eq.Club Médico,name.eq.Club Medico")
    .limit(1)
    .maybeSingle();

  const clinicId = (clinicRes.data as { id: string } | null)?.id;
  if (!clinicId) {
    return {
      clinicFound: false,
      deleted: {} as Record<string, number>,
      clinicId: null as string | null,
    };
  }

  const deleted: Record<string, number> = {};
  const countDelete = async (table: string, filter: Record<string, unknown>) => {
    const countRes = await serviceClient
      .from(table as never)
      .select("id", { count: "exact", head: true })
      .match(filter as never);
    deleted[table] = countRes.count ?? 0;
    await serviceClient
      .from(table as never)
      .delete()
      .match(filter as never);
  };

  const match = { clinic_id: clinicId, is_demo: true };

  await countDelete("calls", match);
  await countDelete("tickets", match);
  await countDelete("queues", match);
  await countDelete("appointments", match);
  await countDelete("doctor_room_shifts", match);
  await countDelete("attendants", match);
  await countDelete("professionals", match);
  await countDelete("patients", match);
  await countDelete("receptions", match);
  await countDelete("rooms", match);
  await countDelete("specialties", match);
  await countDelete("audit_logs", match);

  await serviceClient
    .from("kiosk_settings" as never)
    .update({ is_demo: false, demo_batch_id: null } as never)
    .eq("clinic_id", clinicId)
    .eq("is_demo", true);
  await serviceClient
    .from("panel_settings" as never)
    .update({ is_demo: false, demo_batch_id: null } as never)
    .eq("clinic_id", clinicId)
    .eq("is_demo", true);
  await serviceClient
    .from("print_settings" as never)
    .update({ is_demo: false, demo_batch_id: null } as never)
    .eq("clinic_id", clinicId)
    .eq("is_demo", true);

  await serviceClient
    .from("profiles" as never)
    .update({ is_demo: false, demo_batch_id: null } as never)
    .eq("clinic_id", clinicId)
    .eq("is_demo", true);

  const authUsers = await serviceClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (!authUsers.error) {
    for (const user of authUsers.data.users ?? []) {
      const email = user.email?.toLowerCase() ?? "";
      const isDemoEmail =
        email.endsWith("@clubmedico.teste") ||
        email.endsWith("@demo.teste") ||
        email.endsWith("@clubmedico.demo");
      if (!isDemoEmail) continue;
      await serviceClient.auth.admin.deleteUser(user.id);
    }
  }

  await serviceClient
    .from("clinics")
    .update({ is_demo: false, demo_batch_id: null })
    .eq("id", clinicId);

  return { clinicFound: true, deleted, clinicId };
}
