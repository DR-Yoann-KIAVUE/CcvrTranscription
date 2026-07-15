// Test manuel de bout en bout de la transcription, hors interface graphique.
//
//   cargo run --release --example transcribe_test -- <modele.bin> <audio.wav>
//
// Utilise exactement la même fonction que la commande Tauri `transcribe`.

use std::time::Instant;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 3 {
        eprintln!("Usage: transcribe_test <modele.bin> <audio.wav>");
        std::process::exit(2);
    }
    let model = &args[1];
    let wav = &args[2];

    eprintln!("Modèle : {model}");
    eprintln!("Audio  : {wav}");
    let t0 = Instant::now();
    match ccvr_transcription_lib::transcribe::run_whisper(model, wav) {
        Ok(texte) => {
            let dt = t0.elapsed();
            println!("\n----- TRANSCRIPTION -----\n{texte}\n-------------------------");
            eprintln!("Durée de traitement : {:.1} s", dt.as_secs_f64());
        }
        Err(e) => {
            eprintln!("ERREUR : {e}");
            std::process::exit(1);
        }
    }
}
