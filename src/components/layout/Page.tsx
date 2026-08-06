import type { ReactNode } from "react";

import { ErrorState, LoadingState } from "@/components/common/States";
import { AppShell, RoleGate } from "@/components/layout/AppShell";
import { useProfile, type AppRole, type ProfileWithClinic } from "@/hooks/useAuth";

export function Page({
  title,
  description,
  actions,
  allowed,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  allowed: AppRole[];
  children: (profile: ProfileWithClinic) => ReactNode;
}) {
  const { data: profile, isLoading, error } = useProfile();

  if (isLoading) {
    return <LoadingState label="Carregando sua clínica..." />;
  }
  if (error || !profile) {
    return <ErrorState error={error} label="Não foi possível carregar seu perfil" />;
  }

  return (
    <AppShell
      title={title}
      description={description}
      actions={actions}
      role={profile.role}
      clinicName={profile.clinics?.name ?? "Clínica"}
      clinicLogoUrl={profile.clinics?.logo_url ?? null}
      userName={profile.full_name || (profile.email ?? "Usuário")}
    >
      <RoleGate role={profile.role} allowed={allowed}>
        {children(profile)}
      </RoleGate>
    </AppShell>
  );
}
