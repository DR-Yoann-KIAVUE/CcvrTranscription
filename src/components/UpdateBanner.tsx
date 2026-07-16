import type { Update } from "@tauri-apps/plugin-updater";
import type { UpdaterPhase } from "../hooks/useUpdater";

interface Props {
  update: Update | null;
  phase: UpdaterPhase;
  msg: string;
  install: () => void;
}

export function UpdateBanner({ update, phase, msg, install }: Props) {
  if (!update) return null;
  return (
    <div className="update-banner">
      <div>
        <div className="ub-title">Mise à jour disponible</div>
        <div className="ub-sub">
          Version {update.version}
          {phase !== "idle" ? " · " + msg : ""}
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
