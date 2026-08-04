import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError, getToken, setToken, SESION_EXPIRADA_EVENT } from '../api/client';

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: 'ADMIN' | 'EQUIPO';
}

interface AuthContextValue {
  usuario: Usuario | null;
  cargando: boolean;
  sesionExpirada: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [sesionExpirada, setSesionExpirada] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setCargando(false);
      return;
    }
    api
      .get<Usuario>('/auth/me')
      .then(setUsuario)
      .catch(() => setToken(null))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    // Se dispara desde client.ts cuando cualquier request autenticada
    // vuelve con 401 (token expirado o rechazado) — antes eso quedaba
    // como un "Unauthorized" crudo en la pantalla donde te agarraba; así
    // se cierra la sesión al toque y vuelve al login con un aviso.
    function onSesionExpirada() {
      setUsuario(null);
      setSesionExpirada(true);
    }
    window.addEventListener(SESION_EXPIRADA_EVENT, onSesionExpirada);
    return () => window.removeEventListener(SESION_EXPIRADA_EVENT, onSesionExpirada);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ accessToken: string; usuario: Usuario }>('/auth/login', {
      email,
      password,
    });
    setToken(res.accessToken);
    setUsuario(res.usuario);
    setSesionExpirada(false);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUsuario(null);
  }, []);

  return (
    <AuthContext.Provider value={{ usuario, cargando, sesionExpirada, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}

export { ApiError };
