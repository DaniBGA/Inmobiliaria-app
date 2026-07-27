import { useState, type FormEvent } from 'react';
import { useAuth, ApiError } from './AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCargando(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesión.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="loginwrap">
      <div className="logincard">
        <div className="brand">
          <div className="logo">
            <span></span>
          </div>
          <span className="btxt">SGM_AR</span>
        </div>
        <h1>Iniciar sesión</h1>
        <p className="sub">Sistema de Gestión Inmobiliaria — Facundo Paris Propiedades</p>
        {error && <div className="err">{error}</div>}
        <form onSubmit={onSubmit}>
          <div className="fg">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="fg">
            <label>Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn-dark" type="submit" disabled={cargando}>
            {cargando ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
