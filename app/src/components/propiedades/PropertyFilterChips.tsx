import { type TipoPropiedad } from '../../api/propiedades';

const FILTROS: { label: string; tipo: TipoPropiedad | null }[] = [
  { label: 'Todas', tipo: null },
  { label: 'Casas', tipo: 'CASA' },
  { label: 'Deptos', tipo: 'DEPARTAMENTO_DUPLEX' },
  { label: 'Lotes', tipo: 'LOTE' },
  { label: 'Locales', tipo: 'LOCAL_OFICINA' },
];

export function PropertyFilterChips({
  activo,
  onChange,
  onLight,
}: {
  activo: TipoPropiedad | null;
  onChange: (tipo: TipoPropiedad | null) => void;
  onLight?: boolean;
}) {
  return (
    <div className={`filter-chips${onLight ? ' on-light' : ''}`}>
      {FILTROS.map((f) => (
        <button
          key={f.label}
          type="button"
          className={`filter-chip${activo === f.tipo ? ' active' : ''}`}
          onClick={() => onChange(f.tipo)}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
