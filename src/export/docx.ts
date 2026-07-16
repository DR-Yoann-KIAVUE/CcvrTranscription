import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { parseEditorHtml, type Run } from "./parse";
import { BRAND } from "../brand";

export interface ExportMeta {
  patient: string;
  dateConsultation: string;
  titre: string;
  type?: string | null;
}

const CARDINAL = BRAND.cardinal.hex;
const ANTHRACITE = BRAND.anthracite.hex;
const GRIS = BRAND.grisMoyen.hex;

function runsToText(runs: Run[], color = ANTHRACITE): TextRun[] {
  if (runs.length === 0) return [new TextRun({ text: "", color })];
  return runs.map((r) => new TextRun({ text: r.text, bold: r.bold, color }));
}

export async function buildDocx(
  html: string,
  meta: ExportMeta
): Promise<Uint8Array> {
  const blocks = parseEditorHtml(html);

  const children: Paragraph[] = [
    // En-tête de marque
    new Paragraph({
      children: [
        new TextRun({ text: BRAND.name, bold: true, size: 26, color: ANTHRACITE }),
      ],
    }),
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: `${BRAND.praticien} — ${BRAND.specialite}, ${BRAND.lieu}`,
          size: 19,
          color: GRIS,
        }),
      ],
    }),
    // Filet Rouge Cardinal
    new Paragraph({
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 18, color: CARDINAL, space: 1 },
      },
      spacing: { after: 220 },
      children: [],
    }),
    // Type de compte-rendu (eyebrow)
    ...(meta.type
      ? [
          new Paragraph({
            spacing: { after: 20 },
            children: [
              new TextRun({
                text: meta.type.toUpperCase(),
                bold: true,
                size: 17,
                color: CARDINAL,
              }),
            ],
          }),
        ]
      : []),
    // Titre
    new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: meta.titre || "Compte-rendu de consultation",
          bold: true,
          size: 34,
          color: ANTHRACITE,
        }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: `Patient : ${meta.patient}`, size: 21, color: GRIS }),
      ],
    }),
    new Paragraph({
      spacing: { after: 220 },
      children: [
        new TextRun({
          text: `Date de consultation : ${meta.dateConsultation}`,
          size: 21,
          color: GRIS,
        }),
      ],
    }),
  ];

  for (const b of blocks) {
    if (b.type === "h1") {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 160, after: 60 },
          children: runsToText(b.runs, CARDINAL),
        })
      );
    } else if (b.type === "h2") {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 120, after: 40 },
          children: runsToText(b.runs, ANTHRACITE),
        })
      );
    } else if (b.type === "li") {
      children.push(
        new Paragraph({ bullet: { level: 0 }, children: runsToText(b.runs) })
      );
    } else {
      children.push(
        new Paragraph({ spacing: { after: 120 }, children: runsToText(b.runs) })
      );
    }
  }

  const doc = new Document({
    creator: BRAND.name,
    title: meta.titre,
    sections: [
      {
        properties: {},
        children,
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `${BRAND.name} — Document confidentiel`,
                    size: 16,
                    color: GRIS,
                  }),
                ],
              }),
            ],
          }),
        },
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  return new Uint8Array(await blob.arrayBuffer());
}
