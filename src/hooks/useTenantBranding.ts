import { useQuery } from "@tanstack/react-query";

import {
  getDefaultBranding,
  resolveTenantBranding,
  type TenantBranding,
} from "@/services/tenant-branding";

export const tenantBrandingQueryKey = ["tenant-branding"] as const;

export function useTenantBranding() {
  return useQuery<TenantBranding>({
    queryKey: tenantBrandingQueryKey,
    queryFn: resolveTenantBranding,
    staleTime: 5 * 60_000,
    retry: false,
    initialData: getDefaultBranding(),
  });
}
