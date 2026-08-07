import { invoke } from "@tauri-apps/api/core";
import type { CompteRendu, CrVersion, Patient, SearchHit } from "./types";

export type Origine = "transcription" | "regeneration" | "edition";

const nowIso = () => new Date().toISOString();

// ---- Authentification ----
export const authVerify = (password: string) =>
  invoke<boolean>("auth_verify", { password });
export const authChangePassword = (current: string, newPassword: string) =>
  invoke<void>("auth_change_password", { current, new: newPassword });
/** Vrai tant que le code d'accès est encore 0000. */
export const authIsDefaultCode = () =>
  invoke<boolean>("auth_is_default_code");
export const authPopupPending = () => invoke<boolean>("auth_popup_pending");
export const authPopupAck = () => invoke<void>("auth_popup_ack");

// ---- En-tête des courriers ----
export const getLetterheadJson = () =>
  invoke<string | null>("get_letterhead");
export const setLetterheadJson = (json: string) =>
  invoke<void>("set_letterhead", { json });

// ---- Image de signature ----
export interface SignatureData {
  bytes: number[];
  format: string; // "PNG" | "JPEG"
}
export const importSignature = (src: string) =>
  invoke<void>("import_signature", { src });
export const getSignature = () =>
  invoke<SignatureData | null>("get_signature");
export const clearSignature = () => invoke<void>("clear_signature");
export const authGetEmail = () =>
  invoke<string | null>("auth_get_email");
export const authSetEmail = (email: string) =>
  invoke<void>("auth_set_email", { email });
/** Envoie le code à 6 chiffres par e-mail ; renvoie l'adresse masquée. */
export const authForgotPassword = () =>
  invoke<string>("auth_forgot_password");

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
export const transcribeElevenlabs = (path: string) =>
  invoke<string>("transcribe_elevenlabs", { path });

// ---- Réglages moteur STT ----
export type SttProvider = "local" | "elevenlabs";
export const getSttProvider = () =>
  invoke<string>("get_stt_provider") as Promise<SttProvider>;
export const setSttProvider = (provider: SttProvider) =>
  invoke<void>("set_stt_provider", { provider });
export const elevenKeyPresent = () => invoke<boolean>("eleven_key_present");
export const setElevenKey = (key: string) =>
  invoke<void>("set_eleven_key", { key });
export const getSttStreaming = () => invoke<boolean>("get_stt_streaming");
export const setSttStreaming = (on: boolean) =>
  invoke<void>("set_stt_streaming", { on });
export const elevenRealtimeToken = () =>
  invoke<string>("eleven_realtime_token");
export const downloadModel = () => invoke<string>("download_model");

// ---- Export granulaire ----
export const saveBytes = (path: string, bytes: Uint8Array) =>
  invoke<string>("save_bytes", { path, bytes: Array.from(bytes) });
export const copyFile = (src: string, dest: string) =>
  invoke<string>("copy_file", { src, dest });

// ---- Données / sauvegarde ----
export interface DataStats {
  dir: string;
  patients: number;
  comptes_rendus: number;
  versions: number;
  audio_count: number;
  db_bytes: number;
  audio_bytes: number;
}
export const dataStats = () => invoke<DataStats>("data_stats");
export const backupData = (destDir: string, folderName: string) =>
  invoke<string>("backup_data", { destDir, folderName });
