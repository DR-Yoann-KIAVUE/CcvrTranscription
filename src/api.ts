import { invoke } from "@tauri-apps/api/core";
import type { CompteRendu, CrVersion, Patient, SearchHit } from "./types";

export type Origine = "transcription" | "regeneration" | "edition";

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
  typeCr: string | null;
  dateConsultation: string;
  texte: string;
  audioPath: string | null;
  origine: Origine;
}) =>
  invoke<CompteRendu>("create_compte_rendu", {
    patientId: args.patientId,
    titre: args.titre,
    typeCr: args.typeCr,
    dateConsultation: args.dateConsultation,
    texte: args.texte,
    audioPath: args.audioPath,
    origine: args.origine,
    now: nowIso(),
  });
export const updateCompteRendu = (args: {
  id: number;
  titre: string;
  typeCr: string | null;
  dateConsultation: string;
  texte: string;
  origine: Origine;
}) =>
  invoke<CompteRendu>("update_compte_rendu", {
    id: args.id,
    titre: args.titre,
    typeCr: args.typeCr,
    dateConsultation: args.dateConsultation,
    texte: args.texte,
    origine: args.origine,
    now: nowIso(),
  });
export const listCrVersions = (compteRenduId: number) =>
  invoke<CrVersion[]>("list_cr_versions", { compteRenduId });
export const renameCompteRendu = (id: number, titre: string) =>
  invoke<void>("rename_compte_rendu", { id, titre, now: nowIso() });
export const deleteCompteRendu = (id: number) =>
  invoke<void>("delete_compte_rendu", { id });
export const searchComptesRendus = (query: string) =>
  invoke<SearchHit[]>("search_comptes_rendus", { query });

// ---- Audio ----
export const saveRecording = (wav: Uint8Array, name: string) =>
  invoke<string>("save_recording", { wav: Array.from(wav), name });

// ---- Transcription ----
export const transcribe = (path: string) =>
  invoke<string>("transcribe", { path });

// ---- Export granulaire ----
export const saveBytes = (path: string, bytes: Uint8Array) =>
  invoke<string>("save_bytes", { path, bytes: Array.from(bytes) });
export const copyFile = (src: string, dest: string) =>
  invoke<string>("copy_file", { src, dest });
