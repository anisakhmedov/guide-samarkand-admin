import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { AdminInfo, api, apiEvents, ApiError, clearToken, getStoredAdmin, getToken, setStoredAdmin, setToken } from '../api/client';

const REFRESH_MS = 30 * 60 * 1000;

interface AuthContextValue {
  admin: AdminInfo | null;
  /** Set when the session ended on its own (expired / account blocked) — shown on the login screen. */
  sessionExpired: boolean;
  login: (login: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminInfo | null>(() => getStoredAdmin());
  const [sessionExpired, setSessionExpired] = useState(false);

  const login = useCallback(async (loginValue: string, password: string) => {
    const res = await api.post<{ token: string; admin: AdminInfo }>('/auth/admin/login', { login: loginValue, password });
    setToken(res.token);
    setStoredAdmin(res.admin);
    setAdmin(res.admin);
    setSessionExpired(false);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setAdmin(null);
  }, []);

  // Any 401 from the API means the token is no longer valid: go back to the login screen
  // instead of leaving a page that silently stops updating.
  useEffect(() => {
    const onUnauthorized = () => {
      clearToken();
      setAdmin(null);
      setSessionExpired(true);
    };
    apiEvents.addEventListener('unauthorized', onUnauthorized);
    return () => apiEvents.removeEventListener('unauthorized', onUnauthorized);
  }, []);

  // Sliding session while the panel is open (the token itself lives 12h).
  useEffect(() => {
    if (!admin) return;
    const refresh = () => {
      if (!getToken()) return;
      api
        .post<{ token: string; admin: AdminInfo }>('/auth/admin/refresh')
        .then((res) => {
          if (!res?.token) return;
          setToken(res.token);
          setStoredAdmin(res.admin);
        })
        .catch((e) => {
          // 401 is handled by the 'unauthorized' listener; network errors just retry next time.
          if (!(e instanceof ApiError)) throw e;
        });
    };
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
  }, [admin?.adminId]);

  return <AuthContext.Provider value={{ admin, sessionExpired, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
