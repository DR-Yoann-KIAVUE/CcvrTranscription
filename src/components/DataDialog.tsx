import { useEffect, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { backupData, dataStats, type DataStats } from "../api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Database, Download, HardDrive } from "lucide-react";

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} Ko`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} Mo`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} Go`;
}

function todayName(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `ccvr-sauvegarde-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function DataDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [stats, setStats] = useState<DataStats | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) dataStats().then(setStats).catch((e) => toast.error(String(e)));
  }, [open]);

  const exportBackup = async () => {
    try {
      const dir = await openDialog({
        directory: true,
        multiple: false,
        title: "Choisir où enregistrer la sauvegarde",
      });
      if (!dir || typeof dir !== "string") return;
      setBusy(true);
      const path = await backupData(dir, todayName());
      toast.success("Sauvegarde enregistrée dans : " + path);
    } catch (e) {
      toast.error("Sauvegarde impossible : " + String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="size-5 text-primary" /> Données & sauvegarde
          </DialogTitle>
          <DialogDescription>
            Toutes vos données sont stockées localement sur cet ordinateur, dans
            une base SQLite. Aucune donnée n'est envoyée sur Internet.
          </DialogDescription>
        </DialogHeader>

        <Card className="p-4">
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label="Patients" value={stats ? String(stats.patients) : "…"} />
            <Stat label="Comptes-rendus" value={stats ? String(stats.comptes_rendus) : "…"} />
            <Stat label="Versions" value={stats ? String(stats.versions) : "…"} />
          </div>
        </Card>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <HardDrive className="size-4 shrink-0" />
          <span>
            Base {stats ? fmtBytes(stats.db_bytes) : "…"} · {stats?.audio_count ?? "…"} audio
            {stats && stats.audio_count > 1 ? "s" : ""} ({stats ? fmtBytes(stats.audio_bytes) : "…"})
          </span>
        </div>

        <div className="rounded-md border bg-muted/40 p-2 font-mono text-[11px] text-muted-foreground break-all">
          {stats?.dir ?? "…"}
        </div>

        <Button onClick={exportBackup} disabled={busy} className="w-full">
          <Download className="size-4" />
          {busy ? "Sauvegarde en cours…" : "Exporter une sauvegarde (base + audio)"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Copie une sauvegarde complète (base + enregistrements) vers un dossier
          ou disque externe de votre choix. À faire régulièrement.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
