import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import { useConfiguracion } from '../hooks/useConfiguracion';
import { useEnviarComprobantePorWhatsapp } from '../hooks/useEnviarComprobantePorWhatsapp';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { ComprobanteImpreso } from '../components/ComprobanteImpreso';
import { LiquidacionComprobanteBody, type Liquidacion, type GastoDetalle, type LiquidacionItem } from '../components/LiquidacionComprobante';
import { formatMoney, mesActualStr, mesLabel, sumarMesesStr } from '../lib/format';
import { splitDescripcionCuenta, combinarDescripcionCuenta, esServicioConCuenta } from '../lib/itemServicioCuenta';
import { SeccionGuia } from '../components/SeccionGuia';

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
  honorariosAdministracion: number;
  porcentajeHonorariosAdministracion: number;
  neto: number;
  items: LiquidacionItem[];
}

interface ItemEditable {
  descripcion: string;
  cuenta: string;
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
  // Mes de la liquidación a imprimir — no tiene por qué ser el actual: se
  // puede armar por adelantado la de un mes próximo (pedido del usuario).
  // También mueve el mes de `resumenMes` (los badges Pagado/No pagado de
  // cada propiedad), para que reflejen el mismo período que se está por
  // liquidar en vez de siempre el actual.
  const [mes, setMes] = useState(mesActualStr());
  const [liqDe, setLiqDe] = useState<Propietario | null>(null);
  const [editDe, setEditDe] = useState<Propietario | null>(null);
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
    queryKey: ['cobros', 'mes', mes],
    queryFn: () => api.get<ResumenMes>(`/cobros/mes/${mes}`),
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
        <SeccionGuia
          icono="◉"
          titulo="¿Qué podés hacer en Propietarios y Liquidaciones?"
          intro="Cada tarjeta agrupa a un propietario con todas sus propiedades y da acceso directo a liquidarle el mes."
          paginas={[
            [
              {
                titulo: 'Datos de contacto y propiedades',
                subtitulo:
                  'Cada tarjeta muestra teléfono, email y sus propiedades, con el estado de pago del mes elegido (Disponible, En venta, Pagado, No pagado).',
              },
              {
                titulo: 'Editar propietario',
                subtitulo: 'El botón "✎ Editar" corrige nombre, teléfono o email.',
                pasos: ['Hacé clic en "✎ Editar" en la tarjeta.', 'Corregí los datos y confirmá con "Guardar".'],
              },
              {
                titulo: 'Eliminar propietario',
                subtitulo:
                  'El botón "Eliminar" lo borra junto con todo su historial de liquidaciones; sus propiedades quedan sin propietario asignado.',
              },
              {
                titulo: 'Navegador de mes',
                subtitulo:
                  'Arriba de las tarjetas podés moverte a un mes pasado o futuro — cambia tanto el estado de pago de cada propiedad como el mes que se va a liquidar.',
              },
            ],
            [
              {
                titulo: 'Imprimir / emitir liquidación',
                subtitulo:
                  'El botón "▤ Imprimir liquidación de {mes}" calcula una vista previa editable con lo cobrado, los gastos absorbidos y los honorarios de administración ya descontados.',
                pasos: [
                  'Elegí el mes con el navegador de arriba (puede ser un mes futuro).',
                  'Ajustá los montos, agregá o quitá ítems y cargá el N° de cuenta/usuario si el servicio lo tiene.',
                  'Confirmá con "Emitir liquidación" para generarla y descontarla en Caja.',
                ],
              },
              {
                titulo: 'Comprobante',
                subtitulo: 'Una vez emitida, se puede imprimir o enviar por WhatsApp con el PDF ya adjunto.',
              },
              {
                titulo: 'Ítems con N° de cuenta propio',
                subtitulo:
                  'Cada renglón de "Cobrado" tiene su propio campo de N° de cuenta/usuario, separado del nombre del servicio.',
              },
            ],
          ]}
        />
        <div className="monthbar" style={{ marginBottom: 18 }}>
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
        </div>
        <div className="owners">
          {lista.map((o) => {
            const mias = propiedadesPorPropietario.get(o.id) ?? [];
            return (
              <div className="ownercard" key={o.id}>
                <div className="top">
                  <div className="avatar">{iniciales(o.nombre)}</div>
                  <div style={{ flex: '1 1 150px', minWidth: 150 }}>
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
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginLeft: 'auto', justifyContent: 'flex-end' }}>
                    {o.grandesActivos && <span className="tag-big" style={{ marginLeft: 0 }}>GRANDES ACTIVOS</span>}
                    <button className="btn-sm" onClick={() => setEditDe(o)}>
                      ✎ Editar
                    </button>
                    <button
                      className="btn-sm ghostred"
                      disabled={eliminarPropietario.isPending}
                      onClick={() => pedirEliminar(o, mias.length)}
                    >
                      Eliminar
                    </button>
                  </div>
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
                  ▤ Imprimir liquidación de {mesLabel(mes)}
                </button>
              </div>
            );
          })}
          {lista.length === 0 && <div className="empty">Sin propietarios cargados.</div>}
        </div>
      </main>

      {liqDe && <LiquidacionModal propietario={liqDe} mes={mes} onClose={() => setLiqDe(null)} />}
      {editDe && (
        <EditarPropietarioModal
          propietario={editDe}
          onClose={() => setEditDe(null)}
          onSaved={() => {
            setEditDe(null);
            qc.invalidateQueries({ queryKey: ['propietarios'] });
            qc.invalidateQueries({ queryKey: ['propiedades'] });
          }}
        />
      )}
    </>
  );
}

