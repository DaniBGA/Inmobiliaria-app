import { Prisma, PunitorioFrecuencia, PunitorioTipo } from '@prisma/client';

// Vive acá (no en facturas.service.ts) porque tanto FacturasService (ítem
// "Recargo por mora" del mes en curso) como CobrosService (mora acumulada de
// meses ya cerrados, ver `moraAcumulada()`) necesitan el mismo cálculo —
// puesto en cualquiera de los dos services de origen, el otro tendría que
// importarlo cruzado (mismo motivo que `servicios-facturables.util.ts`).
//
// Monto de la mora para `diasAtraso` días, según el tipo/valor/frecuencia
// del punitorio configurado en la propiedad.
export function calcularMontoMora(
  propiedad: {
    punitorioFrecuencia: PunitorioFrecuencia | null;
    punitorioTipo: PunitorioTipo | null;
    punitorioValor: Prisma.Decimal | number | null;
  },
  esperado: number,
  diasAtraso: number,
): number {
  if (!propiedad.punitorioTipo || propiedad.punitorioValor == null || Number(propiedad.punitorioValor) <= 0) {
    return 0;
  }
  if (diasAtraso <= 0) return 0;

  const base =
    propiedad.punitorioTipo === 'PORCENTAJE'
      ? esperado * (Number(propiedad.punitorioValor) / 100)
      : Number(propiedad.punitorioValor);

  // Frecuencia = cada cuánto se aplica el valor de arriba mientras dure el
  // atraso — "DIA" multiplica por cada día atrasado (ej.: mora de
  // $20.000/día, 3 días de atraso → $60.000).
  let unidades: number;
  switch (propiedad.punitorioFrecuencia) {
    case 'SEMANA':
      unidades = Math.ceil(diasAtraso / 7);
      break;
    case 'MES':
      unidades = Math.ceil(diasAtraso / 30);
      break;
    case 'UNICO':
      unidades = 1;
      break;
    case 'DIA':
    default:
      unidades = diasAtraso;
      break;
  }

  return Math.round(base * unidades * 100) / 100;
}
