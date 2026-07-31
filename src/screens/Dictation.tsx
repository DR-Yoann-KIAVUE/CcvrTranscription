import { useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import {
  copyFile,
  createCompteRendu,
  elevenKeyPresent,
  elevenRealtimeToken,
  getSttProvider,
  getSttStreaming,
  listCrVersions,
  modelPresent,
  saveBytes,
  saveRecording,
  transcribe,
  transcribeElevenlabs,
  updateCompteRendu,
  type Origine,
} from "../api";
import type { CompteRendu, CrVersion, Patient } from "../types";
import { AudioRecorder, type RecordingResult } from "../audio/recorder";
import { StreamingTranscriber } from "../audio/streaming";
import { cleanTranscript } from "../cleanup";
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
  Cloud,
  Cpu,
  Download,
  FileText,
  Loader2,
  Pause,
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
  const [dateConsult, setDateConsult] = useState(
    existing?.date_consultation ?? todayInputValue()
  );
  const [html, setHtml] = useState(existing?.texte ?? "");
  const [audioPath, setAudioPath] = useState<string | null>(existing?.audio_path ?? null);
  const [modelOk, setModelOk] = useState(true);
  const [provider, setProvider] = useState<string>("local");
  const [keyPresent, setKeyPresent] = useState(true);
  const [editorKey, setEditorKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [versions, setVersions] = useState<CrVersion[]>([]);
  const [regenOpen, setRegenOpen] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [cloud, setCloud] = useState(false);

  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);

  // Streaming temps réel (ElevenLabs)
  const [streamingMode, setStreamingMode] = useState(false);
  const [liveFinal, setLiveFinal] = useState("");
  const [livePartial, setLivePartial] = useState("");

  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const originRef = useRef<Origine>("edition");
  const editorRef = useRef<EditorHandle>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const streamerRef = useRef<StreamingTranscriber | null>(null);
  const finalRef = useRef("");
  const partialRef = useRef("");
  const saveTimer = useRef<number | null>(null);
  const firstRun = useRef(true);
  const savingRef = useRef(false);
  const pendingRef = useRef(false);
  const crIdRef = useRef<number | null>(existing?.id ?? null);

  useEffect(() => {
    modelPresent().then(setModelOk).catch(() => setModelOk(false));
    getSttProvider().then(setProvider).catch(() => {});
    elevenKeyPresent().then(setKeyPresent).catch(() => {});
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

  const startTimer = () => {
    setSeconds(0);
    setRecording(true);
    timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  const startRecording = async () => {
    const prov = await getSttProvider().catch(() => "local");
    const streaming =
      prov === "elevenlabs" ? await getSttStreaming().catch(() => true) : false;

    if (streaming) {
      // ---- Streaming temps réel ElevenLabs ----
      try {
        const token = await elevenRealtimeToken();
        finalRef.current = "";
        partialRef.current = "";
        setLiveFinal("");
        setLivePartial("");
        const st = new StreamingTranscriber({
          onPartial: (t) => {
            partialRef.current = t;
            setLivePartial(t);
          },
          onFinal: (t) => {
            finalRef.current = (finalRef.current ? finalRef.current + " " : "") + t;
            partialRef.current = "";
            setLiveFinal(finalRef.current);
            setLivePartial("");
          },
          onError: (m) => toast.error("ElevenLabs : " + m),
          onLevel: setLevel,
        });
        await st.start(token);
        streamerRef.current = st;
        setStreamingMode(true);
        startTimer();
      } catch (e) {
        toast.error("Streaming impossible : " + String(e));
      }
      return;
    }

    // ---- Enregistrement classique (local, ou cloud en différé) ----
    try {
      const rec = new AudioRecorder(setLevel);
      await rec.start();
      recorderRef.current = rec;
      setStreamingMode(false);
      startTimer();
    } catch (e) {
      toast.error("Micro inaccessible : " + String(e));
    }
  };

  const stopRecording = async () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    setRecording(false);
    setLevel(0);

    if (streamerRef.current) {
      // Fin du streaming : récupère l'audio + le texte accumulé.
      try {
        const { wav } = await streamerRef.current.stop();
        streamerRef.current = null;
        setStreamingMode(false);
        const name = `p${patient.id}-${Date.now()}`;
        const path = await saveRecording(wav, name);
        setAudioPath(path);
        const text = (
          finalRef.current + (partialRef.current ? " " + partialRef.current : "")
        ).trim();
        setLivePartial("");
        if (text) {
          editorRef.current?.insertHtml(cleanTranscript(text));
          originRef.current = "transcription";
          toast.success("Transcription insérée. Relisez, corrigez, puis enregistrez.");
        } else {
          toast.error("Aucun texte transcrit (vérifiez le micro et la clé).");
        }
      } catch (e) {
        toast.error(String(e));
      }
      return;
    }

    if (!recorderRef.current) return;
    try {
      const result = await recorderRef.current.stop();
      recorderRef.current = null;
      await onFinished(result);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const transcribeInto = async (
    path: string,
    origine: Origine,
    mode: "insert" | "replace",
    engine: "local" | "elevenlabs"
  ) => {
    const isCloud = engine === "elevenlabs";
    setCloud(isCloud);
    setProgress(0);
    setTranscribing(true);
    const un = isCloud
      ? undefined
      : await listen<number>("transcribe-progress", (e) => setProgress(e.payload));
    try {
      const text = isCloud
        ? await transcribeElevenlabs(path)
        : await transcribe(path);
      if (mode === "replace") setEditorHtml(cleanTranscript(text));
      else if (text) editorRef.current?.insertHtml(cleanTranscript(text));
      originRef.current = origine;
      if (text) toast.success("Transcription insérée. Relisez et corrigez si besoin.");
      else toast.error("Transcription vide, vérifiez le micro et réessayez.");
    } catch (e) {
      toast.error(String(e));
    } finally {
      un?.();
      setTranscribing(false);
    }
  };

  const onFinished = async (result: RecordingResult) => {
    try {
      const name = `p${patient.id}-${Date.now()}`;
      const path = await saveRecording(result.wav, name);
      setAudioPath(path);
      const engine =
        (await getSttProvider().catch(() => "local")) === "elevenlabs"
          ? "elevenlabs"
          : "local";
      await transcribeInto(path, "transcription", "insert", engine);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const doRegenerate = async (engine: "local" | "elevenlabs") => {
    setRegenOpen(false);
    if (!audioPath) return;
    await transcribeInto(audioPath, "regeneration", "replace", engine);
  };

  const doSave = async () => {
    if (savingRef.current) {
      pendingRef.current = true;
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      let s: CompteRendu;
      if (crIdRef.current == null) {
        s = await createCompteRendu({
          patientId: patient.id,
          titre,
          typeCr: null,
          dateConsultation: dateConsult,
          texte: html,
          audioPath,
          origine: originRef.current,
        });
        crIdRef.current = s.id;
      } else {
        s = await updateCompteRendu({
          id: crIdRef.current,
          titre,
          typeCr: null,
          dateConsultation: dateConsult,
          texte: html,
          origine: originRef.current,
        });
      }
      originRef.current = "edition";
      await loadVersions(s.id);
      onSaved(s);
    } catch (e) {
      toast.error("Enregistrement : " + String(e));
    } finally {
      savingRef.current = false;
      setSaving(false);
      if (pendingRef.current) {
        pendingRef.current = false;
        void doSave();
      }
    }
  };

  // Autosave : toute modification (texte, titre, date, audio) est
  // enregistrée automatiquement, sans bouton.
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void doSave(), 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, titre, dateConsult, audioPath]);

  // Élément audio unique + état play/pause synchronisé.
  useEffect(() => {
    const el = new Audio();
    audioElRef.current = el;
    const onPlay = () => setPlaying(true);
    const onStop = () => setPlaying(false);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onStop);
    el.addEventListener("ended", onStop);
    return () => {
      el.pause();
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onStop);
      el.removeEventListener("ended", onStop);
    };
  }, []);

  const replay = async () => {
    if (!audioPath) return;
    const el = audioElRef.current;
    if (!el) return;
    try {
      const src = convertFileSrc(audioPath);
      if (el.src !== src) {
        el.src = src;
        el.load();
      }
      if (el.paused) await el.play();
      else el.pause();
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
          }}
          placeholder="Titre du compte-rendu"
        />
        <Input
          type="date"
          className="w-[150px]"
          value={dateConsult}
          onChange={(e) => {
            setDateConsult(e.target.value);
          }}
        />
        <Badge
          variant="outline"
          className={cn(
            "gap-1.5",
            saving ? "border-warning/40 text-warning" : "border-success/40 text-success"
          )}
          title="Enregistrement automatique"
        >
          <Circle className={cn("size-2 fill-current", saving && "animate-pulse")} />
          {saving ? "Enregistrement…" : "Enregistré"}
        </Badge>
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
                  {playing ? (
                    <>
                      <Pause className="size-4" /> Pause
                    </>
                  ) : (
                    <>
                      <Play className="size-4" /> Réécouter
                    </>
                  )}
                </Button>
              )}
              <div className="flex-1" />
              {audioPath && (
                <Button
                  variant="ghost"
                  className="text-white hover:bg-white/10 hover:text-white"
                  onClick={() => setRegenOpen(true)}
                  disabled={transcribing}
                >
                  <RefreshCw className="size-4" /> Régénérer le texte…
                </Button>
              )}
            </>
          )}
        </div>

        {/* Transcription en direct (streaming) */}
        {streamingMode && (recording || liveFinal || livePartial) && (
          <Card className="mb-5 p-4">
            <div className="mb-1.5 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              <span className="size-2 animate-pulse rounded-full bg-primary" />
              Transcription en direct
            </div>
            <p className="text-sm leading-relaxed">
              {liveFinal} <span className="text-muted-foreground">{livePartial}</span>
              {!liveFinal && !livePartial && (
                <span className="text-muted-foreground">Parlez…</span>
              )}
            </p>
          </Card>
        )}

        {/* Clé ElevenLabs manquante (mode cloud) */}
        {provider === "elevenlabs" && !keyPresent && (
          <Card className="mb-5 flex flex-row items-start gap-3 border-warning/30 bg-warning/5 p-4">
            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-warning" />
            <div className="text-sm">
              <strong>Clé API ElevenLabs non configurée.</strong>
              <p className="mt-1 text-muted-foreground">
                Ouvrez <strong>Réglages</strong> pour coller votre clé ElevenLabs
                (une fois par poste), ou basculez en mode <strong>Local</strong>.
                Vous pouvez enregistrer l'audio dès maintenant.
              </p>
            </div>
          </Card>
        )}

        {/* Modèle absent (mode local uniquement) */}
        {provider === "local" && !modelOk && (
          <Card className="mb-5 flex flex-row items-start gap-3 border-warning/30 bg-warning/5 p-4">
            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-warning" />
            <div className="text-sm">
              <strong>Le modèle de transcription local n'est pas installé.</strong>
              <p className="mt-1 text-muted-foreground">
                Ouvrez <strong>Réglages</strong> pour télécharger le modèle (~1 Go,
                une fois), ou passez en mode <strong>ElevenLabs</strong> (cloud).
                Vous pouvez dicter et conserver l'audio dès maintenant.
              </p>
            </div>
          </Card>
        )}

        {/* Transcription en cours */}
        {transcribing && (
          <Card className="mb-5 flex flex-col items-center p-10 text-center">
            <Loader2 className="mb-3 size-6 animate-spin text-primary" />
            {cloud ? (
              <>
                <h3 className="text-sm font-semibold">
                  Transcription (ElevenLabs) en cours…
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  L'audio est envoyé au service cloud puis transcrit. Le texte
                  s'affichera automatiquement.
                </p>
              </>
            ) : (
              <>
                <h3 className="text-sm font-semibold">
                  {progress === 0
                    ? "Chargement du modèle…"
                    : `Transcription en cours — ${progress} %`}
                </h3>
                <div className="mt-3 h-2 w-full max-w-sm overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Progression sur la durée de l'audio. Votre enregistrement est
                  déjà en sécurité ; le texte s'affichera à la fin.
                </p>
              </>
            )}
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
            l'audio. La version actuelle est conservée dans l'historique
            (restaurable). Choisissez le moteur :
          </p>
          <DialogFooter className="sm:justify-between">
            <Button variant="outline" onClick={() => setRegenOpen(false)}>
              Annuler
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => doRegenerate("local")}
                disabled={!modelOk}
                title={!modelOk ? "Modèle local non installé (Réglages)" : undefined}
              >
                <Cpu className="size-4" /> Whisper local
              </Button>
              <Button onClick={() => doRegenerate("elevenlabs")}>
                <Cloud className="size-4" /> ElevenLabs
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function fileName(p: string): string {
  return p.split(/[\\/]/).pop() ?? p;
}
