// The only place the app talks to the network.
//
// Everything the UI renders comes from here — there is no course, major, or
// prerequisite data anywhere else in this frontend. That is the whole point of
// the refactor: adding a university must never mean editing JavaScript.
const BASE = window.__API_BASE__ || 'http://localhost:4010/api';

class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(BASE + path, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });
  } catch (cause) {
    // fetch only rejects on a genuine network failure, which is a different
    // problem from a 4xx and deserves a different message to the student.
    throw new ApiError(0, 'Could not reach the server. Check your connection.', { cause });
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, body?.error?.message || `Request failed (${res.status})`,
      body?.error?.details);
  }
  return body?.data;
}

export const api = {
  universities: () => request('/universities'),
  university: (slug) => request(`/universities/${encodeURIComponent(slug)}`),
  majors: (uniSlug) => request(`/universities/${encodeURIComponent(uniSlug)}/majors`),
  major: (id) => request(`/majors/${encodeURIComponent(id)}`),
  courses: (majorId) => request(`/majors/${encodeURIComponent(majorId)}/courses`),
};

export { ApiError };
