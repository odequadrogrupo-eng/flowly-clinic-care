import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState, LoadingState } from "@/components/common/States";
import { Page } from "@/components/layout/Page";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { logAudit, type Patient } from "@/lib/queue";
import {
  archivePatient,
  listPatients,
  savePatient,
  type PatientFormValues,
} from "@/services/patients";

export const Route = createFileRoute("/_authenticated/pacientes")({
  head: () => ({
    meta: [
      { title: "Pacientes — ClinicFlow" },
      { name: "description", content: "Cadastro de pacientes da clínica: nome, contato e observações." },
      { property: "og:title", content: "Pacientes — ClinicFlow" },
      { property: "og:description", content: "Gestão do cadastro de pacientes no ClinicFlow." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PatientsPage,
});

const emptyForm: PatientFormValues = {
  full_name: "",
  cpf: "",
  birth_date: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
};

function PatientsPage() {
  return (
    <Page title="Pacientes" description="Cadastro e histórico de contato" allowed={["admin", "receptionist", "attendant"]}>
      {(profile) => <PatientsContent clinicId={profile.clinic_id} />}
    </Page>
  );
}

function PatientsContent({ clinicId }: { clinicId: string }) {
  const queryClient = useQueryClient();
  const [term, setTerm] = useState("");
  const [form, setForm] = useState<PatientFormValues | null>(null);
  const [removing, setRemoving] = useState<Patient | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["patients", clinicId, term],
    queryFn: () => listPatients(clinicId, term),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["patients"] });
    queryClient.invalidateQueries({ queryKey: ["patients-search"] });
  };

  const save = useMutation({
    mutationFn: async (values: PatientFormValues) => {
      const savedId = await savePatient(clinicId, values);
      if (values.id) {
        await logAudit({ clinicId, action: "update", entity: "patients", entityId: savedId });
      } else {
        await logAudit({ clinicId, action: "create", entity: "patients", entityId: savedId });
      }
    },
    onSuccess: () => {
      toast.success("Paciente salvo");
      setForm(null);
      invalidate();
    },
    onError: (mutationError: Error) => toast.error("Erro ao salvar", { description: mutationError.message }),
  });

  const remove = useMutation({
    mutationFn: async (patient: Patient) => {
      await archivePatient(clinicId, patient.id);
      await logAudit({ clinicId, action: "archive", entity: "patients", entityId: patient.id });
    },
    onSuccess: () => {
      toast.success("Paciente arquivado");
      invalidate();
    },
    onError: (mutationError: Error) => toast.error("Erro", { description: mutationError.message }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome, CPF ou telefone"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
          />
        </div>
        <Button onClick={() => setForm({ ...emptyForm })}>
          <Plus className="size-4" /> Novo paciente
        </Button>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} />
      ) : (data ?? []).length === 0 ? (
        <div className="card-soft">
          <EmptyState title="Nenhum paciente" description="Cadastre o primeiro paciente da clínica." />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(data ?? []).map((patient) => (
            <div key={patient.id} className="card-soft p-4">
              <p className="font-semibold">{patient.full_name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {patient.phone ?? "Sem telefone"} · {patient.cpf ?? "Sem CPF"}
              </p>
              {patient.email ? <p className="text-sm text-muted-foreground">{patient.email}</p> : null}
              {patient.address ? <p className="text-sm text-muted-foreground">{patient.address}</p> : null}
              {patient.notes ? <p className="mt-2 text-sm">{patient.notes}</p> : null}
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setForm({
                      id: patient.id,
                      full_name: patient.full_name,
                      cpf: patient.cpf ?? "",
                      birth_date: patient.birth_date ?? "",
                      phone: patient.phone ?? "",
                      email: patient.email ?? "",
                      address: patient.address ?? "",
                      notes: patient.notes ?? "",
                    })
                  }
                >
                  <Pencil className="size-4" /> Editar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setRemoving(patient)}>
                  <Trash2 className="size-4" /> Arquivar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={form !== null} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar paciente" : "Novo paciente"}</DialogTitle>
          </DialogHeader>
          {form ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="p-name">Nome completo</Label>
                <Input
                  id="p-name"
                  value={form.full_name}
                  onChange={(event) => setForm({ ...form, full_name: event.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="p-cpf">CPF</Label>
                  <Input id="p-cpf" value={form.cpf} onChange={(event) => setForm({ ...form, cpf: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-birth">Data de nascimento</Label>
                  <Input
                    id="p-birth"
                    type="date"
                    value={form.birth_date}
                    onChange={(event) => setForm({ ...form, birth_date: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-phone">Telefone</Label>
                  <Input
                    id="p-phone"
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="p-email">E-mail</Label>
                  <Input
                    id="p-email"
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="p-address">Endereco</Label>
                  <Input
                    id="p-address"
                    value={form.address}
                    onChange={(event) => setForm({ ...form, address: event.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-notes">Observações</Label>
                <Textarea
                  id="p-notes"
                  rows={3}
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button disabled={save.isPending} onClick={() => form && save.mutate(form)}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar paciente?</AlertDialogTitle>
            <AlertDialogDescription>
              {removing?.full_name} deixará de aparecer nas buscas, mas o histórico é preservado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removing) remove.mutate(removing);
                setRemoving(null);
              }}
            >
              Arquivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
