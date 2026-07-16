import { useCallback, useEffect, useMemo, useState } from "react";
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
import { LogoMark } from "../components/Logo";

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
  const [error, setError] = useState("");

  // Ajout de patient
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDob, setNewDob] = useState("");

  // Sélecteur « Nouvelle dictée »
  const [pickerOpen, setPickerOpen] = useState(false);

  const loadPatients = useCallback(async () => {
    try {
      setPatients(await listPatients(patientQuery));
    } catch (e) {
      setError(String(e));
    }
  }, [patientQuery]);

  useEffect(() => {
    loadPatients();
  }, [loadPatients, refreshKey]);

  const loadCrs = useCallback(async (p: Patient) => {
    try {
      setCrs(await listComptesRendus(p.id));
    } catch (e) {
      setError(String(e));
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
      searchComptesRendus(q).then(setHits).catch((e) => setError(String(e)));
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
      setError(String(e));
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
    const n = `${p.nb_cr} compte${p.nb_cr > 1 ? "s" : ""}-rendu${
      p.nb_cr > 1 ? "s" : ""
    }`;
    return p.date_naissance ? `${n} · Né(e) le ${formatDate(p.date_naissance)}` : n;
  };

  return (
    <div className="shell">
      <div className="appbar">
        <span className="logo">
          <LogoMark />
          <span className="wordmark">CCVR Dictée</span>
        </span>
        <div className="search">
          <input
            placeholder="Rechercher dans tous les comptes-rendus"
            value={contentQuery}
            onChange={(e) => setContentQuery(e.target.value)}
          />
        </div>
        <div className="spacer" />
        <button className="primary" onClick={() => setPickerOpen(true)}>
          + Nouvelle dictée
        </button>
        <button className="ghost" onClick={onLogout}>
          Verrouiller
        </button>
      </div>

      <div className="shell-body">
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="sidebar-title">
              <span className="eyebrow">Patients</span>
              <button
                className="ghost small"
                onClick={() => setAdding((a) => !a)}
              >
                + Nouveau
              </button>
            </div>
            <input
              placeholder="Rechercher un patient"
              value={patientQuery}
              onChange={(e) => setPatientQuery(e.target.value)}
              style={{ width: "100%" }}
            />
            {adding && (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                <input
                  placeholder="Nom et prénom"
                  value={newName}
                  autoFocus
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addPatient()}
                />
                <input
                  type="date"
                  title="Date de naissance (optionnel)"
                  value={newDob}
                  onChange={(e) => setNewDob(e.target.value)}
                />
                <button className="primary small" onClick={addPatient} disabled={!newName.trim()}>
                  Créer le patient
                </button>
              </div>
            )}
          </div>
          <div className="sidebar-list">
            {patients.map((p) => (
              <div
                key={p.id}
                className={"list-item" + (selected?.id === p.id ? " active" : "")}
                onClick={() => {
                  setSelected(p);
                  setContentQuery("");
                }}
              >
                <div className="title">{p.nom}</div>
                <div className="sub">
                  {patientSub(p)}
                  {"  ·  "}
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      removePatient(p);
                    }}
                    style={{ color: "var(--danger)", cursor: "pointer" }}
                  >
                    supprimer
                  </span>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <main className="main">
          {error && <div className="toast err">{error}</div>}

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
          ) : patients.length === 0 ? (
            <div className="empty-state">
              <LogoMark />
              <h3>Aucun patient pour l'instant</h3>
              <p>Créez votre premier patient, puis lancez la dictée. Tout est prêt.</p>
              <button
                className="primary"
                onClick={() => {
                  setAdding(true);
                }}
              >
                + Nouveau patient
              </button>
            </div>
          ) : (
            <div className="empty-state">
              <LogoMark />
              <h3>Sélectionnez un patient</h3>
              <p>
                Choisissez un patient à gauche pour voir ses comptes-rendus, ou
                lancez une nouvelle dictée.
              </p>
              <button className="primary" onClick={() => setPickerOpen(true)}>
                + Nouvelle dictée
              </button>
            </div>
          )}
        </main>
      </div>

      {pickerOpen && (
        <PatientPicker
          patients={patients}
          onClose={() => setPickerOpen(false)}
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
      )}
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
    <div className="main-narrow">
      <div className="search-count">
        {hits.length} compte{hits.length > 1 ? "s" : ""}-rendu
        {hits.length > 1 ? "s" : ""} trouvé{hits.length > 1 ? "s" : ""}
      </div>
      {hits.length === 0 && (
        <p style={{ color: "var(--text-soft)", fontSize: 13 }}>
          Aucun compte-rendu ne contient « {query} ».
        </p>
      )}
      {hits.map((h) => (
        <div key={h.id} className="cr-row" onClick={() => onOpen(h)}>
          <div>
            <div className="title">
              {h.patient_nom} · {h.titre}
            </div>
            <div className="sub">{highlight(h.extrait, query)}</div>
          </div>
        </div>
      ))}
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
    <div className="main-narrow">
      <div className="page-head">
        <div>
          <h1>{patient.nom}</h1>
          <div className="sub">{subLine}</div>
        </div>
        <button onClick={() => onOpen(patient, null)}>
          Nouvelle dictée pour ce patient
        </button>
      </div>

      {crs.length === 0 ? (
        <p style={{ color: "var(--text-soft)", fontSize: 13 }}>
          Aucun compte-rendu. Cliquez sur « Nouvelle dictée pour ce patient ».
        </p>
      ) : (
        crs.map((cr) => (
          <div key={cr.id} className="cr-row" onClick={() => onOpen(patient, cr)}>
            <div>
              <div className="title">
                {cr.titre}
                {reportTypeLabel(cr.type_cr) && (
                  <span className="badge accent">{reportTypeLabel(cr.type_cr)}</span>
                )}
              </div>
              <div className="sub">
                Consultation du {formatDate(cr.date_consultation)}
              </div>
            </div>
            <div className="cr-actions">
              <button
                className="primary small"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen(patient, cr);
                }}
              >
                Ouvrir
              </button>
              <button
                className="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onRename(cr);
                }}
              >
                Renommer
              </button>
              <button
                className="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(cr);
                }}
              >
                Supprimer
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function PatientPicker({
  patients,
  onClose,
  onPick,
  onCreate,
}: {
  patients: Patient[];
  onClose: () => void;
  onPick: (p: Patient) => void;
  onCreate: (nom: string) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(
    () =>
      patients.filter((p) => p.nom.toLowerCase().includes(q.trim().toLowerCase())),
    [patients, q]
  );
  const canCreate = q.trim().length > 0 && filtered.length === 0;

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    if (e.key === "Enter") {
      if (filtered.length > 0) onPick(filtered[0]);
      else if (canCreate) onCreate(q.trim());
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Pour quel patient ?</h3>
        <input
          placeholder="Nom du patient"
          value={q}
          autoFocus
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKey}
          style={{ width: "100%" }}
        />
        <div className="picker-list">
          {filtered.slice(0, 6).map((p) => (
            <div key={p.id} className="picker-item" onClick={() => onPick(p)}>
              {p.nom}
            </div>
          ))}
          {canCreate && (
            <div className="picker-item" onClick={() => onCreate(q.trim())}>
              + Créer « {q.trim()} » comme nouveau patient
            </div>
          )}
          {filtered.length === 0 && !canCreate && (
            <div className="picker-item" style={{ color: "var(--text-soft)", cursor: "default" }}>
              Aucun patient
            </div>
          )}
        </div>
        <div className="picker-hint">
          Entrée pour valider et passer directement à la dictée.
        </div>
      </div>
    </div>
  );
}
