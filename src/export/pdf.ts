import { jsPDF } from "jspdf";
import { parseEditorHtml } from "./parse";
import { BRAND } from "../brand";
import type { ExportMeta } from "./docx";

// Couleurs déterministes issues de la charte graphique CCVR.
const CARDINAL = BRAND.cardinal.rgb;
const ANTHRACITE = BRAND.anthracite.rgb;
const GRIS = BRAND.grisMoyen.rgb;
const SEP = BRAND.grisSeparateur.rgb;

export function buildPdf(html: string, meta: ExportMeta): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 56;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const maxW = pageW - margin * 2;
  let y = margin;

  const footer = () => {
    const page = doc.getNumberOfPages();
    doc.setDrawColor(...SEP);
    doc.setLineWidth(0.5);
    doc.line(margin, pageH - 40, pageW - margin, pageH - 40);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRIS);
    doc.text(
      `${BRAND.name} — Document confidentiel`,
      margin,
      pageH - 26
    );
    doc.text(`Page ${page}`, pageW - margin, pageH - 26, { align: "right" });
  };

  const ensureSpace = (lineH: number) => {
    if (y + lineH > pageH - 60) {
      footer();
      doc.addPage();
      y = margin;
    }
  };

  const writeParagraph = (
    text: string,
    opts: { size: number; bold: boolean; color: number[]; bullet?: boolean }
  ) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.size);
    doc.setTextColor(opts.color[0], opts.color[1], opts.color[2]);
    const indent = opts.bullet ? 16 : 0;
    const prefix = opts.bullet ? "•  " : "";
    const lines = doc.splitTextToSize(prefix + text, maxW - indent) as string[];
    const lineH = opts.size * 1.4;
    for (const line of lines) {
      ensureSpace(lineH);
      doc.text(line, margin + indent, y);
      y += lineH;
    }
  };

  // ---- En-tête de marque ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...ANTHRACITE);
  doc.text(BRAND.name, margin, y);
  y += 15;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...GRIS);
  doc.text(`${BRAND.praticien} — ${BRAND.specialite}, ${BRAND.lieu}`, margin, y);
  y += 12;
  // Filet Rouge Cardinal
  doc.setDrawColor(...CARDINAL);
  doc.setLineWidth(2);
  doc.line(margin, y, pageW - margin, y);
  y += 26;

  // ---- Type (eyebrow) + titre + métadonnées ----
  if (meta.type) {
    writeParagraph(meta.type.toUpperCase(), {
      size: 9.5,
      bold: true,
      color: CARDINAL,
    });
    y += 2;
  }
  writeParagraph(meta.titre || "Compte-rendu de consultation", {
    size: 19,
    bold: true,
    color: ANTHRACITE,
  });
  y += 6;
  writeParagraph(`Patient : ${meta.patient}`, {
    size: 10.5,
    bold: false,
    color: GRIS,
  });
  writeParagraph(`Date de consultation : ${meta.dateConsultation}`, {
    size: 10.5,
    bold: false,
    color: GRIS,
  });
  y += 16;

  // ---- Corps ----
  const blocks = parseEditorHtml(html);
  for (const b of blocks) {
    const text = b.runs.map((r) => r.text).join("");
    const bold = b.runs.length > 0 && b.runs.every((r) => r.bold);
    if (b.type === "h1") {
      y += 8;
      writeParagraph(text, { size: 15, bold: true, color: CARDINAL });
      y += 3;
    } else if (b.type === "h2") {
      y += 6;
      writeParagraph(text, { size: 13, bold: true, color: ANTHRACITE });
      y += 3;
    } else if (b.type === "li") {
      writeParagraph(text, { size: 11, bold, color: ANTHRACITE, bullet: true });
    } else if (text.trim() === "") {
      y += 8;
    } else {
      writeParagraph(text, { size: 11, bold, color: ANTHRACITE });
      y += 5;
    }
  }

  footer();
  const ab = doc.output("arraybuffer");
  return new Uint8Array(ab);
}
