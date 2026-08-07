// Modèles de courriers confraternels (d'après les modèles PDF du cabinet).
// Un modèle définit : la phrase d'introduction (remplie avec le patient), les
// rubriques avec leurs mots-clés de dictée, les textes par défaut, la formule
// de clôture et les mentions de pied de lettre.
//
// Réorganisation par mots-clés : pendant la dictée, le médecin annonce les
// rubriques (« antécédents… », « à l'examen clinique… », « conclusion… ») ;
// le texte est découpé à ces mots-clés et placé sous la bonne rubrique.

import type { Patient } from "./types";

export interface LetterSection {
  /** Libellé imprimé dans le courrier (ex. "Antécédents :"). */
  label: string;
  /** Mots-clés dictés (sans accents, minuscules) qui ouvrent la rubrique. */
  aliases: string[];
  /** Texte pré-rempli (modèles « normaux » type pré-opératoire). */
  defaultText?: string;
}

export interface LetterTemplate {
  key: string;
  label: string;
  salutation: string;
  /** Phrase d'introduction ; "{patient}" est remplacé par nom + naissance + âge. */
  intro: string;
  sections: LetterSection[];
  closing: string;
  /** Mentions en pied de lettre (petits caractères). */
  mentions: string[];
}

const MENTION_DICTEE =
  "Courrier dicté avec un logiciel de reconnaissance vocale, merci d'en excuser les imperfections.";
const MENTION_INFO_PATIENT =
  "Le patient a été informé des modalités, des bénéfices attendus et des effets indésirables éventuels, des prescriptions médicamenteuses, conduite thérapeutique et des examens complémentaires.";

