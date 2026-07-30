import { useEffect, useRef } from 'react';

// Traslada el elemento en Y en proporción a qué tan lejos está su centro
// del centro del viewport — genera el efecto de profundidad clásico
// (fondos que se mueven más lento/rápido que el resto de la página).
// `speed` > 0 se mueve en el mismo sentido del scroll, < 0 al revés.
// Se desactiva con prefers-reduced-motion (mismo criterio que Splash).
export function useParallax<T extends HTMLElement>(speed = 0.2) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let raf = 0;
    function update() {
      raf = 0;
      const node = ref.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const center = rect.top + rect.height / 2 - window.innerHeight / 2;
      node.style.transform = `translate3d(0, ${(center * speed).toFixed(1)}px, 0)`;
    }
    function onScroll() {
      if (!raf) raf = requestAnimationFrame(update);
    }

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [speed]);

  return ref;
}
