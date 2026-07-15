import { invoke } from "@tauri-apps/api/core";
import type { CompteRendu, Patient, SearchHit } from "./types";

const nowIso = () => new Date().toISOString();

// ---- Authentification ----
export const authIsConfigured = () =>
  invoke<boolean>("auth_is_configured");
export const authSetup = (password: string) =>
  invoke<void>("auth_setup", { password });
export const authVerify = (password: string) =>
  invoke<boolean>("auth_verify", { password });

// ---- Modèle Whisper ----
export const modelPresent = () => invoke<boolean>("model_present");
export const modelsDirPath = () => invoke<string>("models_dir_path");

// ---- Patients ----
export const listPatients = (query?: string) =>
  invoke<Patient[]>("list_patients", { query: query ?? null });
export const createPatient = (nom: string, dateNaissance?: string | null) =>
  invoke<Patient>("create_patient", {
    nom,
    dateNaissance: dateNaissance ?? null,
    now: nowIso(),
  });
export const deletePatient = (id: number) =>
  invoke<void>("delete_patient", { id });

// ---- Comptes-rendus ----
export const listComptesRendus = (patientId: number) =>
  invoke<CompteRendu[]>("list_comptes_rendus", { patientId });
export const getCompteRendu = (id: number) =>
  invoke<CompteRendu>("get_compte_rendu", { id });
export const createCompteRendu = (args: {
  patientId: number;
  titre: string;
  dateConsultation: string;
  texte: string;
  audioPath: string | null;
}) =>
  invoke<CompteRendu>("create_compte_rendu", {
    patientId: args.patientId,
    titre: args.titre,
    dateConsultation: args.dateConsultation,
    texte: args.texte,
    audioPath: args.audioPath,
    now: nowIso(),
  });
export const updateCompteRendu = (args: {
  id: number;
  titre: string;
  dateConsultation: string;
  texte: string;
}) =>
  invoke<CompteRendu>("update_compte_rendu", {
    id: args.id,
    titre: args.titre,
    dateConsultation: args.dateConsultation,
    texte: args.texte,
    now: nowIso(),
  });
export const renameCompteRendu = (id: number, titre: string) =>
  invoke<void>("rename_compte_rendu", { id, titre, now: nowIso() });
export const deleteCompteRendu = (id: number) =>
  invoke<void>("delete_compte_rendu", { id });
export const searchComptesRendus = (query: string) =>
  invoke<SearchHit[]>("search_comptes_rendus", { query });

// ---- Audio ----
export const saveRecording = (wav: Uint8Array, name: string) =>
  invoke<string>("save_recording", { wav: Array.from(wav), name });
export const readAudio = async (path: string): Promise<ArrayBuffer> => {
  // La commande renvoie un tauri::ipc::Response -> ArrayBuffer côté JS.
  const res = await invoke<ArrayBuffer>("read_audio", { path });
  return res;
};

// ---- Transcription ----
export const transcribe = (path: string) =>
  invoke<string>("transcribe", { path });

// ---- Export ----
export const exportDocuments = (args: {
  dir: string;
  baseName: string;
  pdf: Uint8Array;
  docx: Uint8Array;
}) =>
  invoke<string[]>("export_documents", {
    dir: args.dir,
    baseName: args.baseName,
    pdf: Array.from(args.pdf),
    docx: Array.from(args.docx),
  });
