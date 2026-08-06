import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { getAuthenticatedUser, mustChangeTemporaryPassword } from "@/services/auth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const user = await getAuthenticatedUser().catch(() => null);
    if (!user) throw redirect({ to: "/auth" });
    const mustChangePassword = await mustChangeTemporaryPassword().catch(() => false);
    if (mustChangePassword) {
      throw redirect({ to: "/reset-password", replace: true });
    }
    return { user };
  },
  component: () => <Outlet />,
});