export const LETTER_TEMPLATES: LetterTemplate[] = [
  {
    key: "consultation",
    label: "Consultation",
    salutation: "Cher confrère, Chère consœur,",
    intro: "Contrôle cardiovasculaire réalisé à {patient}",
    sections: [
      {
        label: "Antécédents :",
        // "précédents" : confusion fréquente de la reconnaissance vocale.
        aliases: ["antecedents", "antecedent", "precedents", "precedent"],
      },
      {
        label: "Facteurs de risque :",
        aliases: [
          "facteurs de risques",
          "facteurs de risque",
          "facteur de risques",
          "facteur de risque",
        ],
      },
      {
        label: "Traitement suivi :",
        aliases: ["traitement suivi", "traitement en cours", "traitements", "traitement"],
      },
      {
        label: "A L'EXAMEN CLINIQUE : TA :",
        aliases: ["a l'examen clinique", "examen clinique", "cliniquement"],
      },
      { label: "ECG :", aliases: ["electrocardiogramme", "e c g", "ecg"] },
      {
        label: "L'ECHOCARDIOGRAPHIE :",
        aliases: [
          "echocardiographie",
          "l'echocardiographie",
          "echographie cardiaque",
          "echocardiogramme",
          "a l'echographie",
        ],
      },
      { label: "CONCLUSION :", aliases: ["en conclusion", "conclusion"] },
    ],
    closing: "Amitiés",
    mentions: [MENTION_INFO_PATIENT, MENTION_DICTEE],
  },
  {
    key: "pacemaker",
    label: "Contrôle de pacemaker",
    salutation: "Cher collègue,",
    intro: "Contrôle du pacemaker de {patient}",
    sections: [
      {
        label: "Il s'agit d'un modèle",
        aliases: ["il s'agit d'un modele", "il s'agit d'un pacemaker", "modele"],
      },
      { label: "Conclusion :", aliases: ["en conclusion", "conclusion"] },
    ],
    closing: "Amitiés",
    mentions: [MENTION_DICTEE],
  },
  {
    key: "cardioversion",
    label: "Pré-cardioversion",
    salutation: "Cher confrère, Chère consœur,",
    intro:
      "Contrôle ECG réalisé à {patient} 24 heures avant la cardioversion prévue",
    sections: [
      {
        label: "Traitement suivi :",
        aliases: ["traitement suivi", "traitement en cours", "traitements", "traitement"],
      },
      { label: "L'ECG :", aliases: ["electrocardiogramme", "l'ecg", "e c g", "ecg"] },
      { label: "CONCLUSION :", aliases: ["en conclusion", "conclusion"] },
    ],
    closing: "Amitiés",
    mentions: [MENTION_DICTEE],
  },
  {
    key: "preop",
    label: "Examen pré-opératoire",
    salutation: "Cher confrère, Chère consœur,",
    intro: "J'ai vu {patient} pour un examen pré-opératoire",
    sections: [
      {
        label: "Antécédents :",
        // "précédents" : confusion fréquente de la reconnaissance vocale.
        aliases: ["antecedents", "antecedent", "precedents", "precedent"],
      },
      {
        label: "Facteurs de risque :",
        aliases: [
          "facteurs de risques",
          "facteurs de risque",
          "facteur de risques",
          "facteur de risque",
        ],
      },
      {
        label: "Traitement actuellement suivi :",
        aliases: [
          "traitement actuellement suivi",
          "traitement suivi",
          "traitement en cours",
          "traitements",
          "traitement",
        ],
      },
      {
        label: "A l'Examen Clinique : TA :",
        aliases: ["a l'examen clinique", "examen clinique", "cliniquement"],
      },
      { label: "ECG :", aliases: ["electrocardiogramme", "e c g", "ecg"] },
      {
        label: "ECHOCARDIOGRAPHIE :",
        aliases: [
          "echocardiographie",
          "echographie cardiaque",
          "echocardiogramme",
          "a l'echographie",
        ],
      },
      { label: "EN CONCLUSION :", aliases: ["en conclusion", "conclusion"] },
    ],
    closing: "Bien amicalement.",
    mentions: [MENTION_DICTEE],
  },
  {
    key: "scintigraphie",
    label: "Scintigraphie myocardique",
    salutation: "Cher confrère, Chère consœur,",
    intro: "La scintigraphie myocardique réalisée à {patient}",
    sections: [],
    closing: "Amitiés",
    mentions: [],
  },
  {
    key: "vasculaire",
    label: "Échodoppler artériel (vasculaire)",
    salutation: "Cher confrère, Chère consœur,",
    intro: "J'ai effectué l'échodoppler artériel à {patient}",
    sections: [
      {
        label: "Au niveau cervical :",
        aliases: ["au niveau cervical", "niveau cervical", "cervical", "carotides", "carotide"],
      },
      {
        label: "Aorte abdominale et iliaques :",
        aliases: ["aorte abdominale", "iliaques", "aorte"],
      },
      {
        label: "Au niveau des membres inférieurs :",
        aliases: ["membres inferieurs", "membre inferieur"],
      },
      { label: "Conclusion :", aliases: ["en conclusion", "conclusion"] },
    ],
    closing: "Amitiés",
    mentions: [MENTION_DICTEE],
  },
];

export function letterTemplateByKey(
  key: string | null | undefined
): LetterTemplate | undefined {
  if (!key) return undefined;
  return LETTER_TEMPLATES.find((t) => t.key === key);
}

export function letterTemplateLabel(key: string | null | undefined): string | null {
  return letterTemplateByKey(key)?.label ?? null;
}

// ---------- Patient dans la phrase d'introduction ----------

/** "MAINGE Martin né(e) le 29/07/1970 (56 ans)" — d'après la fiche patient. */
export function patientIntro(patient: Patient): string {
  if (!patient.date_naissance) return patient.nom;
  const [y, m, d] = patient.date_naissance.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return patient.nom;
  const birth = new Date(y, m - 1, d);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const anniv = new Date(now.getFullYear(), birth.getMonth(), birth.getDate());
  if (now < anniv) age -= 1;
  const dd = String(d).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return `${patient.nom} né(e) le ${dd}/${mm}/${y} (${age} ans)`;
}

export function introText(t: LetterTemplate, patient: Patient): string {
  return t.intro.replace("{patient}", patientIntro(patient));
}

