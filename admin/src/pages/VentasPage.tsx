import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { formatMoney, formatUsd, formatDate } from '../lib/format';
import { honorariosLabel, resolverPorcentajeHonorarios, type TipoHonorarios } from '../lib/honorarios';
import { FotosPropiedad, type FotoPropiedadItem } from '../components/FotosPropiedad';

type EstadoVenta = 'PUBLICADA' | 'RESERVADA' | 'VENDIDA' | 'VENDIDA_POR_TERCEROS' | 'PAUSADA';
type EtapaInteresado = 'CONSULTA' | 'VISITA' | 'NEGOCIACION' | 'RESERVA' | 'DESCARTADO';
type EstadoCartel = 'COLOCADO' | 'A_PEDIDO' | 'RETIRADO';
type ServicioFacturable =
  | 'EXPENSAS'
  | 'USINA'
  | 'CAMUZZI'
  | 'OBRAS_SANITARIAS'
  | 'RETRIBUTIVAS'
  | 'CLOACAS'
  | 'GAS_ENVASADO'
  | 'SISTEMA_BIODIGESTOR';

const SERVICIOS_OPCIONES: { key: ServicioFacturable; label: string }[] = [
  { key: 'EXPENSAS', label: 'Expensas' },
  { key: 'USINA', label: 'Luz (Usina)' },
  { key: 'CAMUZZI', label: 'Gas (Camuzzi)' },
  { key: 'OBRAS_SANITARIAS', label: 'Agua (Obras Sanitarias)' },
  { key: 'RETRIBUTIVAS', label: 'Retributivas de Servicios' },
  { key: 'CLOACAS', label: 'Cloacas' },
  { key: 'GAS_ENVASADO', label: 'Gas envasado' },
  { key: 'SISTEMA_BIODIGESTOR', label: 'Sistema biodigestor' },
];

interface Cliente {
  id: string;
  nombre: string;
}

interface Interesado {
  id: string;
  etapa: EtapaInteresado;
  oferta: string | number | null;
  notas: string | null;
  clienteId: string | null;
  nombreLibre: string | null;
  cliente: Cliente | null;
}

interface VentaResumen {
  id: string;
  precio: string | number;
  moneda: 'ARS' | 'USD';
  estado: EstadoVenta;
  publicada: boolean;
  senaRecibida: string | number | null;
  cierreEstimado: string | null;
  cierreReal: string | null;
  mejorOferta: string | number | null;
}

interface VentaCompleta extends VentaResumen {
  propiedadId: string;
  interesados: Interesado[];
}

interface Propiedad {
  id: string;
  nombre: string;
  direccion: string;
  tipo: string;
  modalidad: 'ALQUILER' | 'VENTA';
  propietarioId: string | null;
  designadoId: string | null;
  propietario: { nombre: string } | null;
  designado: { nombre: string } | null;
  honorariosTipo: TipoHonorarios;
  honorariosPorcentaje: string | number | null;
  honorariosAdministracion: boolean;
  honorariosAdministracionPorcentaje: string | number | null;
  venta: VentaResumen | null;
  inquilino: { nombre: string } | null;
  montoAlquilerVigente: string | number | null;
  alquilerPublicado: boolean;
  ambientes: number | null;
  banos: number | null;
  superficieM2: string | number | null;
  caracterEspecial: boolean;
  serviciosHabilitados: ServicioFacturable[];
  fotos: FotoPropiedadItem[];
}

interface PropietarioOpcion {
  id: string;
  nombre: string;
}

interface DelegadoOpcion {
  id: string;
  nombre: string;
}

interface VentasKpis {
  enVenta: number;
  reservadas: number;
  interesadosActivos: number;
  comisionPotencial: number;
}

interface Configuracion {
  honorariosDefaultPorcentaje: string;
  dolarReferencia: string;
}

interface Cartel {
  id: string;
  propiedadId: string;
  tipoCartel: EstadoCartel;
  medida: string | null;
  fechaColocacion: string | null;
  fechaRetiro: string | null;
  diasEnLaCalle: number | null;
  propiedad: { nombre: string; direccion: string };
}

interface CartelesKpis {
  colocados: number;
  aPedido: number;
  retirados: number;
  publicadasSinCartel: number;
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

const ESTADO_VENTA_LABEL: Record<EstadoVenta, string> = {
  PUBLICADA: 'Publicada',
  RESERVADA: 'Reservada',
  VENDIDA: 'Vendida',
  VENDIDA_POR_TERCEROS: 'Vendida por terceros',
  PAUSADA: 'Pausada',
};

const ESTADO_VENTA_CLASE: Record<EstadoVenta, string> = {
  PUBLICADA: 'publicada',
  RESERVADA: 'reservada',
  VENDIDA: 'vendida',
  VENDIDA_POR_TERCEROS: 'vendida_por_terceros',
  PAUSADA: 'pausada',
};

const ETAPA_LABEL: Record<EtapaInteresado, string> = {
  CONSULTA: 'Consulta',
  VISITA: 'Visita',
  NEGOCIACION: 'Negociación',
  RESERVA: 'Reserva',
  DESCARTADO: 'Descartado',
};

const ETAPA_CLASE: Record<EtapaInteresado, string> = {
  CONSULTA: 'contacto',
  VISITA: 'visita',
  NEGOCIACION: 'negociacion',
  RESERVA: 'reserva',
  DESCARTADO: 'descartado',
};

const CARTEL_LABEL: Record<EstadoCartel, string> = {
  COLOCADO: 'Colocado',
  A_PEDIDO: 'Por colocar',
  RETIRADO: 'Retirado',
};

const CARTEL_CLASE: Record<EstadoCartel, string> = {
  COLOCADO: 'colocado',
  A_PEDIDO: 'apedido',
  RETIRADO: 'retirado',
};

function pad(n: number | undefined) {
  return String(n ?? 0).padStart(2, '0');
}

function fmtPrecio(precio: number, moneda: 'ARS' | 'USD') {
  return moneda === 'USD' ? formatUsd(precio) : formatMoney(precio);
}

export function VentasPage() {
  const qc = useQueryClient();
  const { usuario } = useAuth();
  // Un designado (rol EQUIPO) solo trabaja el pipeline de venta sobre lo
  // que ya existe (interesados/seña/cierre/terceros) — no edita la ficha
  // de la propiedad ni agrega propiedades nuevas ni administra carteles.
  const esEquipo = usuario?.rol === 'EQUIPO';
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroEtapa, setFiltroEtapa] = useState<EtapaInteresado | ''>('');
  const [busquedaCar, setBusquedaCar] = useState('');

