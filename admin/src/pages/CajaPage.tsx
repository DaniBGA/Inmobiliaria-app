import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { formatMoney, formatUsd, formatDate, mesActualStr, sumarMesesStr, mesLabel } from '../lib/format';
import { descargarCsv } from '../lib/csv';

type TipoMovimiento = 'INGRESO' | 'EGRESO';
type Moneda = 'ARS' | 'USD' | 'EUR';

interface Movimiento {
  id: string;
  fecha: string;
  tipo: TipoMovimiento;
  moneda: Moneda;
  monto: string | number;
  concepto: string;
  categoria: string | null;
  medio: string | null;
  referencia: string | null;
  origen: string;
  // Id del registro que originó este movimiento automático (§3.8) — permite
  // editarlo/deshacerlo desde acá sin tener que ir a buscarlo a su módulo.
  pago?: { id: string } | null;
  gasto?: { id: string } | null;
  liquidacion?: { id: string; propietarioId: string; mes: string } | null;
  pagoProveedor?: { id: string } | null;
  ventaComision?: { id: string } | null;
}

interface GastoDetalle {
  id: string;
  descripcion: string;
  monto: string | number;
  fecha: string;
  categoria: string;
  destino: 'PROPIETARIO' | 'INQUILINO' | 'INMOBILIARIA';
  propiedad: { nombre: string };
}

interface CajaKpis {
  ingresosPesos: number;
  egresosPesos: number;
  ingresosDolares: number;
  gananciaPesos: number;
  comisionesVentaUsd: number;
  saldoAcumulado: number;
}

interface ResumenAnualFila {
  mes: string;
  esperado: number;
  cobrado: number;
  morosidad: number;
  gastos: number;
  honorarios: number;
  liquidado: number;
}

interface ResumenAnual {
  anio: number;
  filas: ResumenAnualFila[];
}

// Categorías automáticas: las genera el sistema desde su módulo de origen
// (Cobros, Liquidaciones, Ventas, Incidencias) — no se ofrecen para carga
// manual porque duplicarían el movimiento y la caja quedaría mal.
const ORIGEN_LABEL: Record<string, string> = {
  MANUAL: 'Manual',
  COBRO_ALQUILER: 'Cobro de alquiler',
  GASTO_PROPIEDAD: 'Gasto de propiedad',
  LIQUIDACION_PROPIETARIO: 'Liquidación a propietario',
  PAGO_PROVEEDOR: 'Pago a proveedor',
  COMISION_VENTA: 'Comisión de venta',
};

const CAT_PAGO_ALQUILER = 'Pago de alquiler';
const CAT_ING = [CAT_PAGO_ALQUILER, 'Honorarios de administración', 'Comisión de venta', 'Otros ingresos'];
const CAT_EGR = ['Sueldos', 'Alquiler de oficina', 'Servicios', 'Impuestos', 'Proveedores', 'Marketing', 'Otros egresos'];
const MEDIOS = ['Transferencia', 'Efectivo', 'Otro'];

interface FichaDeudor {
  propiedadId: string;
  propiedadNombre: string;
  inquilino: { nombre: string } | null;
  deudaAcumulada: number;
  mesesImpagos: number;
}

interface MesPendiente {
  mes: string;
  esperado: number;
  cobrado: number;
  pendiente: number;
}

const MOVS_POR_PAGINA = 15;

