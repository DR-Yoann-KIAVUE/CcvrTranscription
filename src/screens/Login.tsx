import { useEffect, useState } from "react";
import { authIsConfigured, authSetup, authVerify } from "../api";
import { LogoMark } from "../components/Logo";

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
        else setError("Mot de passe incorrect. Réessayez.");
      } else if (password.length < 8) {
        setError("Le mot de passe doit contenir au moins 8 caractères.");
      } else if (password !== confirm) {
        setError("Les mots de passe ne correspondent pas.");
      } else {
        await authSetup(password);
        onSuccess();
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-brand">
        <LogoMark />
        <h1>CCVR Dictée</h1>
        <div className="sub">Clinique Cardiovasculaire Raphaëloise</div>
      </div>

      <form className="login-card" onSubmit={submit}>
        {configured === null ? (
          <h2>Chargement…</h2>
        ) : configured ? (
          <h2>Bonjour, Dr Kiavué</h2>
        ) : (
          <>
            <h2>Créer votre mot de passe</h2>
            <p className="intro">
              Il protège vos comptes-rendus sur cet ordinateur. Choisissez un
              mot de passe que vous retiendrez : il n'est pas récupérable.
            </p>
          </>
        )}

        <div className="field">
          <label>Mot de passe</label>
          <input
            type="password"
            placeholder={configured ? "" : "8 caractères minimum"}
            value={password}
            autoFocus
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy || configured === null}
          />
        </div>

        {configured === false && (
          <div className="field">
            <label>Confirmer</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={busy}
            />
          </div>
        )}

        <div className="error">{error}</div>

        <button className="primary" type="submit" disabled={busy || !password}>
          {configured === false ? "Créer et ouvrir" : "Déverrouiller"}
        </button>
      </form>

      <div className="login-note">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        Toutes vos données restent sur cet ordinateur. Aucune connexion internet
        requise.
      </div>
    </div>
  );
}
