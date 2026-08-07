// Export PDF au format « courrier confraternel » (d'après les modèles du
// cabinet) : en-tête praticien, date, formule d'appel, corps (rubriques),
// signature et mentions. Utilisé quand un modèle de courrier est sélectionné.

import { jsPDF } from "jspdf";
import { parseEditorHtml, type Run } from "./parse";
import type { LetterTemplate } from "../letterTemplates";

export interface Letterhead {
  prenom: string;
  nom: string;
  titre: string;
  adresse: string;
  ville: string;
  tel: string;
}

export const DEFAULT_LETTERHEAD: Letterhead = {
  prenom: "",
  nom: "",
  titre: "CARDIOLOGUE",
  adresse: "87 Avenue Archimède",
  ville: "83700 Saint-Raphaël",
  tel: "Tél: 0783468337",
};

/** JSON stocké -> Letterhead (ignore un éventuel ancien format). */
export function parseLetterhead(raw: string | null): Letterhead {
  if (!raw) return DEFAULT_LETTERHEAD;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !("signature" in parsed)) {
      return { ...DEFAULT_LETTERHEAD, ...parsed };
    }
  } catch {
    /* JSON invalide : on repart des valeurs par défaut */
  }
  return DEFAULT_LETTERHEAD;
}

/** "Dr Yoann KIAVUÉ" — nom affiché en tête de courrier ("" si non renseigné). */
export function letterheadName(lh: Letterhead): string {
  const full = `${lh.prenom.trim()} ${lh.nom.trim().toUpperCase()}`.trim();
  return full ? `Dr ${full}` : "";
}

/** "Docteur KIAVUÉ Yoann, cardiologue." — ligne de signature. */
export function letterheadSignature(lh: Letterhead): string {
  const full = `${lh.nom.trim().toUpperCase()} ${lh.prenom.trim()}`.trim();
  const titre = lh.titre.trim().toLowerCase() || "cardiologue";
  return full ? `Docteur ${full}, ${titre}.` : "";
}

/** "2026-08-07" -> "Le 7 août 2026". */
export function frenchLetterDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  if (isNaN(d.getTime())) return `Le ${isoDate}`;
  return (
    "Le " +
    d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
  );
}

/** "2026-08-07" -> "07/08/2026". */
export function shortFrenchDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

export function buildLetterPdf(
  html: string,
  opts: {
    letterhead: Letterhead;
    template: LetterTemplate;
    dateConsultation: string;
  }
): Uint8Array {
  const { letterhead, template } = opts;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 64;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const maxW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (lineH: number) => {
    if (y + lineH > pageH - 56) {
      doc.addPage();
      y = margin;
    }
  };

  // Paragraphe avec gras au fil du texte (libellés de rubriques).
  const writeRuns = (runs: Run[], size: number, lineGap = 1.45) => {
    const lineH = size * lineGap;
    doc.setFontSize(size);
    doc.setTextColor(20, 20, 20);
    let x = margin;
    const newline = () => {
      x = margin;
      y += lineH;
    };
    ensureSpace(lineH);
    for (const run of runs) {
      doc.setFont("helvetica", run.bold ? "bold" : "normal");
      const words = run.text.split(/(\s+)/);
      for (const w of words) {
        if (!w) continue;
        const width = doc.getTextWidth(w);
        if (x + width > margin + maxW && x > margin) {
          newline();
          ensureSpace(0);
          if (/^\s+$/.test(w)) continue;
        }
        if (/^\s+$/.test(w) && x === margin) continue;
        doc.text(w, x, y);
        x += width;
      }
    }
    y += lineH;
  };

  const writeLine = (
    text: string,
    o: {
      size: number;
      bold?: boolean;
      italic?: boolean;
      align?: "left" | "right" | "center";
      x?: number;
      color?: [number, number, number];
      gap?: number;
    }
  ) => {
    const style = o.bold ? "bold" : o.italic ? "italic" : "normal";
    doc.setFont("helvetica", style);
    doc.setFontSize(o.size);
    const c = o.color ?? [20, 20, 20];
    doc.setTextColor(c[0], c[1], c[2]);
    const lineH = o.size * (o.gap ?? 1.35);
    ensureSpace(lineH);
    const x = o.x ?? (o.align === "right" ? pageW - margin : margin);
    doc.text(text, x, y, { align: o.align ?? "left" });
    y += lineH;
  };

  // ---- En-tête praticien (bloc centré sur la colonne de gauche) ----
  const headX = margin + 100;
  const headName = letterheadName(letterhead);
  if (headName) {
    writeLine(headName, { size: 15, bold: true, align: "center", x: headX, gap: 1.15 });
  }
  writeLine(letterhead.titre, { size: 10, align: "center", x: headX, gap: 1.25 });
  writeLine(letterhead.adresse, { size: 10, italic: true, align: "center", x: headX, gap: 1.25 });
  writeLine(letterhead.ville, { size: 10, italic: true, align: "center", x: headX, gap: 1.25 });
  writeLine(letterhead.tel, { size: 10, italic: true, align: "center", x: headX, gap: 1.25 });
  y += 8;

  // ---- Date à droite ----
  writeLine(frenchLetterDate(opts.dateConsultation), {
    size: 11.5,
    align: "right",
  });
  y += 10;

  // ---- Formule d'appel ----
  writeLine(template.salutation, { size: 11.5 });
  y += 8;

  // ---- Corps (contenu de l'éditeur : intro, rubriques, clôture) ----
  const blocks = parseEditorHtml(html);
  for (const b of blocks) {
    const text = b.runs.map((r) => r.text).join("").trim();
    if (text === "") {
      y += 6;
      continue;
    }
    if (b.type === "li") {
      writeRuns([{ text: "-  ", bold: false }, ...b.runs], 11.5);
    } else {
      writeRuns(b.runs, 11.5);
    }
    y += 6;
  }
  y += 8;

  // ---- Signature ----
  const sig = letterheadSignature(letterhead);
  if (sig) writeLine(sig, { size: 11.5 });
  writeLine(shortFrenchDate(opts.dateConsultation), { size: 11.5 });
  y += 14;

  // ---- Mentions ----
  for (const mention of template.mentions) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    const lines = doc.splitTextToSize(mention, maxW) as string[];
    for (const line of lines) {
      ensureSpace(13);
      doc.text(line, margin, y);
      y += 13;
    }
    y += 6;
  }

  return new Uint8Array(doc.output("arraybuffer"));
}
