use whisper_rs::{FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters};

/// Transcrit un fichier WAV local avec Whisper (langue = français).
/// Bloquant : à exécuter dans un thread dédié.
pub fn run_whisper(model_path: &str, wav_path: &str) -> Result<String, String> {
    let samples = read_wav_mono_16k_f32(wav_path)?;
    if samples.is_empty() {
        return Err("Fichier audio vide.".into());
    }

    let ctx = WhisperContext::new_with_params(model_path, WhisperContextParameters::default())
        .map_err(|e| format!("Impossible de charger le modèle Whisper : {e}"))?;
    let mut state = ctx
        .create_state()
        .map_err(|e| format!("Initialisation Whisper : {e}"))?;

    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    params.set_language(Some("fr"));
    params.set_translate(false);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_special(false);
    params.set_print_timestamps(false);
    params.set_suppress_blank(true);

    let threads = std::thread::available_parallelism()
        .map(|n| n.get() as i32)
        .unwrap_or(4);
    params.set_n_threads(threads);

    state
        .full(params, &samples)
        .map_err(|e| format!("Échec de la transcription : {e}"))?;

    let n = state
        .full_n_segments()
        .map_err(|e| e.to_string())?;
    let mut text = String::new();
    for i in 0..n {
        let seg = state
            .full_get_segment_text(i)
            .map_err(|e| e.to_string())?;
        text.push_str(seg.trim());
        text.push(' ');
    }
    Ok(text.trim().to_string())
}

/// Lit un WAV et renvoie un flux mono, 16 kHz, f32 dans [-1, 1].
/// Le frontend produit normalement déjà ce format ; on reste tolérant par sécurité.
fn read_wav_mono_16k_f32(path: &str) -> Result<Vec<f32>, String> {
    let mut reader = hound::WavReader::open(path).map_err(|e| e.to_string())?;
    let spec = reader.spec();

    // Décodage brut en f32 selon le format d'échantillon.
    let raw: Vec<f32> = match spec.sample_format {
        hound::SampleFormat::Float => reader
            .samples::<f32>()
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?,
        hound::SampleFormat::Int => {
            let max = (1i64 << (spec.bits_per_sample - 1)) as f32;
            reader
                .samples::<i32>()
                .map(|s| s.map(|v| v as f32 / max))
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?
        }
    };

    // Mixage vers mono si nécessaire.
    let mono: Vec<f32> = if spec.channels > 1 {
        let ch = spec.channels as usize;
        raw.chunks(ch)
            .map(|frame| frame.iter().sum::<f32>() / ch as f32)
            .collect()
    } else {
        raw
    };

    // Rééchantillonnage linéaire de sécurité vers 16 kHz.
    if spec.sample_rate == 16_000 {
        Ok(mono)
    } else {
        Ok(resample_linear(&mono, spec.sample_rate, 16_000))
    }
}

/// Rééchantillonnage linéaire simple (filet de sécurité, la voix est déjà en 16 kHz).
fn resample_linear(input: &[f32], from: u32, to: u32) -> Vec<f32> {
    if input.is_empty() || from == 0 {
        return vec![];
    }
    let ratio = to as f64 / from as f64;
    let out_len = (input.len() as f64 * ratio).round() as usize;
    let mut out = Vec::with_capacity(out_len);
    for i in 0..out_len {
        let src = i as f64 / ratio;
        let i0 = src.floor() as usize;
        let i1 = (i0 + 1).min(input.len() - 1);
        let frac = (src - i0 as f64) as f32;
        out.push(input[i0] * (1.0 - frac) + input[i1] * frac);
    }
    out
}
