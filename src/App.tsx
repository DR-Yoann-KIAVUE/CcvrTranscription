import { useEffect, useState } from "react";

// Échafaudage minimal — remplacé par les écrans réels une fois le build validé.
export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">🩺</div>
        <h1>Dictée médicale</h1>
        <p>v0.1 alpha — 100 % local</p>
        <span className="badge">{ready ? "Fenêtre prête" : "Chargement…"}</span>
      </div>
    </div>
  );
}
