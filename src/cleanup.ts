// Nettoyage léger de la sortie Whisper : espaces, capitalisation,
// et regroupement en paragraphes de longueur naturelle (HTML pour l'éditeur).

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function cleanTranscript(raw: string): string {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return "<p></p>";

  // Découpe en phrases en conservant la ponctuation finale.
  const sentences = (text.match(/[^.!?…]+[.!?…]*/g) ?? [text])
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s));

  // Regroupe les phrases en paragraphes d'environ 300 caractères, sans couper
  // une phrase. Donne un rendu proche d'un compte-rendu rédigé.
  const paragraphs: string[] = [];
  let current = "";
  for (const s of sentences) {
    if (current && current.length + s.length > 300) {
      paragraphs.push(current.trim());
      current = "";
    }
    current += (current ? " " : "") + s;
  }
  if (current.trim()) paragraphs.push(current.trim());

  return paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
}
