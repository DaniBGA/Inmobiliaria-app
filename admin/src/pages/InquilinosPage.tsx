import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { AlquilarPropiedadModal, type PropiedadParaAlquilar } from '../components/AlquilarPropiedadModal';
import { PropiedadFichaDrawer } from '../components/PropiedadFichaDrawer';
import { formatMoney, formatDate, mesActualStr, sumarMesesStr, mesLabel } from '../lib/format';

interface Inquilino {
  nombre: string;
  telefono: string | null;
  email: string | null;
}

interface Pago {
  id: string;
  monto: string;
  fecha: string;
  medio: string;
}

interface FilaCobro {
  propiedadId: string;
  propiedadNombre: string;
  inquilino: Inquilino | null;
  esperado: number | null;
  cobrado: number;
  pendiente: number;
  estado: 'PAGADO' | 'PENDIENTE' | 'IMPAGO' | 'NO_CORRESPONDE';
  pagos: Pago[];
}

interface ResumenMes {
  mes: string;
  totales: { esperado: number; cobrado: number; pendiente: number };
  filas: FilaCobro[];
}

interface KpisInquilinos {
  inquilinosActivos: number;
  alDia: number;
  conDeuda: number;
  deudaTotalAcumulada: number;
}

interface FichaInquilino {
  propiedadId: string;
  propiedadNombre: string;
  inquilino: Inquilino | null;
  rentaVigente: number | null;
  diaVencimiento: number;
  deudaAcumulada: number;
  mesesImpagos: number;
  ultimoPago: Pago | null;
}

const ESTADO_LABEL: Record<FilaCobro['estado'], { texto: string; clase: string }> = {
  PAGADO: { texto: 'Pagado', clase: 'pagado' },
  PENDIENTE: { texto: 'Pendiente', clase: 'pendiente' },
  IMPAGO: { texto: 'Impago', clase: 'impago' },
  NO_CORRESPONDE: { texto: '—', clase: '' },
};

const MEDIOS = [
  { value: 'TRANSFERENCIA', label: 'Transferencia' },
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'OTRO', label: 'Otro' },
];

interface PropiedadDb extends PropiedadParaAlquilar {
  inquilino: { nombre: string } | null;
  montoAlquilerVigente: string | number | null;
  alquilerPublicado: boolean;
}

