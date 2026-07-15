// Nettoyage léger de la sortie Whisper : espaces, capitalisation,
// et regroupement en paragraphes lisibles (HTML pour l'éditeur).

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function cleanTranscript(raw: string): string {
  let text = raw.replace(/\s+/g, " ").trim();
  if (!text) return "<p></p>";

  // Espaces avant ponctuation double (règle typographique française simple).
  text = text
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([;:!?])(?=\S)/g, "$1 ")
    .replace(/\s{2,}/g, " ");

  // Découpe en phrases en conservant la ponctuation finale.
  const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text];
  const cleaned = sentences
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1));

  // Regroupe ~3 phrases par paragraphe.
  const paragraphs: string[] = [];
  for (let i = 0; i < cleaned.length; i += 3) {
    paragraphs.push(cleaned.slice(i, i + 3).join(" "));
  }

  return paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
}
