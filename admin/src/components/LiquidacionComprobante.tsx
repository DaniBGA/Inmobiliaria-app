import { formatMoney } from '../lib/format';

export interface LiquidacionItem {
  descripcion: string;
  monto: number | string;
  numeroLiquidacion?: string | null;
}

export interface GastoDetalle {
  descripcion: string;
  monto: number | string;
}

export interface LiquidacionDetalle {
  propiedadId: string;
  cobradoTotal: number | string;
  gastosAbsorbidos: number | string;
  gastos: GastoDetalle[];
  honorarios: number | string;
  honorariosAdministracion: number | string;
  neto: number | string;
  items: LiquidacionItem[];
  propiedad: { nombre: string };
}

export interface Liquidacion {
  numero: number;
  netoAGirar: number | string;
  detalle: LiquidacionDetalle[];
}

function iniciales(nombre: string) {
  return nombre.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

// Cuerpo de la liquidación YA EMITIDA (no la vista previa editable, que
// sigue viviendo aparte en `PropietariosPage.tsx::LiquidacionModal`) — mismo
// markup usado en dos lugares reales: el modal de Propietarios (visible en
// pantalla) y `AvisosPage.tsx` (invisible, solo para generar el PDF que
// descarga el botón "Descargar PDF" de la tarjeta "Liquidación lista").
export function LiquidacionComprobanteBody({
  propietarioNombre,
  mesTexto,
  L,
}: {
  propietarioNombre: string;
  mesTexto: string;
  L: Liquidacion;
}) {
  const neto = Number(L.netoAGirar);
  return (
    <div className="liqcard" style={{ boxShadow: 'none' }}>
      <div className="liqhead">
        <div className="avatar">{iniciales(propietarioNombre)}</div>
        <div>
          <h4>{propietarioNombre}</h4>
          <div className="lsub">
            Liquidación N° {L.numero} · {L.detalle.length} {L.detalle.length === 1 ? 'propiedad' : 'propiedades'} · {mesTexto}
          </div>
        </div>
        <span className="spacer"></span>
        <div className="lnet">
          <b>NETO A GIRAR</b>
          <span style={{ color: neto >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatMoney(neto)}</span>
        </div>
      </div>
      <div className="liqbody">
        {L.detalle.map((d) => (
          <div key={d.propiedadId}>
            <div className="liqline pos">
              <span className="ld">
                <b>{d.propiedad.nombre}</b>
              </span>
              <span className="lv">{formatMoney(d.cobradoTotal)}</span>
            </div>
            {d.items.map((it, i) => (
              <div className="liqline" key={i}>
                <span className="ld" style={{ paddingLeft: 16 }}>
                  {it.descripcion}
                  {it.numeroLiquidacion && <small style={{ color: 'var(--muted)' }}> · Liq N° {it.numeroLiquidacion}</small>}
                </span>
                <span className="lv">{formatMoney(it.monto)}</span>
              </div>
            ))}
            {d.gastos.map((g, i) => (
              <div className="liqline neg" key={i}>
                <span className="ld" style={{ paddingLeft: 16 }}>
                  ↳ {g.descripcion}
                </span>
                <span className="lv">− {formatMoney(g.monto)}</span>
              </div>
            ))}
          </div>
        ))}
        {L.detalle.length > 0 && (
          <>
            {L.detalle.some((d) => Number(d.honorariosAdministracion) > 0) && (
              <div className="liqline neg">
                <span className="ld">
                  Honorarios de administración
                  <small>según el % de cada propiedad</small>
                </span>
                <span className="lv">
                  − {formatMoney(L.detalle.reduce((s, d) => s + Number(d.honorariosAdministracion), 0))}
                </span>
              </div>
            )}
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
  );
}
