// Types de comptes-rendus cardiologiques et leurs trames de sections.
// Sélectionner un type structure automatiquement le document : chaque section
// devient un sous-titre (H2) que le médecin remplit à la dictée.

export interface ReportType {
  key: string;
  label: string;
  /** Sections standard de ce type de compte-rendu. */
  sections: string[];
}

export const REPORT_TYPES: ReportType[] = [
  {
    key: "consultation",
    label: "Consultation de cardiologie",
    sections: [
      "Motif de consultation",
      "Antécédents",
      "Traitement en cours",
      "Examen clinique",
      "Examens complémentaires",
      "Conclusion",
      "Conduite à tenir",
    ],
  },
  {
    key: "ett",
    label: "Échocardiographie transthoracique (ETT)",
    sections: [
      "Indication",
      "Ventricule gauche (dimensions, FEVG, cinétique)",
      "Fonction diastolique",
      "Ventricule droit",
      "Oreillettes",
      "Valve mitrale",
      "Valve aortique",
      "Valves tricuspide et pulmonaire",
      "Péricarde",
      "Aorte",
      "Conclusion",
    ],
  },
  {
    key: "ecg",
    label: "Électrocardiogramme (ECG)",
    sections: [
      "Indication",
      "Rythme et fréquence",
      "Conduction (PR, QRS, QT)",
      "Axe",
      "Repolarisation",
      "Conclusion",
    ],
  },
  {
    key: "effort",
    label: "Épreuve d'effort (ECG d'effort)",
    sections: [
      "Indication",
      "Protocole",
      "Charge et fréquence cardiaque maximale atteinte",
      "Réponse tensionnelle",
      "Symptômes",
      "Modifications électriques",
      "Récupération",
      "Conclusion",
    ],
  },
  {
    key: "vo2",
    label: "Épreuve d'effort métabolique (VO2max)",
    sections: [
      "Indication",
      "Protocole",
      "VO2 pic / VO2 max",
      "Seuils ventilatoires (SV1, SV2)",
      "Réponse cardiaque et tensionnelle",
      "Quotient respiratoire",
      "Conclusion",
    ],
  },
  {
    key: "holter",
    label: "Holter ECG (24 h)",
    sections: [
      "Indication",
      "Durée d'enregistrement",
      "Rythme de base (FC moyenne, minimale, maximale)",
      "Troubles du rythme",
      "Troubles conductifs et pauses",
      "Corrélation avec les symptômes",
      "Conclusion",
    ],
  },
  {
    key: "mapa",
    label: "MAPA (Holter tensionnel)",
    sections: [
      "Indication",
      "Moyennes tensionnelles (24 h, diurne, nocturne)",
      "Profil nycthéméral (dipper / non-dipper)",
      "Charge tensionnelle",
      "Conclusion",
    ],
  },
];

export function reportTypeByKey(key: string | null | undefined): ReportType | undefined {
  if (!key) return undefined;
  return REPORT_TYPES.find((t) => t.key === key);
}

export function reportTypeLabel(key: string | null | undefined): string | null {
  return reportTypeByKey(key)?.label ?? null;
}

/** Construit le HTML de trame (sous-titres + paragraphes vides) pour un type. */
export function templateHtml(key: string): string {
  const t = reportTypeByKey(key);
  if (!t) return "";
  return t.sections.map((s) => `<h2>${s}</h2><p></p>`).join("");
}
