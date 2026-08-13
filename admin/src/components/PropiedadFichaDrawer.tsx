import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, ApiError, BASE_URL } from '../api/client';
import { Modal } from './Modal';
import { formatMoney, formatUsd, formatDate, mesActualStr, mesLabel } from '../lib/format';
import { resolverPorcentajeHonorariosAdministracion, type TipoHonorarios } from '../lib/honorarios';
import { FotosPropiedad, type FotoPropiedadItem } from './FotosPropiedad';
import { ComprobanteImpreso } from './ComprobanteImpreso';
import { descargarPdfComprobante } from '../lib/pdfComprobante';

type Modalidad = 'ALQUILER' | 'VENTA';
type ServicioFacturable =
  | 'EXPENSAS'
  | 'USINA'
  | 'CAMUZZI'
  | 'OBRAS_SANITARIAS'
  | 'RETRIBUTIVAS'
  | 'CLOACAS'
  | 'GAS_ENVASADO'
  | 'SISTEMA_BIODIGESTOR';
type IndiceAjuste = 'IPC' | 'ICL' | null;
type PunitorioFrecuencia = 'DIA' | 'SEMANA' | 'MES' | 'UNICO' | null;
type PunitorioTipo = 'PORCENTAJE' | 'MONTO_FIJO' | null;
type EstadoVenta = 'PUBLICADA' | 'RESERVADA' | 'VENDIDA' | 'VENDIDA_POR_TERCEROS' | 'PAUSADA';

interface Inquilino {
  numero: number;
  nombre: string;
  telefono: string | null;
  email: string | null;
}
interface Propietario {
  nombre: string;
  telefono: string | null;
  email: string | null;
}
interface HistorialAumento {
  id: string;
  fecha: string;
  monto: string | number;
}
interface Interesado {
  etapa: string;
}
interface Venta {
  precio: string | number;
  moneda: 'ARS' | 'USD';
  estado: EstadoVenta;
  publicada: boolean;
  senaRecibida: string | number | null;
  cierreEstimado: string | null;
  interesados: Interesado[];
}
interface Documento {
  id: string;
  nombre: string;
  url: string;
  tamanioBytes: number;
  subidoEn: string;
}
interface PropiedadFicha {
  id: string;
  nombre: string;
  direccion: string;
  modalidad: Modalidad;
  tipo: string;
  ambientes: number | null;
  dormitorios: number | null;
  banos: number | null;
  cochera: boolean;
  superficieM2: string | number | null;
  superficieCubierta: string | number | null;
  descripcion: string | null;
  caracterEspecial: boolean;
  serviciosHabilitados: ServicioFacturable[];
  obrasSanitariasUsuario: string | null;
  obrasSanitariasNumeroCuenta: string | null;
  camuzziNumeroCuenta: string | null;
  retributivasNumeroCuenta: string | null;
  fotos: FotoPropiedadItem[];
  montoAlquilerVigente: string | number | null;
  alquilerPublicado: boolean;
  honorariosTipo: TipoHonorarios;
  honorariosPorcentaje: string | number | null;
  honorariosAdministracion: boolean;
  honorariosAdministracionPorcentaje: string | number | null;
  indice: IndiceAjuste;
  frecuenciaAumentoMeses: number | null;
  contratoInicio: string | null;
  contratoFin: string | null;
  punitorioFrecuencia: PunitorioFrecuencia;
  punitorioTipo: PunitorioTipo;
  punitorioValor: string | number | null;
  designado: { nombre: string } | null;
  propietario: Propietario | null;
  inquilino: Inquilino | null;
  historialAumentos: HistorialAumento[];
  venta: Venta | null;
  documentos: Documento[];
}
interface RentaVigente {
  monto: string | number | null;
  proximoAumento: string | null;
}
interface Pago {
  id: string;
  mes: string;
  monto: string | number;
  medio: string;
}
interface Gasto {
  id: string;
  descripcion: string;
  monto: string | number;
  fecha: string;
  categoria: string;
  destino: 'PROPIETARIO' | 'INQUILINO' | 'INMOBILIARIA';
  incidenciaId: string | null;
}
interface Incidencia {
  id: string;
  titulo: string;
  rubro: string;
  estado: 'ABIERTA' | 'EN_CURSO' | 'RESUELTA';
  prioridad: 'BAJA' | 'MEDIA' | 'ALTA';
  costo: string | number | null;
  proveedor: { nombre: string } | null;
  fechaApertura: string;
  fechaCierre: string | null;
}
interface Configuracion {
  ipc: string;
  icl: string;
  honorariosDefaultPorcentaje: string;
  dolarReferencia: string;
  diasAnticipacionAumento: number;
  empresaNombre: string;
  empresaDireccion: string;
  empresaContacto: string;
  publicoMatricula: string;
  facturaWhatsappMensaje: string;
}
interface FacturaItem {
  id: string;
  descripcion: string;
  monto: string | number;
  numeroLiquidacion: string | null;
}
interface Factura {
  numero: number;
  total: string | number;
  items: FacturaItem[];
}
interface Recibo {
  numero: number;
  montoFacturado: string | number;
  montoCobrado: string | number;
  ajusteSobreFacturado: string | number | null;
  items: FacturaItem[];
}

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

