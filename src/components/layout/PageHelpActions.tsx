import type { AppRole } from "@/hooks/useAuth";

import { HowToUseCurrentScreen } from "@/components/layout/HowToUseCurrentScreen";

export function PageHelpActions({ role }: { role: AppRole }) {
  return <HowToUseCurrentScreen role={role} />;
}
