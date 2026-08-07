import { useEffect, useState } from "react";
import {
  authForgotPassword,
  authIsConfigured,
  authSetup,
  authVerify,
} from "../api";
import { LogoMark } from "@/components/Logo";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

export default function Login({ onSuccess }: { onSuccess: () => void }) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    authIsConfigured()
      .then(setConfigured)
      .catch((e) => setError(String(e)));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (configured) {
        const ok = await authVerify(password);
        if (ok) onSuccess();
        else setError("Mot de passe incorrect. Réessayez.");
      } else if (password.length < 8) {
        setError("Le mot de passe doit contenir au moins 8 caractères.");
      } else if (password !== confirm) {
        setError("Les mots de passe ne correspondent pas.");
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setError("Saisissez une adresse e-mail valide.");
      } else {
        await authSetup(password, email.trim());
        onSuccess();
      }
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
      setPassword("");
      setInfo(
        `Un code à 6 chiffres a été envoyé à ${masked}. Saisissez-le ci-dessus comme mot de passe : c'est votre nouveau mot de passe (modifiable ensuite dans les Réglages).`
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
            {configured === null ? (
              <h2 className="text-lg font-semibold">Chargement…</h2>
            ) : configured ? (
              <h2 className="text-lg font-semibold">Bonjour, Dr Kiavué</h2>
            ) : (
              <div>
                <h2 className="text-lg font-semibold">Créer votre mot de passe</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Il protège vos comptes-rendus sur cet ordinateur. En cas
                  d'oubli, un code de récupération pourra être envoyé à votre
                  adresse e-mail.
                </p>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="pwd" className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                Mot de passe
              </Label>
              <Input
                id="pwd"
                type="password"
                placeholder={configured ? "" : "8 caractères minimum"}
                value={password}
                autoFocus
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy || configured === null}
              />
            </div>

            {configured === false && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="confirm" className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    Confirmer
                  </Label>
                  <Input
                    id="confirm"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    disabled={busy}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email" className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    Adresse e-mail
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="pour récupérer le mot de passe en cas d'oubli"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={busy}
                  />
                </div>
              </>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
            {info && <p className="text-sm text-success">{info}</p>}

            <Button type="submit" disabled={busy || !password} className="w-full">
              {configured === false ? "Créer et ouvrir" : "Déverrouiller"}
            </Button>

            {configured && (
              <button
                type="button"
                onClick={forgotPassword}
                disabled={busy}
                className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
              >
                Mot de passe oublié ?
              </button>
            )}
          </form>
        </CardContent>
      </Card>

      <p className="flex max-w-[380px] items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <Lock className="size-3" />
        Toutes vos données restent sur cet ordinateur. Aucune connexion internet
        requise.
      </p>
    </div>
  );
}
