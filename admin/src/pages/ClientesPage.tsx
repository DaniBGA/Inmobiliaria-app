import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { MultiDonut } from '../components/charts/MultiDonut';
import { formatMoney } from '../lib/format';

type TipoOperacionCliente = 'ALQUILAR' | 'COMPRAR' | 'VENDER';
type EstadoCliente = 'SIN_CONTACTAR' | 'EN_SEGUIMIENTO' | 'CERRADO';
type ZonaCliente = 'CENTRO' | 'SEMICENTRICO' | 'INDIFERENTE';
type OrigenCliente = 'INSTAGRAM' | 'PAGINA_WEB' | 'EN_PERSONA' | 'FACEBOOK' | 'CONTACTOS';

interface Delegado {
  id: string;
  nombre: string;
}

interface Cliente {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  tipoOperacion: TipoOperacionCliente;
  busquedaTipoPropiedad: string | null;
  montoDesde: string | number | null;
  montoHasta: string | number | null;
  zona: ZonaCliente | null;
  detalle: string | null;
  estado: EstadoCliente;
  origen: OrigenCliente | null;
  visitaOtraInmobiliariaConQuien: string | null;
  delegadoId: string | null;
  delegado: Delegado | null;
  notas: string | null;
}

interface OrigenStat {
  origen: OrigenCliente;
  cantidad: number;
}

const ORIGEN_LABEL: Record<OrigenCliente, string> = {
  INSTAGRAM: 'Instagram',
  PAGINA_WEB: 'Página web',
  EN_PERSONA: 'En persona',
  FACEBOOK: 'Facebook',
  CONTACTOS: 'Contactos',
};
const ORIGEN_COLOR: Record<OrigenCliente, string> = {
  INSTAGRAM: 'var(--orange)',
  FACEBOOK: 'var(--indigo)',
  PAGINA_WEB: 'var(--ink)',
  EN_PERSONA: 'var(--green)',
  CONTACTOS: 'var(--red)',
};

