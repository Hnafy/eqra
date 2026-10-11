import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AudioInput from "../components/AudioInput";
import { api, ApiError } from "../api/client";

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("ar", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function SpeakerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [speaker, setSpeaker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [file, setFile] = useState(null);
  const [audioKey, setAudioKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getSpeaker(id);
      setSpeaker(data.speaker);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر تحميل بيانات القارئ");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function onAddReference(event) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!file) {
      setError("يرجى اختيار ملف صوتي");
      return;
    }
    setBusy(true);
    try {
      const data = await api.addReference(id, file);
      setSpeaker(data.speaker);
      setFile(null);
      setAudioKey((k) => k + 1);
      setNotice("تمت إضافة المرجع وتحديث البصمة الصوتية");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّرت إضافة المرجع");
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteReference(referenceId) {
    if (!window.confirm("حذف هذا المرجع وإعادة بناء البصمة الصوتية؟")) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const data = await api.deleteReference(id, referenceId);
      setSpeaker(data.speaker);
      setNotice("تم حذف المرجع وتحديث البصمة الصوتية");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر حذف المرجع");
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteSpeaker() {
    if (!window.confirm(`حذف القارئ "${speaker.name}"؟`)) return;
    setBusy(true);
    try {
      await api.deleteSpeaker(id);
      navigate("/admin/speakers", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "تعذّر الحذف");
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="centered">
        <div className="spinner" />
      </div>
    );
  }

  if (!speaker) {
    return (
      <div className="centered column">
        <p className="muted">{error || "القارئ غير موجود"}</p>
        <Link className="btn btn-primary" to="/admin/speakers">
          العودة إلى القرّاء
        </Link>
      </div>
    );
  }

  const references = speaker.references || [];
  const canRemove = speaker.referenceCount > 1;

  return (
    <div className="admin">
      <div className="breadcrumb">
        <Link to="/admin/speakers">القرّاء</Link>
        <span>/</span>
        <span>{speaker.name}</span>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
      {notice && <div className="alert alert-success">{notice}</div>}

      <section className="card">
        <div className="detail-head">
          <h1 className="page-title">{speaker.name}</h1>
          <button type="button" className="btn btn-danger btn-sm" onClick={onDeleteSpeaker} disabled={busy}>
            حذف القارئ
          </button>
        </div>
        <div className="info-grid">
          <div className="info-row">
            <span className="info-label">النموذج</span>
            <span className="info-value">
              {speaker.modelId}@{speaker.modelVersion}
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">أبعاد البصمة</span>
            <span className="info-value">{speaker.embeddingDimension}</span>
          </div>
          <div className="info-row">
            <span className="info-label">عدد المراجع</span>
            <span className="info-value">{speaker.referenceCount}</span>
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">إضافة مرجع صوتي</h2>
        <form onSubmit={onAddReference}>
          <AudioInput key={audioKey} onFile={setFile} disabled={busy} maxMb={25} />
          <div className="upload-actions">
            <button type="submit" className="btn btn-primary" disabled={busy || !file}>
              {busy ? "جارٍ المعالجة..." : "إضافة"}
            </button>
          </div>
        </form>
        <p className="muted small">
          يجب أن يكون المرجع من نفس القارئ وباستخدام نفس النموذج لتفادي رفض التطابق.
        </p>
      </section>

      <section className="card">
        <h2 className="card-title">المراجع ({speaker.referenceCount})</h2>
        <ul className="reference-list">
          {(speaker.references || []).map((ref) => (
            <li key={ref.id} className="reference-row">
              <div className="speaker-meta">
                <span className="file-name">{ref.sourceFilename || "ملف"}</span>
                <span className="muted small">
                  {ref.audioDuration ? `${ref.audioDuration.toFixed(1)} ث · ` : ""}
                  {formatDate(ref.createdAt)}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => onDeleteReference(ref.id)}
                disabled={busy || speaker.referenceCount <= 1}
                title={speaker.referenceCount <= 1 ? "لا يمكن حذف آخر مرجع" : ""}
              >
                حذف
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="detail-footer">
        <Link className="btn btn-ghost" to="/admin/speakers">
          ← رجوع إلى القائمة
        </Link>
      </div>
    </div>
  );
}
