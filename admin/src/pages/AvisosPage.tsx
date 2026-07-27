import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { PageHeader } from '../components/PageHeader';
import { formatMoney, formatDate } from '../lib/format';

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
  propietario: PersonaContacto | null;
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
        <div className="notice">
          <div className="ico">✉</div>
          <div>
            <b>Centro de avisos</b>
            <p>
              El sistema detecta solo a quién hay que escribirle hoy y redacta el mensaje. Revisalo y enviálo por
              WhatsApp o por email con un clic. La edición del texto es solo para este envío: no se guarda. Si un
              aviso ya no te sirve (lo resolviste por otro lado), lo podés eliminar con la ✕ — no vuelve a aparecer
              a menos que la situación que lo generó cambie.
            </p>
          </div>
        </div>

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
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </main>
    </>
  );
}

function AvisoCard({ item, onEliminar }: { item: AvisoItem; onEliminar: () => void }) {
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
