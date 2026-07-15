import { jsPDF } from "jspdf";
import { parseEditorHtml } from "./parse";
import type { ExportMeta } from "./docx";

export function buildPdf(html: string, meta: ExportMeta): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 56;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const maxW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (lineH: number) => {
    if (y + lineH > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeParagraph = (
    text: string,
    opts: { size: number; bold: boolean; bullet?: boolean }
  ) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.size);
    const indent = opts.bullet ? 16 : 0;
    const prefix = opts.bullet ? "•  " : "";
    const lines = doc.splitTextToSize(prefix + text, maxW - indent) as string[];
    const lineH = opts.size * 1.35;
    for (const line of lines) {
      ensureSpace(lineH);
      doc.text(line, margin + indent, y);
      y += lineH;
    }
  };

  // En-tête.
  writeParagraph(meta.titre || "Compte-rendu", { size: 18, bold: true });
  y += 4;
  writeParagraph(`Patient : ${meta.patient}`, { size: 11, bold: false });
  writeParagraph(`Date de consultation : ${meta.dateConsultation}`, {
    size: 11,
    bold: false,
  });
  y += 10;
  doc.setDrawColor(200);
  ensureSpace(12);
  doc.line(margin, y, pageW - margin, y);
  y += 18;

  const blocks = parseEditorHtml(html);
  for (const b of blocks) {
    const text = b.runs.map((r) => r.text).join("");
    // Gras si tous les segments sont gras (simplification pour le PDF).
    const bold = b.runs.length > 0 && b.runs.every((r) => r.bold);
    if (b.type === "h1") {
      y += 6;
      writeParagraph(text, { size: 15, bold: true });
      y += 2;
    } else if (b.type === "h2") {
      y += 4;
      writeParagraph(text, { size: 13, bold: true });
      y += 2;
    } else if (b.type === "li") {
      writeParagraph(text, { size: 11, bold, bullet: true });
    } else if (text.trim() === "") {
      y += 8;
    } else {
      writeParagraph(text, { size: 11, bold });
      y += 4;
    }
  }

  const ab = doc.output("arraybuffer");
  return new Uint8Array(ab);
}
