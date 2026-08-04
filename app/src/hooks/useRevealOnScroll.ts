import { useCallback, useRef, useState } from 'react';

// Reemplaza el `data-reveal` + IntersectionObserver a mano del HTML de
// referencia por un hook React idiomático: fade+rise la primera vez que el
// elemento entra en viewport.
//
// Usa un ref-callback (no `useRef` + `useEffect(() => {...}, [])`) a
// propósito: varios consumidores (ej. ComoTrabajamos.tsx::servicios-cta)
// renderizan el elemento con `ref` recién cuando llega una respuesta del
// backend, es decir DESPUÉS del montaje inicial. Con `useEffect([])` el
// observer se crea una sola vez con `ref.current` todavía en null en ese
// primer render, y nunca se vuelve a intentar — el elemento queda con
// `opacity: 0` (ver .reveal en global.css) para siempre, aunque el usuario
// haga scroll hasta ahí. El ref-callback en cambio se re-ejecuta cada vez
// que React (des)monta el nodo, así que también engancha el observer en
// elementos que aparecen tarde.
export function useRevealOnScroll<T extends HTMLElement>() {
  const [visible, setVisible] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const ref = useCallback((el: T | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    observerRef.current = observer;
  }, []);

  return { ref, visible };
}
