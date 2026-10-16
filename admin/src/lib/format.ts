// `maximumFractionDigits: 2` sin `minimumFractionDigits` muestra los
// centavos solo cuando el monto los tiene (nunca ".00" de más en un monto
// redondo) — antes `maximumFractionDigits: 0` los descartaba siempre,
// redondeando para arriba o para abajo cualquier monto con centavos en
// facturas, liquidaciones, cobros, etc. (pedido del usuario 2026-08-18).
export function formatMoney(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return `$ ${v.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
}

export function formatUsd(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return `US$ ${v.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
}

// Interpreta un monto tipeado a mano (o pegado desde afuera, como la
// calculadora de Arquiler embebida) con el formato argentino de miles/
// decimales — "352.520" son trescientos cincuenta y dos mil quinientos
// veinte, no 352,52 (que es lo que da `Number()` a secas, tratando el
// punto como separador decimal a la inglesa — pedido del usuario, la
// calculadora de aumento lo estaba guardando mal).
//
// Con coma: la coma es el separador decimal, cualquier punto es de miles
// ("352.520,50" → 352520.5). Sin coma: un punto seguido de exactamente 3
// dígitos al final se interpreta como separador de miles ("352.520" →
// 352520); si no, es un decimal normal ("352.5" → 352.5).
export function parseMontoArgentino(raw: string): number {
  const limpio = raw.trim();
  if (!limpio) return NaN;
  if (limpio.includes(',')) {
    return Number(limpio.replace(/\./g, '').replace(',', '.'));
  }
  const partes = limpio.split('.');
  if (partes.length > 1 && partes[partes.length - 1].length === 3) {
    return Number(partes.join(''));
  }
  return Number(limpio);
}

export function formatDate(fecha: string | Date | null | undefined): string {
  if (!fecha) return '—';
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
}

// Duración del contrato en meses, para mostrar "N° factura 9/24" en el
// comprobante de liquidación. Los contratos de esta inmobiliaria van de
// `contratoInicio` a un `contratoFin` que es el día ANTERIOR al aniversario
// de N meses (ej. 01/01/2026 a 31/12/2027 = 24 meses) — por eso se le suma
// un día a `contratoFin` antes de restar los calendarios: así el resultado
// da el N exacto en vez de quedar corrido en 1 (contando el mes de inicio
// dos veces) o mal redondeado (dividiendo por días).
export function mesesContrato(contratoInicio: string | Date | null, contratoFin: string | Date | null): number | null {
  if (!contratoInicio || !contratoFin) return null;
  const inicio = typeof contratoInicio === 'string' ? new Date(contratoInicio) : contratoInicio;
  const finMasUnDia = new Date(typeof contratoFin === 'string' ? new Date(contratoFin) : contratoFin);
  finMasUnDia.setUTCDate(finMasUnDia.getUTCDate() + 1);
  const meses = (finMasUnDia.getUTCFullYear() - inicio.getUTCFullYear()) * 12 + (finMasUnDia.getUTCMonth() - inicio.getUTCMonth());
  return meses > 0 ? meses : null;
}

export function mesActualStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Mismo criterio que `FacturasService.calcularMora()` en el backend
// (`facturas.service.ts`): el vencimiento de un mes es el día
// `diaVencimientoAlquiler` (Configuración) de ESE mes, no del siguiente —
// se replica acá para mostrarlo en el comprobante sin pedirlo a la API.
export function fechaVencimientoAlquiler(mesStr: string, diaVencimientoAlquiler: number): Date {
  const [anio, mes] = mesStr.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, diaVencimientoAlquiler));
}

