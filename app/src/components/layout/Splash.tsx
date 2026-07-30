import { useEffect, useState } from 'react';
import logo from '../../logos/LOGO PNG.-10.png';

const SPLASH_MS = 2400;
const FADE_MS = 600;

// Pantalla de carga inicial, puramente cosmética — no bloquea ni depende de
// que los datos reales (propiedades, contacto) hayan terminado de llegar,
// esos siguen cargando de fondo con sus propios loadstate por sección.
export function Splash() {
  const [loading, setLoading] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setLoading(false);
      return;
    }
    const fadeT = setTimeout(() => setFading(true), SPLASH_MS);
    const doneT = setTimeout(() => setLoading(false), SPLASH_MS + FADE_MS);
    return () => {
      clearTimeout(fadeT);
      clearTimeout(doneT);
    };
  }, []);

  if (!loading) return null;

  return (
    <div className={`splash${fading ? ' fading' : ''}`} aria-hidden="true">
      <div className="splash-mark">
        <img src={logo} alt="Facundo Paris Propiedades" />
      </div>
      <div className="splash-bar">
        <div className="splash-bar-fill" />
      </div>
    </div>
  );
}
