import { useRef, useState } from "react";
import Recorder from "./Recorder";

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

export default function AudioInput({ onFile, disabled = false, maxMb = 25 }) {
  const [tab, setTab] = useState("upload");
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  function applyFile(next) {
    setFile(next);
    onFile?.(next);
  }

  function clearFile() {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
    onFile?.(null);
  }

  function onPick(event) {
    applyFile(event.target.files && event.target.files[0]);
  }

  function switchTab(next) {
    if (next === tab) return;
    setTab(next);
    setDragging(false);
    clearFile();
  }

  function onDrop(event) {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files && event.dataTransfer.files[0];
    if (dropped) applyFile(dropped);
  }

  const isUpload = tab === "upload";

  return (
    <div className="audio-input">
      <div className="tabs" role="tablist" aria-label="طريقة إدخال التسجيل">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`tab${tab === item.id ? " active" : ""}`}
            onClick={() => switchTab(item.id)}
            disabled={disabled}
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
            onChange={onPick}
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
                الصيغ المدعومة: mp3، wav، m4a، ogg، opus، flac — بحد أقصى {maxMb} ميجابايت
              </div>
            </div>
          )}
        </div>
      ) : (
        <Recorder mode={tab} onRecorded={applyFile} disabled={disabled} />
      )}

      {!isUpload && file && (
        <div className="recorded-file">
          <span className="file-name">{file.name}</span>
          <span className="muted small">{formatSize(file.size)}</span>
        </div>
      )}
    </div>
  );
}
