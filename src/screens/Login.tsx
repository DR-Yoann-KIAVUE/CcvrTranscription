import { useEffect, useState } from "react";
import {
  authForgotPassword,
  authIsDefaultCode,
  authPopupAck,
  authPopupPending,
  authVerify,
  getLetterheadJson,
} from "../api";
import { parseLetterhead } from "../export/letter";
import { LogoMark } from "@/components/Logo";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { KeyRound, Lock } from "lucide-react";

export default function Login({ onSuccess }: { onSuccess: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [defaultCode, setDefaultCode] = useState(false);
  const [showMigration, setShowMigration] = useState(false);
  const [praticien, setPraticien] = useState("");

  useEffect(() => {
    authIsDefaultCode().then(setDefaultCode).catch(() => {});
    authPopupPending().then(setShowMigration).catch(() => {});
    getLetterheadJson()
      .then((raw) => {
        const lh = parseLetterhead(raw);
        const full = `${lh.prenom.trim()} ${lh.nom.trim()}`.trim();
        if (full) setPraticien(`Dr ${full}`);
      })
      .catch(() => {});
  }, []);

  const closeMigration = () => {
    setShowMigration(false);
    authPopupAck().catch(() => {});
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const ok = await authVerify(code);
      if (ok) onSuccess();
      else setError("Code incorrect. Réessayez.");
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const forgotPassword = async () => {
    setError("");
    setInfo("");
    setBusy(true);
    try {
      const masked = await authForgotPassword();
      setCode("");
      setInfo(
        `Un code à 6 chiffres a été envoyé à ${masked}. Saisissez-le ci-dessus : c'est votre nouveau code d'accès (modifiable ensuite dans les Réglages).`
      );
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-7 p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
          <LogoMark className="size-7" />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">CCVR Dictée</h1>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Clinique Cardiovasculaire Raphaëloise
          </p>
        </div>
      </div>

      <Card className="w-[380px] border-border/70 shadow-xl shadow-black/5 backdrop-blur-sm">
        <CardContent className="pt-6">
          <form onSubmit={submit} className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold">
              {praticien ? `Bonjour, ${praticien}` : "Bonjour"}
            </h2>

            <div className="grid gap-2">
              <Label htmlFor="code" className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Code d'accès
              </Label>
              <Input
                id="code"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={code}
                autoFocus
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                disabled={busy}
              />
              {defaultCode && (
                <p className="text-xs text-muted-foreground">
                  Code par défaut : <strong className="text-foreground">0000</strong>{" "}
                  — pensez à le changer dans les Réglages.
                </p>
              )}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {info && <p className="text-sm text-success">{info}</p>}

            <Button type="submit" disabled={busy || !code} className="w-full">
              Déverrouiller
            </Button>

            <button
              type="button"
              onClick={forgotPassword}
              disabled={busy}
              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
            >
              Code oublié ?
            </button>
          </form>
        </CardContent>
      </Card>

      <p className="flex max-w-[380px] items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <Lock className="size-3" />
        Toutes vos données restent sur cet ordinateur. Aucune connexion internet
        requise.
      </p>

      <Dialog open={showMigration} onOpenChange={(o) => !o && closeMigration()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <KeyRound className="size-7" />
            </div>
            <DialogTitle className="text-center text-xl">
              Nouveau système de code d'accès
            </DialogTitle>
            <DialogDescription className="text-center text-sm">
              Le mot de passe est remplacé par un digicode (chiffres uniquement).
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/40 p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Votre ancien mot de passe ne fonctionne plus. Votre nouveau code
              d'accès est :
            </p>
            <p className="mt-2 font-mono text-3xl font-bold tracking-[0.3em]">
              0000
            </p>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Vous êtes invité à le changer dès maintenant dans{" "}
            <strong className="text-foreground">Réglages → Sécurité</strong>{" "}
            (une fois connecté).
          </p>
          <Button onClick={closeMigration} className="w-full" size="lg">
            J'ai compris
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
