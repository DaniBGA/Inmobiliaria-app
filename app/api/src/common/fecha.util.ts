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

export function fechaAMesString(fecha: Date): string {
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function esMesActual(mes: Date, ahora: Date = new Date()): boolean {
  const actual = primerDiaMes(ahora);
  return mes.getTime() === actual.getTime();
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
