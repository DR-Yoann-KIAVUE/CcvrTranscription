// Constantes de la charte graphique CCVR (Édition 2026, v1.0).
// Couleurs déterministes utilisées pour les exports PDF / DOCX.

type RGB = [number, number, number];

interface Color {
  hex: string; // sans dièse (pour la lib docx)
  rgb: RGB; // pour jsPDF
}

const c = (hex: string, rgb: RGB): Color => ({ hex, rgb });

export const BRAND = {
  name: "Clinique Cardiovasculaire Raphaëloise",
  short: "CCVR",
  praticien: "Dr Yoann Kiavué",
  specialite: "Cardiologue",
  lieu: "Saint-Raphaël",

  // Primaires
  cardinal: c("B1121B", [177, 18, 27]),
  anthracite: c("373435", [55, 52, 53]),
  blanc: c("FFFFFF", [255, 255, 255]),

  // Dérivées / neutres
  cardinalDeep: c("8E0D15", [142, 13, 21]),
  teinteChaude: c("F7ECEC", [247, 236, 236]),
  grisPerle: c("F2F1F1", [242, 241, 241]),
  grisSeparateur: c("E0DEDF", [224, 222, 223]),
  grisMoyen: c("767274", [118, 114, 116]),
} as const;
