import { useState } from "react";
import Login from "./screens/Login";
import Library from "./screens/Library";
import Dictation from "./screens/Dictation";
import type { CompteRendu, Patient } from "./types";

type View =
  | { name: "login" }
  | { name: "library" }
  | { name: "dictation"; patient: Patient; existing: CompteRendu | null };

export default function App() {
  const [view, setView] = useState<View>({ name: "login" });
  const [refreshKey, setRefreshKey] = useState(0);

  if (view.name === "login") {
    return <Login onSuccess={() => setView({ name: "library" })} />;
  }

  if (view.name === "dictation") {
    return (
      <div style={{ height: "100%", overflowY: "auto" }}>
        <div className="main">
          <Dictation
            patient={view.patient}
            existing={view.existing}
            onBack={() => {
              setRefreshKey((k) => k + 1);
              setView({ name: "library" });
            }}
            onSaved={() => setRefreshKey((k) => k + 1)}
          />
        </div>
      </div>
    );
  }

  return (
    <Library
      refreshKey={refreshKey}
      onOpen={(patient, existing) =>
        setView({ name: "dictation", patient, existing })
      }
    />
  );
}
