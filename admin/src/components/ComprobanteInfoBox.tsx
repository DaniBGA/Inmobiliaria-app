export interface CampoInfoComprobante {
  label: string;
  valor: string;
}

// Caja de datos del comprobante (pedido del usuario 2026-09-02, "tal cual
// el PDF"): dos columnas de campos rótulo/valor dentro de un recuadro —
// izquierda quién/qué (inquilino, propiedad, contrato), derecha
// número/período/vencimiento. Cada comprobante (Factura/Recibo/Liquidación)
// arma su propia lista de campos porque no comparten la misma forma
// (Liquidación es un propietario con N propiedades, no una sola con un
// contrato) — ver `ComprobanteImpreso.tsx` y los callers.
export function ComprobanteInfoBox({
  izquierda,
  derecha,
}: {
  izquierda: CampoInfoComprobante[];
  derecha: CampoInfoComprobante[];
}) {
  return (
    <div className="comp-infobox">
      <div className="comp-infocol">
        {izquierda.map((c) => (
          <div className="comp-infofila" key={c.label}>
            <b>{c.label}:</b> {c.valor}
          </div>
        ))}
      </div>
      <div className="comp-infocol">
        {derecha.map((c) => (
          <div className="comp-infofila" key={c.label}>
            <b>{c.label}:</b> {c.valor}
          </div>
        ))}
      </div>
    </div>
  );
}
