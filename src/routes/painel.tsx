import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useState } from "react";

import { LoadingState } from "@/components/common/States";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useAuth";
import { useRealtime } from "@/hooks/useRealtime";
import { formatTime, speak } from "@/lib/queue";
import { listRecentCalls } from "@/services/calls";

export const Route = createFileRoute("/painel")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Painel de chamadas — ClinicFlow" },
      {
        name: "description",
        content: "Painel de chamadas para a sala de espera: paciente chamado, profissional e sala em tempo real.",
      },
      { property: "og:title", content: "Painel de chamadas — ClinicFlow" },
      { property: "og:description", content: "Exiba chamadas de pacientes na TV da recepção em tempo real." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DisplayPanel,
});

function DisplayPanel() {
  const { data: profile, isLoading } = useProfile();
  const clinicId = profile?.clinic_id;
  const [sound, setSound] = useState(true);
  const [lastSpoken, setLastSpoken] = useState<string | null>(null);

  useRealtime(["calls"], ["panel-calls"], clinicId);

  const { data } = useQuery({
    queryKey: ["panel-calls", clinicId],
    enabled: Boolean(clinicId),
    refetchInterval: 15000,
    queryFn: () => listRecentCalls(clinicId!, 6),
  });

  const current = data?.[0];
  const previous = (data ?? []).slice(1, 5);

  useEffect(() => {
    if (!current || !sound || current.id === lastSpoken || profile?.clinics?.voice_enabled === false) return;
    setLastSpoken(current.id);
    speak(
      `${current.display_name}, ${current.room_name ? `sala ${current.room_name}` : "dirija-se à recepção"}`,
    );
  }, [current, sound, lastSpoken, profile?.clinics?.voice_enabled]);

  if (isLoading) return <LoadingState label="Carregando painel..." />;

  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-primary p-6 text-primary-foreground">
        <div className="max-w-md text-center">
          <h1 className="text-3xl font-bold">Painel de chamadas</h1>
          <p className="mt-3 opacity-90">
            Entre com o usuário da clínica neste dispositivo para exibir as chamadas na sala de espera.
          </p>
          <Button asChild variant="secondary" className="mt-6">
            <Link to="/auth">Entrar</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-primary px-4 py-6 text-primary-foreground sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-widest opacity-75">{profile.clinics?.name ?? "Clínica"}</p>
          <h1 className="text-2xl font-bold sm:text-3xl">Painel de chamadas</h1>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setSound((value) => !value)}
          aria-label={sound ? "Desativar som" : "Ativar som"}
        >
          {sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          {sound ? "Som ligado" : "Som desligado"}
        </Button>
      </header>

      <section className="mt-6 rounded-3xl bg-primary-foreground/10 p-6 text-center sm:p-12">
        {current ? (
          <>
            <p className="text-sm uppercase tracking-[0.3em] opacity-80">Chamando agora</p>
            <p className="mt-4 text-4xl font-black leading-tight sm:text-7xl">{current.display_name}</p>
            <p className="mt-6 text-2xl font-semibold sm:text-4xl">
              {current.room_name ? `Sala ${current.room_name}` : "Recepção"}
            </p>
            <p className="mt-2 text-lg opacity-85 sm:text-2xl">
              {current.professional_name ?? "Equipe de atendimento"} · {formatTime(current.called_at)}
            </p>
          </>
        ) : (
          <>
            <p className="text-2xl font-semibold sm:text-4xl">Aguardando chamadas</p>
            <p className="mt-3 opacity-85">As chamadas aparecem aqui automaticamente.</p>
          </>
        )}
      </section>

      {previous.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-sm uppercase tracking-[0.2em] opacity-75">Chamadas anteriores</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {previous.map((call) => (
              <div key={call.id} className="rounded-2xl bg-primary-foreground/10 p-4">
                <p className="text-xl font-bold">{call.display_name}</p>
                <p className="mt-1 text-sm opacity-85">
                  {call.room_name ?? "Recepção"} · {formatTime(call.called_at)}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <p className="mt-8 text-center text-xs opacity-70">
        Por privacidade, exibimos apenas o primeiro nome e a inicial do sobrenome do paciente.
      </p>
    </main>
  );
}
