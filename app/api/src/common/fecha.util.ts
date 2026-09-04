// Utilidades de fecha compartidas: todos los "mes" del sistema (cobros,
// gastos, facturas, liquidaciones) se normalizan al día 1 del mes en UTC,
// para que las comparaciones y los índices únicos por (propiedad, mes)
// funcionen sin ambigüedad de zona horaria.

export function primerDiaMes(fecha: Date | string): Date {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function mesStringAFecha(mes: string): Date {
  // "YYYY-MM" -> primer día de ese mes en UTC
  const [anio, mesNum] = mes.split('-').map(Number);
  return new Date(Date.UTC(anio, mesNum - 1, 1));
}

// Último instante del mes de `fecha` (día 0 del mes siguiente = último día
// del mes actual). Usado para consultar `rentaVigente(propiedadId, fecha)`
// cuando `fecha` representa un mes completo (no un instante puntual como
// "ahora"): el alquiler inicial o un aumento cargado un día cualquiera de
// ese mes (no necesariamente el 1) igual tiene que contar como vigente
// para todo ese mes, no solo a partir del 1.
export function finDeMes(fecha: Date | string): Date {
  const inicio = primerDiaMes(fecha);
  return new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

export function fechaAMesString(fecha: Date): string {
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}`;
}

// true si `mes` ya cerró (es anterior al mes en curso)
export function mesCerrado(mes: Date, ahora: Date = new Date()): boolean {
  const actual = primerDiaMes(ahora);
  return mes.getTime() < actual.getTime();
}

export function sumarMeses(fecha: Date, meses: number): Date {
  const copia = new Date(fecha);
  copia.setUTCMonth(copia.getUTCMonth() + meses);
  return copia;
}

// Últimos `cantidad` meses cerrados (sin incluir el mes en curso), del más
// antiguo al más reciente — usado para la ventana de deuda de §5.4 (12 meses).
export function ultimosMesesCerrados(cantidad: number, ahora: Date = new Date()): Date[] {
  const actual = primerDiaMes(ahora);
  const meses: Date[] = [];
  for (let i = cantidad; i >= 1; i--) {
    meses.push(sumarMeses(actual, -i));
  }
  return meses;
}

// Días de atraso del alquiler del MES EN CURSO respecto de `diaVencimiento`
// de ese mismo mes — tope en el último día del propio mes: si el calendario
// ya pasó a otro mes sin pagarse, acá deja de sumar (ese saldo pasa a ser
// "Deuda arrastrada" del mes siguiente, no más días de mora de este).
// Distinto de `FacturasService.calcularMora()`, que es retrospectivo sobre
// un mes YA CERRADO y efectivamente pagado (compara contra la fecha real
// del pago, no contra "hoy") — esto es para el mes que todavía sigue
// abierto e impago, usado tanto para el estado "Impago con mora" (§ pedido
// del usuario 2026-09-03) como para el ítem "Recargo por mora" que se
// sugiere al abrir la factura de ese mismo mes.
export function diasDeAtrasoEnMes(mes: Date, diaVencimiento: number, ahora: Date = new Date()): number {
  const vencimiento = new Date(Date.UTC(mes.getUTCFullYear(), mes.getUTCMonth(), diaVencimiento));
  const tope = finDeMes(mes);
  const limite = ahora.getTime() < tope.getTime() ? ahora : tope;
  const dias = Math.floor((limite.getTime() - vencimiento.getTime()) / 86_400_000);
  return dias > 0 ? dias : 0;
}
