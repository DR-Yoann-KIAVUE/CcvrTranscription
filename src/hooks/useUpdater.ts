import { useCallback, useEffect, useRef, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type UpdaterPhase = "idle" | "working" | "error";

// Vérifie les mises à jour au lancement, au retour de focus de la fenêtre, et
// périodiquement — pour ne plus dépendre d'un redémarrage complet de l'app.
export function useUpdater() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [phase, setPhase] = useState<UpdaterPhase>("idle");
  const [msg, setMsg] = useState("");
  const [checkedOnce, setCheckedOnce] = useState(false);
  const phaseRef = useRef<UpdaterPhase>("idle");
  phaseRef.current = phase;

  const doCheck = useCallback(async () => {
    if (phaseRef.current === "working") return; // pas pendant une installation
    try {
      const u = await check();
      setUpdate(u ?? null);
    } catch {
      // Hors ligne, en dev, ou endpoint injoignable : on ignore.
    } finally {
      setCheckedOnce(true);
    }
  }, []);

  useEffect(() => {
    doCheck();
    const onFocus = () => doCheck();
    const onVisible = () => {
      if (document.visibilityState === "visible") doCheck();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    const id = window.setInterval(doCheck, 30 * 60 * 1000);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(id);
    };
  }, [doCheck]);

  const install = useCallback(async () => {
    if (!update) return;
    setPhase("working");
    setMsg("Téléchargement…");
    try {
      await update.downloadAndInstall((e) => {
        if (e.event === "Progress") setMsg("Installation…");
      });
      await relaunch();
    } catch (e) {
      setPhase("error");
      setMsg("Échec de la mise à jour : " + String(e));
    }
  }, [update]);

  const upToDate = checkedOnce && !update && phase === "idle";
  return { update, phase, msg, install, upToDate };
}
