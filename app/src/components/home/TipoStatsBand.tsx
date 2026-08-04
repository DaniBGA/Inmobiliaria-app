import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { statsPorTipo } from '../../api/propiedades';
import { useRevealOnScroll } from '../../hooks/useRevealOnScroll';
import { useParallax } from '../../hooks/useParallax';
import fondoBuscas from '../../images/FondoEncontraLoQueBuscas.jpeg';

// "Departamentos" agrupa DEPARTAMENTO + DUPLEX — de ahí que `tipo` sea una
// lista (mismo criterio que FILTROS_TIPO en PropertyFilterChips.tsx).
const BUCKETS: { key: keyof Awaited<ReturnType<typeof statsPorTipo>>; label: string; tipo: string[] }[] = [
  { key: 'casas', label: 'Casas', tipo: ['CASA'] },
  { key: 'departamentos', label: 'Departamentos', tipo: ['DEPARTAMENTO', 'DUPLEX'] },
  { key: 'locales', label: 'Locales', tipo: ['LOCAL_OFICINA'] },
  { key: 'lotes', label: 'Lotes', tipo: ['LOTE'] },
];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function TipoStatsBand() {
  const navigate = useNavigate();
  const stats = useQuery({ queryKey: ['public-stats-tipo'], queryFn: statsPorTipo });
  const { ref, visible } = useRevealOnScroll<HTMLDivElement>();
  const bgParallax = useParallax<HTMLImageElement>(0.12);
  const textParallax = useParallax<HTMLDivElement>(-0.06);

  return (
    <section className="section dark tipo-band">
      <div className="tipo-band-bg">
        <img src={fondoBuscas} alt="" ref={bgParallax} className="parallax-el" />
      </div>
      <div className="tipo-band-overlay" />
      <div className="container tipo-band-inner">
        <div className="parallax-el" ref={textParallax}>
          <span className="eyebrow">Explorá por tipo</span>
          <h2 className="section-title" style={{ color: '#fff' }}>
            Encontrá lo que buscás
          </h2>
        </div>

        <div className={`tipo-stats-grid reveal${visible ? ' visible' : ''}`} ref={ref}>
          {BUCKETS.map((b) => (
            <button
              key={b.key}
              type="button"
              className="tipo-stat"
              onClick={() => navigate(`/propiedades?tipo=${b.tipo.join(',')}`)}
            >
              <span className="tipo-stat-val">{pad(stats.data?.[b.key] ?? 0)}</span>
              <span className="tipo-stat-lbl">{b.label}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