  const [fichaDe, setFichaDe] = useState<Propiedad | null>(null);
  const [senaDe, setSenaDe] = useState<{ propiedad: Propiedad; venta: VentaResumen } | null>(null);
  const [cerrarDe, setCerrarDe] = useState<{ propiedad: Propiedad; venta: VentaResumen } | null>(null);
  const [tercerosDe, setTercerosDe] = useState<{ propiedad: Propiedad; venta: VentaResumen } | null>(null);
  const [interesadoDe, setInteresadoDe] = useState<{
    ventaId: string;
    propiedadNombre: string;
    interesado: Interesado | null;
  } | null>(null);
  const [cartelModal, setCartelModal] = useState<'new' | Cartel | null>(null);
  const [publicarModal, setPublicarModal] = useState(false);

  const propiedades = useQuery({
    queryKey: ['propiedades'],
    queryFn: () => api.get<Propiedad[]>('/propiedades'),
  });
  const propietarios = useQuery({
    queryKey: ['propietarios'],
    queryFn: () => api.get<PropietarioOpcion[]>('/propietarios'),
  });
  const delegados = useQuery({
    queryKey: ['integrantes-equipo'],
    queryFn: () => api.get<DelegadoOpcion[]>('/integrantes-equipo'),
  });
  const ventas = useQuery({
    queryKey: ['ventas'],
    queryFn: () => api.get<VentaCompleta[]>('/ventas'),
  });
  const ventasKpis = useQuery({
    queryKey: ['ventas', 'kpis'],
    queryFn: () => api.get<VentasKpis>('/ventas/kpis'),
  });
  const configuracion = useQuery({
    queryKey: ['configuracion'],
    queryFn: () => api.get<Configuracion>('/configuracion'),
  });
  const clientes = useQuery({
    queryKey: ['clientes'],
    queryFn: () => api.get<Cliente[]>('/clientes'),
  });
  const carteles = useQuery({
    queryKey: ['carteles'],
    queryFn: () => api.get<Cartel[]>('/carteles'),
  });
  const cartelesKpis = useQuery({
    queryKey: ['carteles', 'kpis'],
    queryFn: () => api.get<CartelesKpis>('/carteles/kpis'),
  });

  function invalidarVentas() {
    qc.invalidateQueries({ queryKey: ['ventas'] });
    qc.invalidateQueries({ queryKey: ['propiedades'] });
    qc.invalidateQueries({ queryKey: ['clientes'] });
    // Registrar seña / cerrar venta / vender por terceros generan un
    // movimiento automático en Caja (seña o comisión en USD, §3.6).
    qc.invalidateQueries({ queryKey: ['caja'] });
  }
  function invalidarCarteles() {
    qc.invalidateQueries({ queryKey: ['carteles'] });
    qc.invalidateQueries({ queryKey: ['propiedades'] });
  }

  const quitarSena = useMutation({
    mutationFn: (ventaId: string) => api.delete(`/ventas/${ventaId}/sena`),
    onSuccess: invalidarVentas,
  });
  const deshacerVenta = useMutation({
    mutationFn: (ventaId: string) => api.delete(`/ventas/${ventaId}/cerrar`),
    onSuccess: invalidarVentas,
  });

  const marcarColocado = useMutation({
    mutationFn: (id: string) =>
      api.patch(`/carteles/${id}`, {
        tipoCartel: 'COLOCADO',
        fechaColocacion: new Date().toISOString().slice(0, 10),
      }),
    onSuccess: invalidarCarteles,
  });
  const marcarRetirado = useMutation({
    mutationFn: (id: string) => api.post(`/carteles/${id}/retirar`),
    onSuccess: invalidarCarteles,
  });

  if (propiedades.isLoading || ventas.isLoading) {
    return (
      <>
        <PageHeader title="Ventas y Carteles" />
        <main>
          <div className="loadstate">Cargando…</div>
        </main>
      </>
    );
  }

  const honorDefault = Number(configuracion.data?.honorariosDefaultPorcentaje ?? 0);
  const dolarReferencia = Number(configuracion.data?.dolarReferencia ?? 0);
  const ventaPorPropiedadId = new Map((ventas.data ?? []).map((v) => [v.propiedadId, v]));

  // Ventas y Carteles muestra únicamente la cartera en modalidad VENTA — los
  // alquileres (ocupados o vacantes) viven en Inquilinos y Cobros. Si una
  // propiedad que estaba en venta se termina alquilando (vía "+ Alquilar
  // propiedad existente"), su ficha de venta con el historial de interesados
  // no se borra, pero deja de listarse acá; queda accesible desde la ficha
  // de la propiedad en Inquilinos y Cobros.
  const propiedadesVenta = (propiedades.data ?? [])
    .filter((p) => p.modalidad === 'VENTA' && (!filtroTipo || p.tipo === filtroTipo))
    .filter((p) => {
      if (!filtroEtapa) return true;
      const v = ventaPorPropiedadId.get(p.id) ?? p.venta;
      const interesados = v && 'interesados' in v ? (v as VentaCompleta).interesados : [];
      return interesados.some((i) => i.etapa === filtroEtapa);
    });

  const q = busquedaCar.toLowerCase();
  const cartelesVisibles = (carteles.data ?? [])
    .filter((c) => {
      if (!q) return true;
      return [CARTEL_LABEL[c.tipoCartel], c.medida, c.propiedad.nombre, c.propiedad.direccion]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    })
    .slice()
    .sort((a, b) => {
      const orden: Record<EstadoCartel, number> = { COLOCADO: 0, A_PEDIDO: 1, RETIRADO: 2 };
      if (orden[a.tipoCartel] !== orden[b.tipoCartel]) return orden[a.tipoCartel] - orden[b.tipoCartel];
      return (b.fechaColocacion ?? '').localeCompare(a.fechaColocacion ?? '');
    });

