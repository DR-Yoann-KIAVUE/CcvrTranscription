import { useEffect, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

// Vérifie au lancement s'il existe une mise à jour. Si oui, propose un bouton
// « Mettre à jour » qui télécharge, installe et relance l'application.
export function UpdateBanner() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [phase, setPhase] = useState<"idle" | "working" | "error">("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    check()
      .then((u) => {
        if (u) setUpdate(u);
      })
      .catch(() => {
        // Hors ligne, en dev, ou aucun endpoint : on ignore silencieusement.
      });
  }, []);

  if (!update) return null;

  const install = async () => {
    setPhase("working");
    setMsg("Téléchargement…");
    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "Progress") setMsg("Installation…");
      });
      await relaunch();
    } catch (e) {
      setPhase("error");
      setMsg("Échec de la mise à jour : " + String(e));
    }
  };

  return (
    <div className="update-banner">
      <div>
        <div className="ub-title">Mise à jour disponible</div>
        <div className="ub-sub">
          Version {update.version}
          {phase === "working" ? " · " + msg : ""}
          {phase === "error" ? " · " + msg : ""}
        </div>
      </div>
      {phase !== "working" && (
        <button className="primary small" onClick={install}>
          Mettre à jour
        </button>
      )}
    </div>
  );
}
