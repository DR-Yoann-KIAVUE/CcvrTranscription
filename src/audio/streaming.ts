import { encodeWav } from "./recorder";

// Transcription temps réel via le WebSocket ElevenLabs (scribe_v2_realtime).
// Capture le micro en PCM 16 kHz, envoie les chunks en direct, reçoit les
// transcriptions partielles/finales, et conserve l'audio (WAV) pour la réécoute.

interface Callbacks {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (msg: string) => void;
  onLevel?: (level: number) => void;
}

const TARGET_RATE = 16_000;

function pcm16Base64(float32: Float32Array): string {
  const buf = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < float32.length; i++) {
    let s = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const bytes = new Uint8Array(buf);
  let bin = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    bin += String.fromCharCode(
      ...(bytes.subarray(i, i + step) as unknown as number[])
    );
  }
  return btoa(bin);
}

export class StreamingTranscriber {
  private ws: WebSocket | null = null;
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private mute: GainNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private chunks: Float32Array[] = [];
  private ready = false;
  private errored = false;
  private cb: Callbacks;

  constructor(cb: Callbacks) {
    this.cb = cb;
  }

  /** Flux micro brut (pour l'indicateur de voix). */
  getStream(): MediaStream | null {
    return this.stream;
  }

  async start(token: string): Promise<void> {
    // Micro + contexte directement en 16 kHz (pas de rééchantillonnage).
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    this.ctx = new Ctx({ sampleRate: TARGET_RATE });

    const url =
      "wss://api.elevenlabs.io/v1/speech-to-text/realtime" +
      `?token=${encodeURIComponent(token)}` +
      "&model_id=scribe_v2_realtime" +
      "&language_code=fra" +
      "&audio_format=pcm_16000" +
      "&commit_strategy=vad";
    this.ws = new WebSocket(url);

    this.ws.onmessage = (ev) => {
      let msg: { message_type?: string; text?: string; error?: string };
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      switch (msg.message_type) {
        case "partial_transcript":
          this.cb.onPartial(msg.text ?? "");
          break;
        case "final_transcript":
        case "committed_transcript":
          if (msg.text) this.cb.onFinal(msg.text);
          break;
        case "session_started":
          this.ready = true;
          break;
        default:
          if (msg.message_type && msg.message_type.includes("error")) {
            // N'signale qu'une fois et arrête d'envoyer (évite le spam).
            this.ready = false;
            if (!this.errored) {
              this.errored = true;
              this.cb.onError(msg.error || msg.message_type);
            }
          }
      }
    };
    this.ws.onerror = () => this.cb.onError("Connexion temps réel interrompue.");

    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.processor = this.ctx.createScriptProcessor(4096, 1, 1);
    this.mute = this.ctx.createGain();
    this.mute.gain.value = 0;

    this.processor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      const copy = new Float32Array(input);
      this.chunks.push(copy);
      if (this.cb.onLevel) {
        let sum = 0;
        for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
        this.cb.onLevel(Math.min(1, Math.sqrt(sum / input.length) * 3.2));
      }
      if (this.ready && this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            message_type: "input_audio_chunk",
            audio_base_64: pcm16Base64(copy),
            commit: false,
            sample_rate: TARGET_RATE,
          })
        );
      }
    };

    this.source.connect(this.processor);
    this.processor.connect(this.mute);
    this.mute.connect(this.ctx.destination);
  }

  async stop(): Promise<{ wav: Uint8Array }> {
    // Détache le micro.
    this.processor?.disconnect();
    this.source?.disconnect();
    this.mute?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());

    // Demande la finalisation du dernier segment puis laisse un court délai
    // pour recevoir la transcription finale avant de fermer.
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(
          JSON.stringify({
            message_type: "input_audio_chunk",
            audio_base_64: "",
            commit: true,
            sample_rate: TARGET_RATE,
          })
        );
      } catch {
        /* ignore */
      }
      await new Promise((r) => setTimeout(r, 1500));
      try {
        this.ws.close();
      } catch {
        /* ignore */
      }
    }

    if (this.ctx && this.ctx.state !== "closed") await this.ctx.close();

    const merged = concat(this.chunks);
    this.chunks = [];
    this.cb.onLevel?.(0);
    return { wav: encodeWav(merged, TARGET_RATE) };
  }
}

function concat(chunks: Float32Array[]): Float32Array {
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Float32Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}
