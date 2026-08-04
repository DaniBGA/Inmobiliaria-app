import { type TipoPropiedad } from '../../api/propiedades';

// "Deptos" agrupa DEPARTAMENTO + DUPLEX en un solo chip — por eso `tipo` es
// una lista, no un único valor. La identidad de "cuál está activo" se
// compara serializando la lista (join), no por referencia de array — así
// también funciona con un `tipo` de un solo valor que venga de afuera (ej:
// el select completo de tipos en Hero.tsx, que no pasa por estos chips).
export interface FiltroTipo {
  label: string;
  tipo: TipoPropiedad[] | null;
}

export const FILTROS_TIPO: FiltroTipo[] = [
  { label: 'Todas', tipo: null },
  { label: 'Casas', tipo: ['CASA'] },
  { label: 'Deptos', tipo: ['DEPARTAMENTO', 'DUPLEX'] },
  { label: 'Lotes', tipo: ['LOTE'] },
  { label: 'Locales', tipo: ['LOCAL_OFICINA'] },
];

export function serializarTipo(tipo: TipoPropiedad[] | null) {
  return tipo ? [...tipo].sort().join(',') : '';
}

export function PropertyFilterChips({
  activo,
  onChange,
  onLight,
}: {
  activo: TipoPropiedad[] | null;
  onChange: (tipo: TipoPropiedad[] | null) => void;
  onLight?: boolean;
}) {
  const activoKey = serializarTipo(activo);
  return (
    <div className={`filter-chips${onLight ? ' on-light' : ''}`}>
      {FILTROS_TIPO.map((f) => (
        <button
          key={f.label}
          type="button"
          className={`filter-chip${activoKey === serializarTipo(f.tipo) ? ' active' : ''}`}
          onClick={() => onChange(f.tipo)}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
