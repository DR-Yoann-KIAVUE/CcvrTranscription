import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

// Filet de sécurité : une erreur de rendu affiche un message lisible plutôt
// qu'un écran blanc (utile pour diagnostiquer sur la machine de l'utilisateur).
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, font: "13px/1.5 ui-monospace, monospace", color: "#b1121b" }}>
          <strong>Une erreur est survenue au démarrage.</strong>
          <pre style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>
            {String(this.state.error.stack || this.state.error.message)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
