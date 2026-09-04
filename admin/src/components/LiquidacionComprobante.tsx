import { formatMoney, mesesContrato } from '../lib/format';
import { ComprobanteInfoBox } from './ComprobanteInfoBox';

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
  facturaNumero: number | null;
  cobradoTotal: number | string;
  gastosAbsorbidos: number | string;
  gastos: GastoDetalle[];
  honorarios: number | string;
  honorariosAdministracion: number | string;
  porcentajeHonorariosAdministracion: number | string;
  baseAlquilerHonorarios: number | string;
  neto: number | string;
  items: LiquidacionItem[];
  propiedad: { nombre: string; contratoInicio: string | null; contratoFin: string | null };
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
  const propiedades = L.detalle.map((d) => d.propiedad.nombre).join(', ') || '—';
  return (
    <>
      <ComprobanteInfoBox
        izquierda={[
          { label: 'Nombre Propietario', valor: propietarioNombre },
          { label: 'Propiedades incluidas', valor: propiedades },
        ]}
        derecha={[{ label: 'Periodo', valor: mesTexto }]}
      />
      <div className="comp-detalletitulo">Detalle de Liquidación</div>
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
          <div className="comp-propgrupo" key={d.propiedadId}>
            <div className="liqline pos">
              <span className="ld">
                <b>{d.propiedad.nombre}</b>
                {d.facturaNumero != null && (
                  <small style={{ color: 'var(--muted)' }}>
                    {' '}
                    · Numero factura {d.facturaNumero}
                    {(() => {
                      const meses = mesesContrato(d.propiedad.contratoInicio, d.propiedad.contratoFin);
                      return meses != null ? `/${meses}` : '';
                    })()}
                  </small>
                )}
              </span>
              <span className="lv">{formatMoney(d.cobradoTotal)}</span>
            </div>
            {d.items.map((it, i) => {
              // Cuando la inmobiliaria paga los servicios (§ pedido del
              // usuario 2026-09-03), el backend manda esos ítems en
              // negativo — se muestran restando, igual criterio visual que
              // los gastos absorbidos de abajo.
              const monto = Number(it.monto);
              const esNegativo = monto < 0;
              return (
                <div className={`liqline${esNegativo ? ' neg' : ''}`} key={i}>
                  <span className="ld" style={{ paddingLeft: 16 }}>
                    {esNegativo && '↳ '}
                    {it.descripcion}
                    {it.numeroLiquidacion && <small style={{ color: 'var(--muted)' }}> · Liq N° {it.numeroLiquidacion}</small>}
                  </span>
                  <span className="lv">{esNegativo ? `− ${formatMoney(Math.abs(monto))}` : formatMoney(monto)}</span>
                </div>
              );
            })}
            {d.gastos.map((g, i) => (
              <div className="liqline neg" key={i}>
                <span className="ld" style={{ paddingLeft: 16 }}>
                  ↳ {g.descripcion}
                </span>
                <span className="lv">− {formatMoney(g.monto)}</span>
              </div>
            ))}
            {/* Por propiedad, no un total combinado (pedido del usuario
                2026-09-03): cada una puede tener un % de honorarios de
                administración distinto, mezclarlas en una sola línea no
                dejaba ver cuánto le correspondía a cuál. */}
            {Number(d.honorariosAdministracion) > 0 && (
              <div className="liqline neg">
                <span className="ld" style={{ paddingLeft: 16 }}>
                  ↳ Honorarios de administración ({Number(d.porcentajeHonorariosAdministracion)}% del alquiler:{' '}
                  {formatMoney(d.baseAlquilerHonorarios)})
                </span>
                <span className="lv">− {formatMoney(d.honorariosAdministracion)}</span>
              </div>
            )}
          </div>
        ))}
        {L.detalle.length > 0 && (
          <>
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
    </>
  );
}
