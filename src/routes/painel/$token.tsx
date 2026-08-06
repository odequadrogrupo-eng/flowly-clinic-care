import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { useRealtime } from "@/hooks/useRealtime";
import { formatPanelDestination } from "@/lib/panel-display";
import { formatTime } from "@/lib/queue";
import { supabase } from "@/integrations/supabase/client";
import { ClinicLogo } from "@/components/common/ClinicLogo";
import { formatPanelDisplayName, listRecentCalls } from "@/services/calls";

export const Route = createFileRoute("/painel/$token")({
  component: PublicPanelPage,
  ssr: false,
  head: () => ({
    meta: [{ title: "Painel público — ClinicFlow" }, { name: "robots", content: "noindex" }],
  }),
});

function PublicPanelPage() {
  const { token } = Route.useParams();
  const [clock, setClock] = useState(new Date());

  const configQuery = useQuery({
    queryKey: ["public-panel-config", token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("panel_settings" as never)
        .select(
          "clinic_id, enabled, panel_title, current_call_label, previous_calls_label, privacy_message, show_mode, show_ticket, show_patient_name, show_professional, show_called_time, show_destination, show_room, show_desk, show_office, show_priority, room_label, desk_label, office_label, reception_label, show_clock, show_latest_calls, latest_calls_limit" as never,
        )
        .eq("public_token", token)
        .single();
      if (error) throw error;
      return data as {
        clinic_id: string;
        enabled: boolean;
        panel_title: string;
        current_call_label: string;
        previous_calls_label: string;
        privacy_message: string;
        show_mode: "ticket_only" | "first_name" | "name_abbreviated";
        show_ticket: boolean;
        show_patient_name: boolean;
        show_professional: boolean;
        show_called_time: boolean;
        show_destination: boolean;
        show_room: boolean;
        show_desk: boolean;
        show_office: boolean;
        show_priority: boolean;
        room_label: string;
        desk_label: string;
        office_label: string;
        reception_label: string;
        show_clock: boolean;
        show_latest_calls: boolean;
        latest_calls_limit: number;
      };
    },
  });

  const clinicId = configQuery.data?.clinic_id;
  useRealtime(["calls"], ["public-panel-calls"], clinicId);

  const clinicQuery = useQuery({
    queryKey: ["public-panel-clinic", clinicId],
    enabled: Boolean(clinicId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinics")
        .select("name, logo_url")
        .eq("id", clinicId!)
        .single();
      if (error) throw error;
      return data as { name: string; logo_url: string | null };
    },
  });

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const callsQuery = useQuery({
    queryKey: ["public-panel-calls", clinicId],
    enabled: Boolean(clinicId) && configQuery.data?.enabled === true,
    queryFn: () =>
      listRecentCalls(clinicId!, Math.max(2, configQuery.data?.latest_calls_limit ?? 6)),
  });

  if (configQuery.isLoading || callsQuery.isLoading || clinicQuery.isLoading) {
    return <main className="grid min-h-screen place-items-center">Carregando painel...</main>;
  }
  if (!configQuery.data?.enabled)
    return <main className="grid min-h-screen place-items-center">Painel indisponível.</main>;

  const current = callsQuery.data?.[0];
  const previous = (callsQuery.data ?? []).slice(1, 6);

  return (
    <main className="min-h-screen bg-primary px-4 py-6 text-primary-foreground sm:px-8">
      <header className="text-center">
        <div className="mb-3 flex justify-center">
          <ClinicLogo
            src={clinicQuery.data?.logo_url ?? null}
            alt={clinicQuery.data?.name ?? "ClinicFlow"}
            fallbackText={clinicQuery.data?.name ?? "ClinicFlow"}
            className="h-16 w-44 border-primary-foreground/30 bg-white"
            imgClassName="h-12"
          />
        </div>
        <h1 className="text-2xl font-bold sm:text-4xl">
          {configQuery.data.panel_title ?? "Painel de chamadas"}
        </h1>
        {configQuery.data.show_clock ? (
          <p className="mt-2 text-sm opacity-80">{clock.toLocaleTimeString("pt-BR")}</p>
        ) : null}
      </header>

      <section className="mt-6 rounded-3xl bg-primary-foreground/10 p-6 text-center sm:p-12">
        {current ? (
          <>
            <p className="text-sm uppercase tracking-[0.3em] opacity-80">
              {configQuery.data.current_call_label ?? "Chamando agora"}
            </p>
            {configQuery.data.show_ticket !== false ? (
              <p className="mt-3 text-5xl font-black leading-tight sm:text-8xl">
                {current.ticket_code ?? "-"}
              </p>
            ) : null}
            {configQuery.data.show_patient_name !== false ? (
              <p className="mt-3 text-3xl font-bold leading-tight sm:text-5xl">
                {formatPanelDisplayName(current, configQuery.data.show_mode)}
              </p>
            ) : null}
            {configQuery.data.show_destination !== false ? (
              <p className="mt-6 text-2xl font-semibold sm:text-4xl">
                {formatPanelDestination(current.room_name, {
                  roomLabel: configQuery.data.room_label,
                  deskLabel: configQuery.data.desk_label,
                  officeLabel: configQuery.data.office_label,
                  receptionLabel: configQuery.data.reception_label,
                })}
              </p>
            ) : null}
            {configQuery.data.show_called_time !== false ? (
              <p className="mt-2 text-lg opacity-85 sm:text-2xl">{formatTime(current.called_at)}</p>
            ) : null}
          </>
        ) : (
          <p className="text-2xl font-semibold sm:text-4xl">Aguardando chamadas</p>
        )}
      </section>

      {configQuery.data.show_latest_calls && previous.length > 0 ? (
        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {previous.map((call) => (
            <div key={call.id} className="rounded-2xl bg-primary-foreground/10 p-4">
              {configQuery.data.show_ticket !== false ? (
                <p className="text-xl font-black">{call.ticket_code ?? "-"}</p>
              ) : null}
              {configQuery.data.show_patient_name !== false ? (
                <p className="text-lg font-bold">
                  {formatPanelDisplayName(call, configQuery.data.show_mode)}
                </p>
              ) : null}
              {configQuery.data.show_destination !== false ? (
                <p className="mt-1 text-sm opacity-85">
                  {formatPanelDestination(call.room_name, {
                    roomLabel: configQuery.data.room_label,
                    deskLabel: configQuery.data.desk_label,
                    officeLabel: configQuery.data.office_label,
                    receptionLabel: configQuery.data.reception_label,
                  })}
                </p>
              ) : null}
              {configQuery.data.show_called_time !== false ? (
                <p className="mt-1 text-sm opacity-85">{formatTime(call.called_at)}</p>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      <p className="mt-8 text-center text-xs opacity-70">
        {configQuery.data.privacy_message ??
          "Por privacidade, exibimos apenas o primeiro nome e a inicial do sobrenome do paciente."}
      </p>
    </main>
  );
}
