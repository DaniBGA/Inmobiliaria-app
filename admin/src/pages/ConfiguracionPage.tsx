import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, BASE_URL } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { formatMoney, formatDate, mesActualStr, sumarMesesStr, mesLabel } from '../lib/format';
import { descargarCsv } from '../lib/csv';

interface Configuracion {
  honorariosDefaultPorcentaje: string | number;
  comisionVentaPorcentaje: string | number;
  ipc: string | number;
  icl: string | number;
  dolarReferencia: string | number;
  empresaNombre: string;
  empresaCuit: string;
  empresaDireccion: string;
  empresaContacto: string;
  publicoWhatsapp: string;
  publicoTelefono: string;
  publicoEmail: string;
  publicoInstagramUrl: string;
  publicoDireccion: string;
  publicoMatricula: string;
  publicoFotoNosotrosUrl: string;
  proximoNumeroFactura: number;
  proximoNumeroRecibo: number;
  proximoNumeroLiquidacion: number;
  diaVencimientoAlquiler: number;
  diasAnticipacionAumento: number;
  diasAnticipacionVencimiento: number;
  saldoInicialCaja: string | number;
}

interface IntegranteEquipo {
  id: string;
  nombre: string;
}

export function ConfiguracionPage() {
  const configuracion = useQuery({
    queryKey: ['configuracion'],
    queryFn: () => api.get<Configuracion>('/configuracion'),
  });
  const integrantes = useQuery({
    queryKey: ['integrantes-equipo'],
    queryFn: () => api.get<IntegranteEquipo[]>('/integrantes-equipo'),
  });

  return (
    <>
      <PageHeader title="Configuración y Reportes" />
      <main>
        {configuracion.isLoading ? (
          <div className="loadstate">Cargando…</div>
        ) : (
          <ConfiguracionForm data={configuracion.data!} integrantes={integrantes.data ?? []} />
        )}
        <ReportesSection />
      </main>
    </>
  );
}

