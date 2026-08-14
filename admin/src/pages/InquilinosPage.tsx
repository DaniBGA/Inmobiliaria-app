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
  tipo: string;
  inquilino: { nombre: string; telefono: string | null; email: string | null } | null;
  montoAlquilerVigente: string | number | null;
  alquilerPublicado: boolean;
  propietario: { nombre: string } | null;
  designado: { nombre: string } | null;
}

const TIPO_LABEL: Record<string, string> = {
  CASA: 'Casa',
  DEPARTAMENTO: 'Departamento',
  DUPLEX: 'Dúplex',
  QUINTA: 'Quinta',
  LOTE: 'Lote',
  CAMPO: 'Campo',
  GALPON: 'Galpón',
  LOCAL_OFICINA: 'Local/Oficina',
  CABANIAS_HOTELES_OTROS: 'Cabañas/Hoteles/Otros',
  FONDO_DE_COMERCIO: 'Fondo de comercio',
  COCHERAS: 'Cocheras',
};

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

  // Toda la cartera de alquiler (ocupada y vacante) vive acá — Ventas y
  // Carteles solo lista modalidad VENTA. Se muestra con el mismo estilo de
  // tarjeta ("salecard") que usa Ventas y Carteles para su grilla.
  const alquileres = (propiedades.data ?? []).filter((p) => p.modalidad === 'ALQUILER');

  const filasVisibles = (resumen.data?.filas ?? []).filter((f) => (f.esperado ?? 0) > 0);
  const progreso = resumen.data && resumen.data.totales.esperado > 0
    ? Math.round((resumen.data.totales.cobrado / resumen.data.totales.esperado) * 100)
    : 0;

  const q = busqueda.toLowerCase();
  const alquileresVisibles = alquileres.filter((p) => {
    if (!q) return true;
    return [p.nombre, p.direccion, p.inquilino?.nombre, p.inquilino?.email, p.propietario?.nombre]
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

        <div className="secttl" style={{ marginTop: 26 }}>PROPIEDADES EN ALQUILER</div>
        <div className="tablewrap" style={{ marginBottom: 22 }}>
          <div className="searchbar" style={{ justifyContent: 'space-between' }}>
            <input
              type="text"
              placeholder="Buscar por propiedad, inquilino, propietario o email…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            <button className="btn-sm solid" onClick={() => setAlquilarModal(true)}>
              + Agregar propiedad de alquiler
            </button>
          </div>
        </div>
        <div className="salegrid">
          {alquileresVisibles.length === 0 && (
            <div className="empty" style={{ gridColumn: '1/-1' }}>
              {alquileres.length === 0 ? 'No hay propiedades de alquiler cargadas.' : 'Sin propiedades que coincidan con la búsqueda.'}
            </div>
          )}
          {alquileresVisibles.map((p) => {
            const ocupada = !!p.inquilino;
            return (
              <div
                className="salecard"
                key={p.id}
                style={{ cursor: 'pointer' }}
                title="Clic para ver la ficha de la propiedad"
                onClick={() => setFichaId(p.id)}
              >
                <div className="shead">
                  <div className="stop">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4>{p.nombre}</h4>
                      <div className="saddr">
                        {p.direccion} · {TIPO_LABEL[p.tipo] ?? p.tipo}
                      </div>
                    </div>
                    <span style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {ocupada ? (
                        <span className="badge alquilada">Ocupada</span>
                      ) : (
                        <span className={`badge ${p.alquilerPublicado ? 'publicada' : 'pausada'}`}>
                          {p.alquilerPublicado ? 'Publicada' : 'Pausada'}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="sprice">
                    {p.montoAlquilerVigente != null ? formatMoney(p.montoAlquilerVigente) : 'Consultar'}
                    <small>ARS/mes</small>
                  </div>
                </div>
                <div className="sbody">
                  {ocupada ? (
                    <div className="srow">
                      <span>Inquilino</span>
                      <b>{p.inquilino!.nombre}</b>
                    </div>
                  ) : (
                    <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 10 }}>
                      Vacante — disponible para alquilar.
                    </div>
                  )}
                  <div className="srow">
                    <span>Propietario</span>
                    <b>{p.propietario?.nombre ?? '—'}</b>
                  </div>
                  <div className="srow">
                    <span>Publicada en la web</span>
                    <b>{p.alquilerPublicado ? 'Sí' : 'No'}</b>
                  </div>
                  <div className="srow">
                    <span>La muestra</span>
                    <b>
                      {p.designado?.nombre ?? (
                        <span style={{ color: 'var(--muted)', fontWeight: 600 }}>sin designar</span>
                      )}
                    </b>
                  </div>
                </div>
              </div>
            );
          })}
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
          propiedades={(propiedades.data ?? []).filter((p) => p.modalidad === 'ALQUILER' && !p.inquilino)}
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
