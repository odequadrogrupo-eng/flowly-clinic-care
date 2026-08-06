import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { useRealtime } from "@/hooks/useRealtime";
import { formatTime } from "@/lib/queue";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/painel/$token")({
  component: PublicPanelPage,
  ssr: false,
  head: () => ({
    meta: [{ title: "Painel público — ClinicFlow" }, { name: "robots", content: "noindex" }],
  }),
});

type PublicCallRow = {
  id: string;
  display_name: string;
  professional_name: string | null;
  room_name: string | null;
  called_at: string;
};

function PublicPanelPage() {
  const { token } = Route.useParams();

  const configQuery = useQuery({
    queryKey: ["public-panel-config", token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("panel_settings" as never)
        .select("clinic_id, enabled, show_mode, show_destination" as never)
        .eq("public_token", token)
        .single();
      if (error) throw error;
      return data as { clinic_id: string; enabled: boolean; show_mode: "ticket_only" | "first_name" | "name_abbreviated"; show_destination: boolean };
    },
  });

  const clinicId = configQuery.data?.clinic_id;
  useRealtime(["calls"], ["public-panel-calls"], clinicId);

  const callsQuery = useQuery({
    queryKey: ["public-panel-calls", clinicId],
    enabled: Boolean(clinicId) && configQuery.data?.enabled === true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calls")
        .select("id, display_name, professional_name, room_name, called_at")
        .eq("clinic_id", clinicId!)
        .order("called_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return (data ?? []) as PublicCallRow[];
    },
  });

  if (configQuery.isLoading || callsQuery.isLoading) return <main className="grid min-h-screen place-items-center">Carregando painel...</main>;
  if (!configQuery.data?.enabled) return <main className="grid min-h-screen place-items-center">Painel indisponível.</main>;

  const current = callsQuery.data?.[0];
  const previous = (callsQuery.data ?? []).slice(1, 6);

  return (
    <main className="min-h-screen bg-primary px-4 py-6 text-primary-foreground sm:px-8">
      <header className="text-center">
        <h1 className="text-2xl font-bold sm:text-4xl">Painel de chamadas</h1>
      </header>

      <section className="mt-6 rounded-3xl bg-primary-foreground/10 p-6 text-center sm:p-12">
        {current ? (
          <>
            <p className="text-sm uppercase tracking-[0.3em] opacity-80">Chamando agora</p>
            <p className="mt-4 text-4xl font-black leading-tight sm:text-7xl">{current.display_name}</p>
            <p className="mt-6 text-2xl font-semibold sm:text-4xl">
              {configQuery.data.show_destination ? (current.room_name ? `Sala ${current.room_name}` : "Recepção") : ""}
            </p>
            <p className="mt-2 text-lg opacity-85 sm:text-2xl">{formatTime(current.called_at)}</p>
          </>
        ) : (
          <p className="text-2xl font-semibold sm:text-4xl">Aguardando chamadas</p>
        )}
      </section>

      {previous.length > 0 ? (
        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {previous.map((call) => (
            <div key={call.id} className="rounded-2xl bg-primary-foreground/10 p-4">
              <p className="text-lg font-bold">{call.display_name}</p>
              <p className="mt-1 text-sm opacity-85">{formatTime(call.called_at)}</p>
            </div>
          ))}
        </section>
      ) : null}
    </main>
  );
}