function ConfiguracionForm({ data, integrantes }: { data: Configuracion; integrantes: IntegranteEquipo[] }) {
  const qc = useQueryClient();
  const [empresaNombre, setEmpresaNombre] = useState(data.empresaNombre);
  const [empresaCuit, setEmpresaCuit] = useState(data.empresaCuit);
  const [empresaContacto, setEmpresaContacto] = useState(data.empresaContacto);
  const [empresaDireccion, setEmpresaDireccion] = useState(data.empresaDireccion);
  const [publicoWhatsapp, setPublicoWhatsapp] = useState(data.publicoWhatsapp);
  const [publicoTelefono, setPublicoTelefono] = useState(data.publicoTelefono);
  const [publicoEmail, setPublicoEmail] = useState(data.publicoEmail);
  const [publicoInstagramUrl, setPublicoInstagramUrl] = useState(data.publicoInstagramUrl);
  const [publicoDireccion, setPublicoDireccion] = useState(data.publicoDireccion);
  const [publicoMatricula, setPublicoMatricula] = useState(data.publicoMatricula);
  const [ipc, setIpc] = useState(String(data.ipc));
  const [icl, setIcl] = useState(String(data.icl));
  const [dolarReferencia, setDolarReferencia] = useState(String(data.dolarReferencia));
  const [honorariosDefaultPorcentaje, setHonorariosDefaultPorcentaje] = useState(String(data.honorariosDefaultPorcentaje));
  const [comisionVentaPorcentaje, setComisionVentaPorcentaje] = useState(String(data.comisionVentaPorcentaje));
  const [diaVencimientoAlquiler, setDiaVencimientoAlquiler] = useState(String(data.diaVencimientoAlquiler));
  const [diasAnticipacionAumento, setDiasAnticipacionAumento] = useState(String(data.diasAnticipacionAumento));
  const [diasAnticipacionVencimiento, setDiasAnticipacionVencimiento] = useState(String(data.diasAnticipacionVencimiento));
  const [saldoInicialCaja, setSaldoInicialCaja] = useState(String(data.saldoInicialCaja));
  const [nuevoIntegrante, setNuevoIntegrante] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardadoOk, setGuardadoOk] = useState(false);
  const [cotizacionInfo, setCotizacionInfo] = useState<string | null>(null);

  const actualizarCotizacion = useMutation({
    mutationFn: () => api.get<{ compra: number; venta: number; fechaActualizacion: string }>('/configuracion/dolar'),
    onSuccess: (r) => {
      setDolarReferencia(String(Math.round(r.venta)));
      setCotizacionInfo(`Dólar oficial (venta): ${formatMoney(r.venta)} · actualizado ${new Date(r.fechaActualizacion).toLocaleString('es-AR')}`);
      setError(null);
    },
    onError: () => setError('No se pudo consultar la cotización en dolarapi.com. Intentá de nuevo o cargá el valor a mano.'),
  });

  const subirFotoNosotros = useMutation({
    mutationFn: (archivo: File) => {
      const form = new FormData();
      form.append('archivo', archivo);
      return api.upload('/configuracion/foto-nosotros', form);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['configuracion'] }),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo subir la foto.'),
  });

  function descartar() {
    setEmpresaNombre(data.empresaNombre);
    setEmpresaCuit(data.empresaCuit);
    setEmpresaContacto(data.empresaContacto);
    setEmpresaDireccion(data.empresaDireccion);
    setPublicoWhatsapp(data.publicoWhatsapp);
    setPublicoTelefono(data.publicoTelefono);
    setPublicoEmail(data.publicoEmail);
    setPublicoInstagramUrl(data.publicoInstagramUrl);
    setPublicoDireccion(data.publicoDireccion);
    setPublicoMatricula(data.publicoMatricula);
    setIpc(String(data.ipc));
    setIcl(String(data.icl));
    setDolarReferencia(String(data.dolarReferencia));
    setHonorariosDefaultPorcentaje(String(data.honorariosDefaultPorcentaje));
    setComisionVentaPorcentaje(String(data.comisionVentaPorcentaje));
    setDiaVencimientoAlquiler(String(data.diaVencimientoAlquiler));
    setDiasAnticipacionAumento(String(data.diasAnticipacionAumento));
    setDiasAnticipacionVencimiento(String(data.diasAnticipacionVencimiento));
    setSaldoInicialCaja(String(data.saldoInicialCaja));
    setError(null);
  }

  const guardar = useMutation({
    mutationFn: () =>
      api.patch('/configuracion', {
        empresaNombre,
        empresaCuit,
        empresaContacto,
        empresaDireccion,
        publicoWhatsapp,
        publicoTelefono,
        publicoEmail,
        publicoInstagramUrl,
        publicoDireccion,
        publicoMatricula,
        ipc: Number(ipc),
        icl: Number(icl),
        dolarReferencia: Number(dolarReferencia),
        honorariosDefaultPorcentaje: Number(honorariosDefaultPorcentaje),
        comisionVentaPorcentaje: Number(comisionVentaPorcentaje),
        diaVencimientoAlquiler: Math.round(Number(diaVencimientoAlquiler)),
        diasAnticipacionAumento: Math.round(Number(diasAnticipacionAumento)),
        diasAnticipacionVencimiento: Math.round(Number(diasAnticipacionVencimiento)),
        saldoInicialCaja: Number(saldoInicialCaja),
      }),
    onSuccess: () => {
      setGuardadoOk(true);
      setError(null);
      qc.invalidateQueries({ queryKey: ['configuracion'] });
      // Varios valores de acá alimentan cálculos de otras secciones:
      // dolarReferencia (comisión potencial de Ventas), saldoInicialCaja y
      // honorarios/comisión por defecto (Caja y su resumen anual), y los
      // días de anticipación (qué aparece en Avisos).
      qc.invalidateQueries({ queryKey: ['ventas'] });
      qc.invalidateQueries({ queryKey: ['caja'] });
      qc.invalidateQueries({ queryKey: ['reportes'] });
      qc.invalidateQueries({ queryKey: ['avisos'] });
      setTimeout(() => setGuardadoOk(false), 3000);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo guardar la configuración.'),
  });

  const agregarIntegrante = useMutation({
    mutationFn: () => api.post('/integrantes-equipo', { nombre: nuevoIntegrante.trim() }),
    onSuccess: () => {
      setNuevoIntegrante('');
      qc.invalidateQueries({ queryKey: ['integrantes-equipo'] });
    },
  });
  const quitarIntegrante = useMutation({
    mutationFn: (id: string) => api.delete(`/integrantes-equipo/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrantes-equipo'] }),
  });

  return (
    <>
      {error && <div className="errstate" style={{ marginBottom: 14 }}>{error}</div>}

      <div className="repsep">⌂ LA INMOBILIARIA</div>
      <div className="cfggrid">
        <div className="cfgcard">
          <h3>DATOS FISCALES</h3>
          <div className="hint">Encabezan todos los comprobantes que se imprimen: facturas, recibos y liquidaciones.</div>
          <div className="cfgfields">
            <div className="fg full">
              <label>Razón social</label>
              <input value={empresaNombre} onChange={(e) => setEmpresaNombre(e.target.value)} />
            </div>
            <div className="fg">
              <label>CUIT</label>
              <input value={empresaCuit} onChange={(e) => setEmpresaCuit(e.target.value)} placeholder="20-12345678-9" />
            </div>
            <div className="fg">
              <label>Contacto (tel. o email)</label>
              <input value={empresaContacto} onChange={(e) => setEmpresaContacto(e.target.value)} />
            </div>
            <div className="fg full">
              <label>Dirección</label>
              <input value={empresaDireccion} onChange={(e) => setEmpresaDireccion(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="cfgcard">
          <h3>EQUIPO — DESIGNADOS PARA MOSTRAR</h3>
          <div className="hint">
            Registrá a cada integrante. Aparecen como opciones de "Designado para mostrar" en propiedades y clientes.
            Los cambios se guardan al instante.
          </div>
          <div className="equipolist">
            {integrantes.length ? (
              integrantes.map((i) => (
                <div className="eqrow" key={i.id}>
                  <span>▪ {i.nombre}</span>
                  <button
                    className="del"
                    title="Quitar del equipo"
                    onClick={() => quitarIntegrante.mutate(i.id)}
                  >
                    ✕
                  </button>
                </div>
              ))
            ) : (
              <div className="eqrow" style={{ color: 'var(--muted)' }}>
                Sin integrantes cargados
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input
              placeholder="Nombre y apellido"
              style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 9, padding: '10px 12px', fontSize: 13.5, background: 'var(--bg)' }}
              value={nuevoIntegrante}
              onChange={(e) => setNuevoIntegrante(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && nuevoIntegrante.trim()) {
                  e.preventDefault();
                  agregarIntegrante.mutate();
                }
              }}
            />
            <button className="btn-sm solid" disabled={!nuevoIntegrante.trim()} onClick={() => agregarIntegrante.mutate()}>
              + Agregar
            </button>
          </div>
        </div>

        <div className="cfgcard">
          <h3>DATOS PÚBLICOS (LANDING PAGE)</h3>
          <div className="hint">
            El WhatsApp, teléfono, email, Instagram, dirección y matrícula que se muestran en la página web pública
            — puede ser distinto de los datos fiscales de arriba.
          </div>
          <div className="cfgfields">
            <div className="fg">
              <label>WhatsApp</label>
              <input
                value={publicoWhatsapp}
                onChange={(e) => setPublicoWhatsapp(e.target.value)}
                placeholder="5492494123456"
              />
            </div>
            <div className="fg">
              <label>Teléfono</label>
              <input value={publicoTelefono} onChange={(e) => setPublicoTelefono(e.target.value)} />
            </div>
            <div className="fg">
              <label>Email</label>
              <input value={publicoEmail} onChange={(e) => setPublicoEmail(e.target.value)} />
            </div>
            <div className="fg">
              <label>Instagram (URL)</label>
              <input value={publicoInstagramUrl} onChange={(e) => setPublicoInstagramUrl(e.target.value)} />
            </div>
            <div className="fg full">
              <label>Dirección</label>
              <input value={publicoDireccion} onChange={(e) => setPublicoDireccion(e.target.value)} />
            </div>
            <div className="fg">
              <label>Matrícula</label>
              <input value={publicoMatricula} onChange={(e) => setPublicoMatricula(e.target.value)} />
            </div>
            <div className="fg full">
              <label>Foto de "Nosotros"</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {data.publicoFotoNosotrosUrl && (
                  <img
                    src={`${BASE_URL}${data.publicoFotoNosotrosUrl}`}
                    alt=""
                    style={{ width: 72, height: 72, borderRadius: 10, objectFit: 'cover', border: '1px solid var(--border)' }}
                  />
                )}
                <label className="dropzone" style={{ flex: 1, margin: 0 }}>
                  {subirFotoNosotros.isPending ? 'Subiendo…' : data.publicoFotoNosotrosUrl ? 'Cambiar foto' : 'Hacé clic para elegir una foto (JPG, PNG o WEBP)'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={subirFotoNosotros.isPending}
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const archivo = e.target.files?.[0];
                      if (archivo) subirFotoNosotros.mutate(archivo);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
          <div className="cfgnote">
            <i>◈</i>
            <span>
              El WhatsApp va sin espacios ni signos, con código de país (ej: 5492494123456). La foto de "Nosotros" se
              sube y se guarda al toque, no hace falta tocar "Guardar cambios" para esta.
            </span>
          </div>
        </div>
      </div>

      <div className="repsep">▲ VALORES DE MERCADO</div>
      <div className="cfggrid">
        <div className="cfgcard">
          <h3>ÍNDICES DE ACTUALIZACIÓN</h3>
          <div className="hint">Los publica el INDEC. Actualizalos cuando salga el dato nuevo: de acá salen los aumentos que propone el sistema.</div>
          <div className="cfgfields">
            <div className="fg">
              <label>Índice IPC</label>
              <div className="suffix">
                <input type="number" step="0.01" value={ipc} onChange={(e) => setIpc(e.target.value)} />
                <span>%</span>
              </div>
            </div>
            <div className="fg">
              <label>Índice ICL</label>
              <div className="suffix">
                <input type="number" step="0.01" value={icl} onChange={(e) => setIcl(e.target.value)} />
                <span>%</span>
              </div>
            </div>
          </div>
          <div className="cfgnote">
            <i>△</i>
            <span>Se usan en el panel y en las alertas de aumento, que muestran cuánto quedaría la renta al aplicarlos.</span>
          </div>
        </div>

        <div className="cfgcard">
          <h3>COTIZACIÓN DEL DÓLAR</h3>
          <div className="hint">Las propiedades en venta suelen listarse en dólares. Este valor las convierte a pesos para poder sumarlas con el resto.</div>
          <div className="cfgfields">
            <div className="fg full">
              <label>Dólar de referencia</label>
              <div className="suffix">
                <input type="number" min={1} step="1" value={dolarReferencia} onChange={(e) => setDolarReferencia(e.target.value)} />
                <span>$</span>
              </div>
            </div>
          </div>
          <button
            className="btn-sm"
            style={{ marginTop: 10, width: '100%' }}
            disabled={actualizarCotizacion.isPending}
            onClick={() => actualizarCotizacion.mutate()}
          >
            {actualizarCotizacion.isPending ? 'Consultando dolarapi.com…' : 'Actualizar desde dólar oficial (dolarapi.com)'}
          </button>
          <div className="cfgnote">
            <i>◈</i>
            <span>
              {cotizacionInfo ?? (
                <>
                  Afecta la <b>comisión potencial</b> del tablero de Ventas y el equivalente en pesos de cada ficha. El
                  botón trae la cotización del dólar oficial; recordá <b>Guardar configuración</b> para aplicarla.
                </>
              )}
            </span>
          </div>
        </div>

        <div className="cfgcard">
          <h3>HONORARIOS Y COMISIÓN POR DEFECTO</h3>
          <div className="hint">
            Se usan solo cuando una propiedad no define su propio porcentaje — cada propiedad puede tener el suyo
            (libre, 3%, 6% u otro).
          </div>
          <div className="cfgfields">
            <div className="fg">
              <label>Honorarios de alquiler</label>
              <div className="suffix">
                <input
                  type="number"
                  step="0.01"
                  value={honorariosDefaultPorcentaje}
                  onChange={(e) => setHonorariosDefaultPorcentaje(e.target.value)}
                />
                <span>%</span>
              </div>
            </div>
            <div className="fg">
              <label>Comisión de venta</label>
              <div className="suffix">
                <input
                  type="number"
                  step="0.01"
                  value={comisionVentaPorcentaje}
                  onChange={(e) => setComisionVentaPorcentaje(e.target.value)}
                />
                <span>%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="repsep">⚙ REGLAS DE OPERACIÓN</div>
      <div className="cfggrid">
        <div className="cfgcard">
          <h3>VENCIMIENTO DEL ALQUILER</h3>
          <div className="hint">Qué día de cada mes se le vence el alquiler al inquilino.</div>
          <div className="cfgfields">
            <div className="fg full">
              <label>Vence el día</label>
              <div className="suffix">
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={diaVencimientoAlquiler}
                  onChange={(e) => setDiaVencimientoAlquiler(e.target.value)}
                />
                <span>de cada mes</span>
              </div>
            </div>
          </div>
        </div>

        <div className="cfgcard">
          <h3>ANTICIPACIÓN DE LAS ALERTAS</h3>
          <div className="hint">Con cuántos días de anticipación querés que el sistema te avise.</div>
          <div className="cfgfields">
            <div className="fg">
              <label>Avisar aumento con</label>
              <div className="suffix">
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={diasAnticipacionAumento}
                  onChange={(e) => setDiasAnticipacionAumento(e.target.value)}
                />
                <span>días</span>
              </div>
            </div>
            <div className="fg">
              <label>Avisar fin de contrato con</label>
              <div className="suffix">
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={diasAnticipacionVencimiento}
                  onChange={(e) => setDiasAnticipacionVencimiento(e.target.value)}
                />
                <span>días</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="repsep">▤ COMPROBANTES Y CAJA</div>
      <div className="cfggrid">
        <div className="cfgcard">
          <h3>NUMERACIÓN DE COMPROBANTES</h3>
          <div className="hint">Los tres numeradores se incrementan solos al emitir — son de solo lectura acá.</div>
          <div className="cfgfields">
            <div className="fg">
              <label>Próxima factura</label>
              <input value={data.proximoNumeroFactura} disabled />
            </div>
            <div className="fg">
              <label>Próximo recibo</label>
              <input value={data.proximoNumeroRecibo} disabled />
            </div>
            <div className="fg">
              <label>Próxima liquidación</label>
              <input value={data.proximoNumeroLiquidacion} disabled />
            </div>
          </div>
        </div>

        <div className="cfgcard">
          <h3>SALDO INICIAL DE CAJA</h3>
          <div className="hint">El dinero que había en caja antes de empezar a usar el sistema. Todos los movimientos se suman a partir de este número.</div>
          <div className="cfgfields">
            <div className="fg full">
              <label>Saldo inicial</label>
              <div className="suffix">
                <input type="number" step="0.01" value={saldoInicialCaja} onChange={(e) => setSaldoInicialCaja(e.target.value)} />
                <span>$</span>
              </div>
            </div>
          </div>
          <div className="cfgnote">
            <i>₲</i>
            <span>
              Se carga una sola vez, al arrancar. Después el saldo lo lleva la vista de <b>Caja</b>.
            </span>
          </div>
        </div>
      </div>

      <div className="cfgsave">
        {guardadoOk && <span style={{ color: 'var(--green)', fontSize: 12.5, fontWeight: 700, alignSelf: 'center', marginRight: 'auto' }}>Configuración guardada</span>}
        <button className="btn-ghost" onClick={descartar}>
          Descartar cambios
        </button>
        <button className="btn-dark" disabled={guardar.isPending} onClick={() => guardar.mutate()}>
          Guardar configuración
        </button>
      </div>
    </>
  );
}

// ---------- Reportes: exportaciones CSV client-side sobre endpoints ya probados ----------

interface Propietario {
  nombre: string;
}
interface Inquilino {
  nombre: string;
  telefono: string | null;
  email: string | null;
}
interface Propiedad {
  nombre: string;
  direccion: string;
  modalidad: string;
  indice: string | null;
  montoAlquilerVigente: string | number | null;
  contratoInicio: string | null;
  contratoFin: string | null;
  propietario: Propietario | null;
  inquilino: Inquilino | null;
}
interface FichaInquilino {
  propiedadNombre: string;
  inquilino: Inquilino | null;
  rentaVigente: number | null;
  deudaAcumulada: number;
  mesesImpagos: number;
  ultimoPago: { fecha: string } | null;
}
interface Incidencia {
  titulo: string;
  propiedad: { nombre: string };
  proveedor: { nombre: string } | null;
  estado: string;
  prioridad: string;
  fechaApertura: string;
  fechaCierre: string | null;
  costo: string | number | null;
}
interface Cliente {
  nombre: string;
  tipoOperacion: string;
  estado: string;
  origen: string | null;
  telefono: string | null;
  email: string | null;
}
interface Cartel {
  propiedad: { nombre: string };
  tipoCartel: 'COLOCADO' | 'A_PEDIDO' | 'RETIRADO';
  fechaColocacion: string | null;
  diasEnLaCalle: number | null;
}
interface FilaCobro {
  propiedadNombre: string;
  inquilino: Inquilino | null;
  esperado: number | null;
  cobrado: number;
  estado: string;
}
interface ResumenMesCobros {
  filas: FilaCobro[];
}
interface MovimientoCaja {
  fecha: string;
  concepto: string;
  categoria: string | null;
  medio: string | null;
  tipo: 'INGRESO' | 'EGRESO';
  moneda: string;
  monto: string | number;
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
interface EventoAgenda {
  fecha: string;
  tipo: string;
  titulo: string;
  hecho: boolean;
}

function ReportesSection() {
  const [mes, setMes] = useState(mesActualStr());
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [cargando, setCargando] = useState<string | null>(null);

  async function exportar(nombre: string, fn: () => Promise<void>) {
    setCargando(nombre);
    try {
      await fn();
    } finally {
      setCargando(null);
    }
  }

  const reportes = [
    {
      grupo: '¤ REPORTES — DINERO',
      items: [
        {
          key: 'cobros',
          ico: '▤',
          titulo: 'Cobros del mes',
          desc: `Cobros de ${mesLabel(mes)}: propiedad, inquilino, esperado, cobrado y estado.`,
          onClick: () =>
            exportar('cobros', async () => {
              const r = await api.get<ResumenMesCobros>(`/cobros/mes/${mes}`);
              descargarCsv(`cobros_${mes}.csv`, [
                ['Propiedad', 'Inquilino', 'Esperado', 'Cobrado', 'Estado'],
                ...r.filas.map((f) => [f.propiedadNombre, f.inquilino?.nombre ?? '', f.esperado ?? 0, f.cobrado, f.estado]),
              ]);
            }),
        },
        {
          key: 'liquidaciones',
          ico: '¤',
          titulo: `Gastos y liquidaciones — ${anio}`,
          desc: 'Gastos y neto liquidado a propietarios, mes a mes, durante el año seleccionado.',
          onClick: () =>
            exportar('liquidaciones', async () => {
              const r = await api.get<{ filas: ResumenAnualFila[] }>(`/reportes/resumen-anual/${anio}`);
              descargarCsv(`gastos_liquidaciones_${anio}.csv`, [
                ['Mes', 'Gastos', 'Honorarios', 'Liquidado'],
                ...r.filas.map((f) => [mesLabel(f.mes), f.gastos, f.honorarios, f.liquidado]),
              ]);
            }),
        },
        {
          key: 'caja',
          ico: '₲',
          titulo: `Libro de caja — ${mesLabel(mes)}`,
          desc: 'Movimientos del mes seleccionado, con ingresos y egresos.',
          onClick: () =>
            exportar('caja', async () => {
              const r = await api.get<MovimientoCaja[]>(`/caja/movimientos?mes=${mes}`);
              descargarCsv(`caja_${mes}.csv`, [
                ['Fecha', 'Concepto', 'Categoría', 'Medio', 'Moneda', 'Ingreso', 'Egreso'],
                ...r.map((m) => [
                  formatDate(m.fecha),
                  m.concepto,
                  m.categoria ?? '',
                  m.medio ?? '',
                  m.moneda,
                  m.tipo === 'INGRESO' ? Number(m.monto) : '',
                  m.tipo === 'EGRESO' ? Number(m.monto) : '',
                ]),
              ]);
            }),
        },
      ],
    },
    {
      grupo: '⌂ REPORTES — PROPIEDADES E INQUILINOS',
      items: [
        {
          key: 'cartera',
          ico: '⌂',
          titulo: 'Cartera de propiedades',
          desc: 'Listado completo con propietario, inquilino, renta, índice y fechas de contrato.',
          onClick: () =>
            exportar('cartera', async () => {
              const r = await api.get<Propiedad[]>('/propiedades');
              descargarCsv('cartera_propiedades.csv', [
                ['Propiedad', 'Dirección', 'Modalidad', 'Propietario', 'Inquilino', 'Índice', 'Renta vigente', 'Contrato inicio', 'Contrato fin'],
                ...r.map((p) => [
                  p.nombre,
                  p.direccion,
                  p.modalidad,
                  p.propietario?.nombre ?? '',
                  p.inquilino?.nombre ?? '',
                  p.indice ?? '',
                  p.montoAlquilerVigente ?? '',
                  formatDate(p.contratoInicio),
                  formatDate(p.contratoFin),
                ]),
              ]);
            }),
        },
        {
          key: 'inquilinos',
          ico: '◐',
          titulo: 'Estado de cuenta de inquilinos',
          desc: 'Renta vigente, deuda acumulada, meses impagos y último pago de cada inquilino.',
          onClick: () =>
            exportar('inquilinos', async () => {
              const r = await api.get<FichaInquilino[]>('/cobros/inquilinos');
              descargarCsv('estado_cuenta_inquilinos.csv', [
                ['Propiedad', 'Inquilino', 'Renta vigente', 'Deuda acumulada', 'Meses impagos', 'Último pago'],
                ...r.map((f) => [
                  f.propiedadNombre,
                  f.inquilino?.nombre ?? '',
                  f.rentaVigente ?? '',
                  f.deudaAcumulada,
                  f.mesesImpagos,
                  f.ultimoPago ? formatDate(f.ultimoPago.fecha) : '',
                ]),
              ]);
            }),
        },
        {
          key: 'incidencias',
          ico: '⚠',
          titulo: 'Incidencias y reparaciones',
          desc: 'Todos los reclamos con su propiedad, proveedor, estado y costo.',
          onClick: () =>
            exportar('incidencias', async () => {
              const r = await api.get<Incidencia[]>('/incidencias');
              descargarCsv('incidencias.csv', [
                ['Título', 'Propiedad', 'Proveedor', 'Estado', 'Prioridad', 'Apertura', 'Cierre', 'Costo'],
                ...r.map((i) => [
                  i.titulo,
                  i.propiedad.nombre,
                  i.proveedor?.nombre ?? '',
                  i.estado,
                  i.prioridad,
                  formatDate(i.fechaApertura),
                  i.fechaCierre ? formatDate(i.fechaCierre) : '',
                  i.costo ?? '',
                ]),
              ]);
            }),
        },
      ],
    },
    {
      grupo: '☏ REPORTES — COMERCIAL Y SEGUIMIENTO',
      items: [
        {
          key: 'clientes',
          ico: '☏',
          titulo: 'Base de clientes',
          desc: 'Todos los clientes con su tipo, estado de seguimiento, origen y contacto.',
          onClick: () =>
            exportar('clientes', async () => {
              const r = await api.get<Cliente[]>('/clientes');
              descargarCsv('base_clientes.csv', [
                ['Nombre', 'Tipo', 'Estado', 'Origen', 'Teléfono', 'Email'],
                ...r.map((c) => [c.nombre, c.tipoOperacion, c.estado, c.origen ?? '', c.telefono ?? '', c.email ?? '']),
              ]);
            }),
        },
        {
          key: 'agenda',
          ico: '▥',
          titulo: `Agenda de eventos — ${mesLabel(mes)}`,
          desc: 'Visitas, reuniones y tareas cargadas a mano en el mes seleccionado.',
          onClick: () =>
            exportar('agenda', async () => {
              const r = await api.get<{ manuales: EventoAgenda[] }>(`/agenda/mes/${mes}`);
              descargarCsv(`agenda_${mes}.csv`, [
                ['Fecha', 'Tipo', 'Título', 'Hecho'],
                ...r.manuales.map((e) => [formatDate(e.fecha), e.tipo, e.titulo, e.hecho ? 'Sí' : 'No']),
              ]);
            }),
        },
        {
          key: 'carteles',
          ico: '▭',
          titulo: 'Carteles',
          desc: 'Qué cartel está en cada propiedad, desde cuándo y días en la calle.',
          onClick: () =>
            exportar('carteles', async () => {
              const r = await api.get<Cartel[]>('/carteles');
              const tipoLabel: Record<Cartel['tipoCartel'], string> = {
                COLOCADO: 'Colocado',
                A_PEDIDO: 'Por colocar',
                RETIRADO: 'Retirado',
              };
              descargarCsv('carteles.csv', [
                ['Propiedad', 'Tipo de cartel', 'Colocado', 'Días en la calle'],
                ...r.map((c) => [c.propiedad.nombre, tipoLabel[c.tipoCartel], c.fechaColocacion ? formatDate(c.fechaColocacion) : '', c.diasEnLaCalle ?? '']),
              ]);
            }),
        },
      ],
    },
  ];

  return (
    <>
      <div className="repsep" style={{ marginTop: 8 }}>
        ▥ PERÍODO DE LOS REPORTES
      </div>
      <div className="tablewrap" style={{ marginBottom: 22 }}>
        <div className="monthbar">
          <button className="navm" onClick={() => setMes(sumarMesesStr(mes, -1))} title="Mes anterior">
            ‹
          </button>
          <span className="mlabel">{mesLabel(mes)}</span>
          <button className="navm" onClick={() => setMes(sumarMesesStr(mes, 1))} title="Mes siguiente">
            ›
          </button>
          <span className="spacer"></span>
          <button className="navm" onClick={() => setAnio((a) => a - 1)}>
            ‹
          </button>
          <span className="mlabel" style={{ minWidth: 60 }}>
            {anio}
          </span>
          <button className="navm" onClick={() => setAnio((a) => a + 1)}>
            ›
          </button>
        </div>
      </div>

      {reportes.map((grupo) => (
        <div key={grupo.grupo}>
          <div className="repsep">{grupo.grupo}</div>
          <div className="repgrid">
            {grupo.items.map((item) => (
              <div className="repcard" key={item.key}>
                <h4>
                  {item.ico} {item.titulo}
                </h4>
                <p>{item.desc}</p>
                <button className="btn-dark" style={{ width: '100%' }} disabled={cargando === item.key} onClick={item.onClick}>
                  {cargando === item.key ? 'Exportando…' : 'Exportar CSV'}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
