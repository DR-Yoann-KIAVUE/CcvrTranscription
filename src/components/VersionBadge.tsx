import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";

// Affiche en permanence la version de l'application en bas à gauche.
export function VersionBadge() {
  const [version, setVersion] = useState("");

  useEffect(() => {
    getVersion()
      .then((v) => setVersion(v))
      .catch(() => setVersion(""));
  }, []);

  if (!version) return null;
  return <div className="version-badge">v{version}</div>;
}
