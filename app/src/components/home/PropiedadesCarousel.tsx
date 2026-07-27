import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listarPropiedades, type TipoPropiedad } from '../../api/propiedades';
import { PropertyCard } from '../propiedades/PropertyCard';
import { PropertyFilterChips } from '../propiedades/PropertyFilterChips';

const AUTOPLAY_MS = 4000;

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
  const [filtro, setFiltro] = useState<TipoPropiedad | null>(null);
  const [slide, setSlide] = useState(0);
  const perPage = usePerPage();

  const propiedades = useQuery({
    queryKey: ['public-propiedades', filtro],
    queryFn: () => listarPropiedades({ tipo: filtro ?? undefined, limit: 12 }),
  });

  const items = propiedades.data?.items ?? [];
  const maxSlide = Math.max(items.length - perPage, 0);

  useEffect(() => {
    setSlide(0);
  }, [filtro, perPage]);

  useEffect(() => {
    if (maxSlide === 0) return;
    const id = setInterval(() => {
      setSlide((s) => (s >= maxSlide ? 0 : s + 1));
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [maxSlide]);

  return (
    <section id="propiedades" className="section">
      <div className="container">
        <div className="propiedades-head">
          <div>
            <span className="eyebrow">Nuestras propiedades</span>
            <h2 className="section-title">Propiedades destacadas</h2>
          </div>
          <Link to="/propiedades" className="btn btn-outline">
            Ver todas
          </Link>
        </div>

        <div className="propiedades-filtros">
          <PropertyFilterChips activo={filtro} onChange={setFiltro} />
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
                  transform: `translateX(calc(-${slide} * (100% / ${perPage})))`,
                  gridAutoColumns: `calc((100% - ${(perPage - 1) * 24}px) / ${perPage})`,
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
      </div>
    </section>
  );
}
