import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Clinic = Database["public"]["Tables"]["clinics"]["Row"];

export type ProfileWithClinic = Profile & { clinics: Clinic | null };

export const profileQueryKey = ["profile"] as const;

export function useProfile() {
  return useQuery({
    queryKey: profileQueryKey,
    staleTime: 60_000,
    queryFn: async (): Promise<ProfileWithClinic | null> => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*, clinics(*)")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;

      const profile = (data as ProfileWithClinic | null) ?? null;
      if (!profile) return null;

      return profile;
    },
  });
}

export function useAuthSync() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      if (event === "SIGNED_OUT") {
        queryClient.clear();
        return;
      }
      queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);
}

export const roleLabels: Record<AppRole, string> = {
  superadmin: "Superadministrador",
  admin: "Administrador",
  receptionist: "Recepcionista",
  attendant: "Atendente",
  professional: "Profissional",
  public_display: "Painel público",
};

export function canManage(role?: AppRole | null) {
  return role === "admin" || role === "receptionist" || role === "attendant";
}
