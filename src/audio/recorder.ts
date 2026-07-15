// Enregistrement micro via Web Audio (pas de MediaRecorder pour rester
// compatible WKWebView/WebView2), rééchantillonnage en 16 kHz mono et
// encodage WAV 16 bits — exactement ce qu'attend whisper.cpp.

export interface RecordingResult {
  wav: Uint8Array;
  durationSec: number;
}

const TARGET_RATE = 16_000;

export class AudioRecorder {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private mute: GainNode | null = null;
  private chunks: Float32Array[] = [];
  private srcRate = 48_000;
  private onLevel?: (level: number) => void;

  constructor(onLevel?: (level: number) => void) {
    this.onLevel = onLevel;
  }

  async start(): Promise<void> {
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
    this.ctx = new Ctx();
    this.srcRate = this.ctx.sampleRate;

    this.source = this.ctx.createMediaStreamSource(this.stream);
    this.processor = this.ctx.createScriptProcessor(4096, 1, 1);
    // Gain à zéro pour éviter tout retour audio dans les haut-parleurs.
    this.mute = this.ctx.createGain();
    this.mute.gain.value = 0;

    this.chunks = [];
    this.processor.onaudioprocess = (e: AudioProcessingEvent) => {
      const input = e.inputBuffer.getChannelData(0);
      this.chunks.push(new Float32Array(input)); // copie (le buffer est réutilisé)
      if (this.onLevel) {
        let sum = 0;
        for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
        const rms = Math.sqrt(sum / input.length);
        // Normalisation perceptuelle simple.
        this.onLevel(Math.min(1, rms * 3.2));
      }
    };

    this.source.connect(this.processor);
    this.processor.connect(this.mute);
    this.mute.connect(this.ctx.destination);
  }

  async stop(): Promise<RecordingResult> {
    const srcRate = this.srcRate;
    // Détache et libère le micro.
    this.processor?.disconnect();
    this.source?.disconnect();
    this.mute?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    if (this.ctx && this.ctx.state !== "closed") await this.ctx.close();

    const merged = concat(this.chunks);
    this.chunks = [];
    this.onLevel?.(0);

    const durationSec = merged.length / srcRate;
    const resampled = await resampleTo16k(merged, srcRate);
    const wav = encodeWav(resampled, TARGET_RATE);
    return { wav, durationSec };
  }
}

function concat(chunks: Float32Array[]): Float32Array {
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

async function resampleTo16k(
  input: Float32Array,
  srcRate: number
): Promise<Float32Array> {
  if (srcRate === TARGET_RATE || input.length === 0) return input;
  const outLen = Math.max(
    1,
    Math.ceil((input.length * TARGET_RATE) / srcRate)
  );
  const OfflineCtx =
    window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext })
      .webkitOfflineAudioContext;
  const offline = new OfflineCtx(1, outLen, TARGET_RATE);
  const buffer = offline.createBuffer(1, input.length, srcRate);
  // Copie garantie sur un ArrayBuffer (et non SharedArrayBuffer) pour satisfaire
  // le typage de copyToChannel.
  const src = new Float32Array(input.length);
  src.set(input);
  buffer.copyToChannel(src, 0);
  const node = offline.createBufferSource();
  node.buffer = buffer;
  node.connect(offline.destination);
  node.start();
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}

function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample; // mono
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // taille sous-chunk fmt
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits/échantillon
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    let s = Math.max(-1, Math.min(1, samples[i]));
    s = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, s, true);
    offset += 2;
  }
  return new Uint8Array(buffer);
}
