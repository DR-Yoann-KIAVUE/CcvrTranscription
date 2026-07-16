import { useCallback, useEffect, useState } from "react";
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
  const [newName, setNewName] = useState("");
  const [contentQuery, setContentQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [error, setError] = useState("");

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

  // Recherche plein-texte dans le contenu des CR (débounce léger).
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
      const p = await createPatient(nom);
      setNewName("");
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
        date_naissance: null,
        created_at: "",
        nb_cr: 0,
      } as Patient);
    onOpen(patient, cr);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h2 style={{ marginBottom: 12 }}>Patients</h2>
            <button
              className="ghost"
              title="Verrouiller et changer d'utilisateur"
              onClick={onLogout}
              style={{ marginBottom: 12 }}
            >
              Verrouiller
            </button>
          </div>
          <input
            placeholder="Rechercher un patient…"
            value={patientQuery}
            onChange={(e) => setPatientQuery(e.target.value)}
            style={{ width: "100%", marginBottom: 8 }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <input
              placeholder="Nom du nouveau patient"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addPatient()}
              style={{ flex: 1 }}
            />
            <button className="primary" onClick={addPatient} disabled={!newName.trim()}>
              +
            </button>
          </div>
        </div>
        <div className="sidebar-list">
          {patients.length === 0 && (
            <div className="empty-state" style={{ marginTop: 32 }}>
              Aucun patient.
            </div>
          )}
          {patients.map((p) => (
            <div
              key={p.id}
              className={"list-item" + (selected?.id === p.id ? " active" : "")}
              onClick={() => setSelected(p)}
            >
              <div className="title">{p.nom}</div>
              <div className="sub">
                {p.nb_cr} compte{p.nb_cr > 1 ? "s" : ""}-rendu
                {p.nb_cr > 1 ? "s" : ""}
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
        <div className="field" style={{ maxWidth: 480 }}>
          <label>Rechercher dans le contenu des comptes-rendus</label>
          <input
            placeholder="Mot-clé (diagnostic, traitement, symptôme…)"
            value={contentQuery}
            onChange={(e) => setContentQuery(e.target.value)}
          />
        </div>

        {error && <div className="error">{error}</div>}

        {contentQuery.trim() ? (
          <div>
            <h3>
              Résultats ({hits.length}) pour « {contentQuery} »
            </h3>
            {hits.length === 0 && (
              <div className="empty-state">Aucun compte-rendu correspondant.</div>
            )}
            {hits.map((h) => (
              <div key={h.id} className="list-item" onClick={() => openHit(h)}>
                <div className="title">
                  {h.titre} <span className="badge">{h.patient_nom}</span>
                </div>
                <div className="sub">
                  {formatDate(h.date_consultation)} · {h.extrait}
                </div>
              </div>
            ))}
          </div>
        ) : selected ? (
          <div>
            <div className="toolbar">
              <h2 style={{ margin: 0 }}>{selected.nom}</h2>
              <div className="spacer" />
              <button className="primary" onClick={() => onOpen(selected, null)}>
                Nouvelle dictée
              </button>
            </div>
            {crs.length === 0 && (
              <div className="empty-state">
                Aucun compte-rendu pour ce patient. Cliquez sur « Nouvelle
                dictée ».
              </div>
            )}
            {crs.map((cr) => (
              <div key={cr.id} className="list-item" onClick={() => onOpen(selected, cr)}>
                <div className="title">
                  {cr.titre}
                  {reportTypeLabel(cr.type_cr) && (
                    <span className="badge" style={{ marginLeft: 8 }}>
                      {reportTypeLabel(cr.type_cr)}
                    </span>
                  )}
                </div>
                <div className="sub">
                  {formatDate(cr.date_consultation)}
                  {"  ·  "}
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      renameCr(cr);
                    }}
                    style={{ color: "var(--primary)", cursor: "pointer" }}
                  >
                    renommer
                  </span>
                  {"  ·  "}
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      removeCr(cr);
                    }}
                    style={{ color: "var(--danger)", cursor: "pointer" }}
                  >
                    supprimer
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            Sélectionnez un patient à gauche, ou créez-en un nouveau, pour
            commencer une dictée.
          </div>
        )}
      </main>
    </div>
  );
}
