import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AudioInput from "../components/AudioInput";
import { api, ApiError } from "../api/client";

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("ar", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export default function SpeakersPage() {
  const [speakers, setSpeakers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [name, setName] = useState("");
  const [file, setFile] = useState(null);
  const [audioKey, setAudioKey] = useState(0);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listSpeakers();
      setSpeakers(data.speakers || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر تحميل القائمة");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onCreate(event) {
    event.preventDefault();
    setNotice(null);
    setError(null);

    if (!name.trim()) {
      setError("اسم القارئ مطلوب");
      return;
    }
    if (!file) {
      setError("يرجى اختيار ملف صوتي مرجعي");
      return;
    }

    setCreating(true);
    try {
      await api.createSpeaker(name.trim(), file);
      setName("");
      setFile(null);
      setAudioKey((k) => k + 1);
      setNotice("تمت إضافة القارئ بنجاح");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّرت إضافة القارئ");
    } finally {
      setCreating(false);
    }
  }

  async function onDelete(id, speakerName) {
    if (!window.confirm(`حذف القارئ "${speakerName}" وكل مراجعه الصوتية؟`)) return;
    setError(null);
    try {
      await api.deleteSpeaker(id);
      setSpeakers((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر الحذف");
    }
  }

  return (
    <div className="admin">
      <h1 className="page-title">إدارة القرّاء</h1>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
      {notice && <div className="alert alert-success">{notice}</div>}

      <form className="card" onSubmit={onCreate}>
        <h2 className="card-title">إضافة قارئ جديد</h2>
        <label className="field">
          <span>اسم القارئ</span>
          <input
            type="text"
            value={name}
            placeholder="مثال: مشاري راشد العفاسي"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="field">
          <span>التسجيل المرجعي</span>
          <AudioInput key={audioKey} onFile={setFile} disabled={creating} maxMb={25} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={creating}>
          {creating ? "جارٍ الرفع والتحليل..." : "إضافة القارئ"}
        </button>
      </form>

      <section className="card">
        <h2 className="card-title">القرّاء المسجّلون ({speakers.length})</h2>

        {loading ? (
          <div className="centered">
            <div className="spinner" />
          </div>
        ) : speakers.length === 0 ? (
          <p className="muted">لا يوجد قرّاء بعد. أضف أول قارئ من الأعلى.</p>
        ) : (
          <ul className="speaker-list">
            {speakers.map((s) => (
              <li key={s.id} className="speaker-row">
                <div className="speaker-meta">
                  <Link to={`/admin/speakers/${s.id}`} className="speaker-name">
                    {s.name}
                  </Link>
                  <span className="muted small">
                    {s.referenceCount} مرجع · أُضيف {formatDate(s.createdAt)}
                  </span>
                </div>
                <div className="speaker-actions">
                  <Link className="btn btn-ghost btn-sm" to={`/admin/speakers/${s.id}`}>
                    تفاصيل
                  </Link>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => onDelete(s.id, s.name)}
                  >
                    حذف
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
