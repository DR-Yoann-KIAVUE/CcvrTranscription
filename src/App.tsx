import { useState } from "react";
import Login from "./screens/Login";
import Library from "./screens/Library";
import Dictation from "./screens/Dictation";
import { UpdateBanner } from "./components/UpdateBanner";
import { VersionBadge } from "./components/VersionBadge";
import { DitherBackground } from "./components/DitherBackground";
import { useUpdater } from "./hooks/useUpdater";
import { Toaster } from "@/components/ui/sonner";
import type { CompteRendu, Patient } from "./types";

type View =
  | { name: "login" }
  | { name: "library" }
  | { name: "dictation"; patient: Patient; existing: CompteRendu | null };

export default function App() {
  const [view, setView] = useState<View>({ name: "login" });
  const [refreshKey, setRefreshKey] = useState(0);
  const updater = useUpdater();

  let screen;
  if (view.name === "login") {
    screen = <Login onSuccess={() => setView({ name: "library" })} />;
  } else if (view.name === "dictation") {
    screen = (
      <Dictation
        patient={view.patient}
        existing={view.existing}
        onBack={() => {
          setRefreshKey((k) => k + 1);
          setView({ name: "library" });
        }}
        onSaved={() => setRefreshKey((k) => k + 1)}
      />
    );
  } else {
    screen = (
      <Library
        refreshKey={refreshKey}
        onLogout={() => setView({ name: "login" })}
        onOpen={(patient, existing) =>
          setView({ name: "dictation", patient, existing })
        }
      />
    );
  }

  return (
    <>
      <DitherBackground />
      <div className="relative z-10 h-full">{screen}</div>
      <UpdateBanner
        update={updater.update}
        phase={updater.phase}
        msg={updater.msg}
        install={updater.install}
      />
      <VersionBadge upToDate={updater.upToDate} />
      <Toaster richColors position="top-center" />
    </>
  );
}
