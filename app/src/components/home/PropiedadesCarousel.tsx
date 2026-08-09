import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listarPropiedades, type TipoPropiedad } from '../../api/propiedades';
import { PropertyCard } from '../propiedades/PropertyCard';
import { PropertyFilterChips, serializarTipo } from '../propiedades/PropertyFilterChips';
import { useRevealOnScroll } from '../../hooks/useRevealOnScroll';

const GAP = 24;

// Ancho de cada columna del track. En mobile (perPage 1) se deja un poco
// más angosta que el viewport a propósito, para que asome un pedacito de
// la siguiente tarjeta (pedido explícito: que se note que el carrusel
// sigue). Con 2 o 3 por página no hace falta — ya se ven varias tarjetas
// completas a la vez.
function colWidth(perPage: number) {
  if (perPage === 1) return 'calc(100% - 46px)';
  return `calc((100% - ${(perPage - 1) * GAP}px) / ${perPage})`;
}

function usePerPage() {
  const [perPage, setPerPage] = useState(() => calcular());

  function calcular() {
    if (typeof window === 'undefined') return 3;
    if (window.innerWidth >= 981) return 3;
    if (window.innerWidth >= 640) return 2;
    return 1;
  }

  useEffect(() => {
    const onResize = () => setPerPage(calcular());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return perPage;
}

export function PropiedadesCarousel() {
  const [filtro, setFiltro] = useState<TipoPropiedad[] | null>(null);
  const [slide, setSlide] = useState(0);
  const perPage = usePerPage();
  const { ref, visible } = useRevealOnScroll<HTMLDivElement>();

  const propiedades = useQuery({
    queryKey: ['public-propiedades', serializarTipo(filtro)],
    queryFn: () => listarPropiedades({ tipo: filtro ?? undefined, limit: 12 }),
  });

  const items = propiedades.data?.items ?? [];
  const maxSlide = Math.max(items.length - perPage, 0);

  useEffect(() => {
    setSlide(0);
  }, [filtro, perPage]);

  return (
    <section id="propiedades" className="section dark propiedades-section">
      <div className="container">
        <div className={`propiedades-head reveal${visible ? ' visible' : ''}`} ref={ref}>
          <div>
            <span className="eyebrow">Oportunidades</span>
            <h2 className="section-title" style={{ color: '#fff' }}>
              Propiedades disponibles
            </h2>
          </div>
          <div className="propiedades-filtros" style={{ marginTop: 0 }}>
            <PropertyFilterChips activo={filtro} onChange={setFiltro} />
          </div>
        </div>

        {propiedades.isLoading && <div className="loadstate">Cargando propiedades…</div>}
        {!propiedades.isLoading && items.length === 0 && (
          <div className="empty">Todavía no hay propiedades publicadas en esta categoría.</div>
        )}

        {items.length > 0 && (
          <div className="carousel">
            <div className="carousel-viewport">
              <div
                className="carousel-track"
                style={{
                  // El paso tiene que ser "ancho de columna + gap", no solo
                  // "100%/perPage" — si no, el gap entre tarjetas nunca se
                  // recorre y a partir del segundo slide se ve un pedacito
                  // de la tarjeta anterior colándose por el borde. En mobile
                  // (perPage 1) además la columna es un poco más angosta que
                  // el viewport a propósito, para que asome un poco de la
                  // siguiente tarjeta y quede claro que el carrusel sigue.
                  transform: `translateX(calc(-${slide} * (${colWidth(perPage)} + ${GAP}px)))`,
                  gridAutoColumns: colWidth(perPage),
                }}
              >
                {items.map((p) => (
                  <div className="carousel-item" key={p.id}>
                    <PropertyCard propiedad={p} />
                  </div>
                ))}
              </div>
            </div>

            {maxSlide > 0 && (
              <div className="carousel-controls">
                <button
                  type="button"
                  className="carousel-arrow"
                  disabled={slide <= 0}
                  onClick={() => setSlide((s) => Math.max(s - 1, 0))}
                  aria-label="Anterior"
                >
                  ←
                </button>
                <div className="carousel-dots">
                  {Array.from({ length: maxSlide + 1 }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`carousel-dot${i === slide ? ' active' : ''}`}
                      onClick={() => setSlide(i)}
                      aria-label={`Ir a la propiedad ${i + 1}`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className="carousel-arrow"
                  disabled={slide >= maxSlide}
                  onClick={() => setSlide((s) => Math.min(s + 1, maxSlide))}
                  aria-label="Siguiente"
                >
                  →
                </button>
              </div>
            )}
          </div>
        )}

        <div className="propiedades-footer">
          <Link to="/propiedades" className="btn btn-outline">
            Ver todo el catálogo →
          </Link>
        </div>
      </div>
    </section>
  );
}