// ---------- Construction du HTML éditeur ----------

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Corps de lettre pour l'éditeur : introduction, rubriques (libellé en gras +
 * contenu), clôture. L'en-tête, la date, la formule d'appel, la signature et
 * les mentions sont ajoutés à l'export.
 */
export function letterHtml(
  t: LetterTemplate,
  patient: Patient,
  contents?: Map<string, string>,
  preamble?: string
): string {
  const parts: string[] = [];
  parts.push(`<p>${esc(introText(t, patient))}</p>`);
  if (preamble?.trim()) parts.push(`<p>${esc(preamble.trim())}</p>`);
  for (const s of t.sections) {
    const body = (contents?.get(s.label) ?? s.defaultText ?? "").trim();
    parts.push(
      `<p><strong>${esc(s.label)}</strong>${body ? " " + esc(body) : " "}</p>`
    );
  }
  parts.push(`<p>${esc(t.closing)}</p>`);
  return parts.join("");
}

// ---------- Réorganisation par mots-clés ----------

/** Repli accents/majuscules en conservant la longueur (indexation stable). */
function fold(s: string): string {
  let out = "";
  for (const ch of s) {
    const base = ch.normalize("NFD")[0] ?? ch;
    out += base.toLowerCase();
  }
  return out;
}

interface Match {
  section: LetterSection;
  start: number;
  end: number;
}

/** Vrai si le mot-clé démarre une phrase / un paragraphe (pas en plein milieu). */
function isAnnouncement(folded: string, start: number, end: number): boolean {
  // Rien d'alphanumérique juste après (évite "ecg" dans un mot plus long).
  const after = folded[end];
  if (after !== undefined && /[a-z0-9]/.test(after)) return false;
  // Avant : début de texte, ponctuation ou retour à la ligne (en ignorant les
  // espaces). Rejette "les antécédents sont…" au milieu d'une phrase.
  let i = start - 1;
  while (i >= 0 && folded[i] === " ") i--;
  if (i < 0) return true;
  return !/[a-z0-9]/.test(folded[i]);
}

/**
 * Découpe le texte dicté aux mots-clés de rubriques et reconstruit le corps de
 * lettre. Toutes les occurrences annonçant une rubrique sont prises en compte
 * (libellés déjà présents + rubriques dictées) ; le texte précédant la
 * première rubrique reconnue est conservé après l'introduction ; les rubriques
 * jamais remplies gardent leur texte par défaut.
 */
export function reorganizeDictation(
  t: LetterTemplate,
  dictated: string,
  patient: Patient
): string {
  const text = dictated.replace(/[ \t]+/g, " ").trim();
  const folded = fold(text);

  const all: Match[] = [];
  for (const section of t.sections) {
    for (const alias of section.aliases) {
      let from = 0;
      while (true) {
        const idx = folded.indexOf(alias, from);
        if (idx < 0) break;
        from = idx + 1;
        if (isAnnouncement(folded, idx, idx + alias.length)) {
          all.push({ section, start: idx, end: idx + alias.length });
        }
      }
    }
  }
  // Tri par position ; à position égale, le mot-clé le plus long gagne
  // ("en conclusion" avant "conclusion"), puis suppression des chevauchements.
  all.sort((a, b) => a.start - b.start || b.end - a.end);
  const matches: Match[] = [];
  let lastEnd = -1;
  for (const m of all) {
    if (m.start >= lastEnd) {
      matches.push(m);
      lastEnd = m.end;
    }
  }

  const contents = new Map<string, string>();
  const cleanChunk = (raw: string) =>
    raw
      .replace(/^[\s:,;.?!…–—-]+/, "")
      .replace(/\s+/g, " ")
      .trim();

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const next = i + 1 < matches.length ? matches[i + 1].start : text.length;
    const chunk = cleanChunk(text.slice(m.end, next));
    if (!chunk) continue;
    const prev = contents.get(m.section.label);
    contents.set(m.section.label, prev ? `${prev} ${chunk}` : chunk);
  }

  const preambleEnd = matches.length > 0 ? matches[0].start : text.length;
  const preamble = cleanChunk(text.slice(0, preambleEnd));

  return letterHtml(t, patient, contents, preamble);
}
