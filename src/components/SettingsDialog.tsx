import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";
import {
  downloadModel,
  elevenKeyPresent,
  getSttProvider,
  modelPresent,
  setElevenKey,
  setSttProvider,
  type SttProvider,
} from "../api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { AlertTriangle, Cloud, Cpu } from "lucide-react";

export function SettingsDialog({
  open,
  onOpenChange,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onChanged?: () => void;
}) {
  const [provider, setProvider] = useState<SttProvider>("local");
  const [keyPresent, setKeyPresent] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [hasModel, setHasModel] = useState(true);
  const [dlProgress, setDlProgress] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    getSttProvider().then((p) => setProvider(p)).catch(() => {});
    elevenKeyPresent().then(setKeyPresent).catch(() => {});
    modelPresent().then(setHasModel).catch(() => setHasModel(false));
  }, [open]);

  const changeProvider = async (cloud: boolean) => {
    const p: SttProvider = cloud ? "elevenlabs" : "local";
    setProvider(p);
    try {
      await setSttProvider(p);
      onChanged?.();
    } catch (e) {
      toast.error(String(e));
    }
  };

  const saveKey = async () => {
    try {
      await setElevenKey(keyInput);
      setKeyInput("");
      setKeyPresent(true);
      toast.success("Clé ElevenLabs enregistrée.");
    } catch (e) {
      toast.error(String(e));
    }
  };

  const getModel = async () => {
    setDlProgress(0);
    const un = await listen<number>("model-download-progress", (e) =>
      setDlProgress(e.payload)
    );
    try {
      await downloadModel();
      setHasModel(true);
      toast.success("Modèle téléchargé. La dictée locale est prête.");
    } catch (e) {
      toast.error("Téléchargement impossible : " + String(e));
    } finally {
      un();
      setDlProgress(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Réglages — moteur de transcription</DialogTitle>
          <DialogDescription>
            Choisissez comment l'audio est transcrit.
          </DialogDescription>
        </DialogHeader>

        {/* Sélecteur de moteur */}
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="flex items-center gap-2">
            {provider === "elevenlabs" ? (
              <Cloud className="size-4 text-primary" />
            ) : (
              <Cpu className="size-4 text-primary" />
            )}
            <div>
              <div className="text-sm font-semibold">
                {provider === "elevenlabs"
                  ? "Cloud — ElevenLabs"
                  : "Local — Whisper (hors-ligne)"}
              </div>
              <div className="text-xs text-muted-foreground">
                {provider === "elevenlabs"
                  ? "Rapide et léger, mais l'audio est envoyé sur Internet."
                  : "100 % sur cet ordinateur, aucune donnée envoyée."}
              </div>
            </div>
          </div>
          <Switch
            checked={provider === "elevenlabs"}
            onCheckedChange={changeProvider}
          />
        </div>

        {provider === "elevenlabs" ? (
          <>
            <Card className="flex flex-row items-start gap-2 border-warning/30 bg-warning/5 p-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">
                  Données de santé :
                </strong>{" "}
                en mode cloud, l'enregistrement est transmis à ElevenLabs
                (service tiers, hors UE possible). À n'utiliser que si c'est
                conforme à vos obligations (RGPD / hébergement de données de
                santé). En cas de doute, gardez le mode local.
              </p>
            </Card>
            <div className="grid gap-2">
              <Label className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Clé API ElevenLabs {keyPresent && "(configurée)"}
              </Label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder={keyPresent ? "••••••••••••" : "xi-..."}
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                />
                <Button onClick={saveKey} disabled={!keyInput.trim()}>
                  Enregistrer
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                La clé est stockée localement sur cet ordinateur, jamais partagée.
              </p>
            </div>
          </>
        ) : (
          <div className="grid gap-2">
            <div className="text-sm">
              Modèle de transcription :{" "}
              {hasModel ? (
                <span className="text-success">installé ✓</span>
              ) : (
                <span className="text-muted-foreground">non installé</span>
              )}
            </div>
            {!hasModel && dlProgress === null && (
              <Button onClick={getModel}>Télécharger le modèle (~1 Go)</Button>
            )}
            {dlProgress !== null && (
              <div>
                <div className="text-xs text-muted-foreground">
                  Téléchargement du modèle… {dlProgress} %
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-300"
                    style={{ width: `${dlProgress}%` }}
                  />
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Téléchargé une seule fois, puis conservé pour un usage 100 %
              hors-ligne.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
