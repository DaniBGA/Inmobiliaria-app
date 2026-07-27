import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { Modal } from '../components/Modal';
import { formatDate, mesActualStr, sumarMesesStr, mesLabel } from '../lib/format';

type TipoEventoManual = 'VISITA' | 'REUNION' | 'FIRMA_BOLETO' | 'FIRMA_ESCRITURA' | 'TASACION' | 'LLAMADO' | 'TAREA';
type TipoEventoAuto = 'VENCIMIENTO_CONTRATO' | 'AUMENTO_PROXIMO' | 'INCIDENCIA_ABIERTA' | 'INCIDENCIA_EJECUCION';

interface Propiedad {
  id: string;
  nombre: string;
}
interface Cliente {
  id: string;
  nombre: string;
}

interface EventoManual {
  id: string;
  fecha: string;
  tipo: TipoEventoManual;
  titulo: string;
  hecho: boolean;
  clienteId: string | null;
  propiedadId: string | null;
  cliente: Cliente | null;
  propiedad: Propiedad | null;
}

interface EventoAuto {
  tipo: TipoEventoAuto;
  fecha: string;
  titulo: string;
  propiedadId?: string;
  incidenciaId?: string;
  automatico: true;
}

interface EventosDelMes {
  mes: string;
  manuales: EventoManual[];
  automaticos: EventoAuto[];
}

interface Combinado {
  key: string;
  id: string | null;
  fecha: string;
  clase: string;
  icono: string;
  titulo: string;
  hecho: boolean;
  automatico: boolean;
  propiedadNombre: string | null;
  clienteNombre: string | null;
}

const TIPO_MANUAL_LABEL: Record<TipoEventoManual, string> = {
  VISITA: 'Visita',
  REUNION: 'Reunión',
  FIRMA_BOLETO: 'Firma de boleto',
  FIRMA_ESCRITURA: 'Firma de escritura',
  TASACION: 'Tasación',
  LLAMADO: 'Llamado',
  TAREA: 'Tarea',
};
const TIPO_MANUAL_CLASE: Record<TipoEventoManual, string> = {
  VISITA: 'visita',
  REUNION: 'reunion',
  FIRMA_BOLETO: 'firma',
  FIRMA_ESCRITURA: 'firma',
  TASACION: 'tasacion',
  LLAMADO: 'llamado',
  TAREA: 'tarea',
};
const TIPO_MANUAL_ICO: Record<TipoEventoManual, string> = {
  VISITA: '◎',
  REUNION: '◫',
  FIRMA_BOLETO: '✎',
  FIRMA_ESCRITURA: '✒',
  TASACION: '▤',
  LLAMADO: '✆',
  TAREA: '✓',
};
const TIPO_AUTO_CLASE: Record<TipoEventoAuto, string> = {
  VENCIMIENTO_CONTRATO: 'auto',
  AUMENTO_PROXIMO: 'auto',
  INCIDENCIA_ABIERTA: 'incidencia',
  INCIDENCIA_EJECUCION: 'ejecucion',
};
const TIPO_AUTO_ICO: Record<TipoEventoAuto, string> = {
  VENCIMIENTO_CONTRATO: '◷',
  AUMENTO_PROXIMO: '▲',
  INCIDENCIA_ABIERTA: '⚒',
  INCIDENCIA_EJECUCION: '⚙',
};

const VENTANA_AUTO_DIAS = 60;
const DOW = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

function diasHasta(fechaIso: string): number {
  const hoy = new Date();
  const hoyUTC = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const f = new Date(fechaIso);
  const fUTC = Date.UTC(f.getUTCFullYear(), f.getUTCMonth(), f.getUTCDate());
  return Math.round((fUTC - hoyUTC) / 86400000);
}

