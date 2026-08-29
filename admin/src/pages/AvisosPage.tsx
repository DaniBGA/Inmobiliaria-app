import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useConfiguracion } from '../hooks/useConfiguracion';
import { PageHeader } from '../components/PageHeader';
import { SeccionGuia } from '../components/SeccionGuia';
import { ComprobanteImpreso } from '../components/ComprobanteImpreso';
import { LiquidacionComprobanteBody, type Liquidacion } from '../components/LiquidacionComprobante';
import { descargarPdfComprobante } from '../lib/pdfComprobante';
import { formatMoney, formatDate, mesActualStr, mesLabel } from '../lib/format';

interface Configuracion {
  empresaDireccion: string;
  empresaContacto: string;
  publicoMatricula: string;
}

interface PersonaContacto {
  nombre: string;
  telefono: string | null;
  email: string | null;
}

interface ReclamoDeuda {
  clave: string;
  propiedadId: string;
  inquilino: PersonaContacto | null;
  deuda: number;
  mesesImpagos: number;
  texto: string;
}
interface PedidoPresupuesto {
  clave: string;
  incidenciaId: string;
  propiedad: { nombre: string };
  titulo: string;
  texto: string;
}
interface AvisoAumento {
  clave: string;
  propiedadId: string;
  inquilino: PersonaContacto | null;
  fecha: string;
  texto: string;
}
interface RenovacionContrato {
  clave: string;
  propiedadId: string;
  inquilino: PersonaContacto | null;
  contratoFin: string;
  texto: string;
}
interface ClienteSinContactar {
  clave: string;
  clienteId: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  texto: string;
}
interface Recordatorio {
  clave: string;
  eventoId: string;
  titulo: string;
  fecha: string;
  texto: string;
}
interface LiquidacionLista {
  clave: string;
  liquidacionId: string;
  propietario: (PersonaContacto & { id: string }) | null;
  netoAGirar: number;
  texto: string;
}

interface AvisosResponse {
  reclamosDeuda: ReclamoDeuda[];
  pedidosPresupuesto: PedidoPresupuesto[];
  avisosAumento: AvisoAumento[];
  renovacionesContrato: RenovacionContrato[];
  clientesSinContactar: ClienteSinContactar[];
  recordatorios: Recordatorio[];
  liquidacionesListas: LiquidacionLista[];
}

interface AvisoItem {
  key: string;
  grupo: string;
  clave: string;
  ico: string;
  cls: 'crit' | 'warn' | 'info';
  titulo: string;
  quien: string;
  tel: string | null;
  email: string | null;
  asunto: string;
  texto: string;
  // Solo se completa para "Liquidación lista" — habilita el botón
  // "Descargar PDF" de la tarjeta (ver `AvisoCard`).
  liquidacionPdf?: { propietarioId: string; propietarioNombre: string };
}

interface Grupo {
  clave: string;
  titulo: string;
  color: 'red' | 'orange' | 'indigo';
  items: AvisoItem[];
}