// Datos fijos de cuenta de algunos servicios, reflejados automáticamente en
// la factura (ver comentario en schema.prisma) — solo se muestran cuando el
// checkbox del servicio correspondiente está tildado.
function ServiciosCuentaInputs({
  servicios,
  obrasSanitariasUsuario,
  setObrasSanitariasUsuario,
  obrasSanitariasNumeroCuenta,
  setObrasSanitariasNumeroCuenta,
  camuzziNumeroCuenta,
  setCamuzziNumeroCuenta,
  retributivasNumeroCuenta,
  setRetributivasNumeroCuenta,
}: {
  servicios: ServicioFacturable[];
  obrasSanitariasUsuario: string;
  setObrasSanitariasUsuario: (v: string) => void;
  obrasSanitariasNumeroCuenta: string;
  setObrasSanitariasNumeroCuenta: (v: string) => void;
  camuzziNumeroCuenta: string;
  setCamuzziNumeroCuenta: (v: string) => void;
  retributivasNumeroCuenta: string;
  setRetributivasNumeroCuenta: (v: string) => void;
}) {
  const muestraAgua = servicios.includes('OBRAS_SANITARIAS');
  const muestraGas = servicios.includes('CAMUZZI');
  const muestraRetributivas = servicios.includes('RETRIBUTIVAS');
  if (!muestraAgua && !muestraGas && !muestraRetributivas) return null;
  return (
    <div className="formgrid" style={{ marginBottom: 4 }}>
      {muestraAgua && (
        <>
          <div className="fg" style={{ minWidth: 0 }}>
            <label>Agua — Usuario</label>
            <input value={obrasSanitariasUsuario} onChange={(e) => setObrasSanitariasUsuario(e.target.value)} placeholder="Opcional" />
          </div>
          <div className="fg" style={{ minWidth: 0 }}>
            <label>Agua — N° de cuenta</label>
            <input
              value={obrasSanitariasNumeroCuenta}
              onChange={(e) => setObrasSanitariasNumeroCuenta(e.target.value)}
              placeholder="Opcional"
            />
          </div>
        </>
      )}
      {muestraGas && (
        <div className="fg" style={{ minWidth: 0 }}>
          <label>Gas — N° de cuenta</label>
          <input value={camuzziNumeroCuenta} onChange={(e) => setCamuzziNumeroCuenta(e.target.value)} placeholder="Opcional" />
        </div>
      )}
      {muestraRetributivas && (
        <div className="fg" style={{ minWidth: 0 }}>
          <label>Retributivas — N° de cuenta</label>
          <input
            value={retributivasNumeroCuenta}
            onChange={(e) => setRetributivasNumeroCuenta(e.target.value)}
            placeholder="Opcional"
          />
        </div>
      )}
    </div>
  );
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
const FREQ_LABEL: Record<number, string> = { 1: 'MENSUAL', 3: 'TRIMESTRAL', 6: 'SEMESTRAL', 12: 'ANUAL' };
const PUNIT_FREQ_LABEL: Record<string, string> = { DIA: 'POR DÍA', SEMANA: 'POR SEMANA', MES: 'POR MES', UNICO: 'ÚNICO' };
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
const DESTINO_LABEL: Record<Gasto['destino'], string> = {
  PROPIETARIO: 'AL PROPIETARIO',
  INQUILINO: 'AL INQUILINO',
  INMOBILIARIA: 'A LA INMOBILIARIA',
};
const ESTADO_INC_LABEL: Record<Incidencia['estado'], string> = { ABIERTA: 'Abierta', EN_CURSO: 'En curso', RESUELTA: 'Resuelta' };
const ESTADO_INC_CLASE: Record<Incidencia['estado'], string> = { ABIERTA: 'abierta', EN_CURSO: 'encurso', RESUELTA: 'resuelta' };

function fmtKB(bytes: number) {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function PropiedadFichaDrawer({ propiedadId, onClose }: { propiedadId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [montoNuevo, setMontoNuevo] = useState('');
  const [calcAbierto, setCalcAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [subiendoDoc, setSubiendoDoc] = useState(false);
  const [gastoModal, setGastoModal] = useState<'new' | Gasto | null>(null);
  const [facturaModal, setFacturaModal] = useState(false);
  const [reciboModal, setReciboModal] = useState(false);
  const [datosModal, setDatosModal] = useState(false);
  const [fotosModal, setFotosModal] = useState(false);
  const [editarInquilinoModal, setEditarInquilinoModal] = useState(false);

  const propiedad = useQuery({
    queryKey: ['propiedades', propiedadId],
    queryFn: () => api.get<PropiedadFicha>(`/propiedades/${propiedadId}`),
  });
  const p = propiedad.data;
  const esAlquiler = p?.modalidad === 'ALQUILER';

  const rentaVigente = useQuery({
    queryKey: ['renta-vigente', propiedadId],
    queryFn: () => api.get<RentaVigente>(`/propiedades/${propiedadId}/renta-vigente`),
    enabled: esAlquiler,
  });
  const pagos = useQuery({
    queryKey: ['cobros', 'pagos', propiedadId],
    queryFn: () => api.get<Pago[]>(`/cobros/propiedades/${propiedadId}/pagos`),
    enabled: esAlquiler,
  });
  const gastos = useQuery({
    queryKey: ['gastos', propiedadId],
    queryFn: () => api.get<Gasto[]>(`/gastos?propiedadId=${propiedadId}`),
    enabled: esAlquiler,
  });
  const incidencias = useQuery({
    queryKey: ['incidencias', propiedadId],
    queryFn: () => api.get<Incidencia[]>(`/incidencias?propiedadId=${propiedadId}`),
  });
  const configuracion = useQuery({
    queryKey: ['configuracion'],
    queryFn: () => api.get<Configuracion>('/configuracion'),
  });

  function invalidarTodo() {
    qc.invalidateQueries({ queryKey: ['propiedades'] });
    qc.invalidateQueries({ queryKey: ['cobros'] });
    qc.invalidateQueries({ queryKey: ['caja'] });
    qc.invalidateQueries({ queryKey: ['avisos'] });
    qc.invalidateQueries({ queryKey: ['renta-vigente', propiedadId] });
  }

  const eliminarGasto = useMutation({
    mutationFn: (gastoId: string) => api.delete(`/gastos/${gastoId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gastos', propiedadId] });
      qc.invalidateQueries({ queryKey: ['caja'] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo eliminar el gasto.'),
  });

  function confirmarEliminarGasto(g: Gasto) {
    if (window.confirm(`¿Eliminar el gasto "${g.descripcion}"? Se borra también el egreso correspondiente en Caja.`)) {
      eliminarGasto.mutate(g.id);
    }
  }

  const aplicarAumento = useMutation({
    mutationFn: (vars: { fecha: string; monto: number }) => api.post(`/propiedades/${propiedadId}/aumentos`, vars),
    onSuccess: () => {
      setMontoNuevo('');
      setCalcAbierto(false);
      invalidarTodo();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo aplicar el aumento.'),
  });

  const eliminarPropiedad = useMutation({
    mutationFn: () => api.delete(`/propiedades/${propiedadId}`),
    // No usa invalidarTodo() ni toca ['propiedades', propiedadId] /
    // ['renta-vigente', propiedadId] de ninguna forma (ni invalidate ni
    // remove): esta propia ficha todavía está montada y observando esas dos
    // queries en este mismo instante, así que CUALQUIER toque al cache de
    // esas keys (invalidar o directamente sacarlas) hace que React Query
    // les dispare un refetch inmediato — contra una propiedad que ya no
    // existe, esas dos pegan `findUniqueOrThrow` y devuelven 500 en vez de
    // simplemente no hacer nada. Al no tocarlas, no hay refetch; `onClose()`
    // desmonta el drawer y ahí se dejan de observar solas.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['propiedades'], exact: true });
      qc.invalidateQueries({ queryKey: ['cobros'] });
      qc.invalidateQueries({ queryKey: ['caja'] });
      qc.invalidateQueries({ queryKey: ['avisos'] });
      qc.invalidateQueries({ queryKey: ['ventas'] });
      qc.invalidateQueries({ queryKey: ['carteles'] });
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo eliminar la propiedad.'),
  });

  // Marca la propiedad como vacante otra vez — no borra el historial de
  // pagos/facturas del inquilino, solo la relación 1:1 vigente
  // (`removeInquilino`, ya existía en el backend sin usarse desde ningún
  // lado). Una vez vacante, si "Publicada en la web" sigue en true, vuelve
  // a aparecer en la landing pública.
  const quitarInquilino = useMutation({
    mutationFn: () => api.delete(`/propiedades/${propiedadId}/inquilino`),
    onSuccess: invalidarTodo,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo quitar el inquilino.'),
  });

  function confirmarQuitarInquilino() {
    if (window.confirm('¿Marcar esta propiedad como vacante? Se quita el inquilino asignado — no se borra su historial de pagos.')) {
      quitarInquilino.mutate();
    }
  }

  // Toggle inmediato (sin botón "Guardar" aparte): controla si esta
  // propiedad de alquiler vacante se muestra en la landing pública o
  // queda pausada — mismo concepto que "Mostrar en la página web" para
  // Venta, pero como campo propio en Propiedad (no hay ficha de venta
  // para alquiler).
  const togglePublicadoAlquiler = useMutation({
    mutationFn: (checked: boolean) => api.patch(`/propiedades/${propiedadId}`, { alquilerPublicado: checked }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['propiedades'] }),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo actualizar la publicación en la web.'),
  });

  const eliminarDocumento = useMutation({
    mutationFn: (documentoId: string) => api.delete(`/propiedades/${propiedadId}/documentos/${documentoId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['propiedades'] }),
    onError: (err) => setDocError(err instanceof ApiError ? err.message : 'No se pudo eliminar el documento.'),
  });

  async function subirDocumento(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setDocError(null);
    setSubiendoDoc(true);
    try {
      const form = new FormData();
      form.append('archivo', file);
      await api.upload(`/propiedades/${propiedadId}/documentos`, form);
      qc.invalidateQueries({ queryKey: ['propiedades'] });
    } catch (err) {
      setDocError(err instanceof ApiError ? err.message : 'No se pudo subir el documento.');
    } finally {
      setSubiendoDoc(false);
    }
  }

  function confirmarEliminarPropiedad() {
    if (!p) return;
    if (window.confirm(`¿Eliminar definitivamente "${p.nombre}"? Esta acción no se puede deshacer.`)) {
      eliminarPropiedad.mutate();
    }
  }

  // Cuándo mostrar "Alerta Aumento": próximo aumento dentro de la ventana de
  // días de Configuración (mismo criterio que Avisos, §2.10).
  const cfg = configuracion.data;
  const proximoAumento = rentaVigente.data?.proximoAumento ?? null;
  const diasParaAumento = proximoAumento
    ? Math.ceil((new Date(proximoAumento).getTime() - Date.now()) / 86400000)
    : null;
  const aumentoInminente = diasParaAumento != null && cfg && diasParaAumento <= cfg.diasAnticipacionAumento;
  const vencido = p?.contratoFin ? new Date(p.contratoFin) < new Date() : false;

  const montoVigente = Number(rentaVigente.data?.monto ?? p?.montoAlquilerVigente ?? 0);
  const indiceValor = cfg ? Number(p?.indice === 'ICL' ? cfg.icl : cfg.ipc) : 0;
  const sugerido = montoVigente > 0 && indiceValor > 0 ? Math.round(montoVigente * (1 + indiceValor / 100) * 100) / 100 : null;

  function confirmarAumento() {
    const nuevo = Number(montoNuevo);
    if (!nuevo || nuevo <= 0) return;
    if (!window.confirm(`Aplicar aumento: ${formatMoney(montoVigente)} → ${formatMoney(nuevo)}?`)) return;
    const fecha = aumentoInminente && proximoAumento ? proximoAumento.slice(0, 10) : new Date().toISOString().slice(0, 10);
    aplicarAumento.mutate({ fecha, monto: nuevo });
  }

  const historial = p?.historialAumentos ?? [];
  const montoInicial = historial.length ? historial[historial.length - 1].monto : null;
  const v = p?.venta ?? null;
  const dolarReferencia = cfg ? Number(cfg.dolarReferencia) : 0;
  const precioVentaArs = v ? (v.moneda === 'USD' ? Number(v.precio) * dolarReferencia : Number(v.precio)) : 0;
  const honorPct = cfg ? Number(cfg.honorariosDefaultPorcentaje) : 0;

  return (
    <>
      <div className="overlay on" onClick={onClose}></div>
      <div className="drawer on">
        {propiedad.isLoading || !p ? (
          <div className="dhead">
            <div>
              <h2>Cargando…</h2>
            </div>
            <button className="dclose" onClick={onClose}>
              ✕
            </button>
          </div>
        ) : (
          <>
            <div className="dhead">
              <div>
                <h2>{p.nombre}</h2>
                <div className="sub">PARA {p.modalidad === 'VENTA' ? 'VENTA' : 'ALQUILER'}</div>
              </div>
              {aumentoInminente && <span className="badge alerta">Alerta Aumento</span>}
              {vencido && <span className="badge vencido">Vencido</span>}
              <button className="btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setDatosModal(true)}>
                ✎ Editar datos
              </button>
              <button className="btn-sm" onClick={() => setFotosModal(true)}>
                🖼 Fotos ({p.fotos.length})
              </button>
              <button className="dclose" onClick={onClose}>
                ✕
              </button>
            </div>
            {error && (
              <div className="errstate" style={{ margin: '0 32px 0' }}>
                {error}
              </div>
            )}
            <div className="dbody">
              <div>
                <div className="dsec">
                  <h5>INFORMACIÓN DEL CONTRATO</h5>
                  <div className="infocard">
                    <div className="f">
                      <b>Monto inicial</b>
                      <span className="big">{montoInicial != null ? formatMoney(montoInicial) : '—'}</span>
                    </div>
                    <div className="f">
                      <b>Monto actual</b>
                      <span className="big">{montoVigente ? formatMoney(montoVigente) : '—'}</span>
                    </div>
                    <div className="f">
                      <b>Inicio de contrato</b>
                      <span>{p.contratoInicio ? formatDate(p.contratoInicio) : '—'}</span>
                    </div>
                    <div className="f">
                      <b>Índice</b>
                      <span>{esAlquiler ? p.indice ?? '—' : '—'}</span>
                    </div>
                    <div className="f">
                      <b>Fin de contrato</b>
                      <span>{p.contratoFin ? formatDate(p.contratoFin) : '—'}</span>
                    </div>
                    <div className="f">
                      <b>Frecuencia de ajuste</b>
                      <span>{esAlquiler && p.frecuenciaAumentoMeses ? FREQ_LABEL[p.frecuenciaAumentoMeses] ?? `${p.frecuenciaAumentoMeses} MESES` : '—'}</span>
                    </div>
                    <div
                      className="f"
                      style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border2)', paddingTop: 14, marginTop: 2 }}
                    >
                      <b style={{ marginBottom: 0 }}>Próximo aumento</b>
                      <span className="big" style={aumentoInminente ? { color: 'var(--orange)' } : undefined}>
                        {proximoAumento ? formatDate(proximoAumento) : '—'}
                      </span>
                    </div>
                    {p.punitorioValor != null && Number(p.punitorioValor) > 0 && (
                      <div className="f" style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <b style={{ marginBottom: 0 }}>Punitorio por mora</b>
                        <span>
                          {p.punitorioTipo === 'PORCENTAJE' ? `${p.punitorioValor}%` : formatMoney(p.punitorioValor)}{' '}
                          {p.punitorioFrecuencia ? PUNIT_FREQ_LABEL[p.punitorioFrecuencia] : ''}
                        </span>
                      </div>
                    )}
                    {p.honorariosAdministracion && (
                      <div className="f" style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <b style={{ marginBottom: 0 }}>Honorarios de administración</b>
                        <span>{resolverPorcentajeHonorariosAdministracion(p)}%</span>
                      </div>
                    )}
                    {p.designado && (
                      <div className="f" style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <b style={{ marginBottom: 0 }}>La muestra</b>
                        <span>{p.designado.nombre}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="dsec" style={{ marginTop: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <h5>INQUILINO</h5>
                    {esAlquiler && (
                      <label className="chk" style={{ marginBottom: 10 }}>
                        <input
                          type="checkbox"
                          checked={p.alquilerPublicado}
                          disabled={togglePublicadoAlquiler.isPending}
                          onChange={(e) => togglePublicadoAlquiler.mutate(e.target.checked)}
                        />
                        <span>Publicada en la web</span>
                      </label>
                    )}
                    {p.inquilino ? (
                      <>
                        <div className="contactline">
                          👤 <b>{p.inquilino.nombre}</b>
                        </div>
                        {p.inquilino.telefono && <div className="contactline">✆ {p.inquilino.telefono}</div>}
                        {p.inquilino.email && (
                          <div className="contactline">
                            ✉ <a href={`mailto:${p.inquilino.email}`}>{p.inquilino.email}</a>
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                          <button className="btn-invoice" style={{ marginTop: 0, flex: 1 }} onClick={() => setFacturaModal(true)}>
                            📄 Emitir factura
                          </button>
                          <button className="btn-invoice" style={{ marginTop: 0, flex: 1 }} onClick={() => setReciboModal(true)}>
                            🧾 Emitir recibo
                          </button>
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <button className="btn-sm" style={{ flex: 1 }} onClick={() => setEditarInquilinoModal(true)}>
                            ✎ Editar datos
                          </button>
                          <button
                            className="btn-sm ghostred"
                            style={{ flex: 1 }}
                            disabled={quitarInquilino.isPending}
                            onClick={confirmarQuitarInquilino}
                          >
                            ✕ Marcar como vacante
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="contactline" style={{ color: 'var(--muted)' }}>
                        Sin inquilino
                      </div>
                    )}
                  </div>
                  <div>
                    <h5>PROPIETARIO</h5>
                    {p.propietario ? (
                      <>
                        <div className="contactline">
                          👤 <b>{p.propietario.nombre}</b>
                        </div>
                        {p.propietario.telefono && <div className="contactline">✆ {p.propietario.telefono}</div>}
                        {p.propietario.email && (
                          <div className="contactline">
                            ✉ <a href={`mailto:${p.propietario.email}`}>{p.propietario.email}</a>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="contactline" style={{ color: 'var(--muted)' }}>
                        No especificado
                      </div>
                    )}
                  </div>
                </div>

                <div className="dsec" style={{ marginTop: 22 }}>
                  <h5>HISTORIAL DE AUMENTOS</h5>
                  <div className="hist">
                    {historial.length ? (
                      historial.map((h) => (
                        <div className="row" key={h.id}>
                          <span>{formatDate(h.fecha)}</span>
                          <span>{formatMoney(h.monto)}</span>
                        </div>
                      ))
                    ) : (
                      <div className="row">
                        <span style={{ color: 'var(--muted)' }}>Sin registros</span>
                        <span></span>
                      </div>
                    )}
                  </div>
                </div>

                {esAlquiler && (
                  <div className="dsec" style={{ marginTop: 22 }}>
                    <h5>ÚLTIMOS COBROS</h5>
                    <div className="hist">
                      {pagos.data?.length ? (
                        pagos.data.map((pg) => (
                          <div className="row" key={pg.id}>
                            <span>
                              {mesLabel(pg.mes.slice(0, 7))} · {pg.medio}
                            </span>
                            <span>{formatMoney(pg.monto)}</span>
                          </div>
                        ))
                      ) : (
                        <div className="row">
                          <span style={{ color: 'var(--muted)' }}>Sin cobros registrados</span>
                          <span></span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {esAlquiler && (
                  <div className="dsec" style={{ marginTop: 22 }}>
                    <h5 style={{ display: 'flex', alignItems: 'center' }}>
                      GASTOS IMPUTADOS
                      <button className="btn-sm" style={{ marginLeft: 'auto', padding: '4px 10px' }} onClick={() => setGastoModal('new')}>
                        + Cargar gasto
                      </button>
                    </h5>
                    <div className="hist">
                      {gastos.data?.length ? (
                        gastos.data.map((g) => (
                          <div className="row" key={g.id} style={{ alignItems: 'center', gap: 12 }}>
                            <span style={{ minWidth: 0 }}>
                              <span style={{ display: 'block', color: 'var(--ink)', fontWeight: 600 }}>{g.descripcion}</span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, color: 'var(--muted)', fontSize: 11 }}>
                                {formatDate(g.fecha)}
                                <span className="gastotag">{g.categoria}</span>
                                <span className="gastotag">{DESTINO_LABEL[g.destino]}</span>
                              </span>
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
                              <span style={{ color: 'var(--red)' }}>− {formatMoney(g.monto)}</span>
                              {g.incidenciaId ? (
                                <span style={{ fontSize: 10.5, color: 'var(--muted)' }} title="Generado al resolver una incidencia con costo — se edita desde Incidencias y Proveedores">
                                  desde Incidencias
                                </span>
                              ) : (
                                <>
                                  <button
                                    className="btn-sm"
                                    style={{ padding: '2px 8px' }}
                                    title="Editar gasto"
                                    onClick={() => setGastoModal(g)}
                                  >
                                    ✎
                                  </button>
                                  <button
                                    className="btn-sm ghostred"
                                    style={{ padding: '2px 8px' }}
                                    title="Eliminar gasto"
                                    onClick={() => confirmarEliminarGasto(g)}
                                  >
                                    ✕
                                  </button>
                                </>
                              )}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="row">
                          <span style={{ color: 'var(--muted)' }}>Sin gastos cargados</span>
                          <span></span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div>
                {esAlquiler ? (
                  <div className="calc">
                    <h4>🧮 CALCULADORA DE AUMENTO</h4>
                    <p>Calculá la actualización del alquiler con la calculadora de Arquiler y después registrá el nuevo monto en el sistema.</p>
                    {!calcAbierto ? (
                      <button className="btn-light" style={{ width: '100%' }} onClick={() => setCalcAbierto(true)}>
                        INICIAR ACTUALIZACIÓN
                      </button>
                    ) : (
                      <>
                        <div className="calcframe">
                          <iframe title="Calculadora de alquileres" src="https://arquiler.com/mini?theme=light&backgroundColor=ffffff" loading="lazy" />
                        </div>
                        {sugerido != null && (
                          <div className="result">Sugerido con el índice cargado en Configuración: {formatMoney(sugerido)}</div>
                        )}
                        <div className="fields" style={{ marginTop: sugerido != null ? 0 : 14 }}>
                          <div style={{ gridColumn: '1/-1' }}>
                            <label>Nuevo monto calculado ($)</label>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              placeholder="Copiá aquí el resultado de la calculadora"
                              value={montoNuevo}
                              onChange={(e) => setMontoNuevo(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="btnrow">
                          <button className="btn-light" disabled={aplicarAumento.isPending || !montoNuevo} onClick={confirmarAumento}>
                            APLICAR AUMENTO
                          </button>
                          <button className="btn-ghostd" onClick={() => setCalcAbierto(false)}>
                            Cancelar
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="dsec">
                    <h5>OPERACIÓN DE VENTA</h5>
                    <div className="infocard">
                      <div className="f">
                        <b>Precio de lista</b>
                        <span className="big">{v ? (v.moneda === 'USD' ? formatUsd(v.precio) : formatMoney(v.precio)) : '—'}</span>
                      </div>
                      <div className="f">
                        <b>Estado</b>
                        <span>{v ? <span className={`badge ${ESTADO_VENTA_CLASE[v.estado]}`}>{ESTADO_VENTA_LABEL[v.estado]}</span> : '—'}</span>
                      </div>
                      <div className="f">
                        <b>Comisión estimada</b>
                        <span>{v ? formatMoney((precioVentaArs * honorPct) / 100) : '—'}</span>
                      </div>
                      <div className="f">
                        <b>Seña recibida</b>
                        <span>{v?.senaRecibida ? formatUsd(v.senaRecibida) : '—'}</span>
                      </div>
                      <div className="f">
                        <b>Publicada</b>
                        <span>{v ? (v.publicada ? 'Sí' : 'No') : '—'}</span>
                      </div>
                      <div className="f">
                        <b>Cierre estimado</b>
                        <span>{v?.cierreEstimado ? formatDate(v.cierreEstimado) : '—'}</span>
                      </div>
                      <div className="f" style={{ gridColumn: '1/-1' }}>
                        <b>Interesados activos</b>
                        <span>{v ? v.interesados.filter((i) => i.etapa !== 'DESCARTADO').length : 0}</span>
                      </div>
                    </div>
                    <Link to="/ventas" className="btn-invoice" style={{ marginTop: 12, display: 'block', textAlign: 'center' }}>
                      Ver en Ventas y Carteles
                    </Link>
                  </div>
                )}

                <div className="dsec" style={{ marginTop: 22 }}>
                  <h5>DOCUMENTACIÓN</h5>
                  {docError && (
                    <div className="errstate" style={{ marginBottom: 10 }}>
                      {docError}
                    </div>
                  )}
                  <div className="doclist">
                    {p.documentos.map((d) => (
                      <div className="docitem" key={d.id}>
                        <span style={{ fontSize: 17 }}>📄</span>
                        <div className="nm">
                          {d.nombre}
                          <div className="meta">
                            {formatDate(d.subidoEn)} · {fmtKB(d.tamanioBytes)}
                          </div>
                        </div>
                        <div className="acts">
                          <a className="btn-sm" href={`${BASE_URL}${d.url}`} target="_blank" rel="noopener noreferrer">
                            Ver
                          </a>
                          <button className="btn-sm ghostred" onClick={() => eliminarDocumento.mutate(d.id)} title="Eliminar">
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                    <label className="dropzone">
                      {subiendoDoc ? 'Subiendo…' : p.documentos.length ? '+ Adjuntar otro documento' : '+ Adjuntar contrato'}
                      <small>Arrastrá un PDF acá o hacé clic para elegirlo (máx. 15 MB)</small>
                      <input
                        type="file"
                        accept="application/pdf"
                        style={{ display: 'none' }}
                        disabled={subiendoDoc}
                        onChange={(e) => {
                          subirDocumento(e.target.files);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div className="dsec" style={{ marginTop: 22 }}>
                  <h5>INCIDENCIAS DE LA PROPIEDAD</h5>
                  <div className="doclist">
                    {(incidencias.data ?? []).map((i) => (
                      <div className="docitem" key={i.id}>
                        <div className="nm">
                          {i.titulo}
                          <div className="meta">
                            {ESTADO_INC_LABEL[i.estado]} · {i.proveedor ? i.proveedor.nombre : 'sin proveedor'}
                            {i.costo ? ` · ${formatMoney(i.costo)}` : ''}
                          </div>
                        </div>
                        <span className={`badge ${ESTADO_INC_CLASE[i.estado]}`}>{ESTADO_INC_LABEL[i.estado]}</span>
                      </div>
                    ))}
                    <Link to="/incidencias" className="dropzone" style={{ display: 'block' }}>
                      + Registrar una incidencia
                      <small>
                        {incidencias.data?.length
                          ? 'Un reclamo nuevo del inquilino o una reparación a coordinar'
                          : 'Esta propiedad no tiene reclamos ni reparaciones registradas'}
                      </small>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
            <div className="dfoot">
              <button className="btn-danger" disabled={eliminarPropiedad.isPending} onClick={confirmarEliminarPropiedad}>
                Eliminar propiedad
              </button>
            </div>
          </>
        )}
      </div>

      {gastoModal && p && (
        <NuevoGastoModal
          propiedadId={p.id}
          gasto={gastoModal === 'new' ? null : gastoModal}
          onClose={() => setGastoModal(null)}
          onSaved={() => {
            setGastoModal(null);
            qc.invalidateQueries({ queryKey: ['gastos', propiedadId] });
            qc.invalidateQueries({ queryKey: ['caja'] });
          }}
        />
      )}
      {facturaModal && p && (
        <FacturaModal
          propiedadId={p.id}
          propiedadNombre={p.nombre}
          inquilino={p.inquilino}
          honorariosAdministracionActual={p.honorariosAdministracion}
          honorariosAdministracionPorcentajeActual={p.honorariosAdministracionPorcentaje}
          onClose={() => setFacturaModal(false)}
        />
      )}
      {reciboModal && p && (
        <ReciboModal
          propiedadId={p.id}
          propiedadNombre={p.nombre}
          onClose={() => setReciboModal(false)}
          onEmitido={() => qc.invalidateQueries({ queryKey: ['caja'] })}
        />
      )}
      {datosModal && p && (
        <EditarDatosGeneralesModal
          propiedad={p}
          onClose={() => setDatosModal(false)}
          onSaved={() => {
            setDatosModal(false);
            qc.invalidateQueries({ queryKey: ['propiedades'] });
          }}
        />
      )}
      {editarInquilinoModal && p?.inquilino && (
        <EditarInquilinoModal
          propiedadId={p.id}
          inquilino={p.inquilino}
          onClose={() => setEditarInquilinoModal(false)}
          onSaved={() => {
            setEditarInquilinoModal(false);
            invalidarTodo();
          }}
        />
      )}
      {fotosModal && p && (
        <Modal open onClose={() => setFotosModal(false)} title={`Fotos — ${p.nombre}`} width={520}>
          <FotosPropiedad
            propiedadId={p.id}
            fotos={p.fotos}
            mostrarPortada={p.caracterEspecial}
            onChange={() => qc.invalidateQueries({ queryKey: ['propiedades', propiedadId] })}
          />
          <div className="btnrow">
            <button className="btn-dark" onClick={() => setFotosModal(false)}>
              Cerrar
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function EditarDatosGeneralesModal({
  propiedad,
  onClose,
  onSaved,
}: {
  propiedad: PropiedadFicha;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nombre, setNombre] = useState(propiedad.nombre);
  const [direccion, setDireccion] = useState(propiedad.direccion);
  const [tipo, setTipo] = useState(propiedad.tipo);
  const [ambientes, setAmbientes] = useState(String(propiedad.ambientes ?? ''));
  const [dormitorios, setDormitorios] = useState(String(propiedad.dormitorios ?? ''));
  const [banos, setBanos] = useState(String(propiedad.banos ?? ''));
  const [cochera, setCochera] = useState(propiedad.cochera);
  const [caracterEspecial, setCaracterEspecial] = useState(propiedad.caracterEspecial);
  const [superficieM2, setSuperficieM2] = useState(String(propiedad.superficieM2 ?? ''));
  const [superficieCubierta, setSuperficieCubierta] = useState(String(propiedad.superficieCubierta ?? ''));
  const [descripcion, setDescripcion] = useState(propiedad.descripcion ?? '');
  const [servicios, setServicios] = useState<ServicioFacturable[]>(propiedad.serviciosHabilitados ?? []);
  const [obrasSanitariasUsuario, setObrasSanitariasUsuario] = useState(propiedad.obrasSanitariasUsuario ?? '');
  const [obrasSanitariasNumeroCuenta, setObrasSanitariasNumeroCuenta] = useState(propiedad.obrasSanitariasNumeroCuenta ?? '');
  const [camuzziNumeroCuenta, setCamuzziNumeroCuenta] = useState(propiedad.camuzziNumeroCuenta ?? '');
  const [retributivasNumeroCuenta, setRetributivasNumeroCuenta] = useState(propiedad.retributivasNumeroCuenta ?? '');
  const [punitorioTipo, setPunitorioTipo] = useState<'' | 'MONTO_FIJO' | 'PORCENTAJE'>(propiedad.punitorioTipo ?? '');
  const [punitorioValor, setPunitorioValor] = useState(propiedad.punitorioValor != null ? String(propiedad.punitorioValor) : '');
  const [punitorioFrecuencia, setPunitorioFrecuencia] = useState<'DIA' | 'SEMANA' | 'MES' | 'UNICO'>(
    propiedad.punitorioFrecuencia ?? 'DIA',
  );
  const [error, setError] = useState<string | null>(null);

  function toggleServicio(key: ServicioFacturable) {
    setServicios((prev) => (prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]));
  }

  const guardar = useMutation({
    mutationFn: () =>
      api.patch(`/propiedades/${propiedad.id}`, {
        nombre,
        direccion,
        tipo,
        ambientes: ambientes ? Number(ambientes) : undefined,
        dormitorios: dormitorios ? Number(dormitorios) : undefined,
        banos: banos ? Number(banos) : undefined,
        cochera,
        superficieM2: superficieM2 ? Number(superficieM2) : undefined,
        superficieCubierta: superficieCubierta ? Number(superficieCubierta) : undefined,
        descripcion: descripcion.trim() || undefined,
        caracterEspecial,
        serviciosHabilitados: propiedad.modalidad === 'ALQUILER' ? servicios : undefined,
        obrasSanitariasUsuario:
          propiedad.modalidad === 'ALQUILER' && servicios.includes('OBRAS_SANITARIAS')
            ? obrasSanitariasUsuario.trim() || null
            : undefined,
        obrasSanitariasNumeroCuenta:
          propiedad.modalidad === 'ALQUILER' && servicios.includes('OBRAS_SANITARIAS')
            ? obrasSanitariasNumeroCuenta.trim() || null
            : undefined,
        camuzziNumeroCuenta:
          propiedad.modalidad === 'ALQUILER' && servicios.includes('CAMUZZI') ? camuzziNumeroCuenta.trim() || null : undefined,
        retributivasNumeroCuenta:
          propiedad.modalidad === 'ALQUILER' && servicios.includes('RETRIBUTIVAS')
            ? retributivasNumeroCuenta.trim() || null
            : undefined,
        punitorioTipo: propiedad.modalidad === 'ALQUILER' ? punitorioTipo || null : undefined,
        punitorioValor: propiedad.modalidad === 'ALQUILER' && punitorioTipo && punitorioValor ? Number(punitorioValor) : null,
        punitorioFrecuencia: propiedad.modalidad === 'ALQUILER' && punitorioTipo ? punitorioFrecuencia : null,
      }),
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo guardar la propiedad.'),
  });

  return (
    <Modal open onClose={onClose} title={`Editar Datos — ${propiedad.nombre}`} width={460}>
      {error && <div className="errstate" style={{ marginBottom: 14 }}>{error}</div>}
      <div className="formgrid">
        <div className="fg full">
          <label>Nombre</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="fg full">
          <label>Dirección</label>
          <input value={direccion} onChange={(e) => setDireccion(e.target.value)} />
        </div>
        <div className="fg full">
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
          <label>Ambientes</label>
          <input type="number" min={0} value={ambientes} onChange={(e) => setAmbientes(e.target.value)} placeholder="Opcional" />
        </div>
        <div className="fg">
          <label>Dormitorios</label>
          <input type="number" min={0} value={dormitorios} onChange={(e) => setDormitorios(e.target.value)} placeholder="Opcional" />
        </div>
        <div className="fg">
          <label>Baños</label>
          <input type="number" min={0} value={banos} onChange={(e) => setBanos(e.target.value)} placeholder="Opcional" />
        </div>
        <div className="fg">
          <label>Superficie total (m²)</label>
          <input type="number" min={0} step="0.01" value={superficieM2} onChange={(e) => setSuperficieM2(e.target.value)} placeholder="Opcional" />
        </div>
        <div className="fg">
          <label>Superficie cubierta (m²)</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={superficieCubierta}
            onChange={(e) => setSuperficieCubierta(e.target.value)}
            placeholder="Opcional"
          />
        </div>
        <div className="fg" style={{ display: 'flex', alignItems: 'flex-end' }}>
          <label className="chk">
            <input type="checkbox" checked={cochera} onChange={(e) => setCochera(e.target.checked)} />
            <span>Tiene cochera</span>
          </label>
        </div>
        <div className="fg" style={{ display: 'flex', alignItems: 'flex-end' }}>
          <label className="chk">
            <input
              type="checkbox"
              checked={caracterEspecial}
              onChange={(e) => setCaracterEspecial(e.target.checked)}
            />
            <span>Carácter especial</span>
          </label>
        </div>
        <div className="fg full">
          <label>Descripción</label>
          <textarea rows={3} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Breve descripción del lugar (opcional)" />
        </div>
      </div>

      {propiedad.modalidad === 'ALQUILER' && (
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
          <ServiciosCuentaInputs
            servicios={servicios}
            obrasSanitariasUsuario={obrasSanitariasUsuario}
            setObrasSanitariasUsuario={setObrasSanitariasUsuario}
            obrasSanitariasNumeroCuenta={obrasSanitariasNumeroCuenta}
            setObrasSanitariasNumeroCuenta={setObrasSanitariasNumeroCuenta}
            camuzziNumeroCuenta={camuzziNumeroCuenta}
            setCamuzziNumeroCuenta={setCamuzziNumeroCuenta}
            retributivasNumeroCuenta={retributivasNumeroCuenta}
            setRetributivasNumeroCuenta={setRetributivasNumeroCuenta}
          />

          <div className="secttl">MORA POR ATRASO</div>
          <div className="formgrid" style={{ marginBottom: 4 }}>
            <div className="fg">
              <label>Tipo</label>
              <select value={punitorioTipo} onChange={(e) => setPunitorioTipo(e.target.value as typeof punitorioTipo)}>
                <option value="">— Sin mora —</option>
                <option value="MONTO_FIJO">Monto fijo</option>
                <option value="PORCENTAJE">Porcentaje del alquiler</option>
              </select>
            </div>
            {punitorioTipo && (
              <>
                <div className="fg">
                  <label>Valor</label>
                  <div className="suffix">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={punitorioValor}
                      onChange={(e) => setPunitorioValor(e.target.value)}
                    />
                    <span>{punitorioTipo === 'PORCENTAJE' ? '%' : '$'}</span>
                  </div>
                </div>
                <div className="fg">
                  <label>Se aplica por</label>
                  <select value={punitorioFrecuencia} onChange={(e) => setPunitorioFrecuencia(e.target.value as typeof punitorioFrecuencia)}>
                    <option value="DIA">Día de atraso</option>
                    <option value="SEMANA">Semana de atraso</option>
                    <option value="MES">Mes de atraso</option>
                    <option value="UNICO">Una sola vez</option>
                  </select>
                </div>
              </>
            )}
          </div>
        </>
      )}

      <div className="cfgnote">
        <i>△</i>
        <span>
          Ambientes, dormitorios, baños, superficie, cochera y descripción son los datos que se muestran en la ficha
          pública de la landing. "Carácter especial" además la incluye en el carrusel destacado del inicio.
        </span>
      </div>
      <div className="btnrow">
        <button className="btn-ghost" onClick={onClose}>
          Cancelar
        </button>
        <button className="btn-dark" disabled={guardar.isPending || !nombre.trim() || !direccion.trim()} onClick={() => guardar.mutate()}>
          Guardar
        </button>
      </div>
    </Modal>
  );
}

function EditarInquilinoModal({
  propiedadId,
  inquilino,
  onClose,
  onSaved,
}: {
  propiedadId: string;
  inquilino: Inquilino;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nombre, setNombre] = useState(inquilino.nombre);
  const [telefono, setTelefono] = useState(inquilino.telefono ?? '');
  const [email, setEmail] = useState(inquilino.email ?? '');
  const [error, setError] = useState<string | null>(null);

  // Mismo endpoint que usa "+ Agregar inquilino" (upsert por propiedadId) —
  // al ya existir un inquilino para esta propiedad, esto actualiza sus
  // datos en el lugar sin tocar su `numero` correlativo.
  const guardar = useMutation({
    mutationFn: () =>
      api.patch(`/propiedades/${propiedadId}/inquilino`, {
        nombre: nombre.trim(),
        telefono: telefono.trim() || undefined,
        email: email.trim() || undefined,
      }),
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo guardar el inquilino.'),
  });

  return (
    <Modal open onClose={onClose} title={`Editar Inquilino — N° ${inquilino.numero}`} width={420}>
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
      </div>
      <div className="btnrow">
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

function NuevoGastoModal({
  propiedadId,
  gasto,
  onClose,
  onSaved,
}: {
  propiedadId: string;
  gasto: Gasto | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const esEdicion = !!gasto;
  const [descripcion, setDescripcion] = useState(gasto?.descripcion ?? '');
  const [monto, setMonto] = useState(gasto ? String(gasto.monto) : '');
  const [categoria, setCategoria] = useState(gasto?.categoria ?? '');
  const [destino, setDestino] = useState<'PROPIETARIO' | 'INQUILINO'>(
    gasto?.destino === 'INQUILINO' ? 'INQUILINO' : 'PROPIETARIO',
  );
  const [fecha, setFecha] = useState(gasto ? gasto.fecha.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: () =>
      esEdicion
        ? api.patch(`/gastos/${gasto!.id}`, {
            descripcion,
            monto: Number(monto),
            fecha,
            categoria,
            destino,
          })
        : api.post('/gastos', {
            propiedadId,
            mes: fecha.slice(0, 7),
            descripcion,
            monto: Number(monto),
            fecha,
            categoria,
            destino,
          }),
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo guardar el gasto.'),
  });

  const eliminar = useMutation({
    mutationFn: () => api.delete(`/gastos/${gasto!.id}`),
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo eliminar el gasto.'),
  });

  function confirmarEliminar() {
    if (window.confirm('¿Eliminar este gasto? Se borra también el egreso correspondiente en Caja.')) {
      eliminar.mutate();
    }
  }

  const puedeGuardar = descripcion.trim() && monto && categoria.trim();

  return (
    <Modal open onClose={onClose} title={esEdicion ? 'Editar Gasto' : 'Cargar Gasto'} width={460}>
      {error && <div className="errstate" style={{ marginBottom: 14 }}>{error}</div>}
      <div className="formgrid">
        <div className="fg full">
          <label>Descripción</label>
          <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej: Reparación de bomba de agua" />
        </div>
        <div className="fg">
          <label>Monto</label>
          <input type="number" min={0} step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} />
        </div>
        <div className="fg">
          <label>Fecha</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div className="fg">
          <label>Categoría</label>
          <input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Ej: Plomería" />
        </div>
        <div className="fg">
          <label>¿A quién se le imputa?</label>
          <select value={destino} onChange={(e) => setDestino(e.target.value as 'PROPIETARIO' | 'INQUILINO')}>
            <option value="PROPIETARIO">Propietario</option>
            <option value="INQUILINO">Inquilino</option>
          </select>
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

interface ItemEditable {
  descripcion: string;
  monto: string;
  numeroLiquidacion: string;
}

function FacturaModal({
  propiedadId,
  propiedadNombre,
  inquilino,
  honorariosAdministracionActual,
  honorariosAdministracionPorcentajeActual,
  onClose,
}: {
  propiedadId: string;
  propiedadNombre: string;
  inquilino: Inquilino | null;
  honorariosAdministracionActual: boolean;
  honorariosAdministracionPorcentajeActual: number | string | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const mes = mesActualStr();

  // Mismo queryKey que ya usa el drawer padre (línea ~218): React Query
  // dedupea y sirve del caché, no dispara un segundo pedido de red.
  const configuracion = useQuery({
    queryKey: ['configuracion'],
    queryFn: () => api.get<Configuracion>('/configuracion'),
  });
  const cfg = configuracion.data;

  // Ítems predeterminados (§3.5: alquiler vigente + servicios habilitados,
  // precargados con lo último facturado + gastos trasladados + deuda
  // arrastrada) — se traen como punto de partida editable, no se emiten
  // directo: el usuario puede agregar/quitar líneas y cambiar montos antes
  // de confirmar.
  const predeterminados = useQuery({
    queryKey: ['items-predeterminados', propiedadId, mes],
    queryFn: () =>
      api.get<{ descripcion: string; monto: number; numeroLiquidacion?: string | null }[]>(
        `/facturacion/propiedades/${propiedadId}/items-predeterminados?mes=${mes}`,
      ),
  });

  const [items, setItems] = useState<ItemEditable[] | null>(null);
  // Número de factura a mano (opcional) — para cuando la inmobiliaria ya
  // lleva su propia numeración por fuera del sistema y quiere que la
  // factura emitida coincida con esa. Si se deja vacío, el backend asigna
  // el correlativo automático de Configuración (comportamiento de siempre).
  const [numeroFactura, setNumeroFactura] = useState('');
  const [honorariosAdministracion, setHonorariosAdministracion] = useState(honorariosAdministracionActual);
  const [honorariosAdministracionPorcentaje, setHonorariosAdministracionPorcentaje] = useState(
    honorariosAdministracionPorcentajeActual != null ? String(honorariosAdministracionPorcentajeActual) : '',
  );

  useEffect(() => {
    if (predeterminados.data && items === null) {
      setItems(
        predeterminados.data.map((it) => ({
          descripcion: it.descripcion,
          monto: String(it.monto),
          numeroLiquidacion: it.numeroLiquidacion ?? '',
        })),
      );
    }
    // Solo precarga la primera vez que llegan los predeterminados; después
    // el usuario es dueño del estado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [predeterminados.data]);

  // Honorarios de administración (§2.3, §5.5): se calculan sobre el
  // alquiler puro, no sobre el total facturado (que también incluye
  // expensas/servicios/deuda que la inmobiliaria solo intermedia) — mismo
  // criterio que liquidaciones.service.ts::generar(). Elegir el % acá lo
  // deja guardado en la propiedad para esta y las próximas liquidaciones.
  // Los honorarios profesionales (comisión) no aplican acá — son solo para
  // propiedades en venta.
  const montoAlquiler = Number(items?.find((it) => it.descripcion === 'Alquiler')?.monto ?? 0);

  const pctAdministracionResuelto = resolverPorcentajeHonorariosAdministracion({
    honorariosAdministracion,
    honorariosAdministracionPorcentaje: honorariosAdministracionPorcentaje || null,
  });
  const honorariosAdministracionPreview = Math.round(montoAlquiler * (pctAdministracionResuelto / 100) * 100) / 100;
  const honorariosAdministracionCambiaron =
    honorariosAdministracion !== honorariosAdministracionActual ||
    (honorariosAdministracion &&
      honorariosAdministracionPorcentaje !== String(honorariosAdministracionPorcentajeActual ?? ''));

  const emitir = useMutation({
    mutationFn: async () => {
      if (honorariosAdministracionCambiaron) {
        await api.patch(`/propiedades/${propiedadId}`, {
          honorariosAdministracion,
          honorariosAdministracionPorcentaje:
            honorariosAdministracion && honorariosAdministracionPorcentaje
              ? Number(honorariosAdministracionPorcentaje)
              : undefined,
        });
        qc.invalidateQueries({ queryKey: ['propiedades'] });
      }
      return api.post<Factura>(`/facturacion/propiedades/${propiedadId}/facturas`, {
        mes,
        numero: numeroFactura.trim() ? Number(numeroFactura) : undefined,
        items: (items ?? [])
          .filter((it) => it.descripcion.trim())
          .map((it) => ({
            descripcion: it.descripcion.trim(),
            monto: Number(it.monto) || 0,
            numeroLiquidacion: it.numeroLiquidacion.trim() || undefined,
          })),
      });
    },
  });

  const F = emitir.data;
  const comprobanteRef = useRef<HTMLDivElement>(null);
  const [enviandoWhatsapp, setEnviandoWhatsapp] = useState(false);

  async function enviarPorWhatsapp() {
    if (!comprobanteRef.current || !inquilino?.telefono || !F) return;
    setEnviandoWhatsapp(true);
    try {
      await descargarPdfComprobante(comprobanteRef.current, `Factura ${F.numero} - ${propiedadNombre}.pdf`);
      // Plantilla editable desde Configuración y Reportes (§ facturaWhatsappMensaje)
      // — con un default razonable por si todavía no se cargó nada ahí.
      const plantilla =
        cfg?.facturaWhatsappMensaje ||
        'Hola {nombre}, te comparto la Factura N° {numero} de {propiedad} correspondiente a {mes}. Te dejo el PDF descargado — adjuntalo acá mismo en el chat.';
      const texto = plantilla
        .split('{nombre}').join(inquilino.nombre)
        .split('{numero}').join(String(F.numero))
        .split('{propiedad}').join(propiedadNombre)
        .split('{mes}').join(mesLabel(mes));
      window.open(`https://wa.me/${inquilino.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`, '_blank');
    } finally {
      setEnviandoWhatsapp(false);
    }
  }

  const actualizarItem = (idx: number, campo: keyof ItemEditable, valor: string) => {
    setItems((prev) => prev && prev.map((it, i) => (i === idx ? { ...it, [campo]: valor } : it)));
  };
  const quitarItem = (idx: number) => {
    setItems((prev) => prev && prev.filter((_, i) => i !== idx));
  };
  const agregarItem = () => {
    setItems((prev) => [...(prev ?? []), { descripcion: '', monto: '0', numeroLiquidacion: '' }]);
  };

  const totalEditable = (items ?? []).reduce((acc, it) => acc + (Number(it.monto) || 0), 0);

  return (
    <Modal open onClose={onClose} title={`Factura — ${propiedadNombre}`} width={560}>
      {predeterminados.isPending && <div className="loadstate">Cargando ítems…</div>}
      {predeterminados.isError && <div className="errstate">No se pudieron cargar los ítems de la factura.</div>}
      {emitir.isError && (
        <div className="errstate">{emitir.error instanceof ApiError ? emitir.error.message : 'No se pudo emitir la factura.'}</div>
      )}

      {!F && items && (
        <>
          <div className="formgrid" style={{ marginBottom: 14 }}>
            <div className="fg">
              <label>N° de factura (opcional)</label>
              <input
                type="number"
                min={1}
                placeholder="Automático si se deja vacío"
                value={numeroFactura}
                onChange={(e) => setNumeroFactura(e.target.value)}
              />
            </div>
            <div className="fg">
              <label>Inquilino</label>
              <input value={inquilino ? `N° ${inquilino.numero} — ${inquilino.nombre}` : '—'} disabled />
            </div>
          </div>

          <div className="fg full" style={{ marginBottom: 4 }}>
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
            <>
              <div className="formgrid" style={{ marginBottom: 6 }}>
                <div className="fg">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    placeholder="%"
                    value={honorariosAdministracionPorcentaje}
                    onChange={(e) => setHonorariosAdministracionPorcentaje(e.target.value)}
                  />
                </div>
              </div>
              <div className="liqline" style={{ marginBottom: 14 }}>
                <span className="ld">
                  Honorarios de administración ({pctAdministracionResuelto}% de {formatMoney(montoAlquiler)})
                </span>
                <span className="lv">{formatMoney(honorariosAdministracionPreview)}</span>
              </div>
            </>
          )}

          <div className="itemlist">
            {items.map((it, idx) => (
              <div className="itemrow" key={idx}>
                <input
                  className="itemdesc"
                  value={it.descripcion}
                  onChange={(e) => actualizarItem(idx, 'descripcion', e.target.value)}
                  placeholder="Descripción"
                />
                <input
                  className="itemliq"
                  placeholder="Liq"
                  title="Número de liquidación"
                  value={it.numeroLiquidacion}
                  onChange={(e) => actualizarItem(idx, 'numeroLiquidacion', e.target.value.replace(/[^\d-]/g, ''))}
                />
                <input
                  className="itemmonto"
                  type="number"
                  step="0.01"
                  value={it.monto}
                  onChange={(e) => actualizarItem(idx, 'monto', e.target.value)}
                />
                <button className="btn-sm ghostred" onClick={() => quitarItem(idx)} title="Quitar ítem">
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button className="btn-sm" style={{ marginTop: 8 }} onClick={agregarItem}>
            + Agregar ítem
          </button>
          <div className="liqline tot" style={{ marginTop: 14 }}>
            <span className="ld">Total</span>
            <span className="lv">{formatMoney(totalEditable)}</span>
          </div>
          <div className="btnrow">
            <button className="btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button className="btn-dark" disabled={emitir.isPending || items.length === 0} onClick={() => emitir.mutate()}>
              Emitir factura
            </button>
          </div>
        </>
      )}

      {F && (
        <>
          <ComprobanteImpreso cfg={cfg} ref={comprobanteRef}>
            <div className="liqcard" style={{ boxShadow: 'none' }}>
              <div className="liqhead">
                <div>
                  <h4>Factura N° {F.numero}</h4>
                  <div className="lsub">{mesLabel(mes)}</div>
                </div>
                <span className="spacer"></span>
                <div className="lnet">
                  <b>TOTAL</b>
                  <span>{formatMoney(F.total)}</span>
                </div>
              </div>
              <div className="liqbody">
                {F.items.map((it) => (
                  <div className="liqline" key={it.id}>
                    <span className="ld">
                      {it.descripcion}
                      {it.numeroLiquidacion && <small style={{ color: 'var(--muted)' }}> · Liq N° {it.numeroLiquidacion}</small>}
                    </span>
                    <span className="lv">{formatMoney(it.monto)}</span>
                  </div>
                ))}
              </div>
            </div>
          </ComprobanteImpreso>
          <div className="btnrow noprint">
            <button className="btn-ghost" onClick={onClose}>
              Cerrar
            </button>
            {inquilino?.telefono && (
              <button className="btn-whatsapp" disabled={enviandoWhatsapp} onClick={enviarPorWhatsapp}>
                {enviandoWhatsapp ? 'Generando PDF…' : '📄 WhatsApp'}
              </button>
            )}
            <button className="btn-dark" onClick={() => window.print()}>
              ▤ Imprimir
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}


function ReciboModal({
  propiedadId,
  propiedadNombre,
  onClose,
  onEmitido,
}: {
  propiedadId: string;
  propiedadNombre: string;
  onClose: () => void;
  onEmitido: () => void;
}) {
  const mes = mesActualStr();
  // Mismo queryKey que ya usa el drawer padre: React Query dedupea y sirve
  // del caché, no dispara un segundo pedido de red.
  const configuracion = useQuery({
    queryKey: ['configuracion'],
    queryFn: () => api.get<Configuracion>('/configuracion'),
  });
  const cfg = configuracion.data;

  const generar = useMutation({
    mutationFn: () => api.post<Recibo>(`/facturacion/propiedades/${propiedadId}/recibos`, { mes }),
    onSuccess: onEmitido,
  });

  useEffect(() => {
    generar.mutate();
    // Se genera una sola vez al abrir el modal, no en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const R = generar.data;

  return (
    <Modal open onClose={onClose} title={`Recibo — ${propiedadNombre}`} width={520}>
      {generar.isPending && <div className="loadstate">Generando recibo…</div>}
      {generar.isError && (
        <div className="errstate">{generar.error instanceof ApiError ? generar.error.message : 'No se pudo emitir el recibo.'}</div>
      )}
      {R && (
        <>
          <ComprobanteImpreso cfg={cfg}>
            <div className="liqcard" style={{ boxShadow: 'none' }}>
              <div className="liqhead">
                <div>
                  <h4>Recibo N° {R.numero}</h4>
                  <div className="lsub">{mesLabel(mes)}</div>
                </div>
                <span className="spacer"></span>
                <div className="lnet">
                  <b>COBRADO</b>
                  <span>{formatMoney(R.montoCobrado)}</span>
                </div>
              </div>
              <div className="liqbody">
                {R.items.map((it) => (
                  <div className="liqline" key={it.id}>
                    <span className="ld">{it.descripcion}</span>
                    <span className="lv">{formatMoney(it.monto)}</span>
                  </div>
                ))}
              </div>
            </div>
          </ComprobanteImpreso>
          <div className="btnrow noprint">
            <button className="btn-ghost" onClick={onClose}>
              Cerrar
            </button>
            <button className="btn-dark" onClick={() => window.print()}>
              ▤ Imprimir
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