function hoyStrUTC(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function AgendaPage() {
  const qc = useQueryClient();
  const [mes, setMes] = useState(mesActualStr());
  const [diaSel, setDiaSel] = useState<string | null>(null);
  const [verHechos, setVerHechos] = useState(false);
  const [modal, setModal] = useState<'new' | EventoManual | null>(null);

  const eventosDelMes = useQuery({
    queryKey: ['agenda', 'mes', mes],
    queryFn: () => api.get<EventosDelMes>(`/agenda/mes/${mes}`),
  });
  const propiedades = useQuery({
    queryKey: ['propiedades'],
    queryFn: () => api.get<Propiedad[]>('/propiedades'),
  });
  const clientes = useQuery({
    queryKey: ['clientes'],
    queryFn: () => api.get<Cliente[]>('/clientes'),
  });

  function invalidar() {
    qc.invalidateQueries({ queryKey: ['agenda'] });
    // Marcar/crear un evento manual cambia los "recordatorios" de Avisos.
    qc.invalidateQueries({ queryKey: ['avisos'] });
  }

  const marcarHecho = useMutation({
    mutationFn: ({ id, hecho }: { id: string; hecho: boolean }) => api.patch(`/agenda/${id}/hecho`, { hecho }),
    onSuccess: invalidar,
  });

  if (eventosDelMes.isLoading) {
    return (
      <>
        <PageHeader title="Agenda" />
        <main>
          <div className="loadstate">Cargando…</div>
        </main>
      </>
    );
  }

  const manuales = eventosDelMes.data?.manuales ?? [];
  const automaticos = eventosDelMes.data?.automaticos ?? [];

  const combinados: Combinado[] = [
    ...manuales.map((e) => ({
      key: `m-${e.id}`,
      id: e.id,
      fecha: e.fecha,
      clase: TIPO_MANUAL_CLASE[e.tipo],
      icono: TIPO_MANUAL_ICO[e.tipo],
      titulo: e.titulo,
      hecho: e.hecho,
      automatico: false,
      propiedadNombre: e.propiedad?.nombre ?? null,
      clienteNombre: e.cliente?.nombre ?? null,
    })),
    ...automaticos.map((e, i) => ({
      key: `a-${e.tipo}-${i}`,
      id: null,
      fecha: e.fecha,
      clase: TIPO_AUTO_CLASE[e.tipo],
      icono: TIPO_AUTO_ICO[e.tipo],
      titulo: e.titulo,
      hecho: false,
      automatico: true,
      propiedadNombre: null,
      clienteNombre: null,
    })),
  ];

  // KPIs (§2.7): "hoy" y "esta semana" cuentan todo lo pendiente en rango;
  // "atrasados" solo cuenta automáticos dentro de una ventana de 60 días —
  // pasado eso ya es historia, no un pendiente real (vencimientos viejos no
  // se pueden marcar como hechos, así que quedarían para siempre si no).
  const hoy = hoyStrUTC();
  const delHoy = combinados.filter((e) => e.fecha.slice(0, 10) === hoy && (verHechos || !e.hecho));
  const en7 = combinados.filter((e) => {
    const d = diasHasta(e.fecha);
    return d >= 0 && d <= 7 && !e.hecho;
  });
  const visitas = combinados.filter((e) => e.clase === 'visita' && !e.hecho && diasHasta(e.fecha) >= 0);
  const atrasados = combinados.filter((e) => {
    const d = diasHasta(e.fecha);
    if (d >= 0 || e.hecho) return false;
    return e.automatico ? d >= -VENTANA_AUTO_DIAS : true;
  });

  // Calendario del mes
  const [anio, mesIdx] = mes.split('-').map(Number);
  const primerDia = new Date(anio, mesIdx - 1, 1);
  const diasEnMes = new Date(anio, mesIdx, 0).getDate();
  const offset = (primerDia.getDay() + 6) % 7;

  const eventosPorDia = new Map<string, Combinado[]>();
  for (const e of combinados) {
    const k = e.fecha.slice(0, 10);
    const lista = eventosPorDia.get(k) ?? [];
    lista.push(e);
    eventosPorDia.set(k, lista);
  }

  const celdas: { key: string; dia?: number; fechaStr?: string }[] = [];
  for (let i = 0; i < offset; i++) celdas.push({ key: `off-${i}` });
  for (let d = 1; d <= diasEnMes; d++) {
    const fechaStr = `${mes}-${String(d).padStart(2, '0')}`;
    celdas.push({ key: fechaStr, dia: d, fechaStr });
  }

  let listaLateral: Combinado[];
  let tituloLateral: string;
  if (diaSel) {
    listaLateral = (eventosPorDia.get(diaSel) ?? []).filter((e) => verHechos || !e.hecho);
    tituloLateral = `EVENTOS DEL ${diaSel.split('-').reverse().join('/')}`;
  } else {
    listaLateral = combinados
      .filter((e) => diasHasta(e.fecha) >= 0 && (verHechos || !e.hecho))
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .slice(0, 12);
    tituloLateral = 'PRÓXIMOS EVENTOS';
  }

  return (
    <>
      <PageHeader title="Agenda" />
      <main>
        <div className="kpis">
          <div className={`kpi${delHoy.length ? ' alert' : ''}`}>
            <div className="lbl">Hoy</div>
            <div className="val">{String(delHoy.length).padStart(2, '0')}</div>
            <div className="hint">{delHoy.length ? 'eventos para hoy' : 'nada agendado hoy'}</div>
          </div>
          <div className="kpi">
            <div className="lbl">Esta semana</div>
            <div className="val">{String(en7.length).padStart(2, '0')}</div>
            <div className="hint">próximos 7 días</div>
          </div>
          <div className="kpi">
            <div className="lbl">Visitas agendadas</div>
            <div className="val">{String(visitas.length).padStart(2, '0')}</div>
            <div className="hint">pendientes</div>
          </div>
          <div className={`kpi${atrasados.length ? ' alert' : ''}`}>
            <div className="lbl">Atrasados</div>
            <div className="val">{String(atrasados.length).padStart(2, '0')}</div>
            <div className="hint">sin marcar como hechos</div>
          </div>
        </div>

        <div className="tablewrap" style={{ marginBottom: 18 }}>
          <div className="monthbar">
            <button className="navm" onClick={() => setMes(sumarMesesStr(mes, -1))} title="Mes anterior">
              ‹
            </button>
            <span className="mlabel">{mesLabel(mes)}</span>
            <button className="navm" onClick={() => setMes(sumarMesesStr(mes, 1))} title="Mes siguiente">
              ›
            </button>
            <button
              className="btn-sm"
              onClick={() => {
                setMes(mesActualStr());
                setDiaSel(null);
              }}
            >
              Mes actual
            </button>
            <span className="spacer"></span>
            <label className="chk" style={{ marginRight: 12 }}>
              <input type="checkbox" checked={verHechos} onChange={(e) => setVerHechos(e.target.checked)} />
              <span>Ver los ya hechos</span>
            </label>
            <button className="btn-sm solid" onClick={() => setModal('new')}>
              + Nuevo evento
            </button>
          </div>
        </div>

        <div className="agsplit">
          <div className="panel" style={{ padding: 20 }}>
            <h3 style={{ marginBottom: 14 }}>CALENDARIO</h3>
            <div className="calgrid">
              {DOW.map((d) => (
                <div className="dow" key={d}>
                  {d}
                </div>
              ))}
            </div>
            <div className="calgrid">
              {celdas.map((c) => {
                if (!c.fechaStr) return <div className="calday off" key={c.key}></div>;
                const evs = (eventosPorDia.get(c.fechaStr) ?? []).filter((e) => verHechos || !e.hecho);
                const clases = ['calday'];
                if (c.fechaStr === hoy) clases.push('hoy');
                if (c.fechaStr === diaSel) clases.push('sel');
                return (
                  <div
                    className={clases.join(' ')}
                    key={c.key}
                    onClick={() => setDiaSel(diaSel === c.fechaStr ? null : c.fechaStr!)}
                  >
                    <div className="n">{c.dia}</div>
                    <div className="evs">
                      {evs.slice(0, 3).map((e) => (
                        <div className={`calev ${e.clase}${e.hecho ? ' hecho' : ''}`} title={e.titulo} key={e.key}>
                          {e.titulo}
                        </div>
                      ))}
                      {evs.length > 3 && (
                        <div className="calev" style={{ background: 'transparent', color: 'var(--muted)' }}>
                          +{evs.length - 3} más
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="callegend">
              <span>
                <i className="ev visita"></i>Visita
              </span>
              <span>
                <i className="ev reunion"></i>Reunión
              </span>
              <span>
                <i className="ev firma"></i>Firma
              </span>
              <span>
                <i className="ev tarea"></i>Tarea
              </span>
              <span>
                <i className="ev auto"></i>Vencimiento / aumento
              </span>
              <span>
                <i className="ev incidencia" style={{ background: 'var(--orange)' }}></i>Incidencia abierta
              </span>
              <span>
                <i className="ev ejecucion" style={{ background: 'var(--indigo)' }}></i>Ejecución agendada
              </span>
            </div>
          </div>
          <div>
            <h3 className="agtitle">{tituloLateral}</h3>
            {listaLateral.length === 0 ? (
              <div className="okstate" style={{ padding: 32 }}>
                <div className="big">▥</div>
                <h4>{diaSel ? 'Nada agendado este día' : 'No hay eventos próximos'}</h4>
                <p>
                  {diaSel ? (
                    'Hacé clic en "+ Nuevo evento" para agendar algo.'
                  ) : (
                    <>
                      Agendá visitas, reuniones y tareas
                      <br />
                      para verlas acá.
                    </>
                  )}
                </p>
              </div>
            ) : (
              <div className="evlist">
                {listaLateral.map((e) => {
                  const d = diasHasta(e.fecha);
                  const cuando = d === 0 ? 'HOY' : d === 1 ? 'MAÑANA' : d < 0 ? `ATRASADO ${Math.abs(d)}d` : `en ${d} días`;
                  const original = e.id ? manuales.find((m) => m.id === e.id) : null;
                  return (
                    <div
                      className={`evcard ${e.hecho ? 'hecho' : ''} ${e.automatico ? e.clase : ''}`}
                      key={e.key}
                      style={{ cursor: e.automatico ? 'default' : 'pointer' }}
                      onClick={() => original && setModal(original)}
                    >
                      {e.automatico ? (
                        <div className="h">{e.icono}</div>
                      ) : (
                        <input
                          type="checkbox"
                          className="evchk"
                          checked={e.hecho}
                          onClick={(ev) => ev.stopPropagation()}
                          onChange={() => marcarHecho.mutate({ id: e.id!, hecho: !e.hecho })}
                        />
                      )}
                      <div className="b">
                        <div className="t">{e.titulo}</div>
                        <div className="m">
                          {formatDate(e.fecha)} · {cuando}
                          {e.propiedadNombre ? ` · ${e.propiedadNombre}` : ''}
                          {e.clienteNombre ? ` · ${e.clienteNombre}` : ''}
                        </div>
                      </div>
                      <div className="h" style={{ width: 'auto' }}>
                        {e.automatico ? '' : e.icono}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {modal && (
        <EventoModal
          evento={modal === 'new' ? null : modal}
          diaSel={diaSel}
          propiedades={propiedades.data ?? []}
          clientes={clientes.data ?? []}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            invalidar();
          }}
        />
      )}
    </>
  );
}

function EventoModal({
  evento,
  diaSel,
  propiedades,
  clientes,
  onClose,
  onSaved,
}: {
  evento: EventoManual | null;
  diaSel: string | null;
  propiedades: Propiedad[];
  clientes: Cliente[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const esNuevo = !evento;
  const [titulo, setTitulo] = useState(evento?.titulo ?? '');
  const [tipo, setTipo] = useState<TipoEventoManual>(evento?.tipo ?? 'VISITA');
  const [fecha, setFecha] = useState(evento?.fecha.slice(0, 10) ?? diaSel ?? new Date().toISOString().slice(0, 10));
  const [propiedadId, setPropiedadId] = useState(evento?.propiedadId ?? '');
  const [clienteId, setClienteId] = useState(evento?.clienteId ?? '');
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: () => {
      const payload = {
        fecha,
        tipo,
        titulo,
        propiedadId: propiedadId || undefined,
        clienteId: clienteId || undefined,
      };
      return esNuevo ? api.post('/agenda', payload) : api.patch(`/agenda/${evento!.id}`, payload);
    },
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo guardar el evento.'),
  });

  const eliminar = useMutation({
    mutationFn: () => api.delete(`/agenda/${evento!.id}`),
    onSuccess: onSaved,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo eliminar el evento.'),
  });

  return (
    <Modal open onClose={onClose} title={esNuevo ? 'Nuevo Evento' : 'Editar Evento'}>
      {error && <div className="errstate" style={{ marginBottom: 14 }}>{error}</div>}
      <div className="formgrid">
        <div className="fg full">
          <label>Título</label>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </div>
        <div className="fg">
          <label>Tipo</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoEventoManual)}>
            {Object.entries(TIPO_MANUAL_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div className="fg">
          <label>Fecha</label>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </div>
        <div className="fg">
          <label>Propiedad</label>
          <select value={propiedadId} onChange={(e) => setPropiedadId(e.target.value)}>
            <option value="">— Sin propiedad —</option>
            {propiedades.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
        <div className="fg">
          <label>Cliente</label>
          <select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">— Sin cliente —</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
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
        <button className="btn-dark" disabled={guardar.isPending || !titulo.trim()} onClick={() => guardar.mutate()}>
          Guardar
        </button>
      </div>
    </Modal>
  );
}
