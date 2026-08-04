import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { listarPropiedades, type ModalidadPropiedad, type TipoPropiedad } from '../api/propiedades';
import { PropertyCard } from '../components/propiedades/PropertyCard';
import { PropertyFilterChips } from '../components/propiedades/PropertyFilterChips';

const LIMIT = 12;

export function PropiedadesPage() {
  useDocumentTitle('Propiedades — Facundo Paris Propiedades');

  const [params, setParams] = useSearchParams();
  const modalidad = (params.get('modalidad') as ModalidadPropiedad | null) ?? null;
  // Uno o varios separados por coma — soporta tanto el filtro agrupado de
  // los chips ("DEPARTAMENTO,DUPLEX") como un tipo puntual del select
  // completo de Hero.tsx (ej: "GALPON").
  const tipoParam = params.get('tipo');
  const tipo = tipoParam ? (tipoParam.split(',') as TipoPropiedad[]) : null;
  const [page, setPage] = useState(1);

  function setModalidad(next: ModalidadPropiedad | null) {
    const q = new URLSearchParams(params);
    if (next) q.set('modalidad', next);
    else q.delete('modalidad');
    setParams(q);
    setPage(1);
  }

  function setTipo(next: TipoPropiedad[] | null) {
    const q = new URLSearchParams(params);
    if (next && next.length > 0) q.set('tipo', next.join(','));
    else q.delete('tipo');
    setParams(q);
    setPage(1);
  }

  const propiedades = useQuery({
    queryKey: ['public-propiedades-listado', modalidad, tipoParam, page],
    queryFn: () => listarPropiedades({ modalidad: modalidad ?? undefined, tipo: tipo ?? undefined, page, limit: LIMIT }),
  });

  const items = propiedades.data?.items ?? [];
  const total = propiedades.data?.total ?? 0;
  const totalPaginas = Math.max(Math.ceil(total / LIMIT), 1);

  return (
    <main className="section" style={{ paddingTop: 48 }}>
      <div className="container">
        <span className="eyebrow">Propiedades</span>
        <h1 className="section-title">Todas nuestras propiedades</h1>

        <div className="propiedades-toolbar">
          <div className="search-tabs standalone">
            <button type="button" className={modalidad === null ? 'active' : ''} onClick={() => setModalidad(null)}>
              Todas
            </button>
            <button type="button" className={modalidad === 'VENTA' ? 'active' : ''} onClick={() => setModalidad('VENTA')}>
              Venta
            </button>
            <button type="button" className={modalidad === 'ALQUILER' ? 'active' : ''} onClick={() => setModalidad('ALQUILER')}>
              Alquiler
            </button>
          </div>
          <PropertyFilterChips activo={tipo} onChange={setTipo} onLight />
        </div>

        {propiedades.isLoading && <div className="loadstate">Cargando propiedades…</div>}
        {!propiedades.isLoading && items.length === 0 && (
          <div className="empty">No hay propiedades publicadas con estos filtros.</div>
        )}

        {items.length > 0 && (
          <>
            <div className="propiedades-grid">
              {items.map((p) => (
                <PropertyCard propiedad={p} key={p.id} />
              ))}
            </div>

            {totalPaginas > 1 && (
              <div className="pagination">
                <button type="button" className="btn btn-outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  ← Anterior
                </button>
                <span>
                  Página {page} de {totalPaginas}
                </span>
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={page >= totalPaginas}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Siguiente →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
