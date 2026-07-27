import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { formatMoney, formatDate, mesActualStr } from '../lib/format';

type EstadoIncidencia = 'ABIERTA' | 'EN_CURSO' | 'RESUELTA';
type PrioridadIncidencia = 'BAJA' | 'MEDIA' | 'ALTA';
type DestinoGasto = 'PROPIETARIO' | 'INQUILINO' | 'INMOBILIARIA';

interface Propiedad {
  id: string;
  nombre: string;
  direccion: string;
}

interface Proveedor {
  id: string;
  nombre: string;
  rubro: string;
  telefono: string | null;
  email: string | null;
  cuit: string | null;
  nota: string | null;
}

interface ProveedorConCuenta extends Proveedor {
  totalFacturado: number;
  abonado: number;
  saldoAPagar: number;
}

interface Incidencia {
  id: string;
  titulo: string;
  descripcion: string | null;
  rubro: string;
  prioridad: PrioridadIncidencia;
  estado: EstadoIncidencia;
  reportadaPor: string | null;
  fechaApertura: string;
  fechaEjecucion: string | null;
  fechaCierre: string | null;
  costo: string | number | null;
  quienPagaCosto: DestinoGasto | null;
  abonadaFecha: string | null;
  notas: string | null;
  propiedadId: string;
  propiedad: Propiedad;
  proveedorId: string | null;
  proveedor: Proveedor | null;
}

const PRIO_LABEL: Record<PrioridadIncidencia, string> = { BAJA: 'BAJA', MEDIA: 'MEDIA', ALTA: 'ALTA' };
const PRIO_CLASE: Record<PrioridadIncidencia, string> = { BAJA: 'baja', MEDIA: 'media', ALTA: 'alta' };
const ESTADO_LABEL: Record<EstadoIncidencia, string> = { ABIERTA: 'Abierta', EN_CURSO: 'En curso', RESUELTA: 'Resuelta' };
const ESTADO_CLASE: Record<EstadoIncidencia, string> = { ABIERTA: 'abierta', EN_CURSO: 'encurso', RESUELTA: 'resuelta' };
const RUBRO_ICO: Record<string, string> = {
  Plomería: '●',
  Electricidad: '▲',
  Gas: '◆',
  'Aire acondicionado': '◇',
  Pintura: '◧',
  Albañilería: '▨',
  Cerrajería: '⚿',
  Humedad: '≈',
  Otro: '✱',
};
const RUBROS = Object.keys(RUBRO_ICO);
const DESTINO_LABEL: Record<DestinoGasto, string> = {
  PROPIETARIO: 'Propietario',
  INQUILINO: 'Inquilino',
  INMOBILIARIA: 'Inmobiliaria',
};

