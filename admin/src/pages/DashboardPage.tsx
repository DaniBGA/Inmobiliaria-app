import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { MiniArea } from '../components/charts/MiniArea';
import { MiniDonut } from '../components/charts/MiniDonut';
import { MiniBars } from '../components/charts/MiniBars';
import { PropiedadFichaDrawer } from '../components/PropiedadFichaDrawer';
import { formatMoney, formatDate, mesActualStr, sumarMesesStr, mesLabel } from '../lib/format';

interface Configuracion {
  ipc: string;
  icl: string;
  honorariosDefaultPorcentaje: string;
}

interface Inquilino {
  nombre: string;
}

interface Propiedad {
  id: string;
  nombre: string;
  direccion: string;
  modalidad: 'ALQUILER' | 'VENTA';
  indice: 'IPC' | 'ICL' | null;
  frecuenciaAumentoMeses: number | null;
  montoAlquilerVigente: string | null;
  inquilino: Inquilino | null;
}

interface CobrosKpis {
  inquilinosActivos: number;
  alDia: number;
  conDeuda: number;
  deudaTotalAcumulada: number;
}

interface FilaCobro {
  propiedadId: string;
  propiedadNombre: string;
  inquilino: Inquilino | null;
  esperado: number | null;
  cobrado: number;
  estado: 'PAGADO' | 'PENDIENTE' | 'IMPAGO' | 'NO_CORRESPONDE';
}

interface ResumenMes {
  totales: { esperado: number; cobrado: number; pendiente: number };
  filas: FilaCobro[];
}

interface RentaVigente {
  monto: string | number | null;
  proximoAumento: string | null;
}

const ESTADO_LABEL: Record<FilaCobro['estado'], { texto: string; clase: string }> = {
  PAGADO: { texto: 'Pagado', clase: 'activo' },
  PENDIENTE: { texto: 'No pagado', clase: 'vencido' },
  IMPAGO: { texto: 'No pagado', clase: 'vencido' },
  NO_CORRESPONDE: { texto: '—', clase: '' },
};

