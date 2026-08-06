import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";

/** Subscribes to realtime changes on the given tables and invalidates the query keys. */
export function useRealtime(tables: string[], keys: string[], clinicId?: string | null) {
  const queryClient = useQueryClient();
  const tableKey = tables.join(",");
  const queryKeys = keys.join(",");

  useEffect(() => {
    if (!clinicId) return;
    const channel = supabase.channel(`rt-${tableKey}-${clinicId}`);
    for (const table of tableKey.split(",")) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `clinic_id=eq.${clinicId}` },
        () => {
          for (const key of queryKeys.split(",")) {
            queryClient.invalidateQueries({ queryKey: [key] });
          }
        },
      );
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableKey, queryKeys, clinicId, queryClient]);
}
