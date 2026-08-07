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
    mentions: [MENTION_INFO_PATIENT],
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
    mentions: [],
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
    mentions: [],
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
    mentions: [],
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
        aliases: [
          "au niveau de l'aorte abdominale",
          "niveau de l'aorte abdominale",
          "au niveau de l'aorte",
          "aorte abdominale",
          "iliaques",
          "iliaque",
          "aorte",
        ],
      },
      {
        label: "Au niveau des membres inférieurs :",
        aliases: [
          "au niveau des membres inferieurs",
          "niveau des membres inferieurs",
          "aux membres inferieurs",
          "membres inferieurs",
          "membre inferieur",
        ],
      },
      { label: "Conclusion :", aliases: ["en conclusion", "conclusion"] },
    ],
    closing: "Amitiés",
    mentions: [],
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
  /** Début de l'annonce, mots transparents inclus ("euh, le traitement…"). */
  cut: number;
  start: number;
  end: number;
}

// Mots ignorés devant un mot-clé de rubrique : hésitations et articles que le
// médecin glisse naturellement ("euh, alors, les antécédents…").
const TRANSPARENT_WORDS = new Set([
  "euh",
  "heu",
  "alors",
  "donc",
  "ensuite",
  "puis",
  "voila",
  "bon",
  "et",
  "en",
  "le",
  "la",
  "les",
  "un",
  "une",
]);

/**
 * Le mot-clé annonce-t-il une rubrique ? Il doit démarrer une phrase, en
 * tolérant hésitations et articles devant ("Euh, alors, les antécédents…").
 * Renvoie la position de début d'annonce (mots transparents inclus), ou null
 * si le mot-clé est en plein milieu d'une phrase ("pas d'antécédents connus").
 */
function announcementCut(folded: string, start: number, end: number): number | null {
  // Rien d'alphanumérique juste après (évite "ecg" dans un mot plus long).
  const after = folded[end];
  if (after !== undefined && /[a-z0-9]/.test(after)) return null;

  let cut = start;
  let i = start - 1;
  for (let hops = 0; hops < 4; hops++) {
    while (i >= 0 && folded[i] === " ") i--;
    if (i < 0) return cut;
    const ch = folded[i];
    if (ch === "'") {
      // Élision : "l'échocardiographie" passe, "pas d'antécédents" non.
      if (folded[i - 1] === "l") {
        cut = i - 1;
        i -= 2;
        continue;
      }
      return null;
    }
    if (!/[a-z0-9]/.test(ch)) return cut; // ponctuation ou retour à la ligne
    let j = i;
    while (j >= 0 && /[a-z]/.test(folded[j])) j--;
    const word = folded.slice(j + 1, i + 1);
    if (!TRANSPARENT_WORDS.has(word)) return null;
    cut = j + 1;
    i = j;
  }
  return null;
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
        const cut = announcementCut(folded, idx, idx + alias.length);
        if (cut !== null) {
          all.push({ section, cut, start: idx, end: idx + alias.length });
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
  const cleanChunk = (raw: string) => {
    let s = raw.replace(/\s+/g, " ").trim();
    // Ponctuation d'attaque + hésitations en tête ("… : euh, fumeur").
    for (let pass = 0; pass < 4; pass++) {
      s = s.replace(/^[\s:,;.?!…–—-]+/, "").replace(/^(euh|heu)\b/i, "");
    }
    // Résidus d'annonce en fin de segment ("… fumeur. Euh, le").
    for (let pass = 0; pass < 4; pass++) {
      s = s
        .replace(/[\s:,;…–—-]+$/, "")
        .replace(/\b(euh|heu|alors|donc|et|le|la|les|l'|un|une)$/i, "");
    }
    return s.trim();
  };

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const next = i + 1 < matches.length ? matches[i + 1].cut : text.length;
    const chunk = cleanChunk(text.slice(m.end, next));
    if (!chunk) continue;
    const prev = contents.get(m.section.label);
    contents.set(m.section.label, prev ? `${prev} ${chunk}` : chunk);
  }

  const preambleEnd = matches.length > 0 ? matches[0].cut : text.length;
  const preamble = cleanChunk(text.slice(0, preambleEnd));

  return letterHtml(t, patient, contents, preamble);
}
