import { useRef, useState } from "react";
import { api, ApiError } from "../api/client";
import AnalysisResult from "../components/AnalysisResult";
import Recorder from "../components/Recorder";

const MAX_MB = 20;

const TABS = [
  { id: "upload", label: "رفع ملف" },
  { id: "mic", label: "تسجيل صوت خارجي" },
  { id: "system", label: "تسجيل صوت النظام" },
];

function formatSize(bytes) {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(2)} ميجابايت`;
  return `${(bytes / 1024).toFixed(0)} كيلوبايت`;
}

export default function HomePage() {
  const [tab, setTab] = useState("upload");
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  function reset() {
    setFile(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function switchTab(next) {
    if (next === tab) return;
    setTab(next);
    setDragging(false);
    reset();
  }

  function pickFile(next) {
    setError(null);
    setResult(null);
    if (next) setFile(next);
  }

  function onInputChange(event) {
    pickFile(event.target.files && event.target.files[0]);
  }

  function onDrop(event) {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files && event.dataTransfer.files[0];
    pickFile(dropped);
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (!file || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await api.analyze(file);
      setResult(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  }

  const isUpload = tab === "upload";

  return (
    <div className="home">
      <section className="hero">
        <h1>التعرّف على القارئ والآية من التسجيل</h1>
        <p className="muted">
          ارفع مقطعًا صوتيًا، أو سجّل من الميكروفون، أو سجّل صوت النظام؛ وسيتعرّف
          النظام على القارئ والآية، ويقترح نتيجة بحث على يوتيوب.
        </p>
      </section>

      <form className="card upload-card" onSubmit={onSubmit}>
        <div className="tabs" role="tablist" aria-label="طريقة إدخال التسجيل">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={`tab${tab === item.id ? " active" : ""}`}
              onClick={() => switchTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {isUpload ? (
          <div
            className={`dropzone${dragging ? " dragging" : ""}${file ? " has-file" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current && inputRef.current.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept="audio/*,.opus,.m4a,.webm,.mp4"
              onChange={onInputChange}
              hidden
            />
            {file ? (
              <div className="file-info">
                <span className="file-name">{file.name}</span>
                <span className="muted">{formatSize(file.size)}</span>
              </div>
            ) : (
              <div className="dropzone-hint">
                <div className="dropzone-icon">♪</div>
                <div>اسحب الملف الصوتي هنا أو انقر للاختيار</div>
                <div className="muted small">
                  الصيغ المدعومة: mp3، wav، m4a، ogg، opus، flac — بحد أقصى {MAX_MB} ميجابايت
                </div>
              </div>
            )}
          </div>
        ) : (
          <Recorder mode={tab} onRecorded={pickFile} disabled={loading} />
        )}

        {!isUpload && file && (
          <div className="recorded-file">
            <span className="file-name">{file.name}</span>
            <span className="muted small">{formatSize(file.size)}</span>
          </div>
        )}

        <div className="upload-actions">
          <button type="submit" className="btn btn-primary" disabled={!file || loading}>
            {loading ? "جارٍ التحليل..." : "تحليل التسجيل"}
          </button>
          {file && !loading && (
            <button type="button" className="btn btn-ghost" onClick={reset}>
              إزالة
            </button>
          )}
        </div>

        <p className="muted small">
          ملاحظة: الحد الأدنى لطول التسجيل 5 ثوانٍ للحصول على نتيجة دقيقة.
        </p>
      </form>

      {loading && (
        <div className="card loading-card">
          <div className="spinner" />
          <p className="muted">
            جارٍ استخراج البصمة الصوتية ونسخ النص والبحث عن الآية والفيديو...
          </p>
        </div>
      )}

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {result && <AnalysisResult data={result} />}
    </div>
  );
}