function waLink(tel: string | null, msg: string): string {
  const n = (tel ?? '').replace(/\D/g, '');
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(msg)}` : '';
}
function mailLink(email: string | null, asunto: string, msg: string): string {
  return email ? `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(msg)}` : '';
}

function construirGrupos(data: AvisosResponse): Grupo[] {
  return [
    {
      clave: 'deuda',
      titulo: 'RECLAMOS DE DEUDA',
      color: 'red',
      items: data.reclamosDeuda.map((a, i) => ({
        key: `deuda-${i}`,
        grupo: 'RECLAMO_DEUDA',
        clave: a.clave,
        ico: '¤',
        cls: 'crit',
        titulo: `Reclamo de deuda — ${formatMoney(a.deuda)}`,
        quien: `${a.inquilino?.nombre ?? '—'} · ${a.mesesImpagos} mes(es) impago(s)`,
        tel: a.inquilino?.telefono ?? null,
        email: a.inquilino?.email ?? null,
        asunto: 'Saldo pendiente',
        texto: a.texto,
      })),
    },
    {
      clave: 'proveedor',
      titulo: 'PEDIDOS DE PRESUPUESTO',
      color: 'red',
      items: data.pedidosPresupuesto.map((a, i) => ({
        key: `proveedor-${i}`,
        grupo: 'PEDIDO_PRESUPUESTO',
        clave: a.clave,
        ico: '⚒',
        cls: 'crit',
        titulo: `Pedir presupuesto — ${a.titulo}`,
        quien: `Para: ${a.propiedad.nombre}`,
        tel: null,
        email: null,
        asunto: `Presupuesto — ${a.titulo}`,
        texto: a.texto,
      })),
    },
    {
      clave: 'aumento',
      titulo: 'AVISOS DE AUMENTO',
      color: 'orange',
      items: data.avisosAumento.map((a, i) => ({
        key: `aumento-${i}`,
        grupo: 'AVISO_AUMENTO',
        clave: a.clave,
        ico: '▲',
        cls: 'warn',
        titulo: `Aviso de aumento — ${formatDate(a.fecha)}`,
        quien: a.inquilino?.nombre ?? '—',
        tel: a.inquilino?.telefono ?? null,
        email: a.inquilino?.email ?? null,
        asunto: 'Actualización de alquiler',
        texto: a.texto,
      })),
    },
    {
      clave: 'vencimiento',
      titulo: 'RENOVACIONES DE CONTRATO',
      color: 'orange',
      items: data.renovacionesContrato.map((a, i) => ({
        key: `vencimiento-${i}`,
        grupo: 'RENOVACION_CONTRATO',
        clave: a.clave,
        ico: '◷',
        cls: 'warn',
        titulo: 'Consulta de renovación',
        quien: a.inquilino?.nombre ?? '—',
        tel: a.inquilino?.telefono ?? null,
        email: a.inquilino?.email ?? null,
        asunto: 'Vencimiento de contrato',
        texto: a.texto,
      })),
    },
    {
      clave: 'cliente',
      titulo: 'CLIENTES SIN CONTACTAR',
      color: 'indigo',
      items: data.clientesSinContactar.map((a, i) => ({
        key: `cliente-${i}`,
        grupo: 'CLIENTE_SIN_CONTACTAR',
        clave: a.clave,
        ico: '☏',
        cls: 'info',
        titulo: 'Primer contacto — cliente nuevo',
        quien: a.nombre,
        tel: a.telefono,
        email: a.email,
        asunto: 'Tu consulta',
        texto: a.texto,
      })),
    },
    {
      clave: 'recordatorio',
      titulo: 'RECORDATORIOS PRÓXIMOS',
      color: 'indigo',
      items: data.recordatorios.map((a, i) => ({
        key: `recordatorio-${i}`,
        grupo: 'RECORDATORIO',
        clave: a.clave,
        ico: '▥',
        cls: 'info',
        titulo: a.titulo,
        quien: formatDate(a.fecha),
        tel: null,
        email: null,
        asunto: `Recordatorio — ${a.titulo}`,
        texto: a.texto,
      })),
    },
    {
      clave: 'liquidacion',
      titulo: 'LIQUIDACIONES LISTAS',
      color: 'indigo',
      items: data.liquidacionesListas.map((a, i) => ({
        key: `liquidacion-${i}`,
        grupo: 'LIQUIDACION_LISTA',
        clave: a.clave,
        ico: '▤',
        cls: 'info',
        titulo: `Liquidación lista — ${formatMoney(a.netoAGirar)}`,
        quien: a.propietario?.nombre ?? '—',
        tel: a.propietario?.telefono ?? null,
        email: a.propietario?.email ?? null,
        asunto: 'Liquidación lista',
        texto: a.texto,
        liquidacionPdf: a.propietario ? { propietarioId: a.propietario.id, propietarioNombre: a.propietario.nombre } : undefined,
      })),
    },
  ];
}

export function AvisosPage() {
  const qc = useQueryClient();
  const avisos = useQuery({
    queryKey: ['avisos'],
    queryFn: () => api.get<AvisosResponse>('/avisos'),
  });
  const [ocultos, setOcultos] = useState<Set<string>>(new Set());

  const descartar = useMutation({
    mutationFn: (item: { grupo: string; clave: string }) => api.post('/avisos/descartar', item),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['avisos'] }),
  });

  // Generación del PDF de la liquidación desde acá (botón "Descargar PDF"
  // de la tarjeta "Liquidación lista") — mismo mecanismo que ya usa
  // `PropietariosPage.tsx`, pero acá no hay ningún modal abierto con el
  // detalle ya cargado: primero hay que traerlo (`GET
  // /liquidaciones/propietarios/:id/:mes`, la liquidación YA emitida, no
  // una vista previa) y recién ahí se puede armar el comprobante oculto
  // que captura `descargarPdfComprobante`.
  const configuracion = useConfiguracion<Configuracion>();
  const comprobanteRef = useRef<HTMLDivElement>(null);
  const [pdfData, setPdfData] = useState<{ propietarioNombre: string; L: Liquidacion } | null>(null);
  const mes = mesActualStr();

  const prepararPdf = useMutation({
    mutationFn: async ({ propietarioId, propietarioNombre }: { propietarioId: string; propietarioNombre: string }) => {
      const L = await api.get<Liquidacion>(`/liquidaciones/propietarios/${propietarioId}/${mes}`);
      return { propietarioNombre, L };
    },
    onSuccess: (data) => setPdfData(data),
  });

  useEffect(() => {
    if (pdfData && comprobanteRef.current) {
      descargarPdfComprobante(comprobanteRef.current, `Liquidacion ${pdfData.L.numero} - ${pdfData.propietarioNombre}.pdf`).finally(
        () => setPdfData(null),
      );
    }
  }, [pdfData]);

  if (avisos.isLoading) {
    return (
      <>
        <PageHeader title="Avisos" />
        <main>
          <div className="loadstate">Cargando…</div>
        </main>
      </>
    );
  }

  const grupos = construirGrupos(
    avisos.data ?? {
      reclamosDeuda: [],
      pedidosPresupuesto: [],
      avisosAumento: [],
      renovacionesContrato: [],
      clientesSinContactar: [],
      recordatorios: [],
      liquidacionesListas: [],
    },
  );
  const gruposConAvisos = grupos.filter((g) => g.items.length > 0);
  const total = gruposConAvisos.reduce((acc, g) => acc + g.items.length, 0);
  const gruposVisibles = gruposConAvisos.filter((g) => !ocultos.has(g.clave));

  function toggleGrupo(clave: string) {
    setOcultos((prev) => {
      const next = new Set(prev);
      if (next.has(clave)) next.delete(clave);
      else next.add(clave);
      return next;
    });
  }

  return (
    <>
      <PageHeader title="Avisos" />
      <main>
        <SeccionGuia
          icono="✉"
          titulo="¿Qué es el Centro de Avisos?"
          paginas={[
            [
              {
                titulo: 'Detección automática',
                subtitulo:
                  'El sistema arma solo los avisos según lo que encuentra: deudas, pedidos de presupuesto pendientes, aumentos próximos, vencimientos de contrato, clientes nuevos sin contactar y liquidaciones recién emitidas.',
              },
              {
                titulo: 'Enviar',
                subtitulo:
                  'Cada tarjeta trae el mensaje ya redactado — enviálo por WhatsApp o email con un clic. Podés editar el texto antes de enviar, pero esa edición no se guarda.',
              },
              {
                titulo: 'Descartar',
                subtitulo:
                  'La ✕ oculta un aviso puntual que ya resolviste de otra forma; vuelve a aparecer solo si la situación que lo generó cambia.',
              },
              {
                titulo: 'Filtros',
                subtitulo: 'Los chips de arriba muestran u ocultan cada grupo de avisos y cuántos hay de cada uno.',
              },
            ],
            [
              {
                titulo: 'Reclamos de deuda y Pedidos de presupuesto',
                subtitulo:
                  'Urgencias (en rojo): inquilinos con meses impagos, e incidencias resueltas que necesitan presupuesto de un proveedor.',
              },
              {
                titulo: 'Avisos de aumento y Renovaciones de contrato',
                subtitulo:
                  'Próximos (en naranja): aumentos por aplicar según IPC/ICL, y contratos por vencer.',
              },
              {
                titulo: 'Clientes sin contactar, Recordatorios y Liquidaciones listas',
                subtitulo:
                  'Informativos (en índigo): leads nuevos a contactar, eventos de la Agenda que se acercan, y liquidaciones recién emitidas listas para compartir (con descarga de PDF incluida).',
              },
            ],
          ]}
        />

        {total > 0 && (
          <div className="avfilters">
            {gruposConAvisos.map((g) => (
              <button
                key={g.clave}
                type="button"
                className={`avfilterchip ${g.color}${ocultos.has(g.clave) ? ' off' : ''}`}
                onClick={() => toggleGrupo(g.clave)}
              >
                <span className="dot" />
                {g.titulo} ({g.items.length})
              </button>
            ))}
          </div>
        )}

        {total === 0 ? (
          <div className="okstate">
            <div className="big">✓</div>
            <h4>No hay avisos para enviar</h4>
            <p>
              Nadie debe dinero, no hay aumentos ni vencimientos próximos,
              <br />y todos los clientes nuevos ya fueron contactados.
            </p>
          </div>
        ) : gruposVisibles.length === 0 ? (
          <div className="empty">No hay avisos visibles con este filtro. Activá alguna categoría arriba.</div>
        ) : (
          gruposVisibles.map((g) => (
            <div className="alertgroup" key={g.clave}>
              <h3>
                {g.titulo} <span className={`cnt ${g.color}`}>{g.items.length}</span>
              </h3>
              <div className="alertlist">
                {g.items.map((item) => (
                  <AvisoCard
                    key={item.key}
                    item={item}
                    onEliminar={() => descartar.mutate({ grupo: item.grupo, clave: item.clave })}
                    onDescargarPdf={item.liquidacionPdf ? () => prepararPdf.mutate(item.liquidacionPdf!) : undefined}
                    descargandoPdf={prepararPdf.isPending && prepararPdf.variables?.propietarioId === item.liquidacionPdf?.propietarioId}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </main>

      {/* Comprobante oculto, fuera de la pantalla — nunca se ve, solo existe
          para que `descargarPdfComprobante` lo capture con html2canvas
          cuando se pide el PDF de una liquidación desde acá. */}
      {pdfData && (
        <div style={{ position: 'fixed', left: -10000, top: 0 }}>
          <ComprobanteImpreso cfg={configuracion.data} ref={comprobanteRef}>
            <LiquidacionComprobanteBody propietarioNombre={pdfData.propietarioNombre} mesTexto={mesLabel(mes)} L={pdfData.L} />
          </ComprobanteImpreso>
        </div>
      )}
    </>
  );
}

function AvisoCard({
  item,
  onEliminar,
  onDescargarPdf,
  descargandoPdf,
}: {
  item: AvisoItem;
  onEliminar: () => void;
  onDescargarPdf?: () => void;
  descargandoPdf?: boolean;
}) {
  const [msg, setMsg] = useState(item.texto);

  return (
    <div className={`avcard ${item.cls}`}>
      <div className="ico">{item.ico}</div>
      <div className="b">
        <div className="t">{item.titulo}</div>
        <div className="who">{item.quien}</div>
        <textarea
          className="avmsg"
          rows={5}
          title="Podés editar el mensaje antes de enviarlo"
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
        />
      </div>
      <div className="avacts">
        {onDescargarPdf && (
          <button
            type="button"
            className="btn-sm"
            title="Descargar el PDF de la liquidación para adjuntarlo a mano en WhatsApp o el email"
            disabled={descargandoPdf}
            onClick={onDescargarPdf}
          >
            {descargandoPdf ? 'Generando…' : '📄 Descargar PDF'}
          </button>
        )}
        <a
          className={`btn-wa${item.tel ? '' : ' off'}`}
          href={item.tel ? waLink(item.tel, msg) : undefined}
          target="_blank"
          rel="noopener"
          aria-disabled={!item.tel}
        >
          WhatsApp
        </a>
        <a
          className={`btn-mail${item.email ? '' : ' off'}`}
          href={item.email ? mailLink(item.email, item.asunto, msg) : undefined}
          aria-disabled={!item.email}
        >
          Email
        </a>
        <button type="button" className="btn-sm ghostred" title="Eliminar este aviso" onClick={onEliminar}>
          ✕ Eliminar
        </button>
      </div>
    </div>
  );
}
