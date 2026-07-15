export interface Patient {
  id: number;
  nom: string;
  date_naissance: string | null;
  created_at: string;
  nb_cr: number;
}

export interface CompteRendu {
  id: number;
  patient_id: number;
  titre: string;
  date_consultation: string;
  texte: string;
  audio_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface SearchHit {
  id: number;
  patient_id: number;
  patient_nom: string;
  titre: string;
  date_consultation: string;
  extrait: string;
}
