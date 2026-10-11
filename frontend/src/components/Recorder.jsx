import { useEffect, useRef, useState } from "react";

const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
];

function pickMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function extensionFor(type) {
  if (!type) return "webm";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("mp4")) return "m4a";
  return "webm";
}

function formatDuration(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const secs = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${secs}`;
}

export default function Recorder({ mode, onRecorded, disabled }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function releaseStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  useEffect(
    () => () => {
      clearTimer();
      releaseStream();
    },
    []
  );

  async function start() {
    setError(null);
    if (!navigator.mediaDevices || typeof MediaRecorder === "undefined") {
      setError("متصفحك لا يدعم التسجيل الصوتي.");
      return;
    }

    try {
      let stream;
      if (mode === "system") {
        const display = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        const audioTracks = display.getAudioTracks();
        if (audioTracks.length === 0) {
          display.getTracks().forEach((track) => track.stop());
          throw new Error(
            "لم يتم مشاركة صوت النظام. فعّل خيار «مشاركة صوت النظام/التبويب» عند بدء المشاركة."
          );
        }
        display.getVideoTracks().forEach((track) => track.stop());
        stream = new MediaStream(audioTracks);
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        const ext = type.includes("ogg") ? "ogg" : type.includes("mp4") ? "m4a" : "webm";
        const name = mode === "system" ? `تسجيل-صوت-النظام.${ext}` : `تسجيل-صوت-خارجي.${ext}`;
        releaseStream();
        clearTimer();
        setRecording(false);
        if (blob.size > 0) {
          onRecorded(new File([blob], name, { type }));
        } else {
          setError("لم يتم التقاط أي صوت. حاول مرة أخرى.");
        }
      };

      stream.getAudioTracks().forEach((track) => {
        track.onended = () => {
          if (recorder.state !== "inactive") recorder.stop();
        };
      });

      recorder.start();
      recorderRef.current = recorder;
      setSeconds(0);
      setRecording(true);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (err) {
      releaseStream();
      clearTimer();
      setRecording(false);
      setError((err && err.message) || "تعذّر بدء التسجيل.");
    }
  }

  function stop() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }

  const hint =
    mode === "system"
      ? "اختر تبويبًا أو نافذة أو الشاشة كاملة مع تفعيل «مشاركة صوت النظام»، ثم اضغط «إيقاف التسجيل»."
      : "اسمح بالوصول إلى الميكروفون ثم ابدأ التلاوة، واضغط «إيقاف التسجيل» عند الانتهاء.";

  return (
    <div className="recorder">
      {recording ? (
        <div className="recording-state">
          <span className="rec-dot" aria-hidden="true" />
          <span className="rec-timer">{formatDuration(seconds)}</span>
          <span className="muted small">جارٍ التسجيل...</span>
        </div>
      ) : (
        <div className="recorder-hint">
          <span className="muted">{hint}</span>
        </div>
      )}

      <div className="upload-actions">
        {recording ? (
          <button type="button" className="btn btn-danger" onClick={stop}>
            إيقاف التسجيل
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={start} disabled={disabled}>
            بدء التسجيل
          </button>
        )}
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