// Único lugar del admin donde se puede tocar nombre/teléfono/email de un
// Propietario (modelo aparte de Cliente, aunque todo propietario nuevo
// también se registre como Cliente — ver AgregarPropiedadPage) — antes no
// existía ningún formulario para esto, así que un teléfono cargado desde
// Clientes nunca llegaba a la ficha de la propiedad, que siempre lee de acá.
function EditarPropietarioModal({
  propietario,
  onClose,
  onSaved,
}: {
  propietario: Propietario;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nombre, setNombre] = useState(propietario.nombre);
  const [telefono, setTelefono] = useState(propietario.telefono ?? '');
  const [email, setEmail] = useState(propietario.email ?? '');
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: () =>
      api.patch(`/propietarios/${propietario.id}`, {
        nombre: nombre.trim(),
        telefono: telefono.trim() || undefined,
        email: email.trim() || undefined,
      }),
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo guardar el propietario.'),
  });

  return (
    <Modal open onClose={onClose} title={`Editar Propietario — ${propietario.nombre}`} width={420}>
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

  const configuracion = useConfiguracion<Configuracion>();
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
        inicial[d.propiedadId] = d.items.map((it) => {
          // El N° de cuenta/usuario viene pegado a la descripción del
          // servicio (ver datosCuentaSuffix() en el backend) — se separa
          // para su propio input y se vuelve a unir al emitir (mismo
          // criterio que FacturaModal).
          const { base, cuenta } = splitDescripcionCuenta(it.descripcion);
          return {
            descripcion: base,
            cuenta,
            // Un ítem sin monto previo llega en 0 — se muestra vacío en vez
            // de "0" para que quede claro que falta cargarlo, no que valga
            // cero (mismo criterio que FacturaModal).
            monto: it.monto ? String(it.monto) : '',
            numeroLiquidacion: it.numeroLiquidacion ?? '',
          };
        });
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
              descripcion: combinarDescripcionCuenta(it.descripcion.trim(), it.cuenta),
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
  const { enviando: enviandoWhatsapp, enviar: enviarComprobante } = useEnviarComprobantePorWhatsapp();

  async function enviarPorWhatsapp() {
    if (!L) return;
    const texto = `Hola ${propietario.nombre}, te comparto la Liquidación N° ${L.numero} de ${mesLabel(mes)}. Te dejo el PDF descargado — adjuntalo acá mismo en el chat.`;
    await enviarComprobante({
      elemento: comprobanteRef.current,
      telefono: propietario.telefono,
      nombreArchivo: `Liquidacion ${L.numero} - ${propietario.nombre}.pdf`,
      texto,
    });
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
      return { ...prev, [propiedadId]: [...prev[propiedadId], { descripcion: '', cuenta: '', monto: '', numeroLiquidacion: '' }] };
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
  // el que va a quedar guardado al emitir. Los honorarios profesionales no
  // aplican a alquiler (solo a venta), así que acá solo se descuentan los
  // de administración.
  function honorariosDe(pct: number, items: ItemEditable[]) {
    // "startsWith" además del match exacto: si se editó el texto del ítem
    // (ej. "Alquiler (ajustado)"), no debe perderse el cálculo de honorarios.
    const alquiler = Number(
      items.find((it) => it.descripcion === 'Alquiler' || it.descripcion.startsWith('Alquiler ('))?.monto ?? 0,
    );
    return Math.round(alquiler * (pct / 100) * 100) / 100;
  }

  const netoEditable = (preview.data ?? []).reduce((acc, d) => {
    const items = itemsPorPropiedad?.[d.propiedadId] ?? [];
    const cobrado = items.reduce((s, it) => s + (Number(it.monto) || 0), 0);
    return acc + (cobrado - d.gastosAbsorbidos - honorariosDe(d.porcentajeHonorariosAdministracion, items));
  }, 0);

  return (
    <Modal open onClose={onClose} title={`Liquidación — ${propietario.nombre} (${mesLabel(mes)})`} width={620}>
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
            const honorariosAdministracion = honorariosDe(d.porcentajeHonorariosAdministracion, items);
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
                      {esServicioConCuenta(it.descripcion) ? (
                        <input
                          className="itemcuenta"
                          placeholder="N° cuenta / usuario"
                          title="N° de cuenta / usuario del servicio"
                          value={it.cuenta}
                          onChange={(e) => actualizarItem(d.propiedadId, idx, 'cuenta', e.target.value)}
                        />
                      ) : (
                        <div className="itemcuenta" />
                      )}
                      <input
                        className="itemmonto"
                        type="number"
                        step="0.01"
                        placeholder="0"
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
                {d.porcentajeHonorariosAdministracion > 0 && (
                  <div className="liqline neg">
                    <span className="ld">Honorarios de administración ({d.porcentajeHonorariosAdministracion}% del alquiler)</span>
                    <span className="lv">− {formatMoney(honorariosAdministracion)}</span>
                  </div>
                )}
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
