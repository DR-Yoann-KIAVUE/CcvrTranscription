import { useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import {
  copyFile,
  createCompteRendu,
  listCrVersions,
  modelPresent,
  modelsDirPath,
  saveBytes,
  saveRecording,
  transcribe,
  updateCompteRendu,
  type Origine,
} from "../api";
import type { CompteRendu, CrVersion, Patient } from "../types";
import type { RecordingResult } from "../audio/recorder";
import { cleanTranscript } from "../cleanup";
import { REPORT_TYPES, reportTypeLabel, templateHtml } from "../reportTypes";
import { formatDateTime, todayInputValue } from "../format";
import { buildDocx } from "../export/docx";
import { buildPdf } from "../export/pdf";
import { blocksToPlainText, parseEditorHtml } from "../export/parse";
import Recorder from "./Recorder";
import Editor, { type EditorHandle } from "./Editor";

interface Props {
  patient: Patient;
  existing: CompteRendu | null;
  onBack: () => void;
  onSaved: (cr: CompteRendu) => void;
}

type Status =
  | { kind: "idle" }
  | { kind: "working"; msg: string }
  | { kind: "done"; msg: string }
  | { kind: "error"; msg: string };

const ORIGINE_LABEL: Record<Origine, string> = {
  transcription: "Transcription",
  regeneration: "Régénération",
  edition: "Modification",
};

export default function Dictation({ patient, existing, onBack, onSaved }: Props) {
  const [titre, setTitre] = useState(existing?.titre ?? "Consultation");
  const [typeCr, setTypeCr] = useState<string>(
    existing?.type_cr ?? "consultation"
  );
  const [dateConsult, setDateConsult] = useState(
    existing?.date_consultation ?? todayInputValue()
  );
  const [html, setHtml] = useState(existing?.texte ?? "");
  const [audioPath, setAudioPath] = useState<string | null>(
    existing?.audio_path ?? null
  );
  const [crId, setCrId] = useState<number | null>(existing?.id ?? null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [modelOk, setModelOk] = useState(true);
  const [modelDir, setModelDir] = useState("");
  const [editorKey, setEditorKey] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [versions, setVersions] = useState<CrVersion[]>([]);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const originRef = useRef<Origine>("edition");
  const editorRef = useRef<EditorHandle>(null);

  useEffect(() => {
    modelPresent().then(setModelOk).catch(() => setModelOk(false));
    modelsDirPath().then(setModelDir).catch(() => {});
  }, []);

  const meta = () => ({
    patient: patient.nom,
    dateConsultation: dateConsult,
    titre,
    type: reportTypeLabel(typeCr),
  });
  const defaultBase = () =>
    `${patient.nom}_${dateConsult}_${titre}`.replace(/\s+/g, "-").replace(/[^\w\-]/g, "");

  const loadVersions = async (id: number) => {
    try {
      setVersions(await listCrVersions(id));
    } catch (e) {
      setStatus({ kind: "error", msg: String(e) });
    }
  };

  const setEditorHtml = (next: string) => {
    setHtml(next);
    setEditorKey((k) => k + 1); // remonte l'éditeur pour refléter le nouveau contenu
  };

  // Sélection d'un type de compte-rendu : applique sa trame de sections.
  const applyType = (key: string) => {
    setTypeCr(key);
    setDirty(true);
    const tmpl = templateHtml(key);
    if (!tmpl) return;
    const empty = blocksToPlainText(parseEditorHtml(html)).trim().length === 0;
    if (
      empty ||
      window.confirm(
        `Appliquer la trame « ${reportTypeLabel(key)} » ? ` +
          "Le contenu actuel de l'éditeur sera remplacé par les sections de ce type."
      )
    ) {
      originRef.current = "edition";
      setEditorHtml(tmpl);
    }
  };

  const transcribeInto = async (
    path: string,
    origine: Origine,
    mode: "insert" | "replace"
  ) => {
    setStatus({
      kind: "working",
      msg: "Transcription Whisper en cours (cela peut prendre un moment)…",
    });
    const text = await transcribe(path);
    const cleaned = cleanTranscript(text);
    if (mode === "replace") {
      setEditorHtml(cleaned);
    } else if (text) {
      // Insère au curseur (dans la section choisie) sans écraser la trame.
      editorRef.current?.insertHtml(cleaned);
    }
    // Placé après la mutation : insertHtml déclenche onChange qui remet 'edition'.
    originRef.current = origine;
    setDirty(true);
    setStatus({
      kind: text ? "done" : "error",
      msg: text
        ? "Transcription insérée. Relisez, corrigez si besoin, puis enregistrez."
        : "Transcription vide, vérifiez le micro et réessayez.",
    });
  };

  const onFinished = async (result: RecordingResult) => {
    try {
      setStatus({ kind: "working", msg: "Sauvegarde de l'audio en cours…" });
      const name = `p${patient.id}-${Date.now()}`;
      const path = await saveRecording(result.wav, name);
      setAudioPath(path);
      await transcribeInto(path, "transcription", "insert");
    } catch (e) {
      setStatus({ kind: "error", msg: String(e) });
    }
  };

  const regenerate = async () => {
    if (!audioPath) return;
    if (
      !window.confirm(
        "Régénérer le texte à partir de l'audio ? Le texte actuel sera remplacé. " +
          "La version précédente reste consultable dans l'historique après enregistrement."
      )
    )
      return;
    try {
      await transcribeInto(audioPath, "regeneration", "replace");
    } catch (e) {
      setStatus({ kind: "error", msg: String(e) });
    }
  };

  const save = async () => {
    try {
      let saved: CompteRendu;
      if (crId == null) {
        saved = await createCompteRendu({
          patientId: patient.id,
          titre,
          typeCr,
          dateConsultation: dateConsult,
          texte: html,
          audioPath,
          origine: originRef.current,
        });
        setCrId(saved.id);
      } else {
        saved = await updateCompteRendu({
          id: crId,
          titre,
          typeCr,
          dateConsultation: dateConsult,
          texte: html,
          origine: originRef.current,
        });
      }
      originRef.current = "edition";
      setDirty(false);
      setStatus({ kind: "done", msg: "Compte-rendu enregistré." });
      await loadVersions(saved.id);
      onSaved(saved);
    } catch (e) {
      setStatus({ kind: "error", msg: String(e) });
    }
  };

  const replay = async () => {
    if (!audioPath) return;
    try {
      const src = convertFileSrc(audioPath);
      if (!audioElRef.current) audioElRef.current = new Audio();
      audioElRef.current.src = src;
      audioElRef.current.load();
      await audioElRef.current.play();
    } catch (e) {
      setStatus({ kind: "error", msg: "Réécoute impossible : " + String(e) });
    }
  };

  const toggleHistory = async () => {
    const next = !showHistory;
    setShowHistory(next);
    if (next && crId != null) await loadVersions(crId);
  };

  const restoreVersion = (v: CrVersion) => {
    if (
      !window.confirm(
        `Restaurer la version du ${formatDateTime(v.created_at)} ? ` +
          "Le texte actuel sera remplacé (vous pourrez l'enregistrer comme nouvelle version)."
      )
    )
      return;
    originRef.current = "edition";
    setEditorHtml(v.texte);
    setDirty(true);
    setShowHistory(false);
    setStatus({ kind: "done", msg: "Version restaurée. Enregistrez pour la conserver." });
  };

  const exportPdf = async () => {
    try {
      const path = await saveDialog({
        defaultPath: `${defaultBase()}.pdf`,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!path) return;
      await saveBytes(path, buildPdf(html, meta()));
      setStatus({ kind: "done", msg: "PDF exporté : " + fileName(path) });
    } catch (e) {
      setStatus({ kind: "error", msg: "Export PDF impossible : " + String(e) });
    }
  };

  const exportDocx = async () => {
    try {
      const path = await saveDialog({
        defaultPath: `${defaultBase()}.docx`,
        filters: [{ name: "Word", extensions: ["docx"] }],
      });
      if (!path) return;
      await saveBytes(path, await buildDocx(html, meta()));
      setStatus({ kind: "done", msg: "DOCX exporté : " + fileName(path) });
    } catch (e) {
      setStatus({ kind: "error", msg: "Export DOCX impossible : " + String(e) });
    }
  };

  const downloadAudio = async () => {
    if (!audioPath) return;
    try {
      const path = await saveDialog({
        defaultPath: `${defaultBase()}.wav`,
        filters: [{ name: "Audio WAV", extensions: ["wav"] }],
      });
      if (!path) return;
      await copyFile(audioPath, path);
      setStatus({ kind: "done", msg: "Audio téléchargé : " + fileName(path) });
    } catch (e) {
      setStatus({ kind: "error", msg: "Téléchargement audio impossible : " + String(e) });
    }
  };

  const busy = status.kind === "working";
  const hasContent = blocksToPlainText(parseEditorHtml(html)).trim().length > 0;

  return (
    <div>
      <div className="toolbar">
        <button className="ghost" onClick={onBack}>
          Retour
        </button>
        <h2 style={{ margin: 0 }}>
          {existing || crId != null ? "Compte-rendu de " : "Nouvelle dictée pour "}
          {patient.nom}
        </h2>
        <div className="spacer" />
        {dirty && <span className="badge badge-warn">Non enregistré</span>}
        {crId != null && (
          <button className="ghost" onClick={toggleHistory}>
            {showHistory ? "Masquer l'historique" : "Historique des versions"}
          </button>
        )}
      </div>

      {!modelOk && (
        <div className="notice notice-danger">
          <strong>Modèle Whisper introuvable.</strong>
          <p>
            Placez un fichier <code>ggml-*.bin</code> (français) dans :
            <br />
            <code>{modelDir || "…"}</code>
            <br />
            puis relancez l'application. La dictée fonctionne mais la
            transcription échouera tant que le modèle est absent.
          </p>
        </div>
      )}

      {/* Enregistrement */}
      <Recorder onFinished={onFinished} disabled={busy} />

      {/* Actions liées à l'audio */}
      {audioPath && (
        <div className="toolbar audio-actions">
          <span className="audio-label">Enregistrement disponible</span>
          <button onClick={replay}>Réécouter</button>
          <button onClick={regenerate} disabled={busy || !modelOk}>
            Régénérer le texte depuis l'audio
          </button>
        </div>
      )}

      {status.kind !== "idle" && (
        <div
          className={"status-line" + (status.kind === "working" ? " working" : "")}
          style={status.kind === "error" ? { color: "var(--danger)" } : undefined}
        >
          {status.msg}
        </div>
      )}

      {/* Métadonnées */}
      <div className="row">
        <div className="field">
          <label>Nom du patient</label>
          <input value={patient.nom} readOnly />
        </div>
        <div className="field">
          <label>Titre du compte-rendu</label>
          <input
            value={titre}
            onChange={(e) => {
              setTitre(e.target.value);
              setDirty(true);
            }}
            placeholder="Ex. Consultation de suivi"
          />
        </div>
        <div className="field">
          <label>Type de compte-rendu</label>
          <select value={typeCr} onChange={(e) => applyType(e.target.value)}>
            {REPORT_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Date de consultation</label>
          <input
            type="date"
            value={dateConsult}
            onChange={(e) => {
              setDateConsult(e.target.value);
              setDirty(true);
            }}
          />
        </div>
      </div>

      {/* Historique des versions */}
      {showHistory && (
        <div className="history">
          <div className="history-head">Historique des versions</div>
          {versions.length === 0 && (
            <div className="history-empty">Aucune version archivée pour le moment.</div>
          )}
          {versions.map((v, i) => (
            <div key={v.id} className="history-item">
              <div>
                <span className="badge">{ORIGINE_LABEL[v.origine]}</span>
                {i === 0 && <span className="badge badge-current">Actuelle</span>}
                <span className="history-date">{formatDateTime(v.created_at)}</span>
                <div className="history-preview">
                  {blocksToPlainText(parseEditorHtml(v.texte)).slice(0, 140) || "(vide)"}
                </div>
              </div>
              <button onClick={() => restoreVersion(v)}>Restaurer</button>
            </div>
          ))}
        </div>
      )}

      {/* Éditeur */}
      <Editor
        key={editorKey}
        ref={editorRef}
        initialHtml={html}
        onChange={(h) => {
          setHtml(h);
          originRef.current = "edition";
          setDirty(true);
        }}
      />

      {/* Barre d'actions */}
      <div className="toolbar action-bar">
        <button className="primary" onClick={save} disabled={busy}>
          Enregistrer
        </button>
        <div className="spacer" />
        <button onClick={exportPdf} disabled={!hasContent}>
          Exporter en PDF
        </button>
        <button onClick={exportDocx} disabled={!hasContent}>
          Exporter en DOCX
        </button>
        <button onClick={downloadAudio} disabled={!audioPath}>
          Télécharger l'audio
        </button>
      </div>
    </div>
  );
}

function fileName(p: string): string {
  return p.split(/[\\/]/).pop() ?? p;
}
