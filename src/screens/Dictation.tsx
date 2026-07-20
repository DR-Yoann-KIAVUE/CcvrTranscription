import { useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Circle,
  Download,
  FileText,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  Square,
} from "lucide-react";

interface Props {
  patient: Patient;
  existing: CompteRendu | null;
  onBack: () => void;
  onSaved: (cr: CompteRendu) => void;
}

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
  const [modelOk, setModelOk] = useState(true);
  const [modelDir, setModelDir] = useState("");
  const [editorKey, setEditorKey] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [versions, setVersions] = useState<CrVersion[]>([]);
  const [regenOpen, setRegenOpen] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

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

  const startRecording = async () => {
    try {
      const rec = new AudioRecorder(setLevel);
      await rec.start();
      recorderRef.current = rec;
      setSeconds(0);
      setRecording(true);
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (e) {
      toast.error("Micro inaccessible : " + String(e));
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
      toast.error(String(e));
    }
  };

  const transcribeInto = async (path: string, origine: Origine, mode: "insert" | "replace") => {
    setTranscribing(true);
    try {
      const text = await transcribe(path);
      const cleaned = cleanTranscript(text);
      if (mode === "replace") setEditorHtml(cleaned);
      else if (text) editorRef.current?.insertHtml(cleaned);
      originRef.current = origine;
      setDirty(true);
      if (text) toast.success("Transcription insérée. Relisez, corrigez, puis enregistrez.");
      else toast.error("Transcription vide, vérifiez le micro et réessayez.");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setTranscribing(false);
    }
  };

  const onFinished = async (result: RecordingResult) => {
    try {
      const name = `p${patient.id}-${Date.now()}`;
      const path = await saveRecording(result.wav, name);
      setAudioPath(path);
      await transcribeInto(path, "transcription", "insert");
    } catch (e) {
      toast.error(String(e));
    }
  };

  const doRegenerate = async () => {
    setRegenOpen(false);
    if (!audioPath) return;
    await transcribeInto(audioPath, "regeneration", "replace");
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
      toast.success("Compte-rendu enregistré.");
      await loadVersions(saved.id);
      onSaved(saved);
    } catch (e) {
      toast.error(String(e));
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
      toast.error("Réécoute impossible : " + String(e));
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
    toast.success("Version restaurée. Enregistrez pour la conserver.");
  };

  const exportPdf = async () => {
    try {
      const path = await saveDialog({
        defaultPath: `${defaultBase()}.pdf`,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!path) return;
      await saveBytes(path, buildPdf(html, meta()));
      toast.success("PDF exporté : " + fileName(path));
    } catch (e) {
      toast.error("Export PDF impossible : " + String(e));
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
      toast.success("DOCX exporté : " + fileName(path));
    } catch (e) {
      toast.error("Export DOCX impossible : " + String(e));
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
      toast.success("Audio téléchargé : " + fileName(path));
    } catch (e) {
      toast.error("Téléchargement impossible : " + String(e));
    }
  };

  const hasContent = blocksToPlainText(parseEditorHtml(html)).trim().length > 0;

  return (
    <div className="flex h-screen flex-col">
      {/* Bandeau document */}
      <header className="flex items-center gap-3 border-b bg-background/75 px-5 py-2.5 backdrop-blur">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-4" /> Bibliothèque
        </Button>
        <span className="font-mono text-xs text-muted-foreground">{patient.nom}</span>
        <Input
          className="max-w-md flex-1 border-transparent text-base font-semibold shadow-none hover:border-input focus-visible:border-input"
          value={titre}
          onChange={(e) => {
            setTitre(e.target.value);
            setDirty(true);
          }}
          placeholder="Titre du compte-rendu"
        />
        <Select value={typeCr} onValueChange={applyType}>
          <SelectTrigger className="w-[240px]" title="Type de compte-rendu">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REPORT_TYPES.map((t) => (
              <SelectItem key={t.key} value={t.key}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          className="w-[150px]"
          value={dateConsult}
          onChange={(e) => {
            setDateConsult(e.target.value);
            setDirty(true);
          }}
        />
        <Badge
          variant="outline"
          className={cn(
            "gap-1.5",
            dirty ? "border-warning/40 text-warning" : "border-success/40 text-success"
          )}
        >
          <Circle className={cn("size-2 fill-current")} />
          {dirty ? "Non enregistré" : "Enregistré"}
        </Badge>
        <Button onClick={save} disabled={transcribing}>
          Enregistrer
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto bg-muted/40 p-6">
        {/* Bandeau de dictée (sombre) */}
        <div className="mb-5 flex items-center gap-4 rounded-xl bg-foreground px-4 py-3 text-background">
          {recording ? (
            <>
              <Button variant="destructive" onClick={stopRecording}>
                <Square className="size-4 fill-current" /> Arrêter et transcrire
              </Button>
              <span className="size-2.5 animate-pulse rounded-full bg-destructive" />
              <span className="font-mono text-xl font-medium tabular-nums">
                {formatDuration(seconds)}
              </span>
              <div className="h-1.5 w-32 overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full bg-primary transition-[width] duration-75"
                  style={{ width: `${Math.round(level * 100)}%` }}
                />
              </div>
              <span className="font-mono text-xs text-white/60">Micro actif</span>
            </>
          ) : (
            <>
              <Button variant="destructive" onClick={startRecording} disabled={transcribing}>
                <Circle className="size-3.5 fill-current" />
                {audioPath ? "Reprendre la dictée" : "Démarrer la dictée"}
              </Button>
              {audioPath && (
                <Button
                  variant="ghost"
                  className="text-white hover:bg-white/10 hover:text-white"
                  onClick={replay}
                >
                  <Play className="size-4" /> Réécouter
                </Button>
              )}
              <div className="flex-1" />
              {audioPath && (
                <Button
                  variant="ghost"
                  className="text-white hover:bg-white/10 hover:text-white"
                  onClick={() => setRegenOpen(true)}
                  disabled={transcribing || !modelOk}
                >
                  <RefreshCw className="size-4" /> Régénérer le texte depuis l'audio
                </Button>
              )}
            </>
          )}
        </div>

        {/* Modèle absent */}
        {!modelOk && (
          <Card className="mb-5 flex flex-row items-start gap-3 border-warning/30 bg-warning/5 p-4">
            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-warning" />
            <div className="text-sm">
              <strong>Le modèle de transcription n'est pas encore installé.</strong>
              <p className="mt-1 text-muted-foreground">
                Vous pouvez dicter et conserver l'audio dès maintenant. Le texte
                sera généré une fois le modèle placé dans :{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                  {modelDir || "…"}
                </code>
              </p>
            </div>
          </Card>
        )}

        {/* Transcription en cours */}
        {transcribing && (
          <Card className="mb-5 flex flex-col items-center p-10 text-center">
            <Loader2 className="mb-3 size-6 animate-spin text-primary" />
            <h3 className="text-sm font-semibold">Transcription en cours</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Quelques secondes. Le texte s'affichera ici automatiquement, votre
              audio est déjà en sécurité.
            </p>
          </Card>
        )}

        {/* Éditeur + colonne latérale */}
        <div className="flex items-start gap-6">
          <div className="min-w-0 flex-1">
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

          <div className="flex w-64 shrink-0 flex-col gap-5">
            <Card className="gap-0 overflow-hidden py-0">
              <div className="border-b bg-muted/40 px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Exports
              </div>
              <div className="flex flex-col gap-2 p-3">
                <Button variant="outline" className="justify-start" onClick={exportPdf} disabled={!hasContent}>
                  <FileText className="size-4" /> Exporter en PDF
                </Button>
                <Button variant="outline" className="justify-start" onClick={exportDocx} disabled={!hasContent}>
                  <FileText className="size-4" /> Exporter en DOCX
                </Button>
                <Button variant="outline" className="justify-start" onClick={downloadAudio} disabled={!audioPath}>
                  <Download className="size-4" /> Télécharger l'audio
                </Button>
              </div>
            </Card>

            <Card className="gap-0 overflow-hidden py-0">
              <div className="border-b bg-muted/40 px-4 py-2.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Versions
              </div>
              {versions.length === 0 ? (
                <p className="p-3.5 text-xs text-muted-foreground">
                  Les versions apparaîtront après le premier enregistrement.
                </p>
              ) : (
                <>
                  {versions.map((v, i) => (
                    <div
                      key={v.id}
                      className={cn(
                        "flex items-center justify-between gap-2 border-b px-3.5 py-2.5 last:border-b-0",
                        i === 0 && "bg-accent/60"
                      )}
                    >
                      <div>
                        <div className="text-[13px] font-semibold">
                          {i === 0 ? "Version actuelle" : ORIGINE_LABEL[v.origine]}
                        </div>
                        <div className="font-mono text-[11px] text-muted-foreground">
                          {ORIGINE_LABEL[v.origine].toLowerCase()} · {formatDateTime(v.created_at)}
                        </div>
                      </div>
                      {i !== 0 && (
                        <Button size="icon" variant="ghost" className="size-7" title="Restaurer" onClick={() => restoreVersion(v)}>
                          <RotateCcw className="size-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <p className="p-3 text-[11px] text-muted-foreground">
                    Chaque dictée ou régénération archive automatiquement une
                    version. Rien n'est perdu.
                  </p>
                </>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* Modale de régénération */}
      <Dialog open={regenOpen} onOpenChange={setRegenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Régénérer le texte ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Le texte actuel sera remplacé par une nouvelle transcription de
            l'audio. La version actuelle sera conservée dans l'historique et
            restera restaurable.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegenOpen(false)}>
              Annuler
            </Button>
            <Button onClick={doRegenerate}>Régénérer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function fileName(p: string): string {
  return p.split(/[\\/]/).pop() ?? p;
}
