import { createContext, ReactNode, useCallback, useContext, useState } from 'react';
import { AdminInfo, api, clearToken, getStoredAdmin, setStoredAdmin, setToken } from '../api/client';

interface AuthContextValue {
  admin: AdminInfo | null;
  login: (login: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminInfo | null>(() => getStoredAdmin());

  const login = useCallback(async (loginValue: string, password: string) => {
    const res = await api.post<{ token: string; admin: AdminInfo }>('/auth/admin/login', { login: loginValue, password });
    setToken(res.token);
    setStoredAdmin(res.admin);
    setAdmin(res.admin);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setAdmin(null);
  }, []);

  return <AuthContext.Provider value={{ admin, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