const TIPO_LABEL: Record<TipoOperacionCliente, string> = {
  ALQUILAR: 'BUSCA ALQUILAR',
  COMPRAR: 'BUSCA COMPRAR',
  VENDER: 'PROPIETARIO',
};
const TIPO_CLASE: Record<TipoOperacionCliente, string> = {
  ALQUILAR: 'inquilino',
  COMPRAR: 'comprador',
  VENDER: 'propietario',
};
const ESTADO_LABEL: Record<EstadoCliente, string> = {
  SIN_CONTACTAR: 'Sin contactar',
  EN_SEGUIMIENTO: 'En seguimiento',
  CERRADO: 'Cerrado',
};
const ESTADO_CLASE: Record<EstadoCliente, string> = {
  SIN_CONTACTAR: 'nuevo',
  EN_SEGUIMIENTO: 'contactado',
  CERRADO: 'cerrado',
};
const ZONA_LABEL: Record<ZonaCliente, string> = {
  CENTRO: 'Centro',
  SEMICENTRICO: 'Semicéntrico',
  INDIFERENTE: 'Zona indiferente',
};
const TIPO_PROPIEDAD_LABEL: Record<string, string> = {
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

function iniciales(nombre: string) {
  return nombre.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

export function ClientesPage() {
  const qc = useQueryClient();
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | TipoOperacionCliente>('todos');
  const [modal, setModal] = useState<'new' | Cliente | null>(null);
  const [verEliminados, setVerEliminados] = useState(false);

  const clientes = useQuery({
    queryKey: ['clientes'],
    queryFn: () => api.get<Cliente[]>('/clientes'),
  });
  const origenStats = useQuery({
    queryKey: ['clientes', 'stats-por-origen'],
    queryFn: () => api.get<OrigenStat[]>('/clientes/stats-por-origen'),
  });
  const delegados = useQuery({
    queryKey: ['integrantes-equipo'],
    queryFn: () => api.get<Delegado[]>('/integrantes-equipo'),
  });

  function invalidar() {
    qc.invalidateQueries({ queryKey: ['clientes'] });
    // Cambiar el estado de un cliente (p.ej. de "sin contactar" a otro)
    // afecta el grupo "clientes sin contactar" de Avisos.
    qc.invalidateQueries({ queryKey: ['avisos'] });
  }

  if (clientes.isLoading) {
    return (
      <>
        <PageHeader title="Clientes" />
        <main>
          <div className="loadstate">Cargando…</div>
        </main>
      </>
    );
  }

  let lista = clientes.data ?? [];
  if (filtroTipo !== 'todos') lista = lista.filter((c) => c.tipoOperacion === filtroTipo);
  const q = busqueda.toLowerCase();
  if (q) {
    lista = lista.filter((c) =>
      [c.nombre, c.detalle, c.zona, c.visitaOtraInmobiliariaConQuien, c.delegado?.nombre, c.email, c.telefono, c.notas, c.origen && ORIGEN_LABEL[c.origen]]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }
  lista = lista.slice().sort((a, b) => {
    const na = a.estado === 'SIN_CONTACTAR' ? 0 : 1;
    const nb = b.estado === 'SIN_CONTACTAR' ? 0 : 1;
    return na !== nb ? na - nb : 0;
  });

  return (
    <>
      <PageHeader title="Clientes" />
      <main>
        <div className="panel" style={{ marginBottom: 22 }}>
          <h3>ORIGEN DE LOS CLIENTES</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
            <MultiDonut
              slices={(origenStats.data ?? []).map((s) => ({
                label: ORIGEN_LABEL[s.origen],
                valor: s.cantidad,
                color: ORIGEN_COLOR[s.origen],
              }))}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minWidth: 180 }}>
              {(origenStats.data ?? []).map((s) => (
                <div key={s.origen} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                  <i style={{ width: 8, height: 8, borderRadius: 99, background: ORIGEN_COLOR[s.origen], flexShrink: 0, display: 'inline-block' }}></i>
                  <span style={{ flex: 1, color: 'var(--ink2)' }}>{ORIGEN_LABEL[s.origen]}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontWeight: 700 }}>{s.cantidad}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="tablewrap" style={{ marginBottom: 22 }}>
          <div className="searchbar">
            <input
              type="text"
              placeholder="Buscar cliente por nombre, interés, email o teléfono…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value as typeof filtroTipo)}
              style={{ border: '1px solid var(--border)', borderRadius: 9, padding: '9px 12px', background: 'var(--bg)', fontSize: 13 }}
            >
              <option value="todos">Todos los tipos</option>
              <option value="ALQUILAR">Busca alquilar</option>
              <option value="COMPRAR">Busca comprar</option>
              <option value="VENDER">Propietario / quiere vender</option>
            </select>
            <span style={{ flex: 1 }}></span>
            <button className="btn-sm" onClick={() => setVerEliminados(true)}>
              Historial de eliminados
            </button>
            <button className="btn-sm solid" onClick={() => setModal('new')}>
              + Nuevo cliente
            </button>
          </div>
        </div>

        <div className="owners">
          {lista.length === 0 && (
            <div className="okstate" style={{ gridColumn: '1/-1' }}>
              <div className="big">☏</div>
              <h4>No hay clientes para mostrar</h4>
              <p>
                {q || filtroTipo !== 'todos'
                  ? 'Probá cambiando el filtro o el término de búsqueda.'
                  : (
                    <>
                      Cargá a quienes buscan alquilar, comprar o vender
                      <br />
                      para hacerles seguimiento desde acá.
                    </>
                  )}
              </p>
            </div>
          )}
          {lista.map((c) => {
            const busca = [
              c.busquedaTipoPropiedad ? TIPO_PROPIEDAD_LABEL[c.busquedaTipoPropiedad] ?? c.busquedaTipoPropiedad : '',
              c.montoDesde ? `desde ${formatMoney(c.montoDesde)}` : '',
              c.montoHasta ? `hasta ${formatMoney(c.montoHasta)}` : '',
              c.zona ? ZONA_LABEL[c.zona] : 'zona indiferente',
            ].filter(Boolean);
            return (
              <div className="ownercard" key={c.id}>
                <div className="top">
                  <div className="avatar">{iniciales(c.nombre)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4>{c.nombre}</h4>
                    <div className="contact">
                      {c.telefono && <>{c.telefono}<br /></>}
                      {c.email}
                    </div>
                  </div>
                  <span className={`clitipo ${TIPO_CLASE[c.tipoOperacion]}`}>{TIPO_LABEL[c.tipoOperacion]}</span>
                </div>
                {(busca.length > 0 || c.detalle) && (
                  <div className="contact" style={{ marginTop: 10 }}>
                    <b>Busca:</b> {[...busca, c.detalle].filter(Boolean).join(' · ')}
                  </div>
                )}
                {c.visitaOtraInmobiliariaConQuien && (
                  <div className="contact" style={{ marginTop: 6, color: 'var(--orange)' }}>
                    <b>⚠ Visita con otra inmobiliaria:</b> {c.visitaOtraInmobiliariaConQuien}
                  </div>
                )}
                {c.notas && <div className="contact" style={{ marginTop: 6 }}>{c.notas}</div>}
                <div className="props">
                  <div className="oprop" style={{ cursor: 'default' }}>
                    <span className="nm">Estado</span>
                    <span className={`badge ${ESTADO_CLASE[c.estado]}`}>{ESTADO_LABEL[c.estado]}</span>
                  </div>
                  <div className="oprop" style={{ cursor: 'default' }}>
                    <span className="nm">Origen</span>
                    <span className="pdate">{c.origen ? ORIGEN_LABEL[c.origen] : '—'}</span>
                  </div>
                  {c.delegado && (
                    <div className="oprop" style={{ cursor: 'default' }}>
                      <span className="nm">Delegado / designado</span>
                      <span className="pdate">{c.delegado.nombre}</span>
                    </div>
                  )}
                </div>
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border2)', display: 'flex', gap: 8 }}>
                  {c.telefono && (
                    <a className="btn-sm" href={`https://wa.me/${c.telefono.replace(/\D/g, '')}`} target="_blank" rel="noopener">
                      WhatsApp
                    </a>
                  )}
                  {c.email && (
                    <a className="btn-sm" href={`mailto:${c.email}`}>
                      Email
                    </a>
                  )}
                  <span style={{ flex: 1 }}></span>
                  <button className="btn-sm" onClick={() => setModal(c)}>
                    Editar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {modal && (
        <ClienteModal
          cliente={modal === 'new' ? null : modal}
          delegados={delegados.data ?? []}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            invalidar();
          }}
        />
      )}

      {verEliminados && <HistorialEliminadosModal onClose={() => setVerEliminados(false)} onChange={invalidar} />}
    </>
  );
}

// Pensado para el caso de un cliente borrado por error: "Eliminar" desde la
// ficha nunca borra la fila de verdad (ver ClientesService.remove), solo la
// saca de la lista normal — acá se puede revisar y, si corresponde,
// restaurar. El borrado real (irreversible) solo se ofrece en este modal.
function HistorialEliminadosModal({ onClose, onChange }: { onClose: () => void; onChange: () => void }) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const eliminados = useQuery({
    queryKey: ['clientes', 'eliminados'],
    queryFn: () => api.get<(Cliente & { eliminadoEn: string })[]>('/clientes/eliminados'),
  });

  function invalidarEliminados() {
    qc.invalidateQueries({ queryKey: ['clientes', 'eliminados'] });
    onChange();
  }

  const restaurar = useMutation({
    mutationFn: (id: string) => api.patch(`/clientes/${id}/restaurar`),
    onSuccess: invalidarEliminados,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo restaurar el cliente.'),
  });

  const eliminarDefinitivo = useMutation({
    mutationFn: (id: string) => api.delete(`/clientes/${id}/definitivo`),
    onSuccess: invalidarEliminados,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo eliminar el cliente definitivamente.'),
  });

  function confirmarDefinitivo(c: Cliente) {
    if (
      window.confirm(
        `¿Eliminar a "${c.nombre}" de forma DEFINITIVA? Esta acción no se puede deshacer — a diferencia de "Eliminar" en la lista normal, acá no hay forma de recuperarlo después.`,
      )
    ) {
      eliminarDefinitivo.mutate(c.id);
    }
  }

  const lista = eliminados.data ?? [];

  return (
    <Modal open onClose={onClose} title="Historial de clientes eliminados" width={620}>
      {error && <div className="errstate" style={{ marginBottom: 14 }}>{error}</div>}
      {eliminados.isLoading && <div className="loadstate">Cargando…</div>}
      {!eliminados.isLoading && lista.length === 0 && (
        <div className="empty">No hay clientes eliminados.</div>
      )}
      {lista.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lista.map((c) => (
            <div
              key={c.id}
              style={{
                border: '1px solid var(--border2)',
                borderRadius: 12,
                padding: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{c.nombre}</div>
                <div className="contact">
                  {[c.telefono, c.email].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
                </div>
                <div className="pdate" style={{ marginTop: 4 }}>
                  Eliminado el {new Date(c.eliminadoEn).toLocaleDateString('es-AR')}
                </div>
              </div>
              <button
                className="btn-sm"
                disabled={restaurar.isPending}
                onClick={() => restaurar.mutate(c.id)}
              >
                Restaurar
              </button>
              <button
                className="btn-sm ghostred"
                disabled={eliminarDefinitivo.isPending}
                onClick={() => confirmarDefinitivo(c)}
              >
                Eliminar definitivo
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function ClienteModal({
  cliente,
  delegados,
  onClose,
  onSaved,
}: {
  cliente: Cliente | null;
  delegados: Delegado[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const esNuevo = !cliente;
  const [nombre, setNombre] = useState(cliente?.nombre ?? '');
  const [telefono, setTelefono] = useState(cliente?.telefono ?? '');
  const [email, setEmail] = useState(cliente?.email ?? '');
  const [tipoOperacion, setTipoOperacion] = useState<TipoOperacionCliente>(cliente?.tipoOperacion ?? 'ALQUILAR');
  const [estado, setEstado] = useState<EstadoCliente>(cliente?.estado ?? 'SIN_CONTACTAR');
  const [origen, setOrigen] = useState<OrigenCliente | ''>(cliente?.origen ?? 'PAGINA_WEB');
  const [busquedaTipoPropiedad, setBusquedaTipoPropiedad] = useState(cliente?.busquedaTipoPropiedad ?? '');
  const [montoDesde, setMontoDesde] = useState(String(cliente?.montoDesde ?? ''));
  const [montoHasta, setMontoHasta] = useState(String(cliente?.montoHasta ?? ''));
  const [zona, setZona] = useState<ZonaCliente | ''>(cliente?.zona ?? '');
  const [detalle, setDetalle] = useState(cliente?.detalle ?? '');
  const [visitaOtraInmobiliariaConQuien, setVisitaOtraInmobiliariaConQuien] = useState(
    cliente?.visitaOtraInmobiliariaConQuien ?? '',
  );
  const [delegadoId, setDelegadoId] = useState(cliente?.delegadoId ?? '');
  const [notas, setNotas] = useState(cliente?.notas ?? '');
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: () => {
      const payload = {
        nombre,
        telefono: telefono || undefined,
        email: email || undefined,
        tipoOperacion,
        estado,
        origen: origen || undefined,
        busquedaTipoPropiedad: busquedaTipoPropiedad || undefined,
        montoDesde: montoDesde ? Number(montoDesde) : undefined,
        montoHasta: montoHasta ? Number(montoHasta) : undefined,
        zona: zona || undefined,
        detalle: detalle || undefined,
        visitaOtraInmobiliariaConQuien: visitaOtraInmobiliariaConQuien || undefined,
        delegadoId: delegadoId || undefined,
        notas: notas || undefined,
      };
      return esNuevo ? api.post('/clientes', payload) : api.patch(`/clientes/${cliente!.id}`, payload);
    },
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo guardar el cliente.'),
  });

  const eliminar = useMutation({
    mutationFn: () => api.delete(`/clientes/${cliente!.id}`),
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo eliminar el cliente.'),
  });

  return (
    <Modal open onClose={onClose} title={esNuevo ? 'Nuevo Cliente' : 'Editar Cliente'}>
      {error && <div className="errstate" style={{ marginBottom: 14 }}>{error}</div>}
      <div className="formgrid">
        <div className="fg full">
          <label>Nombre</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="fg">
          <label>Teléfono</label>
          <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Opcional" />
        </div>
        <div className="fg">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Opcional" />
        </div>
        <div className="fg">
          <label>Tipo</label>
          <select value={tipoOperacion} onChange={(e) => setTipoOperacion(e.target.value as TipoOperacionCliente)}>
            <option value="ALQUILAR">Busca alquilar</option>
            <option value="COMPRAR">Busca comprar</option>
            <option value="VENDER">Propietario / quiere vender</option>
          </select>
        </div>
        <div className="fg">
          <label>Estado</label>
          <select value={estado} onChange={(e) => setEstado(e.target.value as EstadoCliente)}>
            <option value="SIN_CONTACTAR">Sin contactar</option>
            <option value="EN_SEGUIMIENTO">En seguimiento</option>
            <option value="CERRADO">Cerrado</option>
          </select>
        </div>
        <div className="fg">
          <label>Origen</label>
          <select value={origen} onChange={(e) => setOrigen(e.target.value as OrigenCliente | '')}>
            <option value="">— Sin especificar —</option>
            {Object.entries(ORIGEN_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="fg">
          <label>Tipo de propiedad que busca</label>
          <select value={busquedaTipoPropiedad} onChange={(e) => setBusquedaTipoPropiedad(e.target.value)}>
            <option value="">— Indistinto —</option>
            {Object.entries(TIPO_PROPIEDAD_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="fg">
          <label>Zona</label>
          <select value={zona} onChange={(e) => setZona(e.target.value as ZonaCliente | '')}>
            <option value="">— Sin especificar —</option>
            {Object.entries(ZONA_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="fg">
          <label>Presupuesto desde</label>
          <input type="number" min={0} value={montoDesde} onChange={(e) => setMontoDesde(e.target.value)} placeholder="Opcional" />
        </div>
        <div className="fg">
          <label>Presupuesto hasta</label>
          <input type="number" min={0} value={montoHasta} onChange={(e) => setMontoHasta(e.target.value)} placeholder="Opcional" />
        </div>
        <div className="fg">
          <label>Delegado / designado</label>
          <select value={delegadoId} onChange={(e) => setDelegadoId(e.target.value)}>
            <option value="">— Sin asignar —</option>
            {delegados.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="fg full">
          <label>Detalle de lo que busca</label>
          <input value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder="Opcional" />
        </div>
        <div className="fg full">
          <label>Visita con otra inmobiliaria (con quién)</label>
          <input
            value={visitaOtraInmobiliariaConQuien}
            onChange={(e) => setVisitaOtraInmobiliariaConQuien(e.target.value)}
            placeholder="Opcional"
          />
        </div>
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
        <button className="btn-dark" disabled={guardar.isPending || !nombre.trim()} onClick={() => guardar.mutate()}>
          Guardar
        </button>
      </div>
    </Modal>
  );
}
