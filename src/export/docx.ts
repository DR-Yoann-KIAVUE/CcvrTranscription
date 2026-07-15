import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { parseEditorHtml, type Run } from "./parse";

export interface ExportMeta {
  patient: string;
  dateConsultation: string;
  titre: string;
}

function runsToText(runs: Run[]): TextRun[] {
  if (runs.length === 0) return [new TextRun("")];
  return runs.map(
    (r) => new TextRun({ text: r.text, bold: r.bold })
  );
}

export async function buildDocx(
  html: string,
  meta: ExportMeta
): Promise<Uint8Array> {
  const blocks = parseEditorHtml(html);

  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [new TextRun({ text: meta.titre || "Compte-rendu", bold: true, size: 32 })],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Patient : ${meta.patient}`, size: 22 }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Date de consultation : ${meta.dateConsultation}`,
          size: 22,
        }),
      ],
    }),
    new Paragraph({ text: "" }),
  ];

  for (const b of blocks) {
    if (b.type === "h1") {
      children.push(
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: runsToText(b.runs) })
      );
    } else if (b.type === "h2") {
      children.push(
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: runsToText(b.runs) })
      );
    } else if (b.type === "li") {
      children.push(
        new Paragraph({ bullet: { level: 0 }, children: runsToText(b.runs) })
      );
    } else {
      children.push(new Paragraph({ children: runsToText(b.runs) }));
    }
  }

  const doc = new Document({
    creator: "Dictée médicale",
    title: meta.titre,
    sections: [{ properties: {}, children }],
  });

  const blob = await Packer.toBlob(doc);
  return new Uint8Array(await blob.arrayBuffer());
}
