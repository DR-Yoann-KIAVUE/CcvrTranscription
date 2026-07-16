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
import { AudioRecorder, type RecordingResult } from "../audio/recorder";
import { cleanTranscript } from "../cleanup";
import { REPORT_TYPES, reportTypeLabel, templateHtml } from "../reportTypes";
import { formatDateTime, formatDuration, todayInputValue } from "../format";
import { buildDocx } from "../export/docx";
import { buildPdf } from "../export/pdf";
import { blocksToPlainText, parseEditorHtml } from "../export/parse";
import Editor, { type EditorHandle } from "./Editor";
import { LogoMark } from "../components/Logo";

interface Props {
  patient: Patient;
  existing: CompteRendu | null;
  onBack: () => void;
  onSaved: (cr: CompteRendu) => void;
}

type Status =
  | { kind: "idle" }
  | { kind: "savingAudio" }
  | { kind: "transcribing" }
  | { kind: "done"; msg: string }
  | { kind: "error"; msg: string };

const ORIGINE_LABEL: Record<Origine, string> = {
  transcription: "Transcription",
  regeneration: "Régénération",
  edition: "Modification",
};

export default function Dictation({ patient, existing, onBack, onSaved }: Props) {
  const [titre, setTitre] = useState(existing?.titre ?? "Consultation");
  const [typeCr, setTypeCr] = useState<string>(existing?.type_cr ?? "consultation");
  const [dateConsult, setDateConsult] = useState(
    existing?.date_consultation ?? todayInputValue()
  );
  const [html, setHtml] = useState(existing?.texte ?? "");
  const [audioPath, setAudioPath] = useState<string | null>(existing?.audio_path ?? null);
  const [crId, setCrId] = useState<number | null>(existing?.id ?? null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [modelOk, setModelOk] = useState(true);
  const [modelDir, setModelDir] = useState("");
  const [editorKey, setEditorKey] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [versions, setVersions] = useState<CrVersion[]>([]);
  const [regenOpen, setRegenOpen] = useState(false);

  // Enregistrement
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);

  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const originRef = useRef<Origine>("edition");
  const editorRef = useRef<EditorHandle>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    modelPresent().then(setModelOk).catch(() => setModelOk(false));
    modelsDirPath().then(setModelDir).catch(() => {});
    if (existing?.id != null) loadVersions(existing.id);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    } catch {
      /* silencieux */
    }
  };

  const setEditorHtml = (next: string) => {
    setHtml(next);
    setEditorKey((k) => k + 1);
  };

  const applyType = (key: string) => {
    setTypeCr(key);
    setDirty(true);
    const tmpl = templateHtml(key);
    if (!tmpl) return;
    const empty = blocksToPlainText(parseEditorHtml(html)).trim().length === 0;
    if (
      empty ||
      window.confirm(
        `Appliquer la trame « ${reportTypeLabel(key)} » ? Le contenu actuel de l'éditeur sera remplacé par les sections de ce type.`
      )
    ) {
      originRef.current = "edition";
      setEditorHtml(tmpl);
    }
  };

  // ---- Enregistrement ----
  const startRecording = async () => {
    setStatus({ kind: "idle" });
    try {
      const rec = new AudioRecorder(setLevel);
      await rec.start();
      recorderRef.current = rec;
      setSeconds(0);
      setRecording(true);
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (e) {
      setStatus({ kind: "error", msg: "Micro inaccessible : " + String(e) });
    }
  };

  const stopRecording = async () => {
    if (!recorderRef.current) return;
    if (timerRef.current) window.clearInterval(timerRef.current);
    setRecording(false);
    setLevel(0);
    try {
      const result = await recorderRef.current.stop();
      recorderRef.current = null;
      await onFinished(result);
    } catch (e) {
      setStatus({ kind: "error", msg: String(e) });
    }
  };

  const transcribeInto = async (path: string, origine: Origine, mode: "insert" | "replace") => {
    setStatus({ kind: "transcribing" });
    const text = await transcribe(path);
    const cleaned = cleanTranscript(text);
    if (mode === "replace") setEditorHtml(cleaned);
    else if (text) editorRef.current?.insertHtml(cleaned);
    originRef.current = origine;
    setDirty(true);
    setStatus(
      text
        ? { kind: "done", msg: "Transcription insérée. Relisez, corrigez, puis enregistrez." }
        : { kind: "error", msg: "Transcription vide, vérifiez le micro et réessayez." }
    );
  };

  const onFinished = async (result: RecordingResult) => {
    try {
      setStatus({ kind: "savingAudio" });
      const name = `p${patient.id}-${Date.now()}`;
      const path = await saveRecording(result.wav, name);
      setAudioPath(path);
      await transcribeInto(path, "transcription", "insert");
    } catch (e) {
      setStatus({ kind: "error", msg: String(e) });
    }
  };

  const doRegenerate = async () => {
    setRegenOpen(false);
    if (!audioPath) return;
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

  const restoreVersion = (v: CrVersion) => {
    if (
      !window.confirm(
        `Restaurer la version du ${formatDateTime(v.created_at)} ? Le texte actuel sera remplacé (vous pourrez l'enregistrer comme nouvelle version).`
      )
    )
      return;
    originRef.current = "edition";
    setEditorHtml(v.texte);
    setDirty(true);
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
      setStatus({ kind: "error", msg: "Téléchargement impossible : " + String(e) });
    }
  };

  const busy = status.kind === "savingAudio" || status.kind === "transcribing";
  const hasContent = blocksToPlainText(parseEditorHtml(html)).trim().length > 0;

  return (
    <div className="shell">
      {/* Bandeau document */}
      <div className="doc-bar">
        <button className="ghost" onClick={onBack}>
          ← Bibliothèque
        </button>
        <span className="doc-crumb">{patient.nom}</span>
        <input
          className="doc-title"
          value={titre}
          onChange={(e) => {
            setTitre(e.target.value);
            setDirty(true);
          }}
          placeholder="Titre du compte-rendu"
        />
        <select
          value={typeCr}
          onChange={(e) => applyType(e.target.value)}
          title="Type de compte-rendu"
        >
          {REPORT_TYPES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dateConsult}
          onChange={(e) => {
            setDateConsult(e.target.value);
            setDirty(true);
          }}
        />
        <span className={"badge dot " + (dirty ? "dirty" : "accent")}>
          {dirty ? "Non enregistré" : "Enregistré"}
        </span>
        <button className="primary" onClick={save} disabled={busy}>
          Enregistrer
        </button>
      </div>

      <div className="main">
        {/* Bandeau de dictée (sombre) */}
        <div className="dictation-bar">
          {recording ? (
            <>
              <button className="rec" onClick={stopRecording}>
                ■ Arrêter et transcrire
              </button>
              <span className="rec-dot" />
              <span className="timer">{formatDuration(seconds)}</span>
              <div className="level-meter">
                <div className="level-bar" style={{ width: `${Math.round(level * 100)}%` }} />
              </div>
              <span className="muted">Micro actif</span>
            </>
          ) : (
            <>
              <button className="rec" onClick={startRecording} disabled={busy}>
                ● {audioPath ? "Reprendre la dictée" : "Démarrer la dictée"}
              </button>
              {audioPath && <button onClick={replay}>▶ Réécouter</button>}
              <div className="spacer" />
              {audioPath && (
                <button
                  onClick={() => setRegenOpen(true)}
                  disabled={busy || !modelOk}
                >
                  Régénérer le texte depuis l'audio
                </button>
              )}
            </>
          )}
        </div>

        {/* États */}
        {!modelOk && (
          <div className="notice amber">
            <span className="dot" />
            <div>
              <strong>Le modèle de transcription n'est pas encore installé.</strong>
              <p>
                Vous pouvez dicter et conserver l'audio dès maintenant. Le texte
                sera généré une fois le modèle placé dans : <br />
                <code>{modelDir || "…"}</code>
              </p>
            </div>
          </div>
        )}

        {status.kind === "transcribing" && (
          <div className="transcribing">
            <LogoMark className="spin" />
            <h3>Transcription en cours</h3>
            <p>
              Quelques secondes. Le texte s'affichera ici automatiquement, votre
              audio est déjà en sécurité.
            </p>
          </div>
        )}
        {status.kind === "savingAudio" && (
          <div className="toast ok">Sauvegarde de l'audio en cours…</div>
        )}
        {status.kind === "done" && <div className="toast ok">✓ {status.msg}</div>}
        {status.kind === "error" && <div className="toast err">✕ {status.msg}</div>}

        {/* Éditeur + colonne latérale */}
        <div className="editor-layout">
          <div className="editor-col">
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
          </div>

          <div className="side-col">
            <div className="side-block">
              <h4>Exports</h4>
              <div className="side-pad">
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

            <div className="side-block">
              <h4>Versions</h4>
              {versions.length === 0 ? (
                <div className="side-note">
                  Les versions apparaîtront après le premier enregistrement.
                </div>
              ) : (
                <>
                  {versions.map((v, i) => (
                    <div key={v.id} className={"version" + (i === 0 ? " current" : "")}>
                      <div>
                        <div className="v-label">
                          {i === 0 ? "Version actuelle" : ORIGINE_LABEL[v.origine]}
                        </div>
                        <div className="v-meta">
                          {ORIGINE_LABEL[v.origine].toLowerCase()} ·{" "}
                          {formatDateTime(v.created_at)}
                        </div>
                      </div>
                      {i !== 0 && (
                        <button className="small" onClick={() => restoreVersion(v)}>
                          Restaurer
                        </button>
                      )}
                    </div>
                  ))}
                  <div className="side-note">
                    Chaque dictée ou régénération archive automatiquement une
                    version. Rien n'est perdu.
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modale de régénération */}
      {regenOpen && (
        <div className="modal-backdrop" onClick={() => setRegenOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Régénérer le texte ?</h3>
            <p>
              Le texte actuel sera remplacé par une nouvelle transcription de
              l'audio. La version actuelle sera conservée dans l'historique et
              restera restaurable.
            </p>
            <div className="modal-actions">
              <button onClick={() => setRegenOpen(false)}>Annuler</button>
              <button className="primary" onClick={doRegenerate}>
                Régénérer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function fileName(p: string): string {
  return p.split(/[\\/]/).pop() ?? p;
}
