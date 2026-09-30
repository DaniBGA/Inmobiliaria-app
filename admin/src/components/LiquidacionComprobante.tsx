import { formatMoney, mesesContrato } from '../lib/format';

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

export interface AjusteServicio {
  descripcion: string;
  monto: number | string;
  numeroLiquidacion?: string | null;
}

export interface Liquidacion {
  numero: number;
  netoAGirar: number | string;
  sumaAlquileres: number | string;
  detalle: LiquidacionDetalle[];
  ajustesServicios: AjusteServicio[];
}

// Cuerpo de la liquidación YA EMITIDA (no la vista previa editable, que
// sigue viviendo aparte en `PropietariosPage.tsx::LiquidacionModal`) — mismo
// markup usado en dos lugares reales: el modal de Propietarios (visible en
// pantalla) y `AvisosPage.tsx` (invisible, solo para generar el PDF que
// descarga el botón "Descargar PDF" de la tarjeta "Liquidación lista").
//
// Diseño propio (pedido del usuario 2026-09-30, "Nuevo Modelo" — mockup de
// referencia adjunto): caja de datos en 3 columnas, banner "Neto a girar" y
// tarjetas de propiedad con franja de color en vez del recuadro con avatar
// de antes. Usa clases EXCLUSIVAS (`comp-liq*`), no `.liqcard`/`.liqline` —
// esas las sigue usando el detalle de Factura/Recibo en
// `PropiedadFichaDrawer.tsx`, que no cambia. `comp-propgrupo`/
// `comp-totalesgrupo` se mantienen como clases marcadoras (sin estilo
// propio) porque `lib/pdfComprobante.ts` las usa para el paginado — ver
// comentario ahí (hasta 3 propiedades por hoja, resumen a la hoja
// siguiente si no entra).
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
  const honorariosTotal = L.detalle.reduce((acc, d) => acc + Number(d.honorariosAdministracion), 0);
  return (
    <>
      <div className="comp-liqinfo">
        <div className="comp-liqinfo-col">
          <span className="k">Propietario</span>
          <span className="v">{propietarioNombre}</span>
        </div>
        <div className="comp-liqinfo-col">
          <span className="k">Período</span>
          <span className="v">{mesTexto}</span>
        </div>
        <div className="comp-liqinfo-col">
          <span className="k">Propiedades</span>
          <span className="v">
            {L.detalle.length} {L.detalle.length === 1 ? 'unidad' : 'unidades'}
          </span>
        </div>
      </div>

      <div className="comp-liqneto">
        <div>
          <div className="k">Neto a girar</div>
          <div className="sub">Liquidación N° {L.numero}</div>
        </div>
        <span className="monto">{formatMoney(neto)}</span>
      </div>

      <div className="comp-detalletitulo">Detalle por Propiedad</div>

      {L.detalle.map((d) => (
        <div className="comp-propgrupo comp-liqprop" key={d.propiedadId}>
          <div className="comp-liqprop-head">
            <div>
              <b>{d.propiedad.nombre}</b>
              {d.facturaNumero != null && (
                <span className="sub">
                  Factura N° {d.facturaNumero}
                  {(() => {
                    const meses = mesesContrato(d.propiedad.contratoInicio, d.propiedad.contratoFin);
                    return meses != null ? `/${meses}` : '';
                  })()}
                </span>
              )}
            </div>
            <span className="monto">{formatMoney(d.cobradoTotal)}</span>
          </div>
          {d.items.map((it, i) => (
            <div className="comp-liqrow" key={i}>
              <span className="ld">
                {it.descripcion}
                {it.numeroLiquidacion && <small> · Liq N° {it.numeroLiquidacion}</small>}
              </span>
              <span className="lv">{formatMoney(it.monto)}</span>
            </div>
          ))}
          {d.gastos.map((g, i) => (
            <div className="comp-liqrow neg" key={i}>
              <span className="ld">{g.descripcion}</span>
              <span className="lv">− {formatMoney(g.monto)}</span>
            </div>
          ))}
          {/* Por propiedad, no un total combinado (pedido del usuario
              2026-09-03): cada una puede tener un % de honorarios de
              administración distinto, mezclarlas en una sola línea no
              dejaba ver cuánto le correspondía a cuál. El total combinado
              sí se suma aparte en el resumen de abajo. */}
          {Number(d.honorariosAdministracion) > 0 && (
            <div className="comp-liqrow neg">
              <span className="ld">
                Honorarios de administración ({Number(d.porcentajeHonorariosAdministracion)}% del alquiler:{' '}
                {formatMoney(d.baseAlquilerHonorarios)})
              </span>
              <span className="lv">− {formatMoney(d.honorariosAdministracion)}</span>
            </div>
          )}
        </div>
      ))}

      {L.detalle.length > 0 && (
        <div className="comp-totalesgrupo comp-liqresumen">
          <div className="comp-detalletitulo">Resumen de Liquidación</div>
          <div className="comp-liqrow principal">
            <span className="ld">Suma de alquileres (todas las propiedades)</span>
            <span className="lv">{formatMoney(L.sumaAlquileres)}</span>
          </div>
          {L.ajustesServicios.map((a, i) => (
            <div className="comp-liqrow neg" key={i}>
              <span className="ld">
                {a.descripcion} · total
                {a.numeroLiquidacion && <small> · Liq N° {a.numeroLiquidacion}</small>}
              </span>
              <span className="lv">− {formatMoney(Math.abs(Number(a.monto)))}</span>
            </div>
          ))}
          {honorariosTotal > 0 && (
            <div className="comp-liqrow neg">
              <span className="ld">Honorarios de administración</span>
              <span className="lv">− {formatMoney(honorariosTotal)}</span>
            </div>
          )}
          <div className="comp-liqtotal">
            <span className="ld">Total a liquidar</span>
            <span className="lv" style={{ color: neto >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {formatMoney(neto)}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
