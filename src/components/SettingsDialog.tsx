import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { toast } from "sonner";
import {
  authChangePassword,
  authGetEmail,
  authSetEmail,
  downloadModel,
  elevenKeyPresent,
  getLetterheadJson,
  setLetterheadJson,
  getSttProvider,
  getSttStreaming,
  modelPresent,
  setElevenKey,
  setSttProvider,
  setSttStreaming,
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
import { AlertTriangle, Cloud, Cpu, KeyRound, Mail } from "lucide-react";
import {
  DEFAULT_LETTERHEAD,
  parseLetterhead,
  type Letterhead,
} from "../export/letter";

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
  const [streaming, setStreaming] = useState(true);
  const [pwdCurrent, setPwdCurrent] = useState("");
  const [pwdNew, setPwdNew] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [letterhead, setLetterhead] = useState<Letterhead>(DEFAULT_LETTERHEAD);

  useEffect(() => {
    if (!open) return;
    getSttProvider().then((p) => setProvider(p)).catch(() => {});
    elevenKeyPresent().then(setKeyPresent).catch(() => {});
    modelPresent().then(setHasModel).catch(() => setHasModel(false));
    getSttStreaming().then(setStreaming).catch(() => {});
    authGetEmail().then((e) => setRecoveryEmail(e ?? "")).catch(() => {});
    getLetterheadJson()
      .then((raw) => setLetterhead(parseLetterhead(raw)))
      .catch(() => {});
    setPwdCurrent("");
    setPwdNew("");
    setPwdConfirm("");
  }, [open]);

  const saveLetterhead = async () => {
    try {
      await setLetterheadJson(JSON.stringify(letterhead));
      toast.success("En-tête des courriers enregistré.");
    } catch (e) {
      toast.error(String(e));
    }
  };

  const lhField = (key: keyof Letterhead, placeholder: string) => (
    <Input
      value={letterhead[key]}
      placeholder={placeholder}
      onChange={(e) => setLetterhead({ ...letterhead, [key]: e.target.value })}
    />
  );

  const changePassword = async () => {
    if (pwdNew !== pwdConfirm) {
      toast.error("Les nouveaux codes ne correspondent pas.");
      return;
    }
    try {
      await authChangePassword(pwdCurrent, pwdNew);
      setPwdCurrent("");
      setPwdNew("");
      setPwdConfirm("");
      toast.success("Code d'accès modifié.");
    } catch (e) {
      toast.error(String(e));
    }
  };

  const saveRecoveryEmail = async () => {
    try {
      await authSetEmail(recoveryEmail);
      toast.success("Adresse e-mail de récupération enregistrée.");
    } catch (e) {
      toast.error(String(e));
    }
  };


  const toggleStreaming = async (on: boolean) => {
    setStreaming(on);
    try {
      await setSttStreaming(on);
      onChanged?.();
    } catch (e) {
      toast.error(String(e));
    }
  };

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
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Réglages</DialogTitle>
          <DialogDescription>
            Moteur de transcription et sécurité.
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
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="text-sm font-semibold">
                  Transcription en temps réel (streaming)
                </div>
                <div className="text-xs text-muted-foreground">
                  {streaming
                    ? "Le texte s'affiche au fil de la parole (WebSocket)."
                    : "Transcription après l'arrêt de la dictée (envoi du fichier)."}
                </div>
              </div>
              <Switch checked={streaming} onCheckedChange={toggleStreaming} />
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

        {/* ---- Sécurité ---- */}
        <div className="mt-2 flex items-center gap-2">
          <KeyRound className="size-4 text-primary" />
          <h3 className="text-sm font-semibold">Sécurité</h3>
        </div>

        <div className="grid gap-2 rounded-lg border p-3">
          <div className="text-sm font-semibold">Changer le code d'accès</div>
          <Input
            type="password"
            inputMode="numeric"
            placeholder="Code actuel"
            value={pwdCurrent}
            onChange={(e) => setPwdCurrent(e.target.value.replace(/\D/g, ""))}
          />
          <Input
            type="password"
            inputMode="numeric"
            placeholder="Nouveau code (4 chiffres min.)"
            value={pwdNew}
            onChange={(e) => setPwdNew(e.target.value.replace(/\D/g, ""))}
          />
          <Input
            type="password"
            inputMode="numeric"
            placeholder="Confirmer le nouveau code"
            value={pwdConfirm}
            onChange={(e) => setPwdConfirm(e.target.value.replace(/\D/g, ""))}
          />
          <Button
            onClick={changePassword}
            disabled={!pwdCurrent || !pwdNew || !pwdConfirm}
          >
            Modifier le code
          </Button>
        </div>

        <div className="grid gap-2 rounded-lg border p-3">
          <div className="text-sm font-semibold">Récupération par e-mail</div>
          <p className="text-xs text-muted-foreground">
            En cas d'oubli, un code à 6 chiffres est envoyé à cette adresse
            depuis l'écran de connexion (« Code oublié ? »).
          </p>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="votre@adresse.fr"
              value={recoveryEmail}
              onChange={(e) => setRecoveryEmail(e.target.value)}
            />
            <Button onClick={saveRecoveryEmail} disabled={!recoveryEmail.trim()}>
              Enregistrer
            </Button>
          </div>
        </div>

        {/* ---- En-tête des courriers ---- */}
        <div className="mt-2 flex items-center gap-2">
          <Mail className="size-4 text-primary" />
          <h3 className="text-sm font-semibold">En-tête des courriers</h3>
        </div>

        <div className="grid gap-2 rounded-lg border p-3">
          <p className="text-xs text-muted-foreground">
            Prénom et nom de l'utilisateur de ce poste : ils apparaissent en
            tête des courriers PDF et dans la signature (« Docteur NOM Prénom,
            cardiologue. »).
          </p>
          <div className="flex gap-2">
            {lhField("prenom", "Prénom")}
            {lhField("nom", "Nom")}
          </div>
          {lhField("titre", "CARDIOLOGUE")}
          {lhField("adresse", "Adresse")}
          {lhField("ville", "Code postal Ville")}
          {lhField("tel", "Tél: …")}
          <Button onClick={saveLetterhead}>Enregistrer l'en-tête</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
