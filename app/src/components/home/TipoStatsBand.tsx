import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { statsPorTipo } from '../../api/propiedades';

const BUCKETS: { key: keyof Awaited<ReturnType<typeof statsPorTipo>>; label: string; tipo: string }[] = [
  { key: 'casas', label: 'Casas', tipo: 'CASA' },
  { key: 'departamentos', label: 'Departamentos', tipo: 'DEPARTAMENTO_DUPLEX' },
  { key: 'locales', label: 'Locales', tipo: 'LOCAL_OFICINA' },
  { key: 'lotes', label: 'Lotes', tipo: 'LOTE' },
];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function TipoStatsBand() {
  const navigate = useNavigate();
  const stats = useQuery({ queryKey: ['public-stats-tipo'], queryFn: statsPorTipo });

  return (
    <section className="section dark">
      <div className="container">
        <span className="eyebrow">Explorá por tipo</span>
        <h2 className="section-title" style={{ color: '#fff' }}>
          Encontrá lo que buscás
        </h2>

        <div className="tipo-stats-grid">
          {BUCKETS.map((b) => (
            <button
              key={b.key}
              type="button"
              className="tipo-stat"
              onClick={() => navigate(`/propiedades?tipo=${b.tipo}`)}
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
