import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="centered column">
      <h1 className="error-code">404</h1>
      <p className="muted">الصفحة غير موجودة.</p>
      <Link className="btn btn-primary" to="/">
        العودة إلى الصفحة الرئيسية
      </Link>
    </div>
  );
}
