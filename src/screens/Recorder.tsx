import { useEffect, useRef, useState } from "react";
import { AudioRecorder, type RecordingResult } from "../audio/recorder";
import { formatDuration } from "../format";

interface Props {
  onFinished: (result: RecordingResult) => void;
  disabled?: boolean;
}

export default function Recorder({ onFinished, disabled }: Props) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState("");
  const recorderRef = useRef<AudioRecorder | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  const start = async () => {
    setError("");
    try {
      const rec = new AudioRecorder(setLevel);
      await rec.start();
      recorderRef.current = rec;
      setSeconds(0);
      setRecording(true);
      timerRef.current = window.setInterval(
        () => setSeconds((s) => s + 1),
        1000
      );
    } catch (e) {
      setError(
        "Micro inaccessible. Autorisez le microphone pour l'application. (" +
          String(e) +
          ")"
      );
    }
  };

  const stop = async () => {
    if (!recorderRef.current) return;
    if (timerRef.current) window.clearInterval(timerRef.current);
    setRecording(false);
    setLevel(0);
    try {
      const result = await recorderRef.current.stop();
      recorderRef.current = null;
      onFinished(result);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="recorder">
      <div className="rec-row">
        {recording ? (
          <button className="danger" onClick={stop}>
            ⏹ Arrêter la dictée
          </button>
        ) : (
          <button className="primary" onClick={start} disabled={disabled}>
            🎙 Démarrer la dictée
          </button>
        )}
        {recording && <span className="rec-dot" />}
        <span className="timer">{formatDuration(seconds)}</span>
        <div className="level-meter" title="Niveau sonore">
          <div
            className="level-bar"
            style={{ width: `${Math.round(level * 100)}%` }}
          />
        </div>
      </div>
      {error && <div className="error">{error}</div>}
    </div>
  );
}
