import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { ComprobanteImpreso } from '../components/ComprobanteImpreso';
import { LiquidacionComprobanteBody, type Liquidacion, type GastoDetalle, type LiquidacionItem } from '../components/LiquidacionComprobante';
import { descargarPdfComprobante } from '../lib/pdfComprobante';
import { formatMoney, mesActualStr, mesLabel } from '../lib/format';

interface Configuracion {
  empresaDireccion: string;
  empresaContacto: string;
  publicoMatricula: string;
}

interface Propietario {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  grandesActivos: boolean;
}

interface Propiedad {
  id: string;
  nombre: string;
  modalidad: 'ALQUILER' | 'VENTA';
  propietarioId: string;
  inquilino: { nombre: string } | null;
}

interface FilaCobro {
  propiedadId: string;
  estado: 'PAGADO' | 'PENDIENTE' | 'IMPAGO' | 'NO_CORRESPONDE';
}

interface ResumenMes {
  filas: FilaCobro[];
}

// Vista previa (sin persistir) que devuelve GET .../preview — misma forma
// que el detalle ya emitido, salvo que trae `propiedadNombre` en vez de
// `propiedad.nombre` (no viene de una relación Prisma) y el % de honorarios
// resuelto, para poder recalcular el monto en vivo si se edita el Alquiler.
interface DetallePreview {
  propiedadId: string;
  propiedadNombre: string;
  cobradoTotal: number;
  gastosAbsorbidos: number;
  gastosDetalle: GastoDetalle[];
  honorarios: number;
  porcentajeHonorarios: number;
  neto: number;
  items: LiquidacionItem[];
}

interface ItemEditable {
  descripcion: string;
  monto: string;
  numeroLiquidacion: string;
}

// Estado binario del mes en curso (mismo criterio que Panel General e
// Inquilinos y Cobros). El boceto usa acá una taxonomía más fina
// (activo/alerta/vencido/porvencer) que depende de días de alerta
// configurables — todavía no expuesta por la API, así que las propiedades
// alquiladas muestran el mismo badge Pagado/No pagado que el resto del admin.
const ESTADO_LABEL: Record<FilaCobro['estado'], { texto: string; clase: string }> = {
  PAGADO: { texto: 'Pagado', clase: 'activo' },
  PENDIENTE: { texto: 'No pagado', clase: 'vencido' },
  IMPAGO: { texto: 'No pagado', clase: 'vencido' },
  NO_CORRESPONDE: { texto: '—', clase: '' },
};

