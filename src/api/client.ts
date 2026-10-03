export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const TOKEN_KEY = 'admin_token';
const ADMIN_KEY = 'admin_info';
const TIMEOUT_MS = 20000;

export interface AdminInfo {
  adminId: string;
  name: string;
  role: 'super_admin' | 'reception' | 'content_manager';
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ADMIN_KEY);
}
export function getStoredAdmin(): AdminInfo | null {
  const raw = localStorage.getItem(ADMIN_KEY);
  return raw ? JSON.parse(raw) : null;
}
export function setStoredAdmin(info: AdminInfo) {
  localStorage.setItem(ADMIN_KEY, JSON.stringify(info));
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// App-wide signals: AuthContext listens for `unauthorized` (expired/revoked session → back to
// login instead of a silently broken page), Layout shows a banner while the API is unreachable.
export const apiEvents = new EventTarget();
let offline = false;
function setOffline(next: boolean) {
  if (offline === next) return;
  offline = next;
  apiEvents.dispatchEvent(new Event(next ? 'offline' : 'online'));
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };

  // Without a timeout a stalled request (slow hosting, dropped Wi-Fi) left the page waiting
  // forever until a manual reload. Uploads get longer since photos can be large.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.body instanceof FormData ? TIMEOUT_MS * 3 : TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers, signal: controller.signal });
  } catch {
    setOffline(true);
    throw new ApiError(0, 'Нет связи с сервером');
  } finally {
    clearTimeout(timer);
  }
  setOffline(res.status >= 502 && res.status <= 504);

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.message || message;
    } catch {
      // ignore
    }
    if (res.status === 401 && token && !path.startsWith('/auth/admin/login')) {
      apiEvents.dispatchEvent(new Event('unauthorized'));
    }
    throw new ApiError(res.status, Array.isArray(message) ? message.join(', ') : message);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Several components poll the same endpoints (e.g. the bell and a page both on mount) —
// identical GETs already in flight share one network request.
const inflight = new Map<string, Promise<unknown>>();
function get<T>(path: string): Promise<T> {
  const existing = inflight.get(path);
  if (existing) return existing as Promise<T>;
  const p = request<T>(path).finally(() => inflight.delete(path));
  inflight.set(path, p);
  return p;
}

export const api = {
  get,
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

/** Replace state only when the payload actually changed — polling then doesn't re-render big tables. */
export function sameJson(a: unknown, b: unknown) {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}