export function sumarMesesStr(mesStr: string, delta: number): string {
  const [anio, mes] = mesStr.split('-').map(Number);
  const d = new Date(Date.UTC(anio, mes - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export function mesLabel(mesStr: string): string {
  const [anio, mes] = mesStr.split('-').map(Number);
  return `${MESES[mes - 1]} ${anio}`;
}

export function hoyLabel(): string {
  return new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// Cartel de "alerta de aumento" (pedido del usuario 2026-10-15, en las
// tarjetas de "Inquilinos y Cobros" y al lado de ESPERADO en "COBROS DEL
// MES") — centralizado acá para no repetir la cuenta en cada pantalla
// nueva que lo necesite. `proximoAumento` es la fecha que ya devuelve
// `PropiedadesService.proximoAumento()` en el backend (null si no
// corresponde: vacante, sin frecuencia/contrato, o el contrato termina
// antes de que llegue el próximo aumento).
//
// Ajustado 2026-10-16 (pedido del usuario: "que la alerta de aumento...
// aparezca solo en el mes que se va a realizar el aumento, no que se
// muestre siempre"): antes "PROXIMO" se prendía hasta
// `Configuracion.diasAnticipacionAumento` días ANTES de la fecha (30 por
// default) — con eso, un aumento de noviembre ya aparecía en octubre y
// seguía prendido todo noviembre, dando la sensación de estar "siempre"
// encendido. Ahora "PROXIMO" es directamente "la fecha cae en el mes de
// referencia", sin ventana de anticipación. `diasAnticipacionAumento`
// sigue existiendo y se sigue usando tal cual para el aviso proactivo de
// `AvisosService.avisosAumento()` (un recordatorio aparte, pensado para
// avisarle al inquilino con anticipación) — no se tocó ese.
//
// Ajustado de nuevo 2026-10-16 (2) (pedido del usuario: "en 'COBROS DEL
// MES' si me muevo al mes que tiene aumento aparezca... el aumento"):
// `mesReferencia` (opcional, formato "YYYY-MM") deja elegir CONTRA QUÉ
// mes se compara `proximoAumento` — las tarjetas de propiedades (sin
// navegador de mes) siguen usando el default, "hoy" real; "COBROS DEL
// MES" (que sí tiene navegador ‹ mes ›) le pasa el mes seleccionado, así
// que si el usuario navega hacia adelante hasta el mes del aumento, el
// cartel aparece ahí aunque todavía falten meses para que ese mes
// llegue de verdad.
export type EstadoAumento = 'VENCIDO' | 'PROXIMO' | null;

export function estadoAumento(proximoAumento: string | Date | null | undefined, mesReferencia?: string): EstadoAumento {
  if (!proximoAumento) return null;
  const fecha = new Date(proximoAumento);
  let referencia: Date;
  if (mesReferencia) {
    const [anio, mes] = mesReferencia.split('-').map(Number);
    referencia = new Date(Date.UTC(anio, mes - 1, 1));
  } else {
    referencia = new Date();
  }
  // El chequeo de "mismo mes" va PRIMERO a propósito: `fecha` siempre es
  // medianoche UTC del día 1 (así se normaliza todo "mes" en este
  // sistema) — comparar `fecha < referencia` primero marcaría VENCIDO
  // desde el minuto 1 del mes correcto (ya pasó esa medianoche), aunque
  // siga siendo el mes en el que corresponde aplicarlo. "Mismo mes" tiene
  // que ganar siempre que sea cierto.
  const mismoMes = fecha.getUTCFullYear() === referencia.getUTCFullYear() && fecha.getUTCMonth() === referencia.getUTCMonth();
  if (mismoMes) return 'PROXIMO';
  return fecha.getTime() < referencia.getTime() ? 'VENCIDO' : null;
}

// Nombre de archivo por defecto al descargar un comprobante (pedido del
// usuario 2026-10-15: "el nombre de el archivo sea por defecto: (nombre
// de el cliente/propietario) + mes + año", en vez del "Liquidacion 172 -
// Juan Perez.pdf"/"Factura 86 - depto urlingam.pdf" de antes). `nombre` es
// el inquilino para Factura/Recibo o el propietario para Liquidación —
// decide el caller, acá solo arma y sanea el string final. Se sacan los
// caracteres inválidos en un nombre de archivo de Windows (`\ / : * ? " <
// > |`) y se recortan espacios/puntos sueltos al final (tampoco válidos
// ahí) — un nombre de propietario/inquilino nunca debería tener ninguno
// de estos, pero mejor no confiar en que el dato cargado a mano sea
// siempre limpio.
export function nombreArchivoComprobante(nombre: string, mesStr: string): string {
  const base = `${nombre} ${mesLabel(mesStr)}`.replace(/[\\/:*?"<>|]/g, '').trim().replace(/[. ]+$/, '');
  return `${base}.pdf`;
}
