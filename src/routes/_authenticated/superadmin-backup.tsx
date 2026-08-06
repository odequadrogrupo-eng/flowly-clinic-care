import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Page } from "@/components/layout/Page";
import { Button } from "@/components/ui/button";
import {
  createBackupExportRecord,
  exportClinicDataAsJson,
  jsonToCsvRows,
  listBackupExports,
} from "@/services/backup";
import { listClinicsForSuperadmin } from "@/services/superadmin";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/superadmin-backup")({
  component: SuperadminBackupPage,
  head: () => ({
    meta: [{ title: "Superadmin — Backup" }, { name: "robots", content: "noindex" }],
  }),
});

function SuperadminBackupPage() {
  return (
    <Page
      title="Superadmin · Backup e Recuperação"
      description="Exportação segura por clínica e política de retenção"
      allowed={["superadmin"]}
    >
      {(profile) => <BackupContent profileClinicId={profile.clinic_id} />}
    </Page>
  );
}

function BackupContent({ profileClinicId }: { profileClinicId: string | null }) {
  const clinicsQuery = useQuery({
    queryKey: ["superadmin-backup-clinics"],
    queryFn: listClinicsForSuperadmin,
  });

  const defaultClinicId = useMemo(() => {
    if (profileClinicId) return profileClinicId;
    return clinicsQuery.data?.[0]?.id ?? "";
  }, [profileClinicId, clinicsQuery.data]);

  const [selectedClinicId, setSelectedClinicId] = useState<string>(defaultClinicId);
  const clinicId = selectedClinicId || defaultClinicId;

  const exportsQuery = useQuery({
    queryKey: ["backup-exports", clinicId],
    enabled: clinicId.length > 0,
    queryFn: () => listBackupExports(clinicId),
  });

  const exportJsonMutation = useMutation({
    mutationFn: async () => {
      await createBackupExportRecord({ clinicId, format: "json" });
      const data = await exportClinicDataAsJson(clinicId);
      downloadFile(
        `backup-${clinicId}-${Date.now()}.json`,
        JSON.stringify(data, null, 2),
        "application/json",
      );
    },
    onSuccess: () => toast.success("Backup JSON exportado"),
    onError: (error: Error) => toast.error("Erro ao exportar JSON", { description: error.message }),
  });

  const exportCsvMutation = useMutation({
    mutationFn: async () => {
      await createBackupExportRecord({ clinicId, format: "csv" });
      const data = await exportClinicDataAsJson(clinicId);
      const csv = jsonToCsvRows(data);
      downloadFile(`backup-${clinicId}-${Date.now()}.csv`, csv, "text/csv;charset=utf-8");
    },
    onSuccess: () => toast.success("Backup CSV exportado"),
    onError: (error: Error) => toast.error("Erro ao exportar CSV", { description: error.message }),
  });

  return (
    <div className="space-y-4">
      <section className="card-soft p-4">
        <h2 className="font-semibold">Clínica alvo</h2>
        <div className="mt-2 max-w-sm">
          <Select value={clinicId} onValueChange={setSelectedClinicId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a clínica" />
            </SelectTrigger>
            <SelectContent>
              {(clinicsQuery.data ?? []).map((clinic) => (
                <SelectItem key={clinic.id} value={clinic.id}>
                  {clinic.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="card-soft p-4">
        <h2 className="font-semibold">Status de backup</h2>
        <p className="text-sm text-muted-foreground">
          Último registro:{" "}
          {exportsQuery.data?.[0]
            ? new Date(exportsQuery.data[0].created_at).toLocaleString("pt-BR")
            : "N/A"}
        </p>
        <p className="text-sm text-muted-foreground">Retenção padrão: 30 dias</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            onClick={() => exportJsonMutation.mutate()}
            disabled={exportJsonMutation.isPending}
          >
            Exportar JSON
          </Button>
          <Button
            variant="outline"
            onClick={() => exportCsvMutation.mutate()}
            disabled={exportCsvMutation.isPending}
          >
            Exportar CSV
          </Button>
        </div>
      </section>

      <section className="card-soft p-4">
        <h2 className="font-semibold">Histórico de exports</h2>
        <div className="mt-2 space-y-2">
          {(exportsQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum export registrado.</p>
          ) : (
            (exportsQuery.data ?? []).map((item) => (
              <div key={item.id} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">
                  {item.format.toUpperCase()} · {item.status}
                </p>
                <p className="text-muted-foreground">
                  {new Date(item.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function downloadFile(name: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}