export function InquilinosPage() {
  const [mes, setMes] = useState(mesActualStr());
  const [busqueda, setBusqueda] = useState('');
  const [modalFila, setModalFila] = useState<FilaCobro | null>(null);
  const [alquilarModal, setAlquilarModal] = useState(false);
  const [fichaId, setFichaId] = useState<string | null>(null);
  const qc = useQueryClient();

  const kpis = useQuery({
    queryKey: ['cobros', 'kpis'],
    queryFn: () => api.get<KpisInquilinos>('/cobros/kpis'),
  });
  const resumen = useQuery({
    queryKey: ['cobros', 'mes', mes],
    queryFn: () => api.get<ResumenMes>(`/cobros/mes/${mes}`),
  });
  const fichas = useQuery({
    queryKey: ['cobros', 'inquilinos'],
    queryFn: () => api.get<FichaInquilino[]>('/cobros/inquilinos'),
  });
  const propiedades = useQuery({
    queryKey: ['propiedades'],
    queryFn: () => api.get<PropiedadDb[]>('/propiedades'),
  });

  function invalidarTodo() {
    qc.invalidateQueries({ queryKey: ['cobros'] });
    // Un pago cambia la deuda del inquilino, que es justamente lo que
    // "Avisos" usa para armar los reclamos de deuda.
    qc.invalidateQueries({ queryKey: ['avisos'] });
  }

  // Propiedades de alquiler sin inquilino asignado — no generan cobros ni
  // fichas (por eso no aparecen en ninguna tabla de arriba), pero siguen
  // siendo parte de la cartera de alquiler y necesitan un lugar desde donde
  // se las pueda encontrar y gestionar (publicarlas/pausarlas en la web,
  // asignarles inquilino, editar sus datos) — antes de esto no había
  // ninguna pantalla del admin donde una propiedad así fuera visible.
  const vacantes = (propiedades.data ?? []).filter((p) => p.modalidad === 'ALQUILER' && !p.inquilino);

  const filasVisibles = (resumen.data?.filas ?? []).filter((f) => (f.esperado ?? 0) > 0);
  const progreso = resumen.data && resumen.data.totales.esperado > 0
    ? Math.round((resumen.data.totales.cobrado / resumen.data.totales.esperado) * 100)
    : 0;

  const q = busqueda.toLowerCase();
  const fichasVisibles = (fichas.data ?? []).filter((f) => {
    if (!q) return true;
    return [f.inquilino?.nombre, f.inquilino?.email, f.propiedadNombre]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  return (
    <>
      <PageHeader title="Inquilinos y Cobros" />
      <main>
        <div className="kpis">
          <div className="kpi">
            <div className="lbl">Inquilinos activos</div>
            <div className="val">{String(kpis.data?.inquilinosActivos ?? 0).padStart(2, '0')}</div>
          </div>
          <div className="kpi">
            <div className="lbl">Al día</div>
            <div className="val">{String(kpis.data?.alDia ?? 0).padStart(2, '0')}</div>
          </div>
          <div className={`kpi${(kpis.data?.conDeuda ?? 0) > 0 ? ' alert' : ''}`}>
            <div className="lbl">Con deuda</div>
            <div className="val">{String(kpis.data?.conDeuda ?? 0).padStart(2, '0')}</div>
          </div>
          <div className="kpi">
            <div className="lbl">Deuda total</div>
            <div className="val">{formatMoney(kpis.data?.deudaTotalAcumulada ?? 0)}</div>
            <div className="hint">acumulada de todos los meses</div>
          </div>
        </div>

        <div className="secttl">COBROS DEL MES</div>
        <div className="tablewrap" style={{ marginBottom: 26 }}>
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
            <div className="sum">
              <div>
                <b>ESPERADO</b>
                <span>{formatMoney(resumen.data?.totales.esperado ?? 0)}</span>
              </div>
              <div>
                <b>COBRADO</b>
                <span className="ok">{formatMoney(resumen.data?.totales.cobrado ?? 0)}</span>
              </div>
              <div>
                <b>PENDIENTE</b>
                <span className="bad">{formatMoney(resumen.data?.totales.pendiente ?? 0)}</span>
              </div>
            </div>
          </div>
          <div className="progwrap">
            <i style={{ width: `${progreso}%` }}></i>
          </div>
          <table>
            <thead>
              <tr>
                <th>PROPIEDAD</th>
                <th>INQUILINO</th>
                <th style={{ textAlign: 'right' }}>ESPERADO</th>
                <th style={{ textAlign: 'right' }}>COBRADO</th>
                <th>ESTADO DE PAGO</th>
                <th style={{ textAlign: 'right' }}>ACCIÓN</th>
              </tr>
            </thead>
            <tbody>
              {resumen.isLoading && (
                <tr>
                  <td colSpan={6} className="empty">Cargando…</td>
                </tr>
              )}
              {!resumen.isLoading && filasVisibles.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">No hay alquileres activos en este período.</td>
                </tr>
              )}
              {filasVisibles.map((f) => {
                const ultimoPago = f.pagos[f.pagos.length - 1];
                const { texto, clase } = ESTADO_LABEL[f.estado];
                return (
                  <tr key={f.propiedadId}>
                    <td>
                      <div className="pname">{f.propiedadNombre}</div>
                    </td>
                    <td>{f.inquilino?.nombre ?? <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span className="money">{formatMoney(f.esperado ?? 0)}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="paycell" style={{ alignItems: 'flex-end' }}>
                        <span className="money" style={f.cobrado ? undefined : { color: 'var(--muted)' }}>
                          {f.cobrado ? formatMoney(f.cobrado) : '—'}
                        </span>
                        {ultimoPago && (
                          <span className="pdate">
                            {formatDate(ultimoPago.fecha)} · {ultimoPago.medio}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      {clase ? <span className={`badge ${clase}`}><span className="dot"></span>{texto}</span> : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className={`btn-sm${f.pagos.length ? '' : ' solid'}`}
                        onClick={() => setModalFila(f)}
                      >
                        {f.pagos.length ? 'Editar' : 'Registrar pago'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="secttl">FICHAS DE INQUILINOS</div>
        <div className="tablewrap" style={{ marginBottom: 22 }}>
          <div className="searchbar" style={{ justifyContent: 'space-between' }}>
            <input
              type="text"
              placeholder="Buscar inquilino por nombre, propiedad o email…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            <button className="btn-sm solid" onClick={() => setAlquilarModal(true)}>
              + Agregar inquilino
            </button>
          </div>
        </div>
        <div className="tenants">
          {fichasVisibles.map((f) => (
            <div key={f.propiedadId} className={`tcard${f.deudaAcumulada > 0 ? ' debe' : ''}`}>
              <div className="thead">
                <div className="avatar">
                  {(f.inquilino?.nombre ?? '')
                    .split(' ')
                    .filter(Boolean)
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4>{f.inquilino?.nombre}</h4>
                  <div className="tprop">{f.propiedadNombre}</div>
                  <div className="tcontact">
                    ☎ {f.inquilino?.telefono ?? <span className="nodata">—</span>}
                    <br />
                    ✉ {f.inquilino?.email ?? <span className="nodata">—</span>}
                  </div>
                </div>
              </div>
              <div className="tbody">
                <div className="tstate">
                  <div className="tf">
                    <b>Alquiler vigente</b>
                    <span>{formatMoney(f.rentaVigente)}</span>
                  </div>
                  <div className="tf">
                    <b>Vence el</b>
                    <span>{f.diaVencimiento} de cada mes</span>
                  </div>
                  <div className="tf">
                    <b>Deuda acumulada</b>
                    <span className={f.deudaAcumulada ? 'deuda' : 'ok'}>
                      {f.deudaAcumulada ? formatMoney(f.deudaAcumulada) : 'Sin deuda'}
                    </span>
                  </div>
                  <div className="tf">
                    <b>Último pago</b>
                    <span style={{ fontSize: 13 }}>{f.ultimoPago ? formatDate(f.ultimoPago.fecha) : '—'}</span>
                  </div>
                </div>
                {f.mesesImpagos > 0 && (
                  <div style={{ fontSize: 11.5, color: 'var(--red)', marginTop: 10, fontWeight: 600 }}>
                    {f.mesesImpagos} mes(es) impago(s)
                  </div>
                )}
              </div>
            </div>
          ))}
          {fichasVisibles.length === 0 && !fichas.isLoading && (
            <div className="empty">Sin inquilinos que coincidan con la búsqueda.</div>
          )}
        </div>

        <div className="secttl" style={{ marginTop: 26 }}>PROPIEDADES VACANTES</div>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>PROPIEDAD</th>
                <th style={{ textAlign: 'right' }}>ALQUILER</th>
                <th>PUBLICADA EN LA WEB</th>
              </tr>
            </thead>
            <tbody>
              {vacantes.length === 0 && (
                <tr>
                  <td colSpan={3} className="empty">
                    No hay propiedades de alquiler vacantes.
                  </td>
                </tr>
              )}
              {vacantes.map((p) => (
                <tr key={p.id} className="movrow" onClick={() => setFichaId(p.id)} title="Clic para ver la ficha de la propiedad">
                  <td>
                    <div className="pname">{p.nombre}</div>
                    <div className="psub">{p.direccion}</div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="money">
                      {p.montoAlquilerVigente != null ? formatMoney(p.montoAlquilerVigente) : '—'}
                    </span>
                  </td>
                  <td>
                    {p.alquilerPublicado ? (
                      <span className="badge disponible">
                        <span className="dot"></span>Sí
                      </span>
                    ) : (
                      <span style={{ color: 'var(--muted)' }}>Pausada</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {modalFila && (
        <PagoModal
          fila={modalFila}
          mes={mes}
          onClose={() => setModalFila(null)}
          onSaved={() => {
            setModalFila(null);
            invalidarTodo();
          }}
        />
      )}
      {alquilarModal && (
        <AlquilarPropiedadModal
          propiedades={(propiedades.data ?? []).filter((p) => !(p.modalidad === 'ALQUILER' && p.inquilino))}
          onClose={() => setAlquilarModal(false)}
          onSaved={() => setAlquilarModal(false)}
        />
      )}
      {fichaId && <PropiedadFichaDrawer propiedadId={fichaId} onClose={() => setFichaId(null)} />}
    </>
  );
}

function PagoModal({
  fila,
  mes,
  onClose,
  onSaved,
}: {
  fila: FilaCobro;
  mes: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const pagoExistente = fila.pagos[fila.pagos.length - 1];
  const [monto, setMonto] = useState(String(pagoExistente?.monto ?? fila.esperado ?? ''));
  const [fecha, setFecha] = useState(pagoExistente?.fecha.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [medio, setMedio] = useState(pagoExistente?.medio ?? 'TRANSFERENCIA');
  const [comprobante, setComprobante] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: () => {
      if (pagoExistente) {
        return api.patch(`/cobros/pagos/${pagoExistente.id}`, {
          monto: Number(monto),
          fecha,
          medio,
          comprobante: comprobante || undefined,
          observaciones: observaciones || undefined,
        });
      }
      return api.post(`/cobros/propiedades/${fila.propiedadId}/pagos`, {
        mes,
        monto: Number(monto),
        fecha,
        medio,
        comprobante: comprobante || undefined,
        observaciones: observaciones || undefined,
      });
    },
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo guardar el pago.'),
  });

  const anular = useMutation({
    mutationFn: () => api.post(`/cobros/pagos/${pagoExistente!.id}/anular`),
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo anular el pago.'),
  });

  return (
    <Modal open onClose={onClose} title={`${pagoExistente ? 'Editar Pago' : 'Registrar Pago'} — ${fila.propiedadNombre}`}>
      {error && <div className="errstate" style={{ marginBottom: 14 }}>{error}</div>}
      <div className="formgrid">
        <div
          className="fg full"
          style={{ background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 12, padding: '14px 16px' }}
        >
          <label style={{ marginBottom: 2 }}>Monto esperado del mes</label>
          <span className="money" style={{ fontSize: 20 }}>
            {formatMoney(fila.esperado ?? 0)}
          </span>
        </div>
        <div className="fg">
          <label>Monto cobrado ($)</label>
          <input type="number" min={0} step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} />
        </div>
        <div className="fg">
          <label>Fecha de cobro</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div className="fg">
          <label>Medio de pago</label>
          <select value={medio} onChange={(e) => setMedio(e.target.value)}>
            {MEDIOS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="fg">
          <label>Comprobante / N° op.</label>
          <input placeholder="Opcional" value={comprobante} onChange={(e) => setComprobante(e.target.value)} />
        </div>
        <div className="fg full">
          <label>Observaciones</label>
          <input placeholder="Opcional" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
        </div>
      </div>
      <div className="btnrow">
        {pagoExistente && (
          <button
            className="btn-sm ghostred"
            style={{ marginRight: 'auto' }}
            disabled={anular.isPending}
            onClick={() => anular.mutate()}
          >
            Anular pago
          </button>
        )}
        <button className="btn-ghost" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn-dark" disabled={guardar.isPending} onClick={() => guardar.mutate()}>
          Guardar Pago
        </button>
      </div>
    </Modal>
  );
}
