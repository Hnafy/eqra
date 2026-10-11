function percent(score) {
  if (typeof score !== "number") return "—";
  return `${(score * 100).toFixed(1)}%`;
}

function InfoRow({ label, value }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="info-row">
      <span className="info-label">{label}</span>
      <span className="info-value">{value}</span>
    </div>
  );
}

function SpeakerSection({ speaker }) {
  if (!speaker) return null;

  if (!speaker.available) {
    return (
      <section className="card result-card">
        <h2 className="card-title">القارئ</h2>
        <p className="muted">
          {speaker.candidateCount === 0
            ? "لا يوجد قرّاء مسجّلون بعد."
            : speaker.error || "تعذّر التعرف على القارئ."}
        </p>
      </section>
    );
  }

  return (
    <section className="card result-card">
      <h2 className="card-title">القارئ</h2>

      {speaker.identified ? (
        <div className="identified">
          <div className="identified-name">{speaker.speakerName}</div>
          <div className="badge badge-success">تم التعرف بثقة</div>
        </div>
      ) : (
        <div className="identified">
          <div className="identified-name muted">غير معروف</div>
          <div className="badge badge-warn">الثقة غير كافية</div>
        </div>
      )}

      <div className="info-grid">
        <InfoRow label="درجة التشابه" value={percent(speaker.top1Score)} />
        <InfoRow label="المدّة" value={speaker.audioDuration ? `${speaker.audioDuration.toFixed(1)} ث` : null} />
        <InfoRow label="القرار" value={speaker.decisionReason} />
      </div>

      {Array.isArray(speaker.candidates) && speaker.candidates.length > 0 && (
        <div className="candidates">
          <h3 className="subtitle">المرشحون</h3>
          <ul className="candidate-list">
            {speaker.candidates.map((c) => (
              <li key={c.speaker_id}>
                <span>{c.speaker_name}</span>
                <span className="score-pill">{percent(c.score)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function AyahSection({ ayah }) {
  if (!ayah) return null;

  const transcription = ayah.transcription;
  const best = ayah.best;
  const verseCount = best && best.verse_count ? best.verse_count : 1;
  const isRange = verseCount > 1;

  return (
    <section className="card result-card">
      <h2 className="card-title">الآية</h2>

      {best ? (
        <>
          <div className="ayah-header">
            <span className="surah-name">سورة {best.surah}</span>
            <span className="ayah-ref">
              {isRange
                ? `${best.surah_number}:${best.number} - ${best.end_number}`
                : `${best.surah_number}:${best.number}`}
            </span>
          </div>
          <p className="ayah-text" dir="rtl">
            {best.text}
          </p>
          <div className="info-grid">
            <InfoRow label="درجة المطابقة" value={`${Number(best.score).toFixed(1)}%`} />
            {isRange && (
              <InfoRow label="عدد الآيات" value={`${verseCount} آيات متتالية`} />
            )}
          </div>
        </>
      ) : (
        <p className="muted">
          {ayah.message || ayah.error || "لم يتم العثور على آية مطابقة."}
        </p>
      )}

      {transcription && transcription.text && (
        <div className="transcription">
          <h3 className="subtitle">النص المنسوخ تلقائيًا</h3>
          <p className="transcription-text" dir="rtl">
            {transcription.text}
          </p>
        </div>
      )}
    </section>
  );
}

function VideoCard({ video, primary }) {
  if (!video) return null;
  return (
    <div className={`video-card${primary ? " primary" : ""}`}>
      {video.thumbnail && (
        <img className="video-thumb" src={video.thumbnail} alt="" loading="lazy" />
      )}
      <div className="video-body">
        <div className="video-title">{video.title}</div>
        {video.channel_title && <div className="video-channel">{video.channel_title}</div>}
        {video.url && (
          <a
            className="btn btn-primary btn-sm"
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            فتح على يوتيوب ↗
          </a>
        )}
      </div>
    </div>
  );
}

function YouTubeSection({ youtube }) {
  if (!youtube) return null;

  return (
    <section className="card result-card">
      <h2 className="card-title">
        نتيجة بحث يوتيوب
        {youtube.cached && <span className="badge badge-info">من الذاكرة المؤقتة</span>}
      </h2>

      {youtube.available && youtube.result ? (
        <VideoCard video={youtube.result} primary />
      ) : (
        <p className="muted">{youtube.message || youtube.error || "لا توجد نتيجة من يوتيوب."}</p>
      )}
    </section>
  );
}

export default function AnalysisResult({ data }) {
  if (!data) return null;

  return (
    <div className="results">
      <SpeakerSection speaker={data.speaker} />
      <AyahSection ayah={data.ayah} />
      <YouTubeSection youtube={data.youtube} />

      {data.errors && Object.keys(data.errors).length > 0 && (
        <section className="card result-card errors-card">
          <h2 className="card-title">ملاحظات</h2>
          <ul className="error-list">
            {Object.entries(data.errors).map(([key, message]) => (
              <li key={key}>
                <strong>{key}:</strong> {message}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
