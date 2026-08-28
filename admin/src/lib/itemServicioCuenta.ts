// Separa el N° de cuenta / usuario de un servicio (Luz, Agua, Gas,
// Retributivas) de la descripción del ítem para mostrarlo en un input
// aparte al editar Factura/Liquidación (pedido del usuario — antes venía
// pegado dentro del nombre del servicio, ej. "Usina (Usuario 123 - N° de
// control 456)").
//
// El backend (`FacturasService.itemsPredeterminados()`) sigue devolviendo
// (y `emitir()`/`generar()` siguen esperando) un único string combinado —
// acá solo se parte para editar y se vuelve a combinar antes de enviar, así
// no hace falta tocar el modelo de datos ni lo ya emitido/impreso.
const SERVICIO_BASES_CON_CUENTA = ['Usina', 'Camuzzi', 'Obras Sanitarias', 'Retributivas de Servicios'];

// Para decidir si un ítem muestra el input de N° de cuenta/usuario — el
// resto (Alquiler, Deuda arrastrada, Mora, gastos trasladados, ítems
// cargados a mano) no tiene ese concepto, así que no corresponde mostrarlo
// (pedido del usuario 2026-08-28).
export function esServicioConCuenta(descripcionBase: string): boolean {
  return SERVICIO_BASES_CON_CUENTA.includes(descripcionBase);
}

export function splitDescripcionCuenta(descripcion: string): { base: string; cuenta: string } {
  for (const base of SERVICIO_BASES_CON_CUENTA) {
    if (descripcion === base) return { base, cuenta: '' };
    const prefijo = `${base} (`;
    if (descripcion.startsWith(prefijo) && descripcion.endsWith(')')) {
      return { base, cuenta: descripcion.slice(prefijo.length, -1) };
    }
  }
  return { base: descripcion, cuenta: '' };
}

export function combinarDescripcionCuenta(base: string, cuenta: string): string {
  const cuentaTrim = cuenta.trim();
  return cuentaTrim ? `${base} (${cuentaTrim})` : base;
}