function iniciales(nombre: string) {
  return nombre.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

export function IncidenciasPage() {
  const qc = useQueryClient();
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<'pendientes' | 'todas' | EstadoIncidencia>('pendientes');
  const [busquedaProv, setBusquedaProv] = useState('');

  const [incidenciaModal, setIncidenciaModal] = useState<'new' | Incidencia | null>(null);
  const [proveedorDe, setProveedorDe] = useState<Incidencia | null>(null);
  const [resolverDe, setResolverDe] = useState<Incidencia | null>(null);
  const [provModal, setProvModal] = useState<'new' | ProveedorConCuenta | null>(null);

  const propiedades = useQuery({
    queryKey: ['propiedades'],
    queryFn: () => api.get<Propiedad[]>('/propiedades'),
  });
  const incidencias = useQuery({
    queryKey: ['incidencias'],
    queryFn: () => api.get<Incidencia[]>('/incidencias'),
  });
  const proveedores = useQuery({
    queryKey: ['proveedores'],
    queryFn: () => api.get<ProveedorConCuenta[]>('/proveedores'),
  });

  function invalidarIncidencias() {
    qc.invalidateQueries({ queryKey: ['incidencias'] });
    qc.invalidateQueries({ queryKey: ['proveedores'] });
    qc.invalidateQueries({ queryKey: ['caja'] });
    // Asignar/quitar proveedor cambia los "pedidos de presupuesto" de Avisos.
    qc.invalidateQueries({ queryKey: ['avisos'] });
  }
  function invalidarProveedores() {
    qc.invalidateQueries({ queryKey: ['proveedores'] });
    qc.invalidateQueries({ queryKey: ['incidencias'] });
    qc.invalidateQueries({ queryKey: ['caja'] });
    qc.invalidateQueries({ queryKey: ['avisos'] });
  }

  const reabrir = useMutation({
    mutationFn: (id: string) => api.post(`/incidencias/${id}/reabrir`),
    onSuccess: invalidarIncidencias,
  });
  const registrarPago = useMutation({
    mutationFn: (id: string) => api.post(`/incidencias/${id}/pagar`, { fecha: new Date().toISOString().slice(0, 10) }),
    onSuccess: invalidarIncidencias,
  });
  const pagarSaldo = useMutation({
    mutationFn: (proveedorId: string) =>
      api.post(`/proveedores/${proveedorId}/pagar-saldo`, { fecha: new Date().toISOString().slice(0, 10) }),
    onSuccess: invalidarProveedores,
  });

  if (incidencias.isLoading || propiedades.isLoading) {
    return (
      <>
        <PageHeader title="Incidencias y Proveedores" />
        <main>
          <div className="loadstate">Cargando…</div>
        </main>
      </>
    );
  }

  const todas = incidencias.data ?? [];
  const abiertas = todas.filter((i) => i.estado === 'ABIERTA');
  const encurso = todas.filter((i) => i.estado === 'EN_CURSO');
  const mesActual = mesActualStr();
  const resueltasEsteMes = todas.filter((i) => i.estado === 'RESUELTA' && i.fechaCierre?.slice(0, 7) === mesActual);
  const costoPendiente = todas
    .filter((i) => i.estado !== 'RESUELTA')
    .reduce((s, i) => s + Number(i.costo ?? 0), 0);

  let lista = todas.slice();
  if (filtro === 'pendientes') lista = lista.filter((i) => i.estado !== 'RESUELTA');
  else if (filtro !== 'todas') lista = lista.filter((i) => i.estado === filtro);

  const q = busqueda.toLowerCase();
  if (q) {
    lista = lista.filter((i) =>
      [i.titulo, i.descripcion, i.rubro, i.propiedad.nombre, i.propiedad.direccion, i.proveedor?.nombre, i.reportadaPor]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }

  const ORD: Record<PrioridadIncidencia, number> = { ALTA: 0, MEDIA: 1, BAJA: 2 };
  lista.sort((a, b) => {
    const ra = a.estado === 'RESUELTA' ? 1 : 0;
    const rb = b.estado === 'RESUELTA' ? 1 : 0;
    if (ra !== rb) return ra - rb;
    if (ORD[a.prioridad] !== ORD[b.prioridad]) return ORD[a.prioridad] - ORD[b.prioridad];
    return b.fechaApertura.localeCompare(a.fechaApertura);
  });

  const qProv = busquedaProv.toLowerCase();
  const proveedoresVisibles = (proveedores.data ?? [])
    .filter((p) => !qProv || `${p.nombre} ${p.rubro}`.toLowerCase().includes(qProv))
    .slice()
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  return (
    <>
      <PageHeader title="Incidencias y Proveedores" />
      <main>
        <div className="kpis">
          <div className={`kpi${abiertas.length ? ' alert' : ''}`}>
            <div className="lbl">Abiertas</div>
            <div className="val">{String(abiertas.length).padStart(2, '0')}</div>
            <div className="hint">sin resolver</div>
          </div>
          <div className="kpi">
            <div className="lbl">En curso</div>
            <div className="val">{String(encurso.length).padStart(2, '0')}</div>
            <div className="hint">con proveedor asignado</div>
          </div>
          <div className="kpi">
            <div className="lbl">Resueltas este mes</div>
            <div className="val">{String(resueltasEsteMes.length).padStart(2, '0')}</div>
          </div>
          <div className="kpi">
            <div className="lbl">Costo pendiente</div>
            <div className="val">{formatMoney(costoPendiente)}</div>
            <div className="hint">de incidencias sin cerrar</div>
          </div>
        </div>

        <div className="secttl">TABLERO DE INCIDENCIAS</div>
        <div className="tablewrap" style={{ marginBottom: 22 }}>
          <div className="searchbar">
            <input
              type="text"
              placeholder="Buscar por título, propiedad o proveedor…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            <select
              value={filtro}
              onChange={(e) => setFiltro(e.target.value as typeof filtro)}
              style={{ border: '1px solid var(--border)', borderRadius: 9, padding: '9px 12px', background: 'var(--bg)', fontSize: 13 }}
            >
              <option value="pendientes">Pendientes (abiertas y en curso)</option>
              <option value="todas">Todas</option>
              <option value="ABIERTA">Solo abiertas</option>
              <option value="EN_CURSO">Solo en curso</option>
              <option value="RESUELTA">Solo resueltas</option>
            </select>
            <span style={{ flex: 1 }}></span>
            <button className="btn-sm solid" onClick={() => setIncidenciaModal('new')}>
              + Nueva incidencia
            </button>
          </div>
        </div>

        <div style={{ marginBottom: 26 }}>
          {lista.length === 0 ? (
            <div className="okstate">
              <div className="big">✓</div>
              <h4>No hay incidencias para mostrar</h4>
              <p>
                {q || filtro !== 'pendientes'
                  ? 'Probá cambiando el filtro o el término de búsqueda.'
                  : 'Ninguna propiedad tiene reclamos abiertos ni en curso.'}
              </p>
            </div>
          ) : (
            <div className="inclist">
              {lista.map((i) => {
                const dias = Math.max(0, Math.round((Date.now() - new Date(i.fechaApertura).getTime()) / 864e5));
                const puedePagar =
                  i.estado === 'RESUELTA' && i.costo != null && Number(i.costo) > 0 && i.proveedorId && !i.abonadaFecha;
                return (
                  <div
                    key={i.id}
                    className={`inccard ${PRIO_CLASE[i.prioridad]}${i.estado === 'RESUELTA' ? ' cerrada' : ''}`}
                    onClick={() => setIncidenciaModal(i)}
                  >
                    <div className="ico">{RUBRO_ICO[i.rubro] ?? '✱'}</div>
                    <div className="body">
                      <div className="ttl">
                        {i.titulo}
                        <span className={`prio ${PRIO_CLASE[i.prioridad]}`}>{PRIO_LABEL[i.prioridad]}</span>
                      </div>
                      <div className="dsc">
                        {i.propiedad.nombre} · {i.propiedad.direccion}
                      </div>
                      {i.descripcion && <div className="dsc">{i.descripcion}</div>}
                      <div className="meta">
                        <span>{i.rubro}</span>
                        <span>{i.proveedor ? `⚒ ${i.proveedor.nombre}` : '⚒ sin proveedor asignado'}</span>
                        {i.reportadaPor && <span>◐ {i.reportadaPor}</span>}
                        {i.estado === 'RESUELTA' ? (
                          <span>✓ cerrada el {formatDate(i.fechaCierre)}</span>
                        ) : (
                          <span>△ abierta hace {dias} {dias === 1 ? 'día' : 'días'}</span>
                        )}
                      </div>
                    </div>
                    <div className="right">
                      <span className={`badge ${ESTADO_CLASE[i.estado]}`}>{ESTADO_LABEL[i.estado]}</span>
                      {i.costo != null && Number(i.costo) > 0 && (
                        <span className="money" style={{ fontSize: 14 }}>
                          {formatMoney(i.costo)}
                        </span>
                      )}
                      {i.estado !== 'RESUELTA' && (
                        <button
                          className="btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setProveedorDe(i);
                          }}
                        >
                          {i.proveedor ? 'Reasignar proveedor' : 'Asignar proveedor'}
                        </button>
                      )}
                      {i.estado !== 'RESUELTA' && (
                        <button
                          className="btn-sm solid"
                          onClick={(e) => {
                            e.stopPropagation();
                            setResolverDe(i);
                          }}
                        >
                          Marcar resuelta
                        </button>
                      )}
                      {i.estado === 'RESUELTA' &&
                        (i.abonadaFecha ? (
                          <span className="pdate" style={{ color: 'var(--green)', fontWeight: 700 }}>
                            ✓ abonado el {formatDate(i.abonadaFecha)}
                          </span>
                        ) : puedePagar ? (
                          <button
                            className="btn-sm solid"
                            title="Registrar el pago al proveedor"
                            onClick={(e) => {
                              e.stopPropagation();
                              registrarPago.mutate(i.id);
                            }}
                          >
                            ¤ Registrar pago
                          </button>
                        ) : null)}
                      {i.estado !== 'ABIERTA' && (
                        <button
                          className="btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            reabrir.mutate(i.id);
                          }}
                        >
                          Reabrir
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="secttl">DIRECTORIO DE PROVEEDORES</div>
        <div className="tablewrap" style={{ marginBottom: 22 }}>
          <div className="searchbar">
            <input
              type="text"
              placeholder="Buscar proveedor por nombre o rubro…"
              value={busquedaProv}
              onChange={(e) => setBusquedaProv(e.target.value)}
            />
            <span style={{ flex: 1 }}></span>
            <button className="btn-sm solid" onClick={() => setProvModal('new')}>
              + Nuevo proveedor
            </button>
          </div>
        </div>
        <div className="owners">
          {proveedoresVisibles.length === 0 && (
            <div className="okstate" style={{ gridColumn: '1/-1' }}>
              <div className="big">⚒</div>
              <h4>No hay proveedores cargados</h4>
              <p>
                Cargá los plomeros, electricistas y demás oficios con los que trabajás
                <br />
                para poder asignarlos a las incidencias.
              </p>
            </div>
          )}
          {proveedoresVisibles.map((pv) => (
            <div className="ownercard" key={pv.id}>
              <div className="top">
                <div className="avatar">{iniciales(pv.nombre)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4>{pv.nombre}</h4>
                  <div className="contact">
                    ☎ {pv.telefono ?? <span className="nodata">—</span>}
                    <br />
                    ✉ {pv.email ?? <span className="nodata">—</span>}
                    <br />
                    CUIT {pv.cuit ?? <span className="nodata">—</span>}
                  </div>
                </div>
                <span className="tag-big">{pv.rubro}</span>
              </div>
              {pv.nota && <div className="contact" style={{ marginTop: 8 }}>{pv.nota}</div>}
              <div className="props">
                <div className="oprop" style={{ cursor: 'default' }}>
                  <span className="nm">Total facturado</span>
                  <span className="money">{formatMoney(pv.totalFacturado)}</span>
                </div>
                <div className="oprop" style={{ cursor: 'default' }}>
                  <span className="nm">Abonado</span>
                  <span className="money" style={{ color: 'var(--green)' }}>
                    {formatMoney(pv.abonado)}
                  </span>
                </div>
                <div className="oprop" style={{ cursor: 'default', borderTop: '1px solid var(--border2)' }}>
                  <span className="nm" style={{ fontWeight: 700 }}>
                    Saldo a pagar
                  </span>
                  <span className="money" style={{ color: pv.saldoAPagar > 0 ? 'var(--orange)' : 'var(--muted)' }}>
                    {formatMoney(pv.saldoAPagar)}
                  </span>
                </div>
              </div>
              <div className="liqfoot" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border2)', display: 'flex', gap: 8 }}>
                {pv.telefono && (
                  <a className="btn-sm" href={`tel:${pv.telefono}`}>
                    ✆ Llamar
                  </a>
                )}
                {pv.telefono && (
                  <a
                    className="btn-sm"
                    href={`https://wa.me/${pv.telefono.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener"
                  >
                    WhatsApp
                  </a>
                )}
                {pv.saldoAPagar > 0 && (
                  <button
                    className="btn-sm solid"
                    title="Registrar el pago de todos los trabajos pendientes"
                    disabled={pagarSaldo.isPending}
                    onClick={() => pagarSaldo.mutate(pv.id)}
                  >
                    ¤ Pagar saldo
                  </button>
                )}
                <span style={{ flex: 1 }}></span>
                <button className="btn-sm" onClick={() => setProvModal(pv)}>
                  Editar
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {incidenciaModal && (
        <IncidenciaModal
          incidencia={incidenciaModal === 'new' ? null : incidenciaModal}
          propiedades={propiedades.data ?? []}
          proveedores={proveedores.data ?? []}
          onClose={() => setIncidenciaModal(null)}
          onSaved={() => {
            setIncidenciaModal(null);
            invalidarIncidencias();
          }}
        />
      )}
      {proveedorDe && (
        <AsignarProveedorModal
          incidencia={proveedorDe}
          proveedores={proveedores.data ?? []}
          onClose={() => setProveedorDe(null)}
          onSaved={() => {
            setProveedorDe(null);
            invalidarIncidencias();
          }}
        />
      )}
      {resolverDe && (
        <ResolverModal
          incidencia={resolverDe}
          onClose={() => setResolverDe(null)}
          onSaved={() => {
            setResolverDe(null);
            invalidarIncidencias();
          }}
        />
      )}
      {provModal && (
        <ProveedorModal
          proveedor={provModal === 'new' ? null : provModal}
          onClose={() => setProvModal(null)}
          onSaved={() => {
            setProvModal(null);
            invalidarProveedores();
          }}
        />
      )}
    </>
  );
}

function IncidenciaModal({
  incidencia,
  propiedades,
  proveedores,
  onClose,
  onSaved,
}: {
  incidencia: Incidencia | null;
  propiedades: Propiedad[];
  proveedores: Proveedor[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const esNuevo = !incidencia;
  const [propiedadId, setPropiedadId] = useState(incidencia?.propiedadId ?? propiedades[0]?.id ?? '');
  const [titulo, setTitulo] = useState(incidencia?.titulo ?? '');
  const [descripcion, setDescripcion] = useState(incidencia?.descripcion ?? '');
  const [rubro, setRubro] = useState(incidencia?.rubro ?? RUBROS[0]);
  const [prioridad, setPrioridad] = useState<PrioridadIncidencia>(incidencia?.prioridad ?? 'MEDIA');
  const [reportadaPor, setReportadaPor] = useState(incidencia?.reportadaPor ?? '');
  const [notas, setNotas] = useState(incidencia?.notas ?? '');
  const [proveedorId, setProveedorId] = useState('');
  const [pvNuevoNombre, setPvNuevoNombre] = useState('');
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: () => {
      if (esNuevo) {
        return api.post('/incidencias', {
          propiedadId,
          titulo,
          descripcion: descripcion || undefined,
          rubro,
          prioridad,
          reportadaPor: reportadaPor || undefined,
          notas: notas || undefined,
          proveedorId: proveedorId && proveedorId !== '__new' ? proveedorId : undefined,
          proveedorNuevo: proveedorId === '__new' ? { nombre: pvNuevoNombre, rubro } : undefined,
        });
      }
      return api.patch(`/incidencias/${incidencia!.id}`, {
        titulo,
        descripcion: descripcion || undefined,
        rubro,
        prioridad,
        reportadaPor: reportadaPor || undefined,
        notas: notas || undefined,
      });
    },
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo guardar la incidencia.'),
  });

  const eliminar = useMutation({
    mutationFn: () => api.delete(`/incidencias/${incidencia!.id}`),
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo eliminar la incidencia.'),
  });

  return (
    <Modal open onClose={onClose} title={esNuevo ? 'Nueva Incidencia' : 'Editar Incidencia'}>
      {error && <div className="errstate" style={{ marginBottom: 14 }}>{error}</div>}
      <div className="formgrid">
        <div className="fg full">
          <label>Propiedad</label>
          {esNuevo ? (
            <select value={propiedadId} onChange={(e) => setPropiedadId(e.target.value)}>
              {propiedades.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          ) : (
            <div style={{ fontWeight: 600 }}>
              {incidencia!.propiedad.nombre} · {incidencia!.propiedad.direccion}
            </div>
          )}
        </div>
        <div className="fg full">
          <label>Título</label>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </div>
        <div className="fg full">
          <label>Descripción</label>
          <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Opcional" />
        </div>
        <div className="fg">
          <label>Rubro</label>
          <select value={rubro} onChange={(e) => setRubro(e.target.value)}>
            {RUBROS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="fg">
          <label>Prioridad</label>
          <select value={prioridad} onChange={(e) => setPrioridad(e.target.value as PrioridadIncidencia)}>
            <option value="ALTA">Alta</option>
            <option value="MEDIA">Media</option>
            <option value="BAJA">Baja</option>
          </select>
        </div>
        <div className="fg">
          <label>Reportada por</label>
          <input value={reportadaPor} onChange={(e) => setReportadaPor(e.target.value)} placeholder="Opcional" />
        </div>
        {esNuevo && (
          <div className="fg">
            <label>Proveedor</label>
            <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
              <option value="">— Sin asignar —</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} · {p.rubro}
                </option>
              ))}
              <option value="__new">+ Nuevo proveedor…</option>
            </select>
          </div>
        )}
        {esNuevo && proveedorId === '__new' && (
          <div className="fg full">
            <label>Nombre del nuevo proveedor</label>
            <input value={pvNuevoNombre} onChange={(e) => setPvNuevoNombre(e.target.value)} />
          </div>
        )}
        <div className="fg full">
          <label>Notas</label>
          <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Opcional" />
        </div>
      </div>
      <div className="btnrow">
        {!esNuevo && (
          <button
            className="btn-sm ghostred"
            style={{ marginRight: 'auto' }}
            disabled={eliminar.isPending}
            onClick={() => eliminar.mutate()}
          >
            Eliminar
          </button>
        )}
        <button className="btn-ghost" onClick={onClose}>
          Cancelar
        </button>
        <button
          className="btn-dark"
          disabled={guardar.isPending || !titulo.trim() || (esNuevo && proveedorId === '__new' && !pvNuevoNombre.trim())}
          onClick={() => guardar.mutate()}
        >
          Guardar
        </button>
      </div>
    </Modal>
  );
}

function AsignarProveedorModal({
  incidencia,
  proveedores,
  onClose,
  onSaved,
}: {
  incidencia: Incidencia;
  proveedores: Proveedor[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [proveedorId, setProveedorId] = useState(incidencia.proveedorId ?? '');
  const [pvNuevoNombre, setPvNuevoNombre] = useState('');
  const [fechaEjecucion, setFechaEjecucion] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: () =>
      api.patch(`/incidencias/${incidencia.id}/proveedor`, {
        proveedorId: proveedorId && proveedorId !== '__new' ? proveedorId : undefined,
        proveedorNuevo: proveedorId === '__new' ? { nombre: pvNuevoNombre, rubro: incidencia.rubro } : undefined,
        fechaEjecucion,
      }),
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo asignar el proveedor.'),
  });

  return (
    <Modal open onClose={onClose} title={`Asignar Proveedor — ${incidencia.titulo}`} width={420}>
      {error && <div className="errstate" style={{ marginBottom: 14 }}>{error}</div>}
      <div className="formgrid">
        <div className="fg full">
          <label>Proveedor</label>
          <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
            <option value="">Seleccioná un proveedor…</option>
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} · {p.rubro}
              </option>
            ))}
            <option value="__new">+ Nuevo proveedor…</option>
          </select>
        </div>
        {proveedorId === '__new' && (
          <div className="fg full">
            <label>Nombre del nuevo proveedor</label>
            <input value={pvNuevoNombre} onChange={(e) => setPvNuevoNombre(e.target.value)} />
          </div>
        )}
        <div className="fg full">
          <label>Fecha de visita / ejecución</label>
          <input type="date" value={fechaEjecucion} onChange={(e) => setFechaEjecucion(e.target.value)} />
        </div>
      </div>
      <div className="btnrow">
        <button className="btn-ghost" onClick={onClose}>
          Cancelar
        </button>
        <button
          className="btn-dark"
          disabled={guardar.isPending || (!proveedorId || (proveedorId === '__new' && !pvNuevoNombre.trim()))}
          onClick={() => guardar.mutate()}
        >
          Asignar
        </button>
      </div>
    </Modal>
  );
}

function ResolverModal({
  incidencia,
  onClose,
  onSaved,
}: {
  incidencia: Incidencia;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [costo, setCosto] = useState('');
  const [quienPagaCosto, setQuienPagaCosto] = useState<DestinoGasto>('PROPIETARIO');
  const [fechaCierre, setFechaCierre] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: () =>
      api.post(`/incidencias/${incidencia.id}/resolver`, {
        costo: costo ? Number(costo) : undefined,
        quienPagaCosto: costo ? quienPagaCosto : undefined,
        fechaCierre,
      }),
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo marcar como resuelta.'),
  });

  return (
    <Modal open onClose={onClose} title={`Marcar Resuelta — ${incidencia.titulo}`} width={420}>
      {error && <div className="errstate" style={{ marginBottom: 14 }}>{error}</div>}
      <div className="formgrid">
        <div className="fg full">
          <label>Fecha de cierre</label>
          <input type="date" value={fechaCierre} onChange={(e) => setFechaCierre(e.target.value)} />
        </div>
        <div className="fg">
          <label>Costo del trabajo</label>
          <input type="number" min={0} step="0.01" value={costo} onChange={(e) => setCosto(e.target.value)} placeholder="Opcional" />
        </div>
        {costo && (
          <div className="fg">
            <label>¿Quién paga el costo?</label>
            <select value={quienPagaCosto} onChange={(e) => setQuienPagaCosto(e.target.value as DestinoGasto)}>
              {Object.entries(DESTINO_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="btnrow">
        <button className="btn-ghost" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn-dark" disabled={guardar.isPending} onClick={() => guardar.mutate()}>
          Marcar Resuelta
        </button>
      </div>
    </Modal>
  );
}

function ProveedorModal({
  proveedor,
  onClose,
  onSaved,
}: {
  proveedor: ProveedorConCuenta | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const esNuevo = !proveedor;
  const [nombre, setNombre] = useState(proveedor?.nombre ?? '');
  const [rubro, setRubro] = useState(proveedor?.rubro ?? RUBROS[0]);
  const [cuit, setCuit] = useState(proveedor?.cuit ?? '');
  const [telefono, setTelefono] = useState(proveedor?.telefono ?? '');
  const [email, setEmail] = useState(proveedor?.email ?? '');
  const [nota, setNota] = useState(proveedor?.nota ?? '');
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: () => {
      const payload = {
        nombre,
        rubro,
        cuit: cuit || undefined,
        telefono: telefono || undefined,
        email: email || undefined,
        nota: nota || undefined,
      };
      return esNuevo ? api.post('/proveedores', payload) : api.patch(`/proveedores/${proveedor!.id}`, payload);
    },
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo guardar el proveedor.'),
  });

  const eliminar = useMutation({
    mutationFn: () => api.delete(`/proveedores/${proveedor!.id}`),
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo eliminar el proveedor.'),
  });

  return (
    <Modal open onClose={onClose} title={esNuevo ? 'Nuevo Proveedor' : 'Editar Proveedor'}>
      {error && <div className="errstate" style={{ marginBottom: 14 }}>{error}</div>}
      <div className="formgrid">
        <div className="fg full">
          <label>Nombre</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="fg">
          <label>Rubro</label>
          <select value={rubro} onChange={(e) => setRubro(e.target.value)}>
            {RUBROS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="fg">
          <label>CUIT</label>
          <input value={cuit} onChange={(e) => setCuit(e.target.value)} placeholder="Opcional" />
        </div>
        <div className="fg">
          <label>Teléfono</label>
          <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Opcional" />
        </div>
        <div className="fg">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Opcional" />
        </div>
        <div className="fg full">
          <label>Nota</label>
          <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Opcional" />
        </div>
      </div>
      <div className="btnrow">
        {!esNuevo && (
          <button
            className="btn-sm ghostred"
            style={{ marginRight: 'auto' }}
            disabled={eliminar.isPending}
            onClick={() => eliminar.mutate()}
          >
            Eliminar
          </button>
        )}
        <button className="btn-ghost" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn-dark" disabled={guardar.isPending || !nombre.trim()} onClick={() => guardar.mutate()}>
          Guardar
        </button>
      </div>
    </Modal>
  );
}
