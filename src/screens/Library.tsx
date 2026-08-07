import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  createPatient,
  deleteCompteRendu,
  deletePatient,
  getCompteRendu,
  listComptesRendus,
  listPatients,
  renameCompteRendu,
  searchComptesRendus,
} from "../api";
import type { CompteRendu, Patient, SearchHit } from "../types";
import { formatDate } from "../format";
import { reportTypeLabel } from "../reportTypes";
import { letterTemplateLabel } from "../letterTemplates";

/** Libellé du modèle (nouveaux modèles de courrier, ou anciens types). */
const typeLabel = (key: string | null) =>
  letterTemplateLabel(key) ?? reportTypeLabel(key);
import { LogoMark } from "@/components/Logo";
import { PatientAvatar } from "@/components/PatientAvatar";
import { DataDialog } from "@/components/DataDialog";
import { SettingsDialog } from "@/components/SettingsDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Database, Lock, Plus, Search, Settings, Trash2 } from "lucide-react";

interface Props {
  onOpen: (patient: Patient, existing: CompteRendu | null) => void;
  onLogout: () => void;
  refreshKey: number;
}

export default function Library({ onOpen, onLogout, refreshKey }: Props) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientQuery, setPatientQuery] = useState("");
  const [selected, setSelected] = useState<Patient | null>(null);
  const [crs, setCrs] = useState<CompteRendu[]>([]);
  const [contentQuery, setContentQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDob, setNewDob] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const loadPatients = useCallback(async () => {
    try {
      setPatients(await listPatients(patientQuery));
    } catch (e) {
      toast.error(String(e));
    }
  }, [patientQuery]);

  useEffect(() => {
    loadPatients();
  }, [loadPatients, refreshKey]);

  const loadCrs = useCallback(async (p: Patient) => {
    try {
      setCrs(await listComptesRendus(p.id));
    } catch (e) {
      toast.error(String(e));
    }
  }, []);

  useEffect(() => {
    if (selected) loadCrs(selected);
  }, [selected, loadCrs, refreshKey]);

  useEffect(() => {
    const q = contentQuery.trim();
    if (!q) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => {
      searchComptesRendus(q).then(setHits).catch((e) => toast.error(String(e)));
    }, 200);
    return () => clearTimeout(t);
  }, [contentQuery, refreshKey]);

  const addPatient = async () => {
    const nom = newName.trim();
    if (!nom) return;
    try {
      const p = await createPatient(nom, newDob || null);
      setNewName("");
      setNewDob("");
      setAdding(false);
      await loadPatients();
      setSelected(p);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const removePatient = async (p: Patient) => {
    if (
      !window.confirm(
        `Supprimer le patient « ${p.nom} » et ses ${p.nb_cr} compte(s)-rendu(s) ?`
      )
    )
      return;
    await deletePatient(p.id);
    if (selected?.id === p.id) {
      setSelected(null);
      setCrs([]);
    }
    await loadPatients();
    toast.success("Patient supprimé.");
  };

  const renameCr = async (cr: CompteRendu) => {
    const titre = window.prompt("Nouveau titre du compte-rendu :", cr.titre);
    if (titre == null || !titre.trim()) return;
    await renameCompteRendu(cr.id, titre.trim());
    if (selected) await loadCrs(selected);
  };

  const removeCr = async (cr: CompteRendu) => {
    if (!window.confirm(`Supprimer le compte-rendu « ${cr.titre} » ?`)) return;
    await deleteCompteRendu(cr.id);
    if (selected) await loadCrs(selected);
  };

  const openHit = async (hit: SearchHit) => {
    const cr = await getCompteRendu(hit.id);
    const patient =
      patients.find((p) => p.id === hit.patient_id) ??
      ({
        id: hit.patient_id,
        nom: hit.patient_nom,
        type_cr: null,
        date_naissance: null,
        created_at: "",
        nb_cr: 0,
      } as unknown as Patient);
    onOpen(patient, cr);
  };

  const patientSub = (p: Patient) => {
    const n = `${p.nb_cr} compte${p.nb_cr > 1 ? "s" : ""}-rendu${p.nb_cr > 1 ? "s" : ""}`;
    return p.date_naissance ? `${n} · Né(e) le ${formatDate(p.date_naissance)}` : n;
  };

  return (
    <div className="flex h-screen flex-col">
      {/* Barre d'application */}
      <header className="flex items-center gap-4 border-b bg-background/75 px-5 py-2.5 backdrop-blur">
        <span className="flex items-center gap-2 text-foreground">
          <LogoMark className="size-5 text-primary" />
          <span className="font-semibold tracking-tight">CCVR Dictée</span>
          <span className="ml-1 border-l pl-2.5 font-mono text-[11px] text-muted-foreground">
            Cabinet du Dr Kiavué
          </span>
        </span>
        <div className="relative ml-2 max-w-md flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Rechercher dans tous les comptes-rendus"
            value={contentQuery}
            onChange={(e) => setContentQuery(e.target.value)}
          />
        </div>
        <div className="flex-1" />
        <Button onClick={() => setPickerOpen(true)}>
          <Plus className="size-4" /> Nouvelle dictée
        </Button>
        <Button variant="ghost" onClick={() => setSettingsOpen(true)}>
          <Settings className="size-4" /> Réglages
        </Button>
        <Button variant="ghost" onClick={() => setDataOpen(true)}>
          <Database className="size-4" /> Données
        </Button>
        <Button variant="ghost" onClick={onLogout}>
          <Lock className="size-4" /> Verrouiller
        </Button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <aside className="flex w-[300px] min-w-[300px] flex-col border-r bg-muted/30">
          <div className="border-b p-4">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Patients
              </span>
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setAdding((a) => !a)}>
                <Plus className="size-3.5" /> Nouveau
              </Button>
            </div>
            <Input
              placeholder="Rechercher un patient"
              value={patientQuery}
              onChange={(e) => setPatientQuery(e.target.value)}
            />
            {adding && (
              <div className="mt-2.5 flex flex-col gap-2">
                <Input
                  placeholder="Nom et prénom"
                  value={newName}
                  autoFocus
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addPatient()}
                />
                <Input
                  type="date"
                  title="Date de naissance (optionnel)"
                  value={newDob}
                  onChange={(e) => setNewDob(e.target.value)}
                />
                <Button size="sm" onClick={addPatient} disabled={!newName.trim()}>
                  Créer le patient
                </Button>
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {patients.map((p) => (
              <button
                key={p.id}
                className={cn(
                  "group relative flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-card",
                  selected?.id === p.id
                    ? "bg-accent ring-1 ring-primary/15"
                    : "ring-1 ring-transparent"
                )}
                onClick={() => {
                  setSelected(p);
                  setContentQuery("");
                }}
              >
                <PatientAvatar name={p.nom} className="size-9 text-xs" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{p.nom}</div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {patientSub(p)}
                  </div>
                </div>
                <span
                  role="button"
                  tabIndex={-1}
                  className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  title="Supprimer le patient"
                  onClick={(e) => {
                    e.stopPropagation();
                    removePatient(p);
                  }}
                >
                  <Trash2 className="size-3.5" />
                </span>
              </button>
            ))}
            {patients.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                Aucun patient. Cliquez sur « Nouveau ».
              </p>
            )}
          </div>
        </aside>

        {/* Principal */}
        <main className="flex-1 overflow-y-auto bg-muted/40 p-8">
          {contentQuery.trim() ? (
            <SearchResults query={contentQuery} hits={hits} onOpen={openHit} />
          ) : selected ? (
            <PatientView
              patient={selected}
              crs={crs}
              subLine={patientSub(selected)}
              onOpen={onOpen}
              onRename={renameCr}
              onRemove={removeCr}
            />
          ) : (
            <EmptyState
              hasPatients={patients.length > 0}
              onNew={() => (patients.length > 0 ? setPickerOpen(true) : setAdding(true))}
            />
          )}
        </main>
      </div>

      <PatientPicker
        open={pickerOpen}
        patients={patients}
        onOpenChange={setPickerOpen}
        onPick={(p) => {
          setPickerOpen(false);
          onOpen(p, null);
        }}
        onCreate={async (nom) => {
          const p = await createPatient(nom, null);
          setPickerOpen(false);
          await loadPatients();
          onOpen(p, null);
        }}
      />

      <DataDialog open={dataOpen} onOpenChange={setDataOpen} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}

function highlight(text: string, term: string) {
  const i = text.toLowerCase().indexOf(term.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <span className="hit-term">{text.slice(i, i + term.length)}</span>
      {text.slice(i + term.length)}
    </>
  );
}

function SearchResults({
  query,
  hits,
  onOpen,
}: {
  query: string;
  hits: SearchHit[];
  onOpen: (h: SearchHit) => void;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
        {hits.length} compte{hits.length > 1 ? "s" : ""}-rendu
        {hits.length > 1 ? "s" : ""} trouvé{hits.length > 1 ? "s" : ""}
      </div>
      {hits.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Aucun compte-rendu ne contient « {query} ».
        </p>
      )}
      <div className="flex flex-col gap-2">
        {hits.map((h) => (
          <Card
            key={h.id}
            className="cursor-pointer p-3 transition-colors hover:bg-accent/50"
            onClick={() => onOpen(h)}
          >
            <div className="text-sm font-semibold">
              {h.patient_nom} · {h.titre}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {highlight(h.extrait, query)}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PatientView({
  patient,
  crs,
  subLine,
  onOpen,
  onRename,
  onRemove,
}: {
  patient: Patient;
  crs: CompteRendu[];
  subLine: string;
  onOpen: (p: Patient, cr: CompteRendu | null) => void;
  onRename: (cr: CompteRendu) => void;
  onRemove: (cr: CompteRendu) => void;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <PatientAvatar name={patient.nom} className="size-14 text-lg" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{patient.nom}</h1>
            <div className="mt-1 text-sm text-muted-foreground">{subLine}</div>
          </div>
        </div>
        <Button onClick={() => onOpen(patient, null)}>
          <Plus className="size-4" /> Nouvelle dictée
        </Button>
      </div>

      {crs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun compte-rendu. Cliquez sur « Nouvelle dictée pour ce patient ».
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {crs.map((cr) => (
            <Card
              key={cr.id}
              className="group flex cursor-pointer flex-row items-center justify-between gap-3 p-3.5 transition-colors hover:bg-accent/40"
              onClick={() => onOpen(patient, cr)}
            >
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {cr.titre}
                  {typeLabel(cr.type_cr) && (
                    <Badge variant="secondary" className="font-normal">
                      {typeLabel(cr.type_cr)}
                    </Badge>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Consultation du {formatDate(cr.date_consultation)}
                </div>
              </div>
              <div className="flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                <Button size="sm" onClick={(e) => { e.stopPropagation(); onOpen(patient, cr); }}>
                  Ouvrir
                </Button>
                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onRename(cr); }}>
                  Renommer
                </Button>
                <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onRemove(cr); }}>
                  Supprimer
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ hasPatients, onNew }: { hasPatients: boolean; onNew: () => void }) {
  return (
    <div className="mx-auto mt-16 max-w-md">
      <Card className="flex flex-col items-center p-10 text-center">
        <LogoMark className="mb-3 size-8 text-muted-foreground" />
        <h3 className="text-base font-semibold">
          {hasPatients ? "Sélectionnez un patient" : "Aucun patient pour l'instant"}
        </h3>
        <p className="mb-4 mt-2 text-sm text-muted-foreground">
          {hasPatients
            ? "Choisissez un patient à gauche pour voir ses comptes-rendus, ou lancez une nouvelle dictée."
            : "Créez votre premier patient, puis lancez la dictée. Tout est prêt."}
        </p>
        <Button onClick={onNew}>
          <Plus className="size-4" /> {hasPatients ? "Nouvelle dictée" : "Nouveau patient"}
        </Button>
      </Card>
    </div>
  );
}

function PatientPicker({
  open,
  patients,
  onOpenChange,
  onPick,
  onCreate,
}: {
  open: boolean;
  patients: Patient[];
  onOpenChange: (o: boolean) => void;
  onPick: (p: Patient) => void;
  onCreate: (nom: string) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(
    () => patients.filter((p) => p.nom.toLowerCase().includes(q.trim().toLowerCase())),
    [patients, q]
  );
  const canCreate = q.trim().length > 0 && filtered.length === 0;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (filtered.length > 0) onPick(filtered[0]);
      else if (canCreate) onCreate(q.trim());
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pour quel patient ?</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Nom du patient"
          value={q}
          autoFocus
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKey}
        />
        <div className="overflow-hidden rounded-md border">
          {filtered.slice(0, 6).map((p) => (
            <button
              key={p.id}
              className="block w-full border-b px-3 py-2.5 text-left text-sm last:border-b-0 hover:bg-accent hover:text-accent-foreground"
              onClick={() => onPick(p)}
            >
              {p.nom}
            </button>
          ))}
          {canCreate && (
            <button
              className="block w-full px-3 py-2.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              onClick={() => onCreate(q.trim())}
            >
              + Créer « {q.trim()} » comme nouveau patient
            </button>
          )}
          {filtered.length === 0 && !canCreate && (
            <div className="px-3 py-2.5 text-sm text-muted-foreground">Aucun patient</div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Entrée pour valider et passer directement à la dictée.
        </p>
      </DialogContent>
    </Dialog>
  );
}
