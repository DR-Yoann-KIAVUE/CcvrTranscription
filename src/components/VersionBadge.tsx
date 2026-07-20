import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";

export function VersionBadge({ upToDate }: { upToDate?: boolean }) {
  const [version, setVersion] = useState("");

  useEffect(() => {
    getVersion()
      .then((v) => setVersion(v))
      .catch(() => setVersion(""));
  }, []);

  if (!version) return null;
  return (
    <div className="pointer-events-none fixed bottom-2 left-3 z-40 select-none font-mono text-[11px] text-muted-foreground">
      v{version}
      {upToDate && <span className="text-success"> · à jour</span>}
    </div>
  );
}