export function DashboardPage() {
  const mesActual = mesActualStr();
  const [fichaId, setFichaId] = useState<string | null>(null);

  const configuracion = useQuery({
    queryKey: ['configuracion'],
    queryFn: () => api.get<Configuracion>('/configuracion'),
  });
  const cobrosKpis = useQuery({
    queryKey: ['cobros', 'kpis'],
    queryFn: () => api.get<CobrosKpis>('/cobros/kpis'),
  });
  const resumenMes = useQuery({
    queryKey: ['cobros', 'mes', mesActual],
    queryFn: () => api.get<ResumenMes>(`/cobros/mes/${mesActual}`),
  });
  const propiedades = useQuery({
    queryKey: ['propiedades'],
    queryFn: () => api.get<Propiedad[]>('/propiedades'),
  });

  const alquiladas = (propiedades.data ?? []).filter(
    (p) => p.modalidad === 'ALQUILER' && p.inquilino,
  );
  const totalAlquiler = (propiedades.data ?? []).filter((p) => p.modalidad === 'ALQUILER');

  const rentaVigenteQueries = useQueries({
    queries: alquiladas.map((p) => ({
      queryKey: ['renta-vigente', p.id],
      queryFn: () => api.get<RentaVigente>(`/propiedades/${p.id}/renta-vigente`),
      enabled: alquiladas.length > 0,
    })),
  });

  // Últimos 7 meses de recaudación (Evolución Estratégica)
  const ultimos7Meses = Array.from({ length: 7 }, (_, i) => sumarMesesStr(mesActual, i - 6));
  const historicoQueries = useQueries({
    queries: ultimos7Meses.map((mes) => ({
      queryKey: ['cobros', 'mes', mes, 'historico'],
      queryFn: () => api.get<ResumenMes>(`/cobros/mes/${mes}`),
    })),
  });

  if (configuracion.isLoading || cobrosKpis.isLoading || resumenMes.isLoading || propiedades.isLoading) {
    return (
      <>
        <PageHeader title="Panel General" />
        <main>
          <div className="loadstate">Cargando…</div>
        </main>
      </>
    );
  }

  const cfg = configuracion.data;
  const kpis = cobrosKpis.data;
  const totales = resumenMes.data?.totales;
  const porcentajeCobrado = totales && totales.esperado > 0 ? Math.round((totales.cobrado / totales.esperado) * 100) : 0;
  const ocupacion = totalAlquiler.length > 0 ? Math.round((alquiladas.length / totalAlquiler.length) * 100) : 0;

  const filasPorId = new Map((resumenMes.data?.filas ?? []).map((f) => [f.propiedadId, f]));
  const rentaVigentePorId = new Map(
    alquiladas.map((p, i) => [p.id, rentaVigenteQueries[i]?.data]),
  );

  const conIndice = alquiladas.filter((p) => p.indice === 'IPC').length;
  const conIndiceIcl = alquiladas.filter((p) => p.indice === 'ICL').length;

  const bruto = totales?.cobrado ?? 0;
  const honorariosPct = cfg ? Number(cfg.honorariosDefaultPorcentaje) : 0;
  const neto = bruto * (1 - honorariosPct / 100);

  const puntosArea = ultimos7Meses.map((mes, i) => ({
    label: mesLabel(mes).slice(0, 3),
    valor: historicoQueries[i]?.data?.totales.cobrado ?? 0,
  }));

  return (
    <>
      <PageHeader
        title="Panel General"
        chips={[
          { label: `${alquiladas.length} activos`, tone: 'green' },
        ]}
      />
      <main>
        <div className="kpis">
          <Link to="/configuracion" className="kpi editable" title="Clic para editar el valor del índice">
            <div className="lbl">Actualizaciones IPC</div>
            <div className="val">{cfg ? Number(cfg.ipc).toLocaleString('es-AR') : '—'}</div>
            <div className="hint">clic para editar índice</div>
          </Link>
          <Link to="/configuracion" className="kpi editable" title="Clic para editar el valor del índice">
            <div className="lbl">Actualizaciones ICL</div>
            <div className="val">{cfg ? Number(cfg.icl).toLocaleString('es-AR') : '—'}</div>
            <div className="hint">clic para editar índice</div>
          </Link>
          <Link to="/inquilinos" className={`kpi editable${(kpis?.deudaTotalAcumulada ?? 0) > 0 ? ' alert' : ''}`}>
            <div className="lbl">Deuda de Inquilinos</div>
            <div className="val">{formatMoney(kpis?.deudaTotalAcumulada ?? 0)}</div>
            <div className="hint">{kpis?.conDeuda ?? 0} inquilino(s) con deuda</div>
          </Link>
          <div className="kpi">
            <div className="lbl">Ocupación de Cartera</div>
            <div className="val">{ocupacion}%</div>
            <div className="hint">
              {alquiladas.length} de {totalAlquiler.length} alquiladas
            </div>
          </div>
          <Link to="/inquilinos" className="kpi editable">
            <div className="lbl">Cobranza del Mes</div>
            <div className={`val${porcentajeCobrado < 100 ? ' bad' : ' ok'}`}>{porcentajeCobrado}%</div>
            <div className="hint">
              {formatMoney(totales?.cobrado ?? 0)} de {formatMoney(totales?.esperado ?? 0)}
            </div>
          </Link>
        </div>

        <div className="charts">
          <div className="panel">
            <h3>
              EVOLUCIÓN ESTRATÉGICA{' '}
              <span className="legend">
                <span>
                  <i style={{ background: 'var(--ink)' }}></i>RECAUDACIÓN TOTAL
                </span>
              </span>
            </h3>
            <MiniArea puntos={puntosArea} />
          </div>
          <div className="panel">
            <h3>
              CARTERA POR CONTRATO{' '}
              <span className="legend">
                <span>
                  <i style={{ background: 'var(--ink)' }}></i>IPC
                </span>
                <span>
                  <i style={{ background: 'var(--indigo)' }}></i>ICL
                </span>
              </span>
            </h3>
            <MiniDonut
              a={{ label: 'IPC', valor: conIndice, color: 'var(--ink)' }}
              b={{ label: 'ICL', valor: conIndiceIcl, color: 'var(--indigo)' }}
            />
          </div>
          <div className="panel">
            <h3>
              EFICIENCIA DE RECAUDACIÓN{' '}
              <span className="legend">
                <span>
                  <i style={{ background: 'var(--ink)' }}></i>BRUTO
                </span>
                <span>
                  <i style={{ background: 'var(--indigo)' }}></i>NETO
                </span>
              </span>
            </h3>
            <MiniBars bruto={bruto} neto={neto} />
          </div>
        </div>

        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>PROPIEDAD</th>
                <th>INQUILINO</th>
                <th>ÍNDICE</th>
                <th style={{ textAlign: 'right' }}>RENTA ACTUAL</th>
                <th>PRÓXIMO AUMENTO</th>
                <th>ESTADO</th>
              </tr>
            </thead>
            <tbody>
              {alquiladas.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    Sin propiedades de alquiler.
                  </td>
                </tr>
              )}
              {alquiladas.map((p) => {
                const fila = filasPorId.get(p.id);
                const rv = rentaVigentePorId.get(p.id);
                const estado = fila?.estado ?? 'NO_CORRESPONDE';
                const { texto, clase } = ESTADO_LABEL[estado];
                return (
                  <tr key={p.id} className="movrow" onClick={() => setFichaId(p.id)} title="Clic para ver la ficha de la propiedad">
                    <td>
                      <div className="pname">{p.nombre}</div>
                      <div className="psub">
                        <b>ALQUILER</b> • {p.direccion}
                      </div>
                    </td>
                    <td>{p.inquilino?.nombre ?? <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                    <td>
                      {p.indice ? (
                        <>
                          <span className="idx">{p.indice}</span>
                          <div className="freq">
                            cada {p.frecuenciaAumentoMeses ?? '—'} {p.frecuenciaAumentoMeses === 1 ? 'mes' : 'meses'}
                          </div>
                        </>
                      ) : (
                        <span style={{ color: 'var(--muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="money">
                        {rv?.monto != null ? formatMoney(rv.monto) : formatMoney(p.montoAlquilerVigente)}
                      </span>
                    </td>
                    <td>
                      {rv?.proximoAumento ? (
                        <span className="nextdate">{formatDate(rv.proximoAumento)}</span>
                      ) : (
                        <span style={{ color: 'var(--muted)' }}>—</span>
                      )}
                    </td>
                    <td>
                      {clase ? <span className={`badge ${clase}`}><span className="dot"></span>{texto}</span> : <span style={{ color: 'var(--muted)' }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
      {fichaId && <PropiedadFichaDrawer propiedadId={fichaId} onClose={() => setFichaId(null)} />}
    </>
  );
}
