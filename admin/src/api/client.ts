export const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const TOKEN_KEY = 'sgm_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

// Nombre del evento global que AuthContext escucha para cerrar la sesión
// cuando el token deja de ser válido (expiró, o el backend lo rechazó) —
// sin esto, un 401 en cualquier pantalla se mostraba como un error crudo
// ("Unauthorized") ahí mismo, en vez de mandar de nuevo al login.
export const SESION_EXPIRADA_EVENT = 'auth:sesion-expirada';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  // FormData (subida de archivos) no lleva Content-Type propio: el browser
  // arma el multipart/form-data con el boundary correcto solo si el header
  // no está seteado a mano.
  const esFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(options.body && !esFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  // Solo si ESTA request mandó un token y el backend lo rechazó — un 401
  // en /auth/login (contraseña incorrecta) no manda token, así que no cae
  // acá, y lo sigue manejando el catch normal de LoginPage.
  if (res.status === 401 && token) {
    setToken(null);
    window.dispatchEvent(new Event(SESION_EXPIRADA_EVENT));
  }

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = Array.isArray(body.message) ? body.message.join(', ') : (body.message ?? message);
    } catch {
      /* la respuesta no era JSON */
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  // Un endpoint que devuelve `null` (p. ej. "factura de este mes: no hay
  // todavía") a veces llega con body vacío en vez del texto "null" — un
  // `res.json()` directo tira "Unexpected end of JSON input" en ese caso.
  const texto = await res.text();
  return (texto ? JSON.parse(texto) : null) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body != null ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body != null ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, formData: FormData) => request<T>(path, { method: 'POST', body: formData }),
};
