import { useEffect, useState } from "react";
import { authIsConfigured, authSetup, authVerify } from "../api";

export default function Login({ onSuccess }: { onSuccess: () => void }) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
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
        else setError("Mot de passe incorrect.");
      } else {
        if (password.length < 4) {
          setError("Le mot de passe doit contenir au moins 4 caractères.");
        } else if (password !== confirm) {
          setError("Les mots de passe ne correspondent pas.");
        } else {
          await authSetup(password);
          onSuccess();
        }
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="login-logo" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            width="24"
            height="24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="9" y="2" width="6" height="12" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0" />
            <line x1="12" y1="18" x2="12" y2="22" />
          </svg>
        </div>
        <h1>Dictée médicale</h1>
        <p>
          {configured === null
            ? "Chargement…"
            : configured
            ? "Saisissez votre mot de passe local"
            : "Créez votre mot de passe local"}
        </p>

        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          autoFocus
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy || configured === null}
        />
        {configured === false && (
          <input
            type="password"
            placeholder="Confirmer le mot de passe"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            disabled={busy}
          />
        )}

        <div className="error">{error}</div>

        <button className="primary" type="submit" disabled={busy || !password}>
          {configured === false ? "Créer et entrer" : "Déverrouiller"}
        </button>
        <div className="disclaimer">
          <strong>Données de santé, stockage 100 % local.</strong>
          <span>
            Pour des raisons de réglementation et de sécurité, toutes les données
            restent sur cet ordinateur : aucune sauvegarde automatique, aucun
            envoi vers le cloud. Pensez à <strong>exporter vos comptes-rendus
            (PDF / DOCX)</strong> pour les conserver et les sauvegarder ailleurs.
          </span>
        </div>
      </form>
    </div>
  );
}
