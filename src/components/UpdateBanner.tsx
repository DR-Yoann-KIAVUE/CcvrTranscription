import type { Update } from "@tauri-apps/plugin-updater";
import type { UpdaterPhase } from "../hooks/useUpdater";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface Props {
  update: Update | null;
  phase: UpdaterPhase;
  msg: string;
  install: () => void;
}

export function UpdateBanner({ update, phase, msg, install }: Props) {
  if (!update) return null;
  return (
    <div className="fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-4 rounded-xl border bg-card p-4 shadow-lg">
      <Download className="size-5 text-primary" />
      <div className="flex-1">
        <div className="text-sm font-semibold">Mise à jour disponible</div>
        <div className="font-mono text-[11px] text-muted-foreground">
          Version {update.version}
          {phase !== "idle" ? " · " + msg : ""}
        </div>
      </div>
      {phase !== "working" && (
        <Button size="sm" onClick={install}>
          Mettre à jour
        </Button>
      )}
    </div>
  );
}
