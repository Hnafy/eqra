const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(
  /\/$/,
  ""
);

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function request(path, { method = "GET", body, form } = {}) {
  const options = {
    method,
    credentials: "include",
    headers: {},
  };

  if (form) {
    options.body = form;
  } else if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, options);
  } catch (err) {
    throw new ApiError("تعذّر الاتصال بالخادم. تأكد من تشغيل الواجهة الخلفية.", 0, null);
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const message =
      (data && (data.error || data.message)) || `فشل الطلب (${response.status})`;
    throw new ApiError(message, response.status, data);
  }

  return data;
}

function audioForm(file, extra) {
  const form = new FormData();
  form.append("file", file);
  if (extra) {
    Object.entries(extra).forEach(([key, value]) => {
      if (value !== undefined && value !== null) form.append(key, value);
    });
  }
  return form;
}

export const api = {
  // Health
  health: () => request("/api/analysis/health"),

  // Auth
  login: (email, password) => request("/api/auth/login", { method: "POST", body: { email, password } }),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  me: () => request("/api/auth/me"),

  // Analysis (public)
  analyze: (file) => request("/api/analysis", { method: "POST", form: audioForm(file) }),

  // Speakers (admin)
  listSpeakers: () => request("/api/speakers"),
  getSpeaker: (id) => request(`/api/speakers/${id}`),
  createSpeaker: (name, file) =>
    request("/api/speakers", { method: "POST", form: audioForm(file, { name }) }),
  deleteSpeaker: (id) => request(`/api/speakers/${id}`, { method: "DELETE" }),

  // References (admin)
  listReferences: (id) => request(`/api/speakers/${id}/references`),
  addReference: (id, file) =>
    request(`/api/speakers/${id}/references`, { method: "POST", form: audioForm(file) }),
  deleteReference: (id, referenceId) =>
    request(`/api/speakers/${id}/references/${referenceId}`, { method: "DELETE" }),
};

export { BASE_URL };
