import { useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  createCompteRendu,
  exportDocuments,
  modelPresent,
  modelsDirPath,
  saveRecording,
  transcribe,
  updateCompteRendu,
} from "../api";
import type { CompteRendu, Patient } from "../types";
import type { RecordingResult } from "../audio/recorder";
import { cleanTranscript } from "../cleanup";
import { todayInputValue } from "../format";
import { buildDocx } from "../export/docx";
import { buildPdf } from "../export/pdf";
import { blocksToPlainText, parseEditorHtml } from "../export/parse";
import Recorder from "./Recorder";
import Editor from "./Editor";

interface Props {
  patient: Patient;
  existing: CompteRendu | null;
  onBack: () => void;
  onSaved: (cr: CompteRendu) => void;
}

type Status =
  | { kind: "idle" }
  | { kind: "saving-audio" }
  | { kind: "transcribing" }
  | { kind: "done"; msg: string }
  | { kind: "error"; msg: string };

export default function Dictation({ patient, existing, onBack, onSaved }: Props) {
  const [titre, setTitre] = useState(existing?.titre ?? "Consultation");
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
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    modelPresent().then(setModelOk).catch(() => setModelOk(false));
    modelsDirPath().then(setModelDir).catch(() => {});
  }, []);

  const onFinished = async (result: RecordingResult) => {
    setStatus({ kind: "saving-audio" });
    try {
      const name = `p${patient.id}-${Date.now()}`;
      const path = await saveRecording(result.wav, name);
      setAudioPath(path);
      setStatus({ kind: "transcribing" });
      const text = await transcribe(path);
      const cleaned = cleanTranscript(text);
      // Ajoute à la suite d'un contenu éventuel.
      setHtml((prev) => (prev ? prev + cleaned : cleaned));
      setEditorKey((k) => k + 1);
      setStatus({
        kind: "done",
        msg: text
          ? "Transcription terminée. Relisez et corrigez si besoin."
          : "Transcription vide — vérifiez le micro et réessayez.",
      });
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
          dateConsultation: dateConsult,
          texte: html,
          audioPath,
        });
        setCrId(saved.id);
      } else {
        saved = await updateCompteRendu({
          id: crId,
          titre,
          dateConsultation: dateConsult,
          texte: html,
        });
      }
      setStatus({ kind: "done", msg: "Compte-rendu enregistré." });
      onSaved(saved);
    } catch (e) {
      setStatus({ kind: "error", msg: String(e) });
    }
  };

  const replay = async () => {
    if (!audioPath) return;
    try {
      // Lecture via le protocole asset de Tauri (fiable dans WKWebView/WebView2,
      // contrairement à un blob:).
      const src = convertFileSrc(audioPath);
      if (!audioElRef.current) audioElRef.current = new Audio();
      audioElRef.current.src = src;
      audioElRef.current.load();
      await audioElRef.current.play();
    } catch (e) {
      setStatus({ kind: "error", msg: "Réécoute impossible : " + String(e) });
    }
  };

  const download = async () => {
    try {
      const dir = await openDialog({
        directory: true,
        multiple: false,
        title: "Choisir le dossier d'export",
      });
      if (!dir || typeof dir !== "string") return;
      const meta = {
        patient: patient.nom,
        dateConsultation: dateConsult,
        titre,
      };
      const pdf = buildPdf(html, meta);
      const docx = await buildDocx(html, meta);
      const base = `${patient.nom}_${dateConsult}_${titre}`.replace(/\s+/g, "-");
      const paths = await exportDocuments({
        dir,
        baseName: base,
        pdf,
        docx,
        audio: audioPath,
      });
      setStatus({
        kind: "done",
        msg: "Exporté : " + paths.map((p) => p.split(/[\\/]/).pop()).join(", "),
      });
    } catch (e) {
      setStatus({ kind: "error", msg: "Export impossible : " + String(e) });
    }
  };

  const busy = status.kind === "saving-audio" || status.kind === "transcribing";
  const hasContent = blocksToPlainText(parseEditorHtml(html)).trim().length > 0;

  return (
    <div>
      <div className="toolbar">
        <button className="ghost" onClick={onBack}>
          ← Retour
        </button>
        <h2 style={{ margin: 0 }}>
          {existing ? "Compte-rendu" : "Nouvelle dictée"} — {patient.nom}
        </h2>
      </div>

      {!modelOk && (
        <div className="recorder" style={{ borderColor: "var(--danger)" }}>
          <strong>⚠️ Modèle Whisper introuvable.</strong>
          <p style={{ fontSize: 13, color: "var(--muted)" }}>
            Placez un fichier <code>ggml-*.bin</code> (français) dans :
            <br />
            <code>{modelDir || "…"}</code>
            <br />
            puis relancez l'application. La dictée fonctionne mais la
            transcription échouera tant que le modèle est absent.
          </p>
        </div>
      )}

      <Recorder onFinished={onFinished} disabled={busy} />

      <div
        className={
          "status-line" +
          (busy ? " working" : "") +
          (status.kind === "error" ? " " : "")
        }
        style={status.kind === "error" ? { color: "var(--danger)" } : undefined}
      >
        {status.kind === "saving-audio" && "💾 Sauvegarde de l'audio…"}
        {status.kind === "transcribing" &&
          "⏳ Transcription Whisper en cours (cela peut prendre un moment)…"}
        {status.kind === "done" && "✓ " + status.msg}
        {status.kind === "error" && "✕ " + status.msg}
      </div>

      <div className="row">
        <div className="field">
          <label>Nom du patient</label>
          <input value={patient.nom} readOnly />
        </div>
        <div className="field">
          <label>Titre du compte-rendu</label>
          <input
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            placeholder="Ex. Consultation de suivi"
          />
        </div>
        <div className="field">
          <label>Date de consultation</label>
          <input
            type="date"
            value={dateConsult}
            onChange={(e) => setDateConsult(e.target.value)}
          />
        </div>
      </div>

      <Editor key={editorKey} initialHtml={html} onChange={setHtml} />

      <div className="toolbar" style={{ marginTop: 16 }}>
        <button onClick={replay} disabled={!audioPath}>
          🔊 Réécouter
        </button>
        <div className="spacer" />
        <button className="primary" onClick={save} disabled={busy}>
          💾 Enregistrer
        </button>
        <button onClick={download} disabled={!hasContent}>
          ⬇ Télécharger (PDF + DOCX{audioPath ? " + audio" : ""})
        </button>
      </div>
    </div>
  );
}