function fmtMon(m: Movimiento) {
  if (m.moneda === 'USD') return formatUsd(m.monto);
  if (m.moneda === 'EUR') return `€ ${Number(m.monto).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
  return formatMoney(m.monto);
}

export function CajaPage() {
  const qc = useQueryClient();
  const [mes, setMes] = useState(mesActualStr());
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [modal, setModal] = useState<'new' | Movimiento | null>(null);
  const [pagina, setPagina] = useState(1);
  const [filtroCatIngreso, setFiltroCatIngreso] = useState('');
  const [filtroCatEgreso, setFiltroCatEgreso] = useState('');
  const mesAnterior = sumarMesesStr(mes, -1);

  useEffect(() => {
    setPagina(1);
  }, [mes, filtroCatIngreso, filtroCatEgreso]);

  const movimientos = useQuery({
    queryKey: ['caja', 'movimientos', mes],
    queryFn: () => api.get<Movimiento[]>(`/caja/movimientos?mes=${mes}`),
  });
  const kpis = useQuery({
    queryKey: ['caja', 'kpis', mes],
    queryFn: () => api.get<CajaKpis>(`/caja/kpis/${mes}`),
  });
  const kpisAnterior = useQuery({
    queryKey: ['caja', 'kpis', mesAnterior],
    queryFn: () => api.get<CajaKpis>(`/caja/kpis/${mesAnterior}`),
  });
  const resumenAnual = useQuery({
    queryKey: ['reportes', 'resumen-anual', anio],
    queryFn: () => api.get<ResumenAnual>(`/reportes/resumen-anual/${anio}`),
  });

  // Editar/deshacer desde Caja puede tocar cualquiera de los cinco módulos
  // de origen (Cobros, Gastos, Proveedores/Incidencias, Ventas,
  // Liquidaciones) — se invalida todo junto en vez de tratar de acertarle
  // solo a la sección que corresponde a cada caso.
  function invalidarCaja() {
    qc.invalidateQueries({ queryKey: ['caja'] });
    qc.invalidateQueries({ queryKey: ['cobros'] });
    qc.invalidateQueries({ queryKey: ['gastos'] });
    qc.invalidateQueries({ queryKey: ['proveedores'] });
    qc.invalidateQueries({ queryKey: ['incidencias'] });
    qc.invalidateQueries({ queryKey: ['ventas'] });
    qc.invalidateQueries({ queryKey: ['reportes'] });
    qc.invalidateQueries({ queryKey: ['propiedades'] });
    qc.invalidateQueries({ queryKey: ['avisos'] });
  }

  const movs = movimientos.data ?? [];
  const esARS = (m: Movimiento) => m.moneda === 'ARS';
  // El saldo corrido se calcula en orden cronológico (el back ya devuelve
  // los movimientos ordenados por fecha ascendente) y recién después se
  // invierte para mostrar los últimos arriba — si se invirtiera antes,
  // el saldo de cada fila quedaría mal calculado.
  let corr = kpisAnterior.data?.saldoAcumulado ?? 0;
  const filasConSaldo = movs.map((m) => {
    if (esARS(m)) corr += m.tipo === 'INGRESO' ? Number(m.monto) : -Number(m.monto);
    return { m, saldo: corr };
  });

  // Categorías de ingresos y egresos disponibles para filtrar — se arman a
  // partir de lo que realmente aparece este mes (no de una lista fija),
  // para que el filtro siempre tenga sentido con los datos reales, incluidas
  // las categorías que generan automáticamente otros módulos (Alquiler,
  // Ventas, Liquidación, Proveedores, etc.).
  const categoriasIngreso = Array.from(
    new Set(movs.filter((m) => m.tipo === 'INGRESO' && m.categoria).map((m) => m.categoria as string)),
  ).sort();
  const categoriasEgreso = Array.from(
    new Set(movs.filter((m) => m.tipo === 'EGRESO' && m.categoria).map((m) => m.categoria as string)),
  ).sort();

  // Los dos filtros son independientes entre sí: elegir una categoría de
  // ingresos no oculta los egresos (y viceversa) — cada uno filtra solo su
  // propio tipo de movimiento.
  function pasaFiltroCategoria(m: Movimiento) {
    if (m.tipo === 'INGRESO') return !filtroCatIngreso || m.categoria === filtroCatIngreso;
    if (m.tipo === 'EGRESO') return !filtroCatEgreso || m.categoria === filtroCatEgreso;
    return true;
  }

  const filasOrdenadas = filasConSaldo
    .filter(({ m }) => pasaFiltroCategoria(m))
    .slice()
    .reverse();
  const totalPaginas = Math.max(1, Math.ceil(filasOrdenadas.length / MOVS_POR_PAGINA));
  const paginaActual = Math.min(pagina, totalPaginas);
  const filasPagina = filasOrdenadas.slice(
    (paginaActual - 1) * MOVS_POR_PAGINA,
    paginaActual * MOVS_POR_PAGINA,
  );

  function exportarMovimientos() {
    const filas: unknown[][] = [
      ['Fecha', 'Concepto', 'Categoría', 'Medio', 'Moneda', 'Ingreso', 'Egreso'],
      ...movs.map((m) => [
        formatDate(m.fecha),
        m.concepto,
        m.categoria ?? '',
        m.medio ?? '',
        m.moneda,
        m.tipo === 'INGRESO' ? Number(m.monto) : '',
        m.tipo === 'EGRESO' ? Number(m.monto) : '',
      ]),
    ];
    descargarCsv(`caja_${mes}.csv`, filas);
  }

  function exportarAnual() {
    const filas: unknown[][] = [
      ['Mes', 'Esperado', 'Cobrado', 'Morosidad', 'Gastos', 'Honorarios', 'Liquidado'],
      ...(resumenAnual.data?.filas ?? []).map((f) => [
        mesLabel(f.mes),
        f.esperado,
        f.cobrado,
        f.morosidad,
        f.gastos,
        f.honorarios,
        f.liquidado,
      ]),
    ];
    descargarCsv(`resumen_anual_${anio}.csv`, filas);
  }

  const totalIngresosPesos = movs.filter((m) => m.tipo === 'INGRESO' && esARS(m)).reduce((s, m) => s + Number(m.monto), 0);
  const totalEgresosPesos = movs.filter((m) => m.tipo === 'EGRESO' && esARS(m)).reduce((s, m) => s + Number(m.monto), 0);

  const accAnual = (resumenAnual.data?.filas ?? []).reduce(
    (acc, f) => ({
      esperado: acc.esperado + f.esperado,
      cobrado: acc.cobrado + f.cobrado,
      morosidad: acc.morosidad + f.morosidad,
      gastos: acc.gastos + f.gastos,
      honorarios: acc.honorarios + f.honorarios,
      liquidado: acc.liquidado + f.liquidado,
    }),
    { esperado: 0, cobrado: 0, morosidad: 0, gastos: 0, honorarios: 0, liquidado: 0 },
  );

  return (
    <>
      <PageHeader title="Caja" />
      <main>
        <div className="kpis">
          <div className="kpi">
            <div className="lbl">Ingresos en Pesos</div>
            <div className="val ok">{formatMoney(kpis.data?.ingresosPesos ?? 0)}</div>
          </div>
          <div className="kpi">
            <div className="lbl">Ingresos en Dólares</div>
            <div className="val ok">{formatUsd(kpis.data?.ingresosDolares ?? 0)}</div>
          </div>
          <div className="kpi">
            <div className="lbl">Egresos del mes</div>
            <div className="val bad">{formatMoney(kpis.data?.egresosPesos ?? 0)}</div>
          </div>
          <div className={`kpi${(kpis.data?.gananciaPesos ?? 0) < 0 ? ' alert' : ''}`}>
            <div className="lbl">Ganancia de la inmobiliaria</div>
            <div className="val" style={{ color: (kpis.data?.gananciaPesos ?? 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {formatMoney(kpis.data?.gananciaPesos ?? 0)}
            </div>
            <div className="hint">
              honorarios − gastos propios
              {(kpis.data?.comisionesVentaUsd ?? 0) > 0 && <> · {formatUsd(kpis.data!.comisionesVentaUsd)} en comisiones USD (no incluidas)</>}
            </div>
          </div>
          <div className="kpi">
            <div className="lbl">Saldo acumulado</div>
            <div className="val" style={{ color: (kpis.data?.saldoAcumulado ?? 0) >= 0 ? 'var(--ink)' : 'var(--red)' }}>
              {formatMoney(kpis.data?.saldoAcumulado ?? 0)}
            </div>
            <div className="hint">al cierre de este mes</div>
          </div>
        </div>

        <div className="tablewrap">
          <div className="monthbar">
            <button className="navm" onClick={() => setMes(sumarMesesStr(mes, -1))} title="Mes anterior">
              ‹
            </button>
            <span className="mlabel">{mesLabel(mes)}</span>
            <button className="navm" onClick={() => setMes(sumarMesesStr(mes, 1))} title="Mes siguiente">
              ›
            </button>
            <button className="btn-sm" onClick={() => setMes(mesActualStr())}>
              Mes actual
            </button>
            <span className="spacer"></span>
            <button className="btn-sm" onClick={exportarMovimientos}>
              Exportar CSV
            </button>
            <button className="btn-sm solid" onClick={() => setModal('new')}>
              + Nuevo movimiento
            </button>
          </div>
          <div className="searchbar">
            <select
              value={filtroCatIngreso}
              onChange={(e) => setFiltroCatIngreso(e.target.value)}
              style={{ border: '1px solid var(--border)', borderRadius: 9, padding: '9px 12px', background: 'var(--bg)', fontSize: 13 }}
            >
              <option value="">Categoría de ingresos (todas)</option>
              {categoriasIngreso.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={filtroCatEgreso}
              onChange={(e) => setFiltroCatEgreso(e.target.value)}
              style={{ border: '1px solid var(--border)', borderRadius: 9, padding: '9px 12px', background: 'var(--bg)', fontSize: 13 }}
            >
              <option value="">Categoría de egresos (todas)</option>
              {categoriasEgreso.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <table>
            <thead>
              <tr>
                <th style={{ width: 110 }}>FECHA</th>
                <th>CONCEPTO</th>
                <th>CATEGORÍA</th>
                <th>MEDIO</th>
                <th style={{ textAlign: 'right' }}>INGRESO</th>
                <th style={{ textAlign: 'right' }}>EGRESO</th>
                <th style={{ textAlign: 'right' }}>SALDO</th>
              </tr>
            </thead>
            <tbody>
              {filasPagina.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty">
                    No hay movimientos en este período. Los cobros y liquidaciones aparecen acá automáticamente.
                  </td>
                </tr>
              )}
              {filasPagina.map(({ m, saldo }) => {
                return (
                  <tr
                    key={m.id}
                    className="movrow"
                    title="Clic para editar este movimiento"
                    onClick={() => setModal(m)}
                  >
                    <td>
                      <span className="pdate">{formatDate(m.fecha)}</span>
                    </td>
                    <td>
                      <div className="pname">{m.concepto}</div>
                      {m.origen !== 'MANUAL' ? (
                        <div className="psub">automático · generado desde {ORIGEN_LABEL[m.origen] ?? m.origen}</div>
                      ) : (
                        m.referencia && <div className="psub">Ref: {m.referencia}</div>
                      )}
                    </td>
                    <td>{m.categoria && <span className="cattag">{m.categoria}</span>}</td>
                    <td style={{ fontSize: 12.5, color: 'var(--ink2)' }}>{m.medio ?? '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      {m.tipo === 'INGRESO' ? <span className="money cajain">{fmtMon(m)}</span> : <span style={{ color: 'var(--muted)' }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {m.tipo === 'EGRESO' ? <span className="money cajaout">{fmtMon(m)}</span> : <span style={{ color: 'var(--muted)' }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {esARS(m) ? (
                        <span className="money" style={{ color: saldo >= 0 ? 'var(--ink)' : 'var(--red)' }}>
                          {formatMoney(saldo)}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--muted)' }} title="No afecta el saldo en pesos">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {filasConSaldo.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={4} style={{ fontWeight: 800 }}>
                    TOTALES DEL MES (PESOS)
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="money cajain">{formatMoney(totalIngresosPesos)}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="money cajaout">{formatMoney(totalEgresosPesos)}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span
                      className="money"
                      style={{ color: totalIngresosPesos - totalEgresosPesos >= 0 ? 'var(--green)' : 'var(--red)' }}
                    >
                      {formatMoney(totalIngresosPesos - totalEgresosPesos)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
          {totalPaginas > 1 && (
            <div className="pagbar">
              <button className="navm" disabled={paginaActual === 1} onClick={() => setPagina(paginaActual - 1)} title="Página anterior">
                ‹
              </button>
              <span className="paglabel">
                Página {paginaActual} de {totalPaginas}
                <small>
                  {' '}
                  · {filasOrdenadas.length} movimiento{filasOrdenadas.length === 1 ? '' : 's'} en total
                </small>
              </span>
              <button
                className="navm"
                disabled={paginaActual === totalPaginas}
                onClick={() => setPagina(paginaActual + 1)}
                title="Página siguiente"
              >
                ›
              </button>
            </div>
          )}
        </div>

        <div className="secttl" style={{ marginTop: 26 }}>
          RESUMEN ANUAL
        </div>
        <div className="tablewrap">
          <div className="searchbar" style={{ justifyContent: 'space-between' }}>
            <div className="yearbar" style={{ margin: 0 }}>
              <button className="navm" onClick={() => setAnio((a) => a - 1)}>
                ‹
              </button>
              <span className="ylabel">{anio}</span>
              <button className="navm" onClick={() => setAnio((a) => a + 1)}>
                ›
              </button>
              <span style={{ fontWeight: 700, fontSize: 13.5, marginLeft: 10 }}>Resumen anual</span>
            </div>
            <button className="btn-sm" onClick={exportarAnual}>
              Exportar este resumen
            </button>
          </div>
          <table className="anualtable">
            <thead>
              <tr>
                <th>MES</th>
                <th>ESPERADO</th>
                <th>COBRADO</th>
                <th>MOROSIDAD</th>
                <th>GASTOS</th>
                <th>HONORARIOS</th>
                <th>LIQUIDADO</th>
              </tr>
            </thead>
            <tbody>
              {(resumenAnual.data?.filas ?? []).map((f) => {
                const [, mIdx] = f.mes.split('-').map(Number);
                const futuro = new Date(anio, mIdx - 1, 1) > new Date();
                return (
                  <tr key={f.mes} style={futuro ? { opacity: 0.45 } : undefined}>
                    <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>{mesLabel(f.mes).split(' ')[0]}</td>
                    <td className="money">{f.esperado ? formatMoney(f.esperado) : '—'}</td>
                    <td className="money" style={{ color: 'var(--green)' }}>
                      {f.cobrado ? formatMoney(f.cobrado) : '—'}
                    </td>
                    <td className="money" style={{ color: f.morosidad ? 'var(--red)' : 'var(--muted)' }}>
                      {f.morosidad ? formatMoney(f.morosidad) : '—'}
                    </td>
                    <td className="money">{f.gastos ? formatMoney(f.gastos) : '—'}</td>
                    <td className="money">{f.honorarios ? formatMoney(f.honorarios) : '—'}</td>
                    <td className="money" style={{ fontWeight: 700 }}>
                      {f.liquidado ? formatMoney(f.liquidado) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td>TOTAL {anio}</td>
                <td>{formatMoney(accAnual.esperado)}</td>
                <td style={{ color: 'var(--green)' }}>{formatMoney(accAnual.cobrado)}</td>
                <td style={{ color: 'var(--red)' }}>{formatMoney(accAnual.morosidad)}</td>
                <td>{formatMoney(accAnual.gastos)}</td>
                <td>{formatMoney(accAnual.honorarios)}</td>
                <td>{formatMoney(accAnual.liquidado)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </main>

      {modal === 'new' || (modal && modal.origen === 'MANUAL') ? (
        <NuevoMovimientoModal
          mesActual={mes}
          movimiento={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            invalidarCaja();
          }}
        />
      ) : (
        modal && (
          <EditarMovimientoAutomaticoModal
            movimiento={modal}
            onClose={() => setModal(null)}
            onSaved={() => {
              setModal(null);
              invalidarCaja();
            }}
          />
        )
      )}
    </>
  );
}

const MEDIOS_PAGO = [
  { value: 'TRANSFERENCIA', label: 'Transferencia' },
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'OTRO', label: 'Otro' },
];

function NuevoMovimientoModal({
  mesActual,
  movimiento,
  onClose,
  onSaved,
}: {
  mesActual: string;
  movimiento?: Movimiento | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const esEdicion = !!movimiento;
  const [tipo, setTipo] = useState<TipoMovimiento>(movimiento?.tipo ?? 'EGRESO');
  const [categoria, setCategoria] = useState(movimiento?.categoria ?? CAT_EGR[0]);
  const [moneda, setMoneda] = useState<Moneda>(movimiento?.moneda ?? 'ARS');
  const [monto, setMonto] = useState(movimiento ? String(movimiento.monto) : '');
  const [concepto, setConcepto] = useState(movimiento?.concepto ?? '');
  const [medio, setMedio] = useState(movimiento?.medio ?? 'Transferencia');
  const [referencia, setReferencia] = useState(movimiento?.referencia ?? '');
  const [fecha, setFecha] = useState(
    movimiento ? movimiento.fecha.slice(0, 10) : `${mesActual}-${String(Math.min(new Date().getDate(), 28)).padStart(2, '0')}`,
  );
  const [error, setError] = useState<string | null>(null);

  const [propiedadId, setPropiedadId] = useState('');
  const [mesAPagar, setMesAPagar] = useState('');
  const [medioPago, setMedioPago] = useState('TRANSFERENCIA');

  // Editar es solo para movimientos manuales "sueltos" — el flujo de "Pago
  // de alquiler" siempre pasa por Cobros (origen COBRO_ALQUILER, no MANUAL),
  // así que nunca puede aparecer acá; por eso se saca esa categoría del
  // combo al editar, para no ofrecer un camino que no tiene sentido.
  const categoriasBase = tipo === 'INGRESO' ? CAT_ING : CAT_EGR;
  const categorias = esEdicion ? categoriasBase.filter((c) => c !== CAT_PAGO_ALQUILER) : categoriasBase;
  const esPagoAlquiler = !esEdicion && tipo === 'INGRESO' && categoria === CAT_PAGO_ALQUILER;

  const deudores = useQuery({
    queryKey: ['cobros', 'inquilinos'],
    queryFn: () => api.get<FichaDeudor[]>('/cobros/inquilinos'),
    enabled: esPagoAlquiler,
  });
  const pendientes = useQuery({
    queryKey: ['cobros', 'meses-pendientes', propiedadId],
    queryFn: () => api.get<MesPendiente[]>(`/cobros/propiedades/${propiedadId}/meses-pendientes`),
    enabled: esPagoAlquiler && !!propiedadId,
  });

  const listaDeudores = (deudores.data ?? [])
    .slice()
    .sort((a, b) => b.deudaAcumulada - a.deudaAcumulada);
  const mesElegido = pendientes.data?.find((m) => m.mes === mesAPagar);

  function elegirPropiedad(id: string) {
    setPropiedadId(id);
    setMesAPagar('');
    setMonto('');
  }

  function elegirMes(mes: string) {
    setMesAPagar(mes);
    const fila = pendientes.data?.find((m) => m.mes === mes);
    if (fila) setMonto(String(fila.pendiente));
  }

  const guardar = useMutation({
    mutationFn: () => {
      if (esEdicion) {
        return api.patch(`/caja/movimientos/${movimiento!.id}`, {
          fecha,
          tipo,
          moneda,
          monto: Number(monto),
          concepto,
          categoria,
          medio,
          referencia: referencia || undefined,
        });
      }
      if (esPagoAlquiler) {
        return api.post(`/cobros/propiedades/${propiedadId}/pagos`, {
          mes: mesAPagar,
          monto: Number(monto),
          fecha,
          medio: medioPago,
          comprobante: referencia || undefined,
        });
      }
      return api.post('/caja/movimientos', {
        fecha,
        tipo,
        moneda,
        monto: Number(monto),
        concepto,
        categoria,
        medio,
        referencia: referencia || undefined,
      });
    },
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo guardar el movimiento.'),
  });

  const eliminar = useMutation({
    mutationFn: () => api.delete(`/caja/movimientos/${movimiento!.id}`),
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo eliminar el movimiento.'),
  });

  function confirmarEliminar() {
    if (window.confirm('¿Eliminar este movimiento? Esta acción no se puede deshacer.')) {
      eliminar.mutate();
    }
  }

  const puedeGuardar = esPagoAlquiler
    ? !!propiedadId && !!mesAPagar && !!monto
    : !!concepto.trim() && !!monto;

  return (
    <Modal open onClose={onClose} title={esEdicion ? 'Editar Movimiento' : 'Nuevo Movimiento'}>
      {error && <div className="errstate" style={{ marginBottom: 14 }}>{error}</div>}
      <div className="formgrid">
        <div className="fg">
          <label>Tipo</label>
          <select
            value={tipo}
            onChange={(e) => {
              const t = e.target.value as TipoMovimiento;
              setTipo(t);
              setCategoria(t === 'INGRESO' ? CAT_ING[0] : CAT_EGR[0]);
            }}
          >
            <option value="INGRESO">Ingreso</option>
            <option value="EGRESO">Egreso</option>
          </select>
        </div>
        {!esPagoAlquiler && (
          <div className="fg">
            <label>Moneda</label>
            <select value={moneda} onChange={(e) => setMoneda(e.target.value as Moneda)}>
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
        )}
        <div className="fg">
          <label>Categoría</label>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {esPagoAlquiler ? (
          <>
            <div className="fg full">
              <label>Quién paga</label>
              <select value={propiedadId} onChange={(e) => elegirPropiedad(e.target.value)}>
                <option value="">Seleccioná un inquilino o propiedad…</option>
                {listaDeudores.map((f) => (
                  <option key={f.propiedadId} value={f.propiedadId}>
                    {f.inquilino?.nombre ?? 'Sin inquilino'} — {f.propiedadNombre}
                    {f.deudaAcumulada > 0 ? ` (debe ${f.mesesImpagos} mes${f.mesesImpagos === 1 ? '' : 'es'})` : ''}
                  </option>
                ))}
              </select>
            </div>
            {propiedadId && (
              <div className="fg full">
                <label>Mes que abona</label>
                <select value={mesAPagar} onChange={(e) => elegirMes(e.target.value)} disabled={pendientes.isLoading}>
                  <option value="">
                    {pendientes.isLoading
                      ? 'Buscando meses pendientes…'
                      : pendientes.data?.length
                        ? 'Seleccioná el mes…'
                        : 'Esta propiedad no tiene meses pendientes'}
                  </option>
                  {(pendientes.data ?? []).map((m) => (
                    <option key={m.mes} value={m.mes}>
                      {mesLabel(m.mes)} — pendiente {formatMoney(m.pendiente)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        ) : (
          <div className="fg full">
            <label>Concepto</label>
            <input value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Ej: Pago de sueldos administrativos" />
          </div>
        )}

        <div className="fg">
          <label>Importe {esPagoAlquiler && mesElegido ? '(editable si paga parcial)' : ''}</label>
          <input type="number" min={0.01} step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} />
        </div>
        <div className="fg">
          <label>Medio</label>
          {esPagoAlquiler ? (
            <select value={medioPago} onChange={(e) => setMedioPago(e.target.value)}>
              {MEDIOS_PAGO.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          ) : (
            <select value={medio} onChange={(e) => setMedio(e.target.value)}>
              {MEDIOS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="fg">
          <label>Fecha</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div className="fg full">
          <label>Referencia / comprobante</label>
          <input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Opcional" />
        </div>
      </div>
      <div className="btnrow">
        {esEdicion && (
          <button
            className="btn-sm ghostred"
            style={{ marginRight: 'auto' }}
            disabled={eliminar.isPending}
            onClick={confirmarEliminar}
          >
            Eliminar movimiento
          </button>
        )}
        <button className="btn-ghost" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn-dark" disabled={guardar.isPending || !puedeGuardar} onClick={() => guardar.mutate()}>
          Guardar Movimiento
        </button>
      </div>
    </Modal>
  );
}

// Editar un movimiento automático desde Caja (§3.8): cada origen tiene su
// propio endpoint de corrección (mismo que usa su módulo de origen), así que
// el egreso/ingreso en Caja y el registro que lo generó quedan sincronizados
// en la misma operación — no hay que ir a buscarlo a otra pantalla.
function EditarMovimientoAutomaticoModal({
  movimiento,
  onClose,
  onSaved,
}: {
  movimiento: Movimiento;
  onClose: () => void;
  onSaved: () => void;
}) {
  switch (movimiento.origen) {
    case 'COBRO_ALQUILER':
      return <EditarCobroModal movimiento={movimiento} onClose={onClose} onSaved={onSaved} />;
    case 'GASTO_PROPIEDAD':
      return <EditarGastoModal movimiento={movimiento} onClose={onClose} onSaved={onSaved} />;
    case 'PAGO_PROVEEDOR':
      return <EditarPagoProveedorModal movimiento={movimiento} onClose={onClose} onSaved={onSaved} />;
    case 'COMISION_VENTA':
      return <EditarComisionModal movimiento={movimiento} onClose={onClose} onSaved={onSaved} />;
    case 'LIQUIDACION_PROPIETARIO':
      return <RegenerarLiquidacionModal movimiento={movimiento} onClose={onClose} onSaved={onSaved} />;
    default:
      return null;
  }
}

function EditarCobroModal({
  movimiento,
  onClose,
  onSaved,
}: {
  movimiento: Movimiento;
  onClose: () => void;
  onSaved: () => void;
}) {
  const pagoId = movimiento.pago!.id;
  const [monto, setMonto] = useState(String(movimiento.monto));
  const [fecha, setFecha] = useState(movimiento.fecha.slice(0, 10));
  const [medio, setMedio] = useState(movimiento.medio ?? 'TRANSFERENCIA');
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: () => api.patch(`/cobros/pagos/${pagoId}`, { monto: Number(monto), fecha, medio }),
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo corregir el cobro.'),
  });
  const anular = useMutation({
    mutationFn: () => api.post(`/cobros/pagos/${pagoId}/anular`),
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo anular el cobro.'),
  });

  function confirmarAnular() {
    if (window.confirm('¿Anular este cobro? Ese mes vuelve a quedar pendiente para el inquilino.')) {
      anular.mutate();
    }
  }

  return (
    <Modal open onClose={onClose} title="Editar Cobro de Alquiler" width={400}>
      {error && <div className="errstate" style={{ marginBottom: 14 }}>{error}</div>}
      <div className="formgrid">
        <div className="fg full">
          <label>Concepto</label>
          <div style={{ fontWeight: 600 }}>{movimiento.concepto}</div>
        </div>
        <div className="fg">
          <label>Monto</label>
          <input type="number" min={0.01} step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} />
        </div>
        <div className="fg">
          <label>Fecha</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div className="fg full">
          <label>Medio</label>
          <select value={medio} onChange={(e) => setMedio(e.target.value)}>
            {MEDIOS_PAGO.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="btnrow">
        <button className="btn-sm ghostred" style={{ marginRight: 'auto' }} disabled={anular.isPending} onClick={confirmarAnular}>
          Anular cobro
        </button>
        <button className="btn-ghost" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn-dark" disabled={guardar.isPending || !monto} onClick={() => guardar.mutate()}>
          Guardar
        </button>
      </div>
    </Modal>
  );
}

const GASTO_DESTINO_LABEL: Record<GastoDetalle['destino'], string> = {
  PROPIETARIO: 'Propietario',
  INQUILINO: 'Inquilino',
  INMOBILIARIA: 'Inmobiliaria',
};

function EditarGastoModal({
  movimiento,
  onClose,
  onSaved,
}: {
  movimiento: Movimiento;
  onClose: () => void;
  onSaved: () => void;
}) {
  const gastoId = movimiento.gasto!.id;
  const gasto = useQuery({
    queryKey: ['gastos', 'detalle', gastoId],
    queryFn: () => api.get<GastoDetalle>(`/gastos/${gastoId}`),
  });

  if (gasto.isLoading || !gasto.data) {
    return (
      <Modal open onClose={onClose} title="Editar Gasto" width={420}>
        <div className="loadstate">Cargando…</div>
      </Modal>
    );
  }

  return <EditarGastoForm gasto={gasto.data} onClose={onClose} onSaved={onSaved} />;
}

function EditarGastoForm({
  gasto,
  onClose,
  onSaved,
}: {
  gasto: GastoDetalle;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [descripcion, setDescripcion] = useState(gasto.descripcion);
  const [monto, setMonto] = useState(String(gasto.monto));
  const [categoria, setCategoria] = useState(gasto.categoria);
  const [destino, setDestino] = useState(gasto.destino);
  const [fecha, setFecha] = useState(gasto.fecha.slice(0, 10));
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: () =>
      api.patch(`/gastos/${gasto.id}`, {
        descripcion,
        monto: Number(monto),
        fecha,
        categoria,
        destino,
      }),
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo corregir el gasto.'),
  });
  const eliminar = useMutation({
    mutationFn: () => api.delete(`/gastos/${gasto.id}`),
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo eliminar el gasto.'),
  });

  function confirmarEliminar() {
    if (window.confirm('¿Eliminar este gasto? Se borra también el egreso correspondiente en Caja.')) {
      eliminar.mutate();
    }
  }

  return (
    <Modal open onClose={onClose} title={`Editar Gasto — ${gasto.propiedad.nombre}`} width={460}>
      {error && <div className="errstate" style={{ marginBottom: 14 }}>{error}</div>}
      <div className="formgrid">
        <div className="fg full">
          <label>Descripción</label>
          <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </div>
        <div className="fg">
          <label>Monto</label>
          <input type="number" min={0.01} step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} />
        </div>
        <div className="fg">
          <label>Fecha</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div className="fg">
          <label>Categoría</label>
          <input value={categoria} onChange={(e) => setCategoria(e.target.value)} />
        </div>
        <div className="fg">
          <label>¿A quién se le imputa?</label>
          <select value={destino} onChange={(e) => setDestino(e.target.value as GastoDetalle['destino'])}>
            {(['PROPIETARIO', 'INQUILINO'] as const).map((d) => (
              <option key={d} value={d}>
                {GASTO_DESTINO_LABEL[d]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="btnrow">
        <button className="btn-sm ghostred" style={{ marginRight: 'auto' }} disabled={eliminar.isPending} onClick={confirmarEliminar}>
          Eliminar
        </button>
        <button className="btn-ghost" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn-dark" disabled={guardar.isPending || !descripcion.trim() || !monto} onClick={() => guardar.mutate()}>
          Guardar
        </button>
      </div>
    </Modal>
  );
}

function EditarPagoProveedorModal({
  movimiento,
  onClose,
  onSaved,
}: {
  movimiento: Movimiento;
  onClose: () => void;
  onSaved: () => void;
}) {
  const pagoId = movimiento.pagoProveedor!.id;
  const [monto, setMonto] = useState(String(movimiento.monto));
  const [fecha, setFecha] = useState(movimiento.fecha.slice(0, 10));
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: () => api.patch(`/proveedores/pagos/${pagoId}`, { monto: Number(monto), fecha }),
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo corregir el pago.'),
  });
  const deshacer = useMutation({
    mutationFn: () => api.delete(`/proveedores/pagos/${pagoId}`),
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo deshacer el pago.'),
  });

  function confirmarDeshacer() {
    if (
      window.confirm(
        '¿Deshacer este pago a proveedor? Si con "Pagar saldo" cubrió más de un trabajo, todos vuelven a quedar pendientes de pago juntos.',
      )
    ) {
      deshacer.mutate();
    }
  }

  return (
    <Modal open onClose={onClose} title="Editar Pago a Proveedor" width={380}>
      {error && <div className="errstate" style={{ marginBottom: 14 }}>{error}</div>}
      <div className="formgrid">
        <div className="fg full">
          <label>Concepto</label>
          <div style={{ fontWeight: 600 }}>{movimiento.concepto}</div>
        </div>
        <div className="fg">
          <label>Monto</label>
          <input type="number" min={0.01} step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} />
        </div>
        <div className="fg">
          <label>Fecha</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
      </div>
      <div className="btnrow">
        <button className="btn-sm ghostred" style={{ marginRight: 'auto' }} disabled={deshacer.isPending} onClick={confirmarDeshacer}>
          Deshacer pago
        </button>
        <button className="btn-ghost" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn-dark" disabled={guardar.isPending || !monto} onClick={() => guardar.mutate()}>
          Guardar
        </button>
      </div>
    </Modal>
  );
}

function EditarComisionModal({
  movimiento,
  onClose,
  onSaved,
}: {
  movimiento: Movimiento;
  onClose: () => void;
  onSaved: () => void;
}) {
  const ventaId = movimiento.ventaComision!.id;
  const [monto, setMonto] = useState(String(movimiento.monto));
  const [fecha, setFecha] = useState(movimiento.fecha.slice(0, 10));
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: () => api.post(`/ventas/${ventaId}/cerrar`, { fecha, comisionManual: Number(monto) }),
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo corregir la comisión.'),
  });
  const deshacer = useMutation({
    mutationFn: () => api.delete(`/ventas/${ventaId}/cerrar`),
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo deshacer el cierre.'),
  });

  function confirmarDeshacer() {
    if (window.confirm('¿Deshacer esta venta? Vuelve a "Reservada" y se borra la comisión registrada en Caja.')) {
      deshacer.mutate();
    }
  }

  return (
    <Modal open onClose={onClose} title="Editar Comisión de Venta" width={380}>
      {error && <div className="errstate" style={{ marginBottom: 14 }}>{error}</div>}
      <div className="formgrid">
        <div className="fg full">
          <label>Concepto</label>
          <div style={{ fontWeight: 600 }}>{movimiento.concepto}</div>
        </div>
        <div className="fg">
          <label>Monto (USD)</label>
          <input type="number" min={0.01} step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} />
        </div>
        <div className="fg">
          <label>Fecha de cierre</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div className="fg full hint">
          Este monto queda fijo como comisión de esta venta — no se vuelve a calcular a partir del precio.
        </div>
      </div>
      <div className="btnrow">
        <button className="btn-sm ghostred" style={{ marginRight: 'auto' }} disabled={deshacer.isPending} onClick={confirmarDeshacer}>
          Deshacer venta
        </button>
        <button className="btn-ghost" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn-dark" disabled={guardar.isPending || !monto} onClick={() => guardar.mutate()}>
          Guardar
        </button>
      </div>
    </Modal>
  );
}

function RegenerarLiquidacionModal({
  movimiento,
  onClose,
  onSaved,
}: {
  movimiento: Movimiento;
  onClose: () => void;
  onSaved: () => void;
}) {
  const liquidacionId = movimiento.liquidacion!.id;
  const propietarioId = movimiento.liquidacion!.propietarioId;
  const mesStr = movimiento.liquidacion!.mes.slice(0, 7);
  const [error, setError] = useState<string | null>(null);

  const regenerar = useMutation({
    mutationFn: () => api.post(`/liquidaciones/propietarios/${propietarioId}/${mesStr}`),
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo recalcular la liquidación.'),
  });

  const eliminar = useMutation({
    mutationFn: () => api.delete(`/liquidaciones/${liquidacionId}`),
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo eliminar la liquidación.'),
  });

  function confirmarEliminar() {
    if (
      window.confirm(
        '¿Eliminar esta liquidación? Se borra el ingreso de honorarios de administración que generó en Caja. Los cobros y gastos que se usaron para calcularla no se tocan — podés volver a liquidar este mes de nuevo.',
      )
    ) {
      eliminar.mutate();
    }
  }

  return (
    <Modal open onClose={onClose} title="Liquidación a Propietario" width={420}>
      {error && <div className="errstate" style={{ marginBottom: 14 }}>{error}</div>}
      <div className="fg full">
        <label>Concepto</label>
        <div style={{ fontWeight: 600 }}>{movimiento.concepto}</div>
      </div>
      <div className="cfgnote" style={{ marginTop: 14 }}>
        <i>△</i>
        <span>
          Este ingreso no es un monto suelto: es el honorario de administración que retiene la inmobiliaria, calculado
          automáticamente a partir de lo cobrado ese mes para este propietario. Si corregiste algún cobro o gasto,
          recalculá la liquidación para que este movimiento en Caja quede al día — no se edita un número a mano acá.
        </span>
      </div>
      <div className="btnrow">
        <button className="btn-sm ghostred" style={{ marginRight: 'auto' }} disabled={eliminar.isPending} onClick={confirmarEliminar}>
          Eliminar liquidación
        </button>
        <button className="btn-ghost" onClick={onClose}>
          Cerrar
        </button>
        <button className="btn-dark" disabled={regenerar.isPending} onClick={() => regenerar.mutate()}>
          Recalcular liquidación
        </button>
      </div>
    </Modal>
  );
}
