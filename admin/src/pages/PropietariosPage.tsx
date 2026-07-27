import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { formatMoney, mesActualStr, mesLabel } from '../lib/format';

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

interface LiquidacionItem {
  descripcion: string;
  monto: number | string;
}

interface LiquidacionDetalle {
  propiedadId: string;
  cobradoTotal: number | string;
  gastosAbsorbidos: number | string;
  honorarios: number | string;
  neto: number | string;
  items: LiquidacionItem[];
  propiedad: { nombre: string };
}

interface Liquidacion {
  numero: number;
  netoAGirar: number | string;
  detalle: LiquidacionDetalle[];
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
  const generar = useMutation({
    mutationFn: () => api.post<Liquidacion>(`/liquidaciones/propietarios/${propietario.id}/${mes}`),
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

  useEffect(() => {
    generar.mutate();
    // Se genera una sola vez al abrir el modal, no en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const L = generar.data;
  const cobradoTotal = (L?.detalle ?? []).reduce((s, d) => s + Number(d.cobradoTotal), 0);
  const honorariosTotal = (L?.detalle ?? []).reduce((s, d) => s + Number(d.honorarios), 0);
  const neto = L ? Number(L.netoAGirar) : 0;

  return (
    <Modal open onClose={onClose} title={`Liquidación — ${propietario.nombre}`} width={560}>
      {generar.isPending && <div className="loadstate">Generando liquidación…</div>}
      {generar.isError && (
        <div className="errstate">
          {generar.error instanceof ApiError ? generar.error.message : 'No se pudo generar la liquidación.'}
        </div>
      )}
      {L && (
        <>
          <div className="liqcard" style={{ boxShadow: 'none' }}>
            <div className="liqhead">
              <div className="avatar">{iniciales(propietario.nombre)}</div>
              <div>
                <h4>{propietario.nombre}</h4>
                <div className="lsub">
                  {L.detalle.length} {L.detalle.length === 1 ? 'propiedad' : 'propiedades'} · {mesLabel(mes)}
                </div>
              </div>
              <span className="spacer"></span>
              <div className="lnet">
                <b>NETO A GIRAR</b>
                <span style={{ color: neto >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatMoney(neto)}</span>
              </div>
            </div>
            <div className="liqbody">
              {L.detalle.length === 0 && (
                <div className="okstate">
                  <div className="big">▤</div>
                  <h4>Sin movimientos en {mesLabel(mes)}</h4>
                  <p>No hay cobros registrados para este propietario este mes.</p>
                </div>
              )}
              {L.detalle.map((d) => (
                <div key={d.propiedadId}>
                  <div className="liqline pos">
                    <span className="ld">Cobrado — {d.propiedad.nombre}</span>
                    <span className="lv">{formatMoney(d.cobradoTotal)}</span>
                  </div>
                  {Number(d.gastosAbsorbidos) > 0 && (
                    <div className="liqline neg">
                      <span className="ld" style={{ paddingLeft: 16 }}>
                        ↳ Gastos absorbidos<small>{d.propiedad.nombre}</small>
                      </span>
                      <span className="lv">− {formatMoney(d.gastosAbsorbidos)}</span>
                    </div>
                  )}
                </div>
              ))}
              {L.detalle.length > 0 && (
                <>
                  <div className="liqline neg">
                    <span className="ld">
                      Honorarios profesionales
                      <small>según el % de cada propiedad · sobre {formatMoney(cobradoTotal)} cobrado</small>
                    </span>
                    <span className="lv">− {formatMoney(honorariosTotal)}</span>
                  </div>
                  <div className="liqline tot">
                    <span className="ld">Total a liquidar</span>
                    <span className="lv" style={{ color: neto >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      {formatMoney(neto)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
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