  return (
    <>
      <PageHeader title="Ventas y Carteles" />
      <main>
        <div className="kpis">
          <div className="kpi">
            <div className="lbl">En venta</div>
            <div className="val">{pad(ventasKpis.data?.enVenta)}</div>
          </div>
          <div className="kpi">
            <div className="lbl">Reservadas</div>
            <div className="val">{pad(ventasKpis.data?.reservadas)}</div>
          </div>
          <div className="kpi">
            <div className="lbl">Interesados activos</div>
            <div className="val">{pad(ventasKpis.data?.interesadosActivos)}</div>
          </div>
          <div className="kpi">
            <div className="lbl">Comisión potencial</div>
            <div className="val">{formatMoney(ventasKpis.data?.comisionPotencial ?? 0)}</div>
            <div className="hint">según los honorarios de cada propiedad · dólar {formatMoney(dolarReferencia)}</div>
          </div>
        </div>

        <div className="tablewrap" style={{ marginBottom: 22 }}>
          <div className="searchbar" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                style={{ border: '1px solid var(--border)', borderRadius: 9, padding: '9px 12px', background: 'var(--bg)', fontSize: 13 }}
              >
                <option value="">Tipo de propiedad (todas)</option>
                {Object.entries(TIPO_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <select
                value={filtroEtapa}
                onChange={(e) => setFiltroEtapa(e.target.value as EtapaInteresado | '')}
                style={{ border: '1px solid var(--border)', borderRadius: 9, padding: '9px 12px', background: 'var(--bg)', fontSize: 13 }}
              >
                <option value="">Etapa de interesados (todas)</option>
                {Object.entries(ETAPA_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            {!esEquipo && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-sm solid" onClick={() => setPublicarModal(true)}>
                  + Publicar propiedad en venta
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="salegrid" style={{ marginBottom: 26 }}>
          {propiedadesVenta.length === 0 && (
            <div className="empty" style={{ gridColumn: '1/-1' }}>
              No hay propiedades que coincidan con estos filtros.
            </div>
          )}
          {propiedadesVenta.map((p) => {
            const v = ventaPorPropiedadId.get(p.id) ?? p.venta;

            const estado = v?.estado ?? 'PUBLICADA';
            const precio = Number(v?.precio ?? 0);
            const moneda = v?.moneda ?? 'ARS';
            const ars = moneda === 'USD' ? precio * dolarReferencia : precio;
            const pct = resolverPorcentajeHonorarios(p, honorDefault);
            const com = (ars * pct) / 100;
            const interesados = 'interesados' in (v ?? {}) ? (v as VentaCompleta).interesados : [];
            const activos = interesados.filter((i) => i.etapa !== 'DESCARTADO');
            const mejor = activos.reduce<Interesado | null>((m, i) => {
              const oferta = Number(i.oferta ?? 0);
              return oferta > Number(m?.oferta ?? 0) ? i : m;
            }, null);

            return (
              <div className="salecard" key={p.id}>
                <div className="shead">
                  <div className="stop">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4>{p.nombre}</h4>
                      <div className="saddr">
                        {p.direccion} · {TIPO_LABEL[p.tipo] ?? p.tipo}
                      </div>
                    </div>
                    <span style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <span className={`badge ${ESTADO_VENTA_CLASE[estado]}`}>{ESTADO_VENTA_LABEL[estado]}</span>
                    </span>
                  </div>
                  <div className="sprice">
                    {fmtPrecio(precio, moneda)}
                    <small>{moneda}</small>
                  </div>
                  {moneda === 'USD' && ars > 0 && <div className="sars">≈ {formatMoney(ars)} al dólar de referencia</div>}
                </div>
                <div className="sbody">
                  <div className="srow">
                    <span>Propietario</span>
                    <b>{p.propietario?.nombre ?? '—'}</b>
                  </div>
                  <div className="srow">
                    <span>Publicada</span>
                    <b>{v ? (v.publicada ? 'Sí' : 'No') : '—'}</b>
                  </div>
                  <div className="srow">
                    <span>Honorarios profesionales ({honorariosLabel(p, honorDefault)})</span>
                    <b>{com ? formatMoney(com) : '—'}</b>
                  </div>
                  <div className="srow">
                    <span>La muestra</span>
                    <b>
                      {p.designado?.nombre ?? (
                        <span style={{ color: 'var(--muted)', fontWeight: 600 }}>sin designar</span>
                      )}
                    </b>
                  </div>
                  {v?.senaRecibida != null && Number(v.senaRecibida) > 0 && (
                    <div className="srow">
                      <span>Seña recibida</span>
                      <b style={{ color: 'var(--green)' }}>{formatUsd(v.senaRecibida)}</b>
                    </div>
                  )}
                  {v?.cierreEstimado && (
                    <div className="srow">
                      <span>Cierre estimado</span>
                      <b>{formatDate(v.cierreEstimado)}</b>
                    </div>
                  )}
                  {mejor?.oferta != null && Number(mejor.oferta) > 0 && (
                    <div className="srow">
                      <span>Mejor oferta</span>
                      <b>{formatMoney(mejor.oferta)}</b>
                    </div>
                  )}

                  {v ? (
                    <div className="intlist">
                      <div className="ih">INTERESADOS ({activos.length})</div>
                      {interesados.length ? (
                        interesados.map((i) => (
                          <div
                            className="intitem"
                            key={i.id}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setInteresadoDe({ ventaId: v.id, propiedadNombre: p.nombre, interesado: i })}
                          >
                            <div className="inm">
                              {i.cliente?.nombre ?? i.nombreLibre}
                              <small>{i.notas ?? ''}</small>
                            </div>
                            {i.oferta ? <span className="iof">{formatMoney(i.oferta)}</span> : null}
                            <span className={`etapa ${ETAPA_CLASE[i.etapa]}`}>{ETAPA_LABEL[i.etapa]}</span>
                          </div>
                        ))
                      ) : (
                        <div style={{ color: 'var(--muted)', fontSize: 12.5, padding: '6px 10px' }}>
                          Sin interesados registrados
                        </div>
                      )}
                      <button
                        className="btn-sm"
                        style={{ width: '100%', marginTop: 8 }}
                        onClick={() => setInteresadoDe({ ventaId: v.id, propiedadNombre: p.nombre, interesado: null })}
                      >
                        + Agregar interesado
                      </button>
                    </div>
                  ) : (
                    <div className="intlist">
                      <div style={{ color: 'var(--muted)', fontSize: 12.5, padding: 10 }}>
                        Creá la ficha de venta para sumar interesados.
                      </div>
                    </div>
                  )}
                </div>
                <div className="sfoot" style={{ flexWrap: 'wrap' }}>
                  {!esEquipo && (
                    <button className="btn-sm" style={{ flex: 1 }} onClick={() => setFichaDe(p)}>
                      ✎ Editar ficha
                    </button>
                  )}
                  {v && (estado === 'PUBLICADA' || estado === 'PAUSADA') && (
                    <button className="btn-sm" onClick={() => setSenaDe({ propiedad: p, venta: v })}>
                      ¤ Registrar seña
                    </button>
                  )}
                  {v && estado === 'RESERVADA' && (
                    <>
                      <button className="btn-sm" onClick={() => setSenaDe({ propiedad: p, venta: v })}>
                        ✎ Editar seña
                      </button>
                      <button
                        className="btn-sm ghostred"
                        disabled={quitarSena.isPending}
                        onClick={() => {
                          if (window.confirm('¿Quitar la seña registrada? La propiedad vuelve a "Publicada" y se borra el ingreso en Caja.')) {
                            quitarSena.mutate(v.id);
                          }
                        }}
                      >
                        ✕ Quitar seña
                      </button>
                      <button className="btn-sm solid" onClick={() => setCerrarDe({ propiedad: p, venta: v })}>
                        ✓ Cerrar venta
                      </button>
                    </>
                  )}
                  {v && estado === 'VENDIDA' && (
                    <>
                      <button className="btn-sm" onClick={() => setCerrarDe({ propiedad: p, venta: v })}>
                        ✎ Editar cierre
                      </button>
                      <button
                        className="btn-sm ghostred"
                        disabled={deshacerVenta.isPending}
                        onClick={() => {
                          if (window.confirm('¿Deshacer esta venta? Vuelve a "Reservada" y se borra la comisión registrada en Caja.')) {
                            deshacerVenta.mutate(v.id);
                          }
                        }}
                      >
                        ↺ Deshacer venta
                      </button>
                    </>
                  )}
                  {v && estado !== 'VENDIDA' && estado !== 'VENDIDA_POR_TERCEROS' && (
                    <button className="btn-sm ghostred" onClick={() => setTercerosDe({ propiedad: p, venta: v })}>
                      Vendida por terceros
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="secttl">CARTELES EN LA CALLE</div>
        <div className="kpis">
          <div className="kpi">
            <div className="lbl">Colocados</div>
            <div className="val ok">{pad(cartelesKpis.data?.colocados)}</div>
            <div className="hint">en la calle ahora</div>
          </div>
          <div className={`kpi${(cartelesKpis.data?.aPedido ?? 0) > 0 ? ' alert' : ''}`}>
            <div className="lbl">Por colocar</div>
            <div className="val">{pad(cartelesKpis.data?.aPedido)}</div>
            <div className="hint">esperando la imprenta</div>
          </div>
          <div className="kpi">
            <div className="lbl">Retirados</div>
            <div className="val">{pad(cartelesKpis.data?.retirados)}</div>
          </div>
          <div className="kpi">
            <div className="lbl">Sin cartel</div>
            <div className="val">{pad(cartelesKpis.data?.publicadasSinCartel)}</div>
            <div className="hint">propiedades publicadas</div>
          </div>
        </div>

        <div className="tablewrap">
          <div className="searchbar">
            <input
              type="text"
              placeholder="Buscar por propiedad o tipo de cartel…"
              value={busquedaCar}
              onChange={(e) => setBusquedaCar(e.target.value)}
            />
            <span style={{ flex: 1 }}></span>
            {!esEquipo && (
              <button className="btn-sm solid" onClick={() => setCartelModal('new')}>
                + Nuevo cartel
              </button>
            )}
          </div>
          <table>
            <thead>
              <tr>
                <th>PROPIEDAD</th>
                <th>TIPO DE CARTEL</th>
                <th>MEDIDA</th>
                <th>COLOCADO</th>
                <th>DÍAS EN LA CALLE</th>
                <th style={{ textAlign: 'right' }}>ACCIÓN</th>
              </tr>
            </thead>
            <tbody>
              {cartelesVisibles.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">
                    No hay carteles cargados. Registrá qué cartel está puesto en cada propiedad.
                  </td>
                </tr>
              )}
              {cartelesVisibles.map((c) => (
                <tr
                  className="movrow"
                  key={c.id}
                  style={esEquipo ? { cursor: 'default' } : undefined}
                  onClick={esEquipo ? undefined : () => setCartelModal(c)}
                >
                  <td>
                    <div className="pname">{c.propiedad.nombre}</div>
                    <div className="psub">{c.propiedad.direccion}</div>
                  </td>
                  <td>
                    <span className={`badge ${CARTEL_CLASE[c.tipoCartel]}`}>{CARTEL_LABEL[c.tipoCartel]}</span>
                  </td>
                  <td style={{ fontSize: 12.5, color: 'var(--ink2)' }}>{c.medida ?? '—'}</td>
                  <td>{c.fechaColocacion ? <span className="pdate">{formatDate(c.fechaColocacion)}</span> : '—'}</td>
                  <td>
                    {c.diasEnLaCalle != null ? (
                      <>
                        <span className="money">{c.diasEnLaCalle}</span>{' '}
                        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                          {c.diasEnLaCalle === 1 ? 'día' : 'días'}
                        </span>
                      </>
                    ) : (
                      <span style={{ color: 'var(--muted)' }}>—</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {esEquipo ? (
                      <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>
                    ) : (
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {c.tipoCartel === 'A_PEDIDO' && (
                          <button
                            className="btn-sm solid"
                            onClick={(e) => {
                              e.stopPropagation();
                              marcarColocado.mutate(c.id);
                            }}
                          >
                            Marcar colocado
                          </button>
                        )}
                        {c.tipoCartel === 'COLOCADO' && (
                          <button
                            className="btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              marcarRetirado.mutate(c.id);
                            }}
                          >
                            Marcar retirado
                          </button>
                        )}
                        <button
                          className="btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCartelModal(c);
                          }}
                        >
                          Editar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {fichaDe && (
        <SaleModal
          propiedad={(propiedades.data ?? []).find((p) => p.id === fichaDe.id) ?? fichaDe}
          venta={ventaPorPropiedadId.get(fichaDe.id) ?? fichaDe.venta}
          propietarios={propietarios.data ?? []}
          delegados={delegados.data ?? []}
          onClose={() => setFichaDe(null)}
          onFotosChange={() => qc.invalidateQueries({ queryKey: ['propiedades'] })}
          onSaved={() => {
            setFichaDe(null);
            invalidarVentas();
          }}
          onDeleted={() => {
            setFichaDe(null);
            invalidarVentas();
          }}
        />
      )}
      {senaDe && (
        <SenaModal
          ventaId={senaDe.venta.id}
          propiedadNombre={senaDe.propiedad.nombre}
          montoInicial={senaDe.venta.senaRecibida}
          onClose={() => setSenaDe(null)}
          onSaved={() => {
            setSenaDe(null);
            invalidarVentas();
          }}
        />
      )}
      {cerrarDe && (
        <CerrarModal
          ventaId={cerrarDe.venta.id}
          propiedadNombre={cerrarDe.propiedad.nombre}
          precio={Number(cerrarDe.venta.precio)}
          fechaInicial={cerrarDe.venta.cierreReal}
          onClose={() => setCerrarDe(null)}
          onSaved={() => {
            setCerrarDe(null);
            invalidarVentas();
          }}
        />
      )}
      {tercerosDe && (
        <TercerosModal
          ventaId={tercerosDe.venta.id}
          propiedadNombre={tercerosDe.propiedad.nombre}
          onClose={() => setTercerosDe(null)}
          onSaved={() => {
            setTercerosDe(null);
            invalidarVentas();
          }}
        />
      )}
      {interesadoDe && (
        <InteresadoModal
          ventaId={interesadoDe.ventaId}
          propiedadNombre={interesadoDe.propiedadNombre}
          interesado={interesadoDe.interesado}
          clientes={clientes.data ?? []}
          onClose={() => setInteresadoDe(null)}
          onSaved={() => {
            setInteresadoDe(null);
            invalidarVentas();
          }}
        />
      )}
      {cartelModal && (
        <CartelModal
          cartel={cartelModal === 'new' ? null : cartelModal}
          propiedades={propiedades.data ?? []}
          onClose={() => setCartelModal(null)}
          onSaved={() => {
            setCartelModal(null);
            invalidarCarteles();
          }}
        />
      )}
      {publicarModal && (
        <PublicarExistenteModal
          propiedades={propiedades.data ?? []}
          ventaIds={new Set(ventaPorPropiedadId.keys())}
          onClose={() => setPublicarModal(false)}
          onSaved={() => {
            setPublicarModal(false);
            invalidarVentas();
          }}
        />
      )}
    </>
  );
}

function SaleModal({
  propiedad,
  venta,
  propietarios,
  delegados,
  onClose,
  onSaved,
  onDeleted,
  onFotosChange,
}: {
  propiedad: Propiedad;
  venta: VentaResumen | null;
  propietarios: PropietarioOpcion[];
  delegados: DelegadoOpcion[];
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
  onFotosChange: () => void;
}) {
  const puedeEditarEstado = !venta || venta.estado === 'PUBLICADA' || venta.estado === 'PAUSADA';

  // Datos generales de la propiedad — se corrigen acá los errores de carga
  // (nombre, dirección, tipo, a quién pertenece, honorarios), separado de la
  // ficha de venta propiamente dicha (precio, estado, etc.).
  const [nombre, setNombre] = useState(propiedad.nombre);
  const [direccion, setDireccion] = useState(propiedad.direccion);
  const [tipo, setTipo] = useState(propiedad.tipo);
  const [propietarioId, setPropietarioId] = useState(propiedad.propietarioId ?? '');
  const [designadoId, setDesignadoId] = useState(propiedad.designadoId ?? '');
  const [honorariosTipo, setHonorariosTipo] = useState<TipoHonorarios>(propiedad.honorariosTipo ?? null);
  const [honorariosPorcentaje, setHonorariosPorcentaje] = useState(String(propiedad.honorariosPorcentaje ?? ''));
  const [honorariosAdministracion, setHonorariosAdministracion] = useState(propiedad.honorariosAdministracion);
  const [honorariosAdministracionPorcentaje, setHonorariosAdministracionPorcentaje] = useState(
    String(propiedad.honorariosAdministracionPorcentaje ?? ''),
  );
  const [ambientes, setAmbientes] = useState(String(propiedad.ambientes ?? ''));
  const [banos, setBanos] = useState(String(propiedad.banos ?? ''));
  const [superficieM2, setSuperficieM2] = useState(String(propiedad.superficieM2 ?? ''));
  const [caracterEspecial, setCaracterEspecial] = useState(propiedad.caracterEspecial);
  const [servicios, setServicios] = useState<ServicioFacturable[]>(propiedad.serviciosHabilitados ?? []);

  function toggleServicio(key: ServicioFacturable) {
    setServicios((prev) => (prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]));
  }

  const [precio, setPrecio] = useState(String(venta?.precio ?? ''));
  const [moneda, setMoneda] = useState<'ARS' | 'USD'>(venta?.moneda ?? 'ARS');
  const [estado, setEstado] = useState<'PUBLICADA' | 'PAUSADA'>(venta?.estado === 'PAUSADA' ? 'PAUSADA' : 'PUBLICADA');
  const [publicada, setPublicada] = useState(venta?.publicada ?? true);
  const [cierreEstimado, setCierreEstimado] = useState(venta?.cierreEstimado?.slice(0, 10) ?? '');
  const [mejorOferta, setMejorOferta] = useState(String(venta?.mejorOferta ?? ''));
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: async () => {
      await api.patch(`/propiedades/${propiedad.id}`, {
        nombre,
        direccion,
        tipo,
        propietarioId: propietarioId || undefined,
        designadoId: designadoId || undefined,
        honorariosTipo: honorariosTipo || undefined,
        honorariosPorcentaje: honorariosTipo === 'OTRO' && honorariosPorcentaje ? Number(honorariosPorcentaje) : undefined,
        honorariosAdministracion,
        honorariosAdministracionPorcentaje:
          honorariosAdministracion && honorariosAdministracionPorcentaje
            ? Number(honorariosAdministracionPorcentaje)
            : undefined,
        ambientes: ambientes ? Number(ambientes) : undefined,
        banos: banos ? Number(banos) : undefined,
        superficieM2: superficieM2 ? Number(superficieM2) : undefined,
        caracterEspecial,
        serviciosHabilitados: tipo !== 'LOTE' ? servicios : undefined,
      });
      return api.post(`/propiedades/${propiedad.id}/venta`, {
        precio: Number(precio),
        moneda,
        estado: puedeEditarEstado ? estado : undefined,
        publicada,
        cierreEstimado: cierreEstimado || undefined,
        mejorOferta: mejorOferta ? Number(mejorOferta) : undefined,
      });
    },
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo guardar la ficha de venta.'),
  });

  const eliminar = useMutation({
    mutationFn: () => api.delete(`/propiedades/${propiedad.id}`),
    onSuccess: onDeleted,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo eliminar la propiedad.'),
  });

  function confirmarEliminar() {
    if (window.confirm(`¿Eliminar definitivamente "${propiedad.nombre}"? Esta acción no se puede deshacer.`)) {
      eliminar.mutate();
    }
  }

  return (
    <Modal open onClose={onClose} title={`Ficha de Venta — ${propiedad.nombre}`}>
      {error && <div className="errstate" style={{ marginBottom: 14 }}>{error}</div>}
      <div className="secttl" style={{ marginTop: 0 }}>
        DATOS DE LA PROPIEDAD
      </div>
      <div className="formgrid">
        <div className="fg full">
          <label>Nombre</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="fg full">
          <label>Dirección</label>
          <input value={direccion} onChange={(e) => setDireccion(e.target.value)} />
        </div>
        <div className="fg">
          <label>Tipo de propiedad</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {Object.entries(TIPO_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="fg">
          <label>Propietario</label>
          <select value={propietarioId} onChange={(e) => setPropietarioId(e.target.value)}>
            <option value="">— Sin asignar —</option>
            {propietarios.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="fg">
          <label>Designado para mostrar</label>
          <select value={designadoId} onChange={(e) => setDesignadoId(e.target.value)}>
            <option value="">— Sin designar —</option>
            {delegados.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="fg">
          <label>Honorarios profesionales</label>
          <select value={honorariosTipo ?? ''} onChange={(e) => setHonorariosTipo((e.target.value || null) as TipoHonorarios)}>
            <option value="">Usar el % por defecto de Configuración</option>
            <option value="LIBRE">Libre de gastos (0%)</option>
            <option value="TRES_POR_CIENTO">3%</option>
            <option value="CUATRO_POR_CIENTO">4%</option>
            <option value="SEIS_POR_CIENTO">6%</option>
            <option value="OTRO">Otro %</option>
          </select>
        </div>
        {honorariosTipo === 'OTRO' && (
          <div className="fg">
            <label>Otro — indicar %</label>
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={honorariosPorcentaje}
              onChange={(e) => setHonorariosPorcentaje(e.target.value)}
            />
          </div>
        )}
        <div className="fg" style={{ display: 'flex', alignItems: 'flex-end' }}>
          <label className="chk">
            <input
              type="checkbox"
              checked={honorariosAdministracion}
              onChange={(e) => setHonorariosAdministracion(e.target.checked)}
            />
            <span>Honorarios de administración</span>
          </label>
        </div>
        {honorariosAdministracion && (
          <div className="fg">
            <label>Honorarios de administración — %</label>
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={honorariosAdministracionPorcentaje}
              onChange={(e) => setHonorariosAdministracionPorcentaje(e.target.value)}
            />
          </div>
        )}
        <div className="fg">
          <label>Ambientes</label>
          <input type="number" min={0} value={ambientes} onChange={(e) => setAmbientes(e.target.value)} placeholder="Opcional" />
        </div>
        <div className="fg">
          <label>Baños</label>
          <input type="number" min={0} value={banos} onChange={(e) => setBanos(e.target.value)} placeholder="Opcional" />
        </div>
        <div className="fg">
          <label>Superficie (m²)</label>
          <input type="number" min={0} step="0.01" value={superficieM2} onChange={(e) => setSuperficieM2(e.target.value)} placeholder="Opcional" />
        </div>
        <div className="fg" style={{ display: 'flex', alignItems: 'flex-end' }}>
          <label className="chk">
            <input
              type="checkbox"
              checked={caracterEspecial}
              onChange={(e) => setCaracterEspecial(e.target.checked)}
            />
            <span>Carácter especial (carrusel destacado de la landing)</span>
          </label>
        </div>
      </div>

      {tipo !== 'LOTE' && (
        <>
          <div className="secttl">SERVICIOS QUE SE FACTURAN</div>
          <div className="formgrid" style={{ marginBottom: 4 }}>
            {SERVICIOS_OPCIONES.map((s) => (
              <div className="fg" key={s.key} style={{ minWidth: 0 }}>
                <label className="chk">
                  <input type="checkbox" checked={servicios.includes(s.key)} onChange={() => toggleServicio(s.key)} />
                  <span>{s.label}</span>
                </label>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="secttl">FOTOS</div>
      <FotosPropiedad
        propiedadId={propiedad.id}
        fotos={propiedad.fotos}
        mostrarPortada={propiedad.caracterEspecial}
        onChange={onFotosChange}
      />

      <div className="secttl">FICHA DE VENTA</div>
      <div className="formgrid">
        <div className="fg">
          <label>Precio</label>
          <input type="number" min={0} step="0.01" value={precio} onChange={(e) => setPrecio(e.target.value)} />
        </div>
        <div className="fg">
          <label>Moneda</label>
          <select value={moneda} onChange={(e) => setMoneda(e.target.value as 'ARS' | 'USD')}>
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </select>
        </div>
        {puedeEditarEstado ? (
          <div className="fg">
            <label>Estado de la operación</label>
            <select value={estado} onChange={(e) => setEstado(e.target.value as 'PUBLICADA' | 'PAUSADA')}>
              <option value="PUBLICADA">Publicada</option>
              <option value="PAUSADA">Pausada</option>
            </select>
          </div>
        ) : (
          <div className="fg">
            <label>Estado de la operación</label>
            <div>
              <span className={`badge ${ESTADO_VENTA_CLASE[venta!.estado]}`}>{ESTADO_VENTA_LABEL[venta!.estado]}</span>
            </div>
          </div>
        )}
        <div className="fg">
          <label>Publicada en la web</label>
          <select value={publicada ? '1' : '0'} onChange={(e) => setPublicada(e.target.value === '1')}>
            <option value="1">Sí</option>
            <option value="0">No</option>
          </select>
        </div>
        <div className="fg">
          <label>Cierre estimado</label>
          <input type="date" value={cierreEstimado} onChange={(e) => setCierreEstimado(e.target.value)} />
        </div>
        <div className="fg">
          <label>Mejor oferta recibida</label>
          <input type="number" min={0} step="0.01" value={mejorOferta} onChange={(e) => setMejorOferta(e.target.value)} />
        </div>
      </div>
      <div className="btnrow">
        <button className="btn-sm ghostred" style={{ marginRight: 'auto' }} disabled={eliminar.isPending} onClick={confirmarEliminar}>
          Eliminar propiedad
        </button>
        <button className="btn-ghost" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn-dark" disabled={guardar.isPending} onClick={() => guardar.mutate()}>
          Guardar ficha
        </button>
      </div>
    </Modal>
  );
}

// Toma una propiedad que ya existe en la base (hoy en Alquiler, o cualquiera
// que todavía no tenga ficha de venta) y la pasa a modalidad Venta + le crea
// la ficha — en dos pasos porque son dos recursos distintos en el backend
// (PATCH /propiedades/:id cambia la modalidad, POST /propiedades/:id/venta
// upsertea la ficha), pero de una sola vez desde acá.
// Toma una propiedad que ya existe en la cartera y la publica — venta o
// alquiler, se elige acá mismo. Antes eran dos botones/modales separados
// ("Alquilar propiedad existente" y "Publicar propiedad existente"); se
// unificaron en uno solo porque en el fondo es la misma operación
// (activar una propiedad de la cartera bajo una modalidad), solo cambian
// los datos que hay que cargar.
function PublicarExistenteModal({
  propiedades,
  ventaIds,
  onClose,
  onSaved,
}: {
  propiedades: Propiedad[];
  ventaIds: Set<string>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [propiedadId, setPropiedadId] = useState('');
  const [precio, setPrecio] = useState('');
  const [moneda, setMoneda] = useState<'ARS' | 'USD'>('USD');
  const [publicada, setPublicada] = useState(true);
  const [cierreEstimado, setCierreEstimado] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Cualquier propiedad ya en modalidad Venta que todavía no tiene ficha
  // de venta cargada.
  const opciones = propiedades.filter((p) => p.modalidad === 'VENTA' && !ventaIds.has(p.id));

  const guardar = useMutation({
    mutationFn: async () => {
      return api.post(`/propiedades/${propiedadId}/venta`, {
        precio: Number(precio),
        moneda,
        publicada,
        cierreEstimado: cierreEstimado || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['propiedades'] });
      qc.invalidateQueries({ queryKey: ['cobros'] });
      qc.invalidateQueries({ queryKey: ['avisos'] });
      qc.invalidateQueries({ queryKey: ['ventas'] });
      qc.invalidateQueries({ queryKey: ['carteles'] });
      onSaved();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo publicar la propiedad.'),
  });

  const puedeGuardar = !!propiedadId && !!precio;

  return (
    <Modal open onClose={onClose} title="Publicar propiedad en venta" width={480}>
      {error && <div className="errstate" style={{ marginBottom: 14 }}>{error}</div>}
      <div className="formgrid">
        <div className="fg full">
          <label>Propiedad</label>
          <select value={propiedadId} onChange={(e) => setPropiedadId(e.target.value)}>
            <option value="">— Elegir de la cartera —</option>
            {opciones.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} — {p.direccion} (sin ficha de venta)
              </option>
            ))}
          </select>
          {opciones.length === 0 && (
            <div className="hint" style={{ marginTop: 6 }}>
              Todas las propiedades de la cartera ya están en venta.
            </div>
          )}
        </div>
        <div className="fg">
          <label>Precio</label>
          <input type="number" min={0} step="0.01" value={precio} onChange={(e) => setPrecio(e.target.value)} />
        </div>
        <div className="fg">
          <label>Moneda</label>
          <select value={moneda} onChange={(e) => setMoneda(e.target.value as 'ARS' | 'USD')}>
            <option value="USD">USD</option>
            <option value="ARS">ARS</option>
          </select>
        </div>
        <div className="fg full">
          <label className="chk">
            <input type="checkbox" checked={publicada} onChange={(e) => setPublicada(e.target.checked)} />
            <span>Mostrar en la página web (landing page)</span>
          </label>
        </div>
        <div className="fg full">
          <label>Cierre estimado</label>
          <input type="date" value={cierreEstimado} onChange={(e) => setCierreEstimado(e.target.value)} />
        </div>
      </div>

      <div className="btnrow">
        <button className="btn-ghost" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn-dark" disabled={!puedeGuardar || guardar.isPending} onClick={() => guardar.mutate()}>
          Publicar
        </button>
      </div>
    </Modal>
  );
}

function SenaModal({
  ventaId,
  propiedadNombre,
  montoInicial,
  onClose,
  onSaved,
}: {
  ventaId: string;
  propiedadNombre: string;
  montoInicial?: number | string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const esEdicion = montoInicial != null && Number(montoInicial) > 0;
  const [monto, setMonto] = useState(montoInicial != null ? String(montoInicial) : '');
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: () => api.post(`/ventas/${ventaId}/sena`, { monto: Number(monto) }),
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo registrar la seña.'),
  });

  return (
    <Modal open onClose={onClose} title={`${esEdicion ? 'Editar' : 'Registrar'} Seña — ${propiedadNombre}`} width={420}>
      {error && <div className="errstate" style={{ marginBottom: 14 }}>{error}</div>}
      <div className="formgrid">
        <div className="fg full">
          <label>Monto de la seña (USD)</label>
          <input type="number" min={0.01} step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} />
        </div>
      </div>
      <div className="cfgnote" style={{ marginTop: 4 }}>
        <i>△</i>
        <span>La seña queda registrada en la ficha de la venta, pero no genera movimiento en Caja — lo único que se refleja ahí es el honorario al cerrar la venta.</span>
      </div>
      <div className="btnrow">
        <button className="btn-ghost" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn-dark" disabled={guardar.isPending || !monto} onClick={() => guardar.mutate()}>
          {esEdicion ? 'Guardar seña' : 'Registrar seña'}
        </button>
      </div>
    </Modal>
  );
}

function CerrarModal({
  ventaId,
  propiedadNombre,
  precio,
  fechaInicial,
  onClose,
  onSaved,
}: {
  ventaId: string;
  propiedadNombre: string;
  precio: number;
  fechaInicial?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const esEdicion = !!fechaInicial;
  const [fecha, setFecha] = useState(fechaInicial?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [precioFinal, setPrecioFinal] = useState(String(precio));
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: () =>
      api.post(`/ventas/${ventaId}/cerrar`, {
        fecha,
        precioFinal: precioFinal ? Number(precioFinal) : undefined,
      }),
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo cerrar la venta.'),
  });

  return (
    <Modal open onClose={onClose} title={`${esEdicion ? 'Editar Cierre' : 'Cerrar Venta'} — ${propiedadNombre}`} width={420}>
      {error && <div className="errstate" style={{ marginBottom: 14 }}>{error}</div>}
      <div className="formgrid">
        <div className="fg full">
          <label>Fecha de cierre</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div className="fg full">
          <label>Precio final</label>
          <input type="number" min={0} step="0.01" value={precioFinal} onChange={(e) => setPrecioFinal(e.target.value)} />
        </div>
      </div>
      <div className="btnrow">
        <button className="btn-ghost" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn-dark" disabled={guardar.isPending} onClick={() => guardar.mutate()}>
          {esEdicion ? 'Guardar cierre' : 'Cerrar venta'}
        </button>
      </div>
    </Modal>
  );
}

function TercerosModal({
  ventaId,
  propiedadNombre,
  onClose,
  onSaved,
}: {
  ventaId: string;
  propiedadNombre: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [detalle, setDetalle] = useState('');
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: () => api.post(`/ventas/${ventaId}/vender-por-terceros`, { detalle }),
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo registrar la venta por terceros.'),
  });

  return (
    <Modal open onClose={onClose} title={`Vendida por Terceros — ${propiedadNombre}`} width={420}>
      {error && <div className="errstate" style={{ marginBottom: 14 }}>{error}</div>}
      <div className="formgrid">
        <div className="fg full">
          <label>Detalle — quién la vendió</label>
          <input value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder="Ej: Inmobiliaria López" />
        </div>
      </div>
      <div className="btnrow">
        <button className="btn-ghost" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn-dark" disabled={guardar.isPending || !detalle.trim()} onClick={() => guardar.mutate()}>
          Confirmar
        </button>
      </div>
    </Modal>
  );
}

function InteresadoModal({
  ventaId,
  propiedadNombre,
  interesado,
  clientes,
  onClose,
  onSaved,
}: {
  ventaId: string;
  propiedadNombre: string;
  interesado: Interesado | null;
  clientes: Cliente[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const esNuevo = !interesado;
  const [modo, setModo] = useState<'cliente' | 'libre'>(interesado?.clienteId ? 'cliente' : 'libre');
  const [clienteId, setClienteId] = useState(interesado?.clienteId ?? '');
  const [nombreLibre, setNombreLibre] = useState(interesado?.nombreLibre ?? '');
  const [etapa, setEtapa] = useState<EtapaInteresado>(interesado?.etapa ?? 'CONSULTA');
  const [oferta, setOferta] = useState(String(interesado?.oferta ?? ''));
  const [notas, setNotas] = useState(interesado?.notas ?? '');
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: () => {
      const payload = {
        etapa,
        oferta: oferta ? Number(oferta) : undefined,
        notas: notas || undefined,
        ...(esNuevo ? (modo === 'cliente' ? { clienteId } : { nombreLibre }) : {}),
      };
      return esNuevo
        ? api.post(`/ventas/${ventaId}/interesados`, payload)
        : api.patch(`/interesados/${interesado!.id}`, payload);
    },
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo guardar el interesado.'),
  });

  const eliminar = useMutation({
    mutationFn: () => api.delete(`/interesados/${interesado!.id}`),
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo eliminar el interesado.'),
  });

  const puedeGuardar = esNuevo ? (modo === 'cliente' ? !!clienteId : !!nombreLibre.trim()) : true;

  return (
    <Modal open onClose={onClose} title={`${esNuevo ? 'Nuevo' : 'Editar'} Interesado — ${propiedadNombre}`}>
      {error && <div className="errstate" style={{ marginBottom: 14 }}>{error}</div>}
      <div className="formgrid">
        {esNuevo ? (
          <>
            <div className="fg full">
              <label>Interesado</label>
              <select value={modo} onChange={(e) => setModo(e.target.value as 'cliente' | 'libre')}>
                <option value="libre">Nombre libre (todavía no es cliente)</option>
                <option value="cliente">Cliente ya registrado</option>
              </select>
            </div>
            {modo === 'cliente' ? (
              <div className="fg full">
                <label>Cliente</label>
                <select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                  <option value="">Seleccioná un cliente…</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="fg full">
                <label>Nombre</label>
                <input value={nombreLibre} onChange={(e) => setNombreLibre(e.target.value)} />
              </div>
            )}
          </>
        ) : (
          <div className="fg full">
            <label>Interesado</label>
            <div style={{ fontWeight: 600 }}>{interesado!.cliente?.nombre ?? interesado!.nombreLibre}</div>
          </div>
        )}
        <div className="fg">
          <label>Etapa</label>
          <select value={etapa} onChange={(e) => setEtapa(e.target.value as EtapaInteresado)}>
            {Object.entries(ETAPA_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="fg">
          <label>Oferta</label>
          <input type="number" min={0} step="0.01" value={oferta} onChange={(e) => setOferta(e.target.value)} />
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
        <button className="btn-dark" disabled={guardar.isPending || !puedeGuardar} onClick={() => guardar.mutate()}>
          Guardar
        </button>
      </div>
    </Modal>
  );
}

function CartelModal({
  cartel,
  propiedades,
  onClose,
  onSaved,
}: {
  cartel: Cartel | null;
  propiedades: Propiedad[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const esNuevo = !cartel;
  const [propiedadId, setPropiedadId] = useState(cartel?.propiedadId ?? propiedades[0]?.id ?? '');
  const [tipoCartel, setTipoCartel] = useState<EstadoCartel>(cartel?.tipoCartel ?? 'COLOCADO');
  const [medida, setMedida] = useState(cartel?.medida ?? '');
  const [fechaColocacion, setFechaColocacion] = useState(
    cartel?.fechaColocacion?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
  );
  const [fechaRetiro, setFechaRetiro] = useState(cartel?.fechaRetiro?.slice(0, 10) ?? '');
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: () =>
      esNuevo
        ? api.post('/carteles', { propiedadId, tipoCartel, medida: medida || undefined, fechaColocacion })
        : api.patch(`/carteles/${cartel!.id}`, {
            tipoCartel,
            medida: medida || undefined,
            fechaColocacion: fechaColocacion || undefined,
            fechaRetiro: tipoCartel === 'RETIRADO' ? fechaRetiro || new Date().toISOString().slice(0, 10) : undefined,
          }),
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo guardar el cartel.'),
  });

  const eliminar = useMutation({
    mutationFn: () => api.delete(`/carteles/${cartel!.id}`),
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo eliminar el cartel.'),
  });

  return (
    <Modal open onClose={onClose} title={esNuevo ? 'Nuevo Cartel' : 'Editar Cartel'}>
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
            <div style={{ fontWeight: 600 }}>{cartel!.propiedad.nombre}</div>
          )}
        </div>
        <div className="fg">
          <label>Tipo de cartel</label>
          <select value={tipoCartel} onChange={(e) => setTipoCartel(e.target.value as EstadoCartel)}>
            <option value="COLOCADO">Colocado</option>
            <option value="RETIRADO">Retirado</option>
            <option value="A_PEDIDO">Por colocar</option>
          </select>
        </div>
        <div className="fg">
          <label>Medida</label>
          <select value={medida} onChange={(e) => setMedida(e.target.value)}>
            <option value="">Sin especificar</option>
            <option value="Chico">Chico</option>
            <option value="Grande">Grande</option>
          </select>
        </div>
        <div className="fg">
          <label>Fecha de colocación</label>
          <input type="date" value={fechaColocacion} onChange={(e) => setFechaColocacion(e.target.value)} />
        </div>
        {!esNuevo && tipoCartel === 'RETIRADO' && (
          <div className="fg">
            <label>Fecha de retiro</label>
            <input type="date" value={fechaRetiro} onChange={(e) => setFechaRetiro(e.target.value)} />
          </div>
        )}
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
        <button className="btn-dark" disabled={guardar.isPending || (esNuevo && !propiedadId)} onClick={() => guardar.mutate()}>
          Guardar
        </button>
      </div>
    </Modal>
  );
}