function iniciales(nombre: string) {
  return nombre
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function PropietariosPage() {
  const mesActual = mesActualStr();
  const [liqDe, setLiqDe] = useState<Propietario | null>(null);
  const qc = useQueryClient();

  const propietarios = useQuery({
    queryKey: ['propietarios'],
    queryFn: () => api.get<Propietario[]>('/propietarios'),
  });
  const propiedades = useQuery({
    queryKey: ['propiedades'],
    queryFn: () => api.get<Propiedad[]>('/propiedades'),
  });
  const resumenMes = useQuery({
    queryKey: ['cobros', 'mes', mesActual],
    queryFn: () => api.get<ResumenMes>(`/cobros/mes/${mesActual}`),
  });

  const eliminarPropietario = useMutation({
    mutationFn: (id: string) => api.delete(`/propietarios/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['propietarios'] });
      qc.invalidateQueries({ queryKey: ['propiedades'] });
    },
    onError: (err) => alert(err instanceof ApiError ? err.message : 'No se pudo eliminar el propietario.'),
  });

  function pedirEliminar(o: Propietario, cantidadPropiedades: number) {
    const avisoPropiedades =
      cantidadPropiedades > 0
        ? `\n\n${cantidadPropiedades} propiedad${cantidadPropiedades === 1 ? '' : 'es'} suya${cantidadPropiedades === 1 ? '' : 's'} quedará${cantidadPropiedades === 1 ? '' : 'n'} sin propietario asignado.`
        : '';
    const ok = window.confirm(
      `¿Eliminar a "${o.nombre}" de Propietarios y Liquidaciones? Esto borra también todo su historial de liquidaciones emitidas.${avisoPropiedades}`,
    );
    if (ok) eliminarPropietario.mutate(o.id);
  }

  if (propietarios.isLoading || propiedades.isLoading) {
    return (
      <>
        <PageHeader title="Propietarios y Liquidaciones" />
        <main>
          <div className="loadstate">Cargando…</div>
        </main>
      </>
    );
  }

  const estadoPorId = new Map((resumenMes.data?.filas ?? []).map((f) => [f.propiedadId, f.estado]));
  const propiedadesPorPropietario = new Map<string, Propiedad[]>();
  for (const p of propiedades.data ?? []) {
    const lista = propiedadesPorPropietario.get(p.propietarioId) ?? [];
    lista.push(p);
    propiedadesPorPropietario.set(p.propietarioId, lista);
  }

  const lista = propietarios.data ?? [];

  return (
    <>
      <PageHeader
        title="Propietarios y Liquidaciones"
        chips={[{ label: `${lista.length} propietarios`, tone: 'green' }]}
      />
      <main>
        <div className="owners">
          {lista.map((o) => {
            const mias = propiedadesPorPropietario.get(o.id) ?? [];
            return (
              <div className="ownercard" key={o.id}>
                <div className="top">
                  <div className="avatar">{iniciales(o.nombre)}</div>
                  <div>
                    <h4>{o.nombre}</h4>
                    <div className="contact">
                      ☎ {o.telefono ?? <span className="nodata">—</span>}
                      <br />
                      ✉{' '}
                      {o.email ? (
                        <a href={`mailto:${o.email}`}>{o.email}</a>
                      ) : (
                        <span className="nodata">—</span>
                      )}
                    </div>
                  </div>
                  {o.grandesActivos && <span className="tag-big">GRANDES ACTIVOS</span>}
                  <button
                    className="btn-sm ghostred"
                    style={{ marginLeft: 'auto', flexShrink: 0 }}
                    disabled={eliminarPropietario.isPending}
                    onClick={() => pedirEliminar(o, mias.length)}
                  >
                    Eliminar
                  </button>
                </div>
                <div className="props">
                  {mias.length === 0 && (
                    <div className="empty" style={{ padding: 16 }}>
                      Sin propiedades asociadas
                    </div>
                  )}
                  {mias.map((p) => {
                    let badge: { texto: string; clase: string };
                    if (p.modalidad === 'VENTA') badge = { texto: 'En Venta', clase: 'venta' };
                    else if (!p.inquilino) badge = { texto: 'Disponible', clase: 'disponible' };
                    else badge = ESTADO_LABEL[estadoPorId.get(p.id) ?? 'NO_CORRESPONDE'];
                    return (
                      <div className="oprop" key={p.id} style={{ cursor: 'default' }}>
                        <span className="nm">{p.nombre}</span>
                        <span className="mode">{p.modalidad === 'ALQUILER' ? 'alquiler' : 'venta'}</span>
                        {badge.clase ? (
                          <span className={`badge ${badge.clase}`}>{badge.texto}</span>
                        ) : (
                          <span style={{ color: 'var(--muted)' }}>—</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <button className="btn-invoice" onClick={() => setLiqDe(o)}>
                  ▤ Imprimir liquidación del mes
                </button>
              </div>
            );
          })}
          {lista.length === 0 && <div className="empty">Sin propietarios cargados.</div>}
        </div>
      </main>

      {liqDe && <LiquidacionModal propietario={liqDe} mes={mesActual} onClose={() => setLiqDe(null)} />}
    </>
  );
}

function LiquidacionModal({
  propietario,
  mes,
  onClose,
}: {
  propietario: Propietario;
  mes: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();

  const configuracion = useQuery({
    queryKey: ['configuracion'],
    queryFn: () => api.get<Configuracion>('/configuracion'),
  });
  const cfg = configuracion.data;

  // Vista previa editable (§3.4) — igual criterio que Facturas: se calcula
  // todo (cobrado, gastos absorbidos, honorarios) pero no se persiste nada
  // hasta "Emitir liquidación". El usuario puede tocar los montos y agregar
  // ítems del lado "Cobrado" antes de confirmar; los gastos absorbidos no
  // son editables acá — siempre salen de Incidencias/Gastos reales.
  const preview = useQuery({
    queryKey: ['liquidacion-preview', propietario.id, mes],
    queryFn: () => api.get<DetallePreview[]>(`/liquidaciones/propietarios/${propietario.id}/${mes}/preview`),
  });

  const [itemsPorPropiedad, setItemsPorPropiedad] = useState<Record<string, ItemEditable[]> | null>(null);

  useEffect(() => {
    if (preview.data && itemsPorPropiedad === null) {
      const inicial: Record<string, ItemEditable[]> = {};
      for (const d of preview.data) {
        inicial[d.propiedadId] = d.items.map((it) => ({
          descripcion: it.descripcion,
          monto: String(it.monto),
          numeroLiquidacion: it.numeroLiquidacion ?? '',
        }));
      }
      setItemsPorPropiedad(inicial);
    }
    // Solo precarga la primera vez que llega la vista previa; después el
    // usuario es dueño del estado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview.data]);

  const generar = useMutation({
    mutationFn: () =>
      api.post<Liquidacion>(`/liquidaciones/propietarios/${propietario.id}/${mes}`, {
        detalle: (preview.data ?? []).map((d) => ({
          propiedadId: d.propiedadId,
          items: (itemsPorPropiedad?.[d.propiedadId] ?? [])
            .filter((it) => it.descripcion.trim())
            .map((it) => ({
              descripcion: it.descripcion.trim(),
              monto: Number(it.monto) || 0,
              numeroLiquidacion: it.numeroLiquidacion.trim() || undefined,
            })),
        })),
      }),
    // Generar la liquidación crea un movimiento automático en Caja
    // (LIQUIDACION_PROPIETARIO) y puede aparecer en Avisos ("liquidación
    // lista para compartir") — sin esto, Caja y Avisos quedaban con datos
    // viejos hasta recargar la página.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['caja'] });
      qc.invalidateQueries({ queryKey: ['reportes'] });
      qc.invalidateQueries({ queryKey: ['avisos'] });
    },
  });

  const L = generar.data;
  const comprobanteRef = useRef<HTMLDivElement>(null);
  const [enviandoWhatsapp, setEnviandoWhatsapp] = useState(false);

  async function enviarPorWhatsapp() {
    if (!comprobanteRef.current || !propietario.telefono || !L) return;
    setEnviandoWhatsapp(true);
    try {
      await descargarPdfComprobante(comprobanteRef.current, `Liquidacion ${L.numero} - ${propietario.nombre}.pdf`);
      const texto = `Hola ${propietario.nombre}, te comparto la Liquidación N° ${L.numero} de ${mesLabel(mes)}. Te dejo el PDF descargado — adjuntalo acá mismo en el chat.`;
      window.open(`https://wa.me/${propietario.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`, '_blank');
    } finally {
      setEnviandoWhatsapp(false);
    }
  }

  function actualizarItem(propiedadId: string, idx: number, campo: keyof ItemEditable, valor: string) {
    setItemsPorPropiedad((prev) => {
      if (!prev) return prev;
      return { ...prev, [propiedadId]: prev[propiedadId].map((it, i) => (i === idx ? { ...it, [campo]: valor } : it)) };
    });
  }
  function agregarItem(propiedadId: string) {
    setItemsPorPropiedad((prev) => {
      if (!prev) return prev;
      return { ...prev, [propiedadId]: [...prev[propiedadId], { descripcion: '', monto: '0', numeroLiquidacion: '' }] };
    });
  }
  function quitarItem(propiedadId: string, idx: number) {
    setItemsPorPropiedad((prev) => {
      if (!prev) return prev;
      return { ...prev, [propiedadId]: prev[propiedadId].filter((_, i) => i !== idx) };
    });
  }

  // Mismo cálculo que `LiquidacionesService.calcularDetalle()` en el
  // backend, para que el total que se ve acá mientras se edita coincida con
  // el que va a quedar guardado al emitir.
  function honorariosDe(pct: number, items: ItemEditable[]) {
    const alquiler = Number(items.find((it) => it.descripcion === 'Alquiler')?.monto ?? 0);
    return Math.round(alquiler * (pct / 100) * 100) / 100;
  }

  const netoEditable = (preview.data ?? []).reduce((acc, d) => {
    const items = itemsPorPropiedad?.[d.propiedadId] ?? [];
    const cobrado = items.reduce((s, it) => s + (Number(it.monto) || 0), 0);
    return acc + (cobrado - d.gastosAbsorbidos - honorariosDe(d.porcentajeHonorarios, items));
  }, 0);

  const neto = L ? Number(L.netoAGirar) : netoEditable;

  return (
    <Modal open onClose={onClose} title={`Liquidación — ${propietario.nombre}`} width={620}>
      {preview.isPending && <div className="loadstate">Calculando liquidación…</div>}
      {preview.isError && <div className="errstate">No se pudo calcular la liquidación.</div>}
      {generar.isError && (
        <div className="errstate">
          {generar.error instanceof ApiError ? generar.error.message : 'No se pudo emitir la liquidación.'}
        </div>
      )}

      {!L && preview.data && itemsPorPropiedad && (
        <>
          {preview.data.length === 0 && (
            <div className="okstate">
              <div className="big">▤</div>
              <h4>Sin movimientos en {mesLabel(mes)}</h4>
              <p>No hay cobros registrados para este propietario este mes.</p>
            </div>
          )}
          {preview.data.map((d) => {
            const items = itemsPorPropiedad[d.propiedadId] ?? [];
            const honorarios = honorariosDe(d.porcentajeHonorarios, items);
            return (
              <div key={d.propiedadId} style={{ marginBottom: 18 }}>
                <div className="fg full" style={{ marginBottom: 4 }}>
                  <label>{d.propiedadNombre} — Cobrado</label>
                </div>
                <div className="itemlist">
                  {items.map((it, idx) => (
                    <div className="itemrow" key={idx}>
                      <input
                        className="itemdesc"
                        value={it.descripcion}
                        onChange={(e) => actualizarItem(d.propiedadId, idx, 'descripcion', e.target.value)}
                        placeholder="Descripción"
                      />
                      <input
                        className="itemmonto"
                        type="number"
                        step="0.01"
                        value={it.monto}
                        onChange={(e) => actualizarItem(d.propiedadId, idx, 'monto', e.target.value)}
                      />
                      <input
                        className="itemliq"
                        inputMode="numeric"
                        placeholder="Liq"
                        title="Número de liquidación"
                        value={it.numeroLiquidacion}
                        onChange={(e) =>
                          actualizarItem(d.propiedadId, idx, 'numeroLiquidacion', e.target.value.replace(/\D/g, ''))
                        }
                      />
                      <button className="btn-sm ghostred" onClick={() => quitarItem(d.propiedadId, idx)} title="Quitar ítem">
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <button className="btn-sm" style={{ marginTop: 8 }} onClick={() => agregarItem(d.propiedadId)}>
                  + Agregar item
                </button>

                {d.gastosDetalle.map((g, i) => (
                  <div className="liqline neg" key={i} style={{ marginTop: i === 0 ? 10 : 0 }}>
                    <span className="ld" style={{ paddingLeft: 16 }}>
                      ↳ {g.descripcion}
                    </span>
                    <span className="lv">− {formatMoney(g.monto)}</span>
                  </div>
                ))}
                <div className="liqline neg">
                  <span className="ld">Honorarios ({d.porcentajeHonorarios}% del alquiler)</span>
                  <span className="lv">− {formatMoney(honorarios)}</span>
                </div>
              </div>
            );
          })}
          {preview.data.length > 0 && (
            <div className="liqline tot">
              <span className="ld">Total a liquidar</span>
              <span className="lv" style={{ color: netoEditable >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {formatMoney(netoEditable)}
              </span>
            </div>
          )}
          <div className="btnrow noprint">
            <button className="btn-ghost" onClick={onClose}>
              Cancelar
            </button>
            <button
              className="btn-dark"
              disabled={generar.isPending || preview.data.length === 0}
              onClick={() => generar.mutate()}
            >
              Emitir liquidación
            </button>
          </div>
        </>
      )}

      {L && (
        <>
          <ComprobanteImpreso cfg={cfg} ref={comprobanteRef}>
            <LiquidacionComprobanteBody propietarioNombre={propietario.nombre} mesTexto={mesLabel(mes)} L={L} />
          </ComprobanteImpreso>
          <div className="btnrow noprint">
            <button className="btn-ghost" onClick={onClose}>
              Cerrar
            </button>
            {propietario.telefono && (
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
